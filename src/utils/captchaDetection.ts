/**
 * CAPTCHA Detection Utilities
 * Detects common CAPTCHA providers without solving them
 */

import type { Page } from 'playwright';

export interface CaptchaDetectionResult {
    detected: boolean;
    type?: 'recaptcha' | 'hcaptcha' | 'cloudflare' | 'arkose' | 'custom' | 'unknown';
    confidence: 'high' | 'medium' | 'low';
    selector?: string;
}

// CAPTCHA detection patterns
const CAPTCHA_PATTERNS = {
    recaptcha: {
        selectors: [
            'iframe[src*="google.com/recaptcha"]',
            'iframe[src*="recaptcha.net"]',
            '.g-recaptcha',
            '#g-recaptcha',
            '[data-sitekey]',
        ],
        textPatterns: [
            /recaptcha/i,
            /i'm not a robot/i,
            /verify you're human/i,
        ],
    },
    hcaptcha: {
        selectors: [
            'iframe[src*="hcaptcha.com"]',
            '.h-captcha',
            '[data-hcaptcha-sitekey]',
        ],
        textPatterns: [
            /hcaptcha/i,
        ],
    },
    cloudflare: {
        selectors: [
            'iframe[src*="challenges.cloudflare.com"]',
            '#cf-turnstile',
            '.cf-turnstile',
            '#challenge-form',
        ],
        textPatterns: [
            /checking your browser/i,
            /cloudflare/i,
            /attention required/i,
            /just a moment/i,
            /ray id/i,
        ],
    },
    arkose: {
        selectors: [
            'iframe[src*="arkoselabs.com"]',
            'iframe[src*="funcaptcha.com"]',
        ],
        textPatterns: [
            /arkose/i,
            /funcaptcha/i,
        ],
    },
};

/**
 * Detect CAPTCHA presence on a page
 */
export async function detectCaptcha(page: Page): Promise<CaptchaDetectionResult> {
    try {
        // Check for known CAPTCHA selectors
        for (const [type, patterns] of Object.entries(CAPTCHA_PATTERNS)) {
            for (const selector of patterns.selectors) {
                try {
                    const element = await page.$(selector);
                    if (element) {
                        return {
                            detected: true,
                            type: type as CaptchaDetectionResult['type'],
                            confidence: 'high',
                            selector,
                        };
                    }
                } catch {
                    // Selector not found, continue
                }
            }
        }

        // Check page content for CAPTCHA text patterns
        const pageContent = await page.content();
        const pageText = await page.evaluate(() => document.body?.innerText || '');

        for (const [type, patterns] of Object.entries(CAPTCHA_PATTERNS)) {
            for (const pattern of patterns.textPatterns) {
                if (pattern.test(pageContent) || pattern.test(pageText)) {
                    return {
                        detected: true,
                        type: type as CaptchaDetectionResult['type'],
                        confidence: 'medium',
                    };
                }
            }
        }

        // Check for generic CAPTCHA indicators
        const genericPatterns = [
            /captcha/i,
            /prove you're human/i,
            /human verification/i,
            /security check/i,
            /are you a robot/i,
        ];

        for (const pattern of genericPatterns) {
            if (pattern.test(pageText)) {
                return {
                    detected: true,
                    type: 'unknown',
                    confidence: 'low',
                };
            }
        }

        return { detected: false, confidence: 'high' };
    } catch (error) {
        // If detection fails, assume no CAPTCHA but with low confidence
        return { detected: false, confidence: 'low' };
    }
}

/**
 * Quick check for common CAPTCHA iframes (faster than full detection)
 */
export async function quickCaptchaCheck(page: Page): Promise<boolean> {
    try {
        const captchaIframes = await page.$$('iframe[src*="captcha"], iframe[src*="challenge"]');
        return captchaIframes.length > 0;
    } catch {
        return false;
    }
}
