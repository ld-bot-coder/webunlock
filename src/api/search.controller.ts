/**
 * Google Search Controller
 * Specialized endpoint for Google Search with maximum anti-detection
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuid } from 'uuid';
import { getBrowserPool } from '../browser/browserPool.js';
import { getRateLimiter, createRateLimitHeaders } from './rate-limiter.js';
import type { Page } from 'playwright';

interface SearchRequest {
    keyword: string;
    num_results?: number;
    country?: string; // e.g., 'in' for India, 'us' for US
}

interface SearchResult {
    title: string;
    url: string;
    snippet: string;
    position: number;
}

interface SearchResponse {
    success: boolean;
    request_id: string;
    keyword: string;
    results: SearchResult[];
    total_results?: string;
    errors?: Array<{ code: string; message: string }>;
    timestamp: string;
}

/**
 * Human-like delays
 */
async function humanDelay(min: number = 200, max: number = 600): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Type like a human with variable delays
 */
async function humanType(page: Page, text: string): Promise<void> {
    for (const char of text) {
        await page.keyboard.type(char, { delay: Math.floor(Math.random() * 80) + 40 });
        // Occasional pause
        if (Math.random() < 0.08) {
            await humanDelay(100, 250);
        }
    }
}

/**
 * Random mouse movement
 */
async function randomMouseMove(page: Page): Promise<void> {
    const viewport = page.viewportSize();
    if (!viewport) return;

    const x = Math.floor(Math.random() * viewport.width * 0.6) + viewport.width * 0.2;
    const y = Math.floor(Math.random() * viewport.height * 0.6) + viewport.height * 0.2;

    await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
}

/**
 * Handle cookie consent dialogs
 */
async function handleCookieConsent(page: Page): Promise<void> {
    try {
        // Google cookie consent (multiple variants)
        const consentSelectors = [
            'button:has-text("Accept all")',
            'button:has-text("I agree")',
            'button:has-text("Agree")',
            '[aria-label="Accept all"]',
            '#L2AGLb', // Google's consent button ID
            'button[jsname="higCR"]',
        ];

        for (const selector of consentSelectors) {
            const button = await page.$(selector);
            if (button && await button.isVisible()) {
                await humanDelay(300, 600);
                await button.click();
                await humanDelay(500, 1000);
                break;
            }
        }
    } catch {
        // Consent handling is optional
    }
}

/**
 * Parse Google search results
 */
async function parseSearchResults(page: Page, maxResults: number): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // Wait for results to load
    await page.waitForSelector('#search', { timeout: 10000 }).catch(() => { });

    // Get organic results (skip ads)
    const resultElements = await page.$$('#search .g:not(.uEierd)');

    let position = 1;
    for (const element of resultElements) {
        if (results.length >= maxResults) break;

        try {
            const titleEl = await element.$('h3');
            const linkEl = await element.$('a[href^="http"]');
            const snippetEl = await element.$('[data-sncf], .VwiC3b, .yXK7lf');

            if (titleEl && linkEl) {
                const title = await titleEl.textContent() || '';
                const url = await linkEl.getAttribute('href') || '';
                const snippet = snippetEl ? await snippetEl.textContent() || '' : '';

                if (url && !url.includes('google.com/search')) {
                    results.push({
                        title: title.trim(),
                        url: url.trim(),
                        snippet: snippet.trim(),
                        position,
                    });
                    position++;
                }
            }
        } catch {
            continue;
        }
    }

    return results;
}

/**
 * Get total results count
 */
async function getTotalResults(page: Page): Promise<string | undefined> {
    try {
        const resultStats = await page.$('#result-stats');
        if (resultStats) {
            const text = await resultStats.textContent();
            return text?.trim();
        }
    } catch {
        // Optional
    }
    return undefined;
}

/**
 * Check for CAPTCHA or unusual traffic detection
 */
async function checkForBlock(page: Page): Promise<string | null> {
    try {
        // Wait for page to stabilize
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => { });

        const url = page.url();

        if (url.includes('/sorry/')) {
            return 'CAPTCHA_DETECTED';
        }

        // Safely get content
        const content = await page.content().catch(() => '');

        if (content.includes('unusual traffic') || content.includes('Our systems have detected')) {
            return 'UNUSUAL_TRAFFIC';
        }
    } catch {
        // Ignore errors during block check
    }

    return null;
}

/**
 * Handle POST /v1/search
 */
