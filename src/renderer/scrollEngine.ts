/**
 * Scroll Engine
 * Human-like scrolling to trigger lazy-loaded content
 */

import type { Page } from 'playwright';
import type { ScrollConfig } from '../types/index.js';
import { randomDelay, jitteredDelay } from '../utils/timing.js';

export interface ScrollResult {
    scrollsPerformed: number;
    totalHeight: number;
    finalPosition: number;
    contentChanges: number;
}

/**
 * Perform human-like scrolling on a page
 */
export async function performScroll(
    page: Page,
    config: ScrollConfig
): Promise<ScrollResult> {
    if (!config.enabled) {
        return {
            scrollsPerformed: 0,
            totalHeight: 0,
            finalPosition: 0,
            contentChanges: 0,
        };
    }

    const { max_scrolls, delay_ms } = config;
    let scrollsPerformed = 0;
    let contentChanges = 0;
    let previousHeight = 0;
    let previousContentLength = 0;

    // Get initial state
    const initialState = await page.evaluate(() => ({
        height: document.body.scrollHeight,
        contentLength: document.body.innerHTML.length,
    }));
    previousHeight = initialState.height;
    previousContentLength = initialState.contentLength;

    for (let i = 0; i < max_scrolls; i++) {
        // Calculate scroll amount (varies to look human)
        const viewportHeight = page.viewportSize()?.height || 768;
        const scrollAmount = Math.floor(viewportHeight * (0.6 + Math.random() * 0.3));

        // Perform scroll
        await page.evaluate((amount) => {
            window.scrollBy({
                top: amount,
                behavior: 'smooth',
            });
        }, scrollAmount);

        scrollsPerformed++;

        // Wait for content to load
        await jitteredDelay(delay_ms, 25);

        // Check for new content
        const currentState = await page.evaluate(() => ({
            height: document.body.scrollHeight,
            contentLength: document.body.innerHTML.length,
            scrollPosition: window.scrollY,
        }));

        // Detect if new content was loaded
        if (
            currentState.height > previousHeight ||
            currentState.contentLength > previousContentLength * 1.02
        ) {
            contentChanges++;
            previousHeight = currentState.height;
            previousContentLength = currentState.contentLength;

            // Extra wait for newly loaded content
            await randomDelay(200, 500);
        }

        // Check if we've reached the bottom
        const atBottom = await page.evaluate(() => {
            return (window.innerHeight + window.scrollY) >= document.body.scrollHeight - 100;
        });

        if (atBottom) {
            // Try scrolling past the bottom to trigger infinite scroll
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight + 1000);
            });
            await jitteredDelay(delay_ms);

            // Check if more content loaded
            const newHeight = await page.evaluate(() => document.body.scrollHeight);
            if (newHeight <= previousHeight) {
                // No new content, we're done
                break;
            }

            contentChanges++;
            previousHeight = newHeight;
        }

        // Occasional pause (human behavior)
        if (Math.random() < 0.2) {
            await randomDelay(500, 1500);
        }
    }

    // Get final state
    const finalState = await page.evaluate(() => ({
        totalHeight: document.body.scrollHeight,
        finalPosition: window.scrollY,
    }));

    // Scroll back to top (optional, matches some user behavior)
    // Commented out as many scraping use cases want the final state
    // await page.evaluate(() => window.scrollTo(0, 0));

    return {
        scrollsPerformed,
        totalHeight: finalState.totalHeight,
        finalPosition: finalState.finalPosition,
        contentChanges,
    };
}

/**
 * Scroll to a specific element
 */
export async function scrollToElement(
    page: Page,
    selector: string,
    options: { behavior?: 'smooth' | 'instant'; timeout?: number } = {}
): Promise<boolean> {
    const { behavior = 'smooth', timeout = 5000 } = options;

    try {
        const element = await page.waitForSelector(selector, { timeout });
        if (!element) return false;

        await element.scrollIntoViewIfNeeded();

        if (behavior === 'smooth') {
            // Enhanced smooth scroll
            await page.evaluate(
                ([sel]) => {
                    const el = document.querySelector(sel);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                },
                [selector]
            );
            await randomDelay(300, 600);
        }

        return true;
    } catch {
        return false;
    }
}

/**
 * Scroll in random patterns (more human-like)
 */
export async function randomScroll(page: Page): Promise<void> {
    const viewportHeight = page.viewportSize()?.height || 768;

    // Random direction
    const direction = Math.random() > 0.3 ? 1 : -1;
    const amount = Math.floor(viewportHeight * (0.3 + Math.random() * 0.5)) * direction;

    await page.evaluate((scrollAmount) => {
        window.scrollBy({
            top: scrollAmount,
            behavior: Math.random() > 0.5 ? 'smooth' : 'auto',
        });
    }, amount);

    await randomDelay(100, 300);
}
