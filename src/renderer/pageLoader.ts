/**
 * Page Loader
 * Handles navigation with configurable wait strategies
 */

import type { Page, Response } from 'playwright';
import type { RenderConfig } from '../types/index.js';
import { withTimeout } from '../utils/timing.js';

export interface NavigationResult {
    success: boolean;
    response: Response | null;
    finalUrl: string;
    httpStatus: number;
    loadTimeMs: number;
    error?: string;
}

/**
 * Map our wait_until values to Playwright's
 */
function mapWaitUntil(
    waitUntil: RenderConfig['wait_until']
): 'load' | 'domcontentloaded' | 'networkidle' | 'commit' {
    const mapping: Record<string, 'load' | 'domcontentloaded' | 'networkidle' | 'commit'> = {
        load: 'load',
        domcontentloaded: 'domcontentloaded',
        networkidle: 'networkidle',
        commit: 'commit',
    };
    return mapping[waitUntil] || 'networkidle';
}

/**
 * Navigate to a URL with configurable wait strategy
 */
export async function loadPage(
    page: Page,
    url: string,
    config: RenderConfig
): Promise<NavigationResult> {
    const startTime = performance.now();
    const { wait_until, timeout_ms, javascript } = config;

    // Disable JavaScript if requested
    if (!javascript) {
        await page.context().route('**/*', (route) => {
            const resourceType = route.request().resourceType();
            if (resourceType === 'script') {
                return route.abort();
            }
            return route.continue();
        });
    }

    try {
        // Navigate with timeout
        const response = await withTimeout(
            page.goto(url, {
                waitUntil: mapWaitUntil(wait_until),
                timeout: timeout_ms,
            }),
            timeout_ms + 5000, // Add buffer for our timeout wrapper
            `Navigation timeout after ${timeout_ms}ms`
        );

        const loadTimeMs = Math.round(performance.now() - startTime);

        // Handle null response (can happen with some redirects)
        if (!response) {
            return {
                success: true,
                response: null,
                finalUrl: page.url(),
                httpStatus: 200, // Assume success if page loaded without error
                loadTimeMs,
            };
        }

        return {
            success: true,
            response,
            finalUrl: page.url(),
            httpStatus: response.status(),
            loadTimeMs,
        };
    } catch (error) {
        const loadTimeMs = Math.round(performance.now() - startTime);
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check if it's a timeout
        if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
            return {
                success: false,
                response: null,
                finalUrl: page.url() || url,
                httpStatus: 0,
                loadTimeMs,
                error: `Navigation timeout: ${timeout_ms}ms exceeded`,
            };
        }

        // Check for network errors
        if (errorMessage.includes('net::') || errorMessage.includes('ERR_')) {
            return {
                success: false,
                response: null,
                finalUrl: url,
                httpStatus: 0,
                loadTimeMs,
                error: `Network error: ${errorMessage}`,
            };
        }

        return {
            success: false,
            response: null,
            finalUrl: url,
            httpStatus: 0,
            loadTimeMs,
            error: errorMessage,
        };
    }
}

/**
 * Wait for additional conditions after page load
 */
export async function waitForStability(
    page: Page,
    options: {
        timeout?: number;
        checkInterval?: number;
        stableThreshold?: number;
    } = {}
): Promise<boolean> {
    const { timeout = 5000, checkInterval = 200, stableThreshold = 2 } = options;

    let previousLength = 0;
    let stableCount = 0;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        const currentLength = await page.evaluate(() => document.body.innerHTML.length);

        if (currentLength === previousLength) {
            stableCount++;
            if (stableCount >= stableThreshold) {
                return true;
            }
        } else {
            stableCount = 0;
            previousLength = currentLength;
        }

        await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    return false;
}

/**
 * Wait for specific network activity to complete
 */
export async function waitForNetwork(
    page: Page,
    options: {
        timeout?: number;
        idleTime?: number;
        allowedInFlight?: number;
    } = {}
): Promise<boolean> {
    const { timeout = 10000, idleTime = 500, allowedInFlight = 0 } = options;

    let inFlightRequests = 0;
    let lastActiveTime = Date.now();

    const onRequest = () => {
        inFlightRequests++;
        lastActiveTime = Date.now();
    };

    const onResponse = () => {
        inFlightRequests = Math.max(0, inFlightRequests - 1);
        if (inFlightRequests <= allowedInFlight) {
            lastActiveTime = Date.now();
        }
    };

    page.on('request', onRequest);
    page.on('response', onResponse);
    page.on('requestfailed', onResponse);

    try {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            if (
                inFlightRequests <= allowedInFlight &&
                Date.now() - lastActiveTime >= idleTime
            ) {
                return true;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        return false;
    } finally {
        page.off('request', onRequest);
        page.off('response', onResponse);
        page.off('requestfailed', onResponse);
    }
}

/**
 * Extract the final HTML content
 */
export async function extractHtml(page: Page): Promise<string> {
    return page.content();
}

/**
 * Get the page title
 */
export async function getPageTitle(page: Page): Promise<string> {
    try {
        return await page.title();
    } catch {
        return '';
    }
}
