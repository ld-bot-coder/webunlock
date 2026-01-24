/**
 * Wait Condition Handler
 * Implements CSS and JavaScript-based waiting (Crawl4AI-style)
 */

import type { Page } from 'playwright';
import { withTimeout } from './timing.js';

export interface WaitResult {
    success: boolean;
    error?: string;
    durationMs: number;
}

/**
 * Parse and execute a wait_for condition
 * Supports:
 * - "css:.selector" - Wait for CSS selector
 * - "js:() => condition" - Wait for JS condition to return true
 */
export async function executeWaitFor(
    page: Page,
    waitFor: string,
    timeoutMs: number = 30000
): Promise<WaitResult> {
    const startTime = performance.now();

    try {
        if (waitFor.startsWith('css:')) {
            // CSS-based waiting
            const selector = waitFor.slice(4).trim();
            await withTimeout(
                page.waitForSelector(selector, { state: 'attached', timeout: timeoutMs }),
                timeoutMs,
                `CSS wait timeout for selector: ${selector}`
            );

            return {
                success: true,
                durationMs: Math.round(performance.now() - startTime),
            };
        } else if (waitFor.startsWith('js:')) {
            // JavaScript-based waiting
            const jsCondition = waitFor.slice(3).trim();

            await withTimeout(
                page.waitForFunction(jsCondition, { timeout: timeoutMs }),
                timeoutMs,
                `JS wait condition timeout`
            );

            return {
                success: true,
                durationMs: Math.round(performance.now() - startTime),
            };
        } else {
            // Treat as plain CSS selector (backward compatible)
            await withTimeout(
                page.waitForSelector(waitFor, { state: 'attached', timeout: timeoutMs }),
                timeoutMs,
                `Wait timeout for selector: ${waitFor}`
            );

            return {
                success: true,
                durationMs: Math.round(performance.now() - startTime),
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            durationMs: Math.round(performance.now() - startTime),
        };
    }
}

/**
 * Execute JavaScript code on the page
 */
export async function executeJsCode(
    page: Page,
    jsCode: string | string[],
    options: { delayBetweenMs?: number } = {}
): Promise<{ success: boolean; results: unknown[]; error?: string }> {
    const { delayBetweenMs = 100 } = options;
    const scripts = Array.isArray(jsCode) ? jsCode : [jsCode];
    const results: unknown[] = [];

    try {
        for (const script of scripts) {
            const result = await page.evaluate(script);
            results.push(result);

            // Small delay between scripts
            if (delayBetweenMs > 0 && scripts.length > 1) {
                await new Promise(resolve => setTimeout(resolve, delayBetweenMs));
            }
        }

        return { success: true, results };
    } catch (error) {
        return {
            success: false,
            results,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Common wait conditions as presets
 */
export const WAIT_PRESETS = {
    // Wait for page to have substantial content
    contentLoaded: 'js:() => document.body.innerText.length > 100',

    // Wait for no pending network requests
    networkIdle: 'js:() => !window.fetch || true',

    // Wait for document ready
    documentReady: 'js:() => document.readyState === "complete"',

    // Wait for images to load
    imagesLoaded: 'js:() => Array.from(document.images).every(img => img.complete)',

    // Wait for lazy-loaded content (content length stabilized)
    contentStable: `js:() => {
    if (!window._lastContentLength) {
      window._lastContentLength = document.body.innerHTML.length;
      window._stableCount = 0;
      return false;
    }
    if (document.body.innerHTML.length === window._lastContentLength) {
      window._stableCount++;
      return window._stableCount >= 3;
    }
    window._lastContentLength = document.body.innerHTML.length;
    window._stableCount = 0;
    return false;
  }`,
};