export async function handleGoogleSearch(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    const requestId = uuid();
    const startTime = Date.now();

    // Get client IP for rate limiting
    const forwarded = request.headers['x-forwarded-for'];
    const clientIp = forwarded
        ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]).trim()
        : request.ip || 'unknown';

    request.log.info({ requestId, clientIp }, 'Google Search request');

    // Rate limit check
    const rateLimiter = getRateLimiter();
    const rateLimit = rateLimiter.isAllowed(clientIp);

    const rateLimitHeaders = createRateLimitHeaders(rateLimit.remaining, rateLimit.resetAt);
    for (const [key, value] of Object.entries(rateLimitHeaders)) {
        reply.header(key, value);
    }

    if (!rateLimit.allowed) {
        reply.status(429).send({
            success: false,
            request_id: requestId,
            keyword: '',
            results: [],
            errors: [{ code: 'RATE_LIMITED', message: 'Too many requests' }],
            timestamp: new Date().toISOString(),
        } as SearchResponse);
        return;
    }

    // Validate request
    const body = request.body as SearchRequest;
    if (!body?.keyword || typeof body.keyword !== 'string' || body.keyword.trim().length === 0) {
        reply.status(400).send({
            success: false,
            request_id: requestId,
            keyword: '',
            results: [],
            errors: [{ code: 'VALIDATION_ERROR', message: 'keyword is required' }],
            timestamp: new Date().toISOString(),
        } as SearchResponse);
        return;
    }

    const keyword = body.keyword.trim();
    const numResults = Math.min(body.num_results || 10, 50);
    const country = body.country || 'in';

    let context: { page: Page; cleanup: () => Promise<void> } | null = null;

    try {
        // Acquire browser context
        const pool = getBrowserPool();
        context = await pool.acquire({
            browser: {
                user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1366, height: 768 },
                locale: country === 'in' ? 'en-IN' : 'en-US',
                timezone: country === 'in' ? 'Asia/Kolkata' : 'America/New_York',
            },
        });

        const { page } = context;

        // === STEALTH: Initial setup ===
        // Random delay before starting
        await humanDelay(500, 1000);

        // Go to Google homepage first (more natural)
        const googleUrl = country === 'in' ? 'https://www.google.co.in/' : 'https://www.google.com/';
        await page.goto(googleUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Handle cookie consent
        await handleCookieConsent(page);

        // Wait and move mouse (human behavior)
        await humanDelay(800, 1500);
        await randomMouseMove(page);

        // Find search box and click it
        const searchBox = await page.$('textarea[name="q"], input[name="q"]');
        if (!searchBox) {
            throw new Error('Search box not found');
        }

        await humanDelay(200, 400);
        await searchBox.click();
        await humanDelay(300, 500);

        // Type the search query (human-like)
        await humanType(page, keyword);

        // Random pause before submitting
        await humanDelay(400, 800);

        // Press Enter to search
        await page.keyboard.press('Enter');

        // Wait for search results page
        await page.waitForURL(/search/, { timeout: 15000 }).catch(() => { });
        await page.waitForSelector('#search', { timeout: 10000 }).catch(() => { });
        await humanDelay(800, 1500);

        // Check for blocks
        const blockReason = await checkForBlock(page);
        if (blockReason) {
            throw new Error(blockReason);
        }

        // Scroll a bit (human behavior)
        await page.mouse.wheel(0, Math.floor(Math.random() * 200) + 100);
        await humanDelay(300, 600);

        // Parse results
        const results = await parseSearchResults(page, numResults);
        const totalResults = await getTotalResults(page);

        const duration = Date.now() - startTime;
        request.log.info({ requestId, duration, resultCount: results.length }, 'Search complete');

        reply.send({
            success: true,
            request_id: requestId,
            keyword,
            results,
            total_results: totalResults,
            timestamp: new Date().toISOString(),
        } as SearchResponse);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        request.log.error({ requestId, error: errorMessage }, 'Search failed');

        let errorCode = 'SEARCH_ERROR';
        if (errorMessage.includes('CAPTCHA')) errorCode = 'CAPTCHA_DETECTED';
        if (errorMessage.includes('UNUSUAL')) errorCode = 'BLOCKED';

        reply.status(500).send({
            success: false,
            request_id: requestId,
            keyword,
            results: [],
            errors: [{ code: errorCode, message: errorMessage }],
            timestamp: new Date().toISOString(),
        } as SearchResponse);
    } finally {
        if (context) {
            await context.cleanup();
        }
    }
}
