/**
 * Block Detection Utilities
 * Detects access denied, bot challenges, and rate limiting
 */

import type { Page, Response } from 'playwright';

export interface BlockDetectionResult {
    blocked: boolean;
    reason?: 'access_denied' | 'bot_challenge' | 'rate_limited' | 'geo_blocked' | 'ip_blocked' | 'unknown';
    provider?: 'cloudflare' | 'akamai' | 'datadome' | 'perimeterx' | 'imperva' | 'unknown';
    confidence: 'high' | 'medium' | 'low';
    httpStatus?: number;
    details?: string;
}

// Block detection patterns by provider
const BLOCK_PATTERNS = {
    cloudflare: {
        textPatterns: [
            /access denied/i,
            /error 1015/i, // Rate limited
            /error 1020/i, // Access denied
            /error 1006/i, // Access denied
            /error 1007/i, // Access denied
            /ray id:/i,
            /cloudflare/i,
            /sorry, you have been blocked/i,
        ],
        statusCodes: [403, 503, 429],
    },
    akamai: {
        textPatterns: [
            /access denied/i,
            /akamai/i,
            /reference #/i,
            /request blocked/i,
        ],
        statusCodes: [403, 503],
    },
    datadome: {
        textPatterns: [
            /datadome/i,
            /captcha.*datadome/i,
        ],
        statusCodes: [403],
    },
    perimeterx: {
        textPatterns: [
            /perimeterx/i,
            /px-captcha/i,
            /human challenge/i,
        ],
        statusCodes: [403],
    },
    imperva: {
        textPatterns: [
            /incapsula/i,
            /imperva/i,
            /request unsuccessful/i,
        ],
        statusCodes: [403],
    },
};

// Generic block patterns
const GENERIC_BLOCK_PATTERNS = [
    /access denied/i,
    /403 forbidden/i,
    /request blocked/i,
    /you don't have permission/i,
    /you have been blocked/i,
    /suspicious activity/i,
    /unusual traffic/i,
    /too many requests/i,
    /rate limit/i,
    /temporarily unavailable/i,
    /please try again later/i,
];

/**
 * Detect if a page has been blocked
 */
export async function detectBlock(page: Page, response?: Response | null): Promise<BlockDetectionResult> {
    try {
        const httpStatus = response?.status() || 200;

        // First check HTTP status codes
        if (httpStatus === 403 || httpStatus === 429 || httpStatus === 503) {
            const content = await page.content();
            const bodyText = await page.evaluate(() => document.body?.innerText || '');

            // Check for known providers
            for (const [provider, patterns] of Object.entries(BLOCK_PATTERNS)) {
                if (patterns.statusCodes.includes(httpStatus)) {
                    for (const pattern of patterns.textPatterns) {
                        if (pattern.test(content) || pattern.test(bodyText)) {
                            return {
                                blocked: true,
                                reason: httpStatus === 429 ? 'rate_limited' : 'access_denied',
                                provider: provider as BlockDetectionResult['provider'],
                                confidence: 'high',
                                httpStatus,
                            };
                        }
                    }
                }
            }

            // Generic block detection
            return {
                blocked: true,
                reason: httpStatus === 429 ? 'rate_limited' : 'access_denied',
                provider: 'unknown',
                confidence: 'medium',
                httpStatus,
            };
        }

        // Check page content for block indicators even on 200 responses
        // (Some sites return 200 with a challenge page)
        const pageText = await page.evaluate(() => document.body?.innerText || '');
        const pageTitle = await page.title();

        // Check for bot challenge indicators
        for (const [provider, patterns] of Object.entries(BLOCK_PATTERNS)) {
            for (const pattern of patterns.textPatterns) {
                if (pattern.test(pageText) || pattern.test(pageTitle)) {
                    return {
                        blocked: true,
                        reason: 'bot_challenge',
                        provider: provider as BlockDetectionResult['provider'],
                        confidence: 'medium',
                        httpStatus,
                    };
                }
            }
        }

        // Check generic patterns
        for (const pattern of GENERIC_BLOCK_PATTERNS) {
            if (pattern.test(pageText) && pageText.length < 5000) {
                // Short pages with block-like text are likely block pages
                return {
                    blocked: true,
                    reason: 'access_denied',
                    provider: 'unknown',
                    confidence: 'low',
                    httpStatus,
                };
            }
        }

        // Check for empty or minimal content (might indicate JS challenge)
        const contentLength = pageText.trim().length;
        if (contentLength < 100 && httpStatus === 200) {
            // Very short content might indicate a challenge page
            const hasScripts = await page.$$eval('script', scripts => scripts.length);
            if (hasScripts > 5) {
                return {
                    blocked: true,
                    reason: 'bot_challenge',
                    provider: 'unknown',
                    confidence: 'low',
                    httpStatus,
                    details: 'Page has minimal content but many scripts - possible JS challenge',
                };
            }
        }

        return {
            blocked: false,
            confidence: 'high',
            httpStatus,
        };
    } catch (error) {
        return {
            blocked: false,
            confidence: 'low',
            details: `Detection error: ${error}`,
        };
    }
}

/**
 * Check if a response indicates a block based on headers
 */
export function checkBlockHeaders(response: Response): boolean {
    const headers = response.headers();

    // Check for common block-related headers
    const blockIndicators = [
        'cf-mitigated',
        'x-datadome',
        'x-px-',
        'x-incapsula',
    ];

    for (const indicator of blockIndicators) {
        for (const header of Object.keys(headers)) {
            if (header.toLowerCase().includes(indicator)) {
                return true;
            }
        }
    }

    return false;
}
