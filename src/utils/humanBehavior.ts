/**
 * Human Behavior Simulation
 * Makes browser interactions look natural and human-like
 */

import type { Page } from 'playwright';

/**
 * Random delay between actions (human-like timing)
 */
export async function humanDelay(min: number = 200, max: number = 800): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Short delay for quick actions
 */
export async function shortDelay(): Promise<void> {
    await humanDelay(50, 150);
}

/**
 * Medium delay for reading/thinking
 */
export async function mediumDelay(): Promise<void> {
    await humanDelay(300, 700);
}

/**
 * Long delay for page load waiting
 */
export async function longDelay(): Promise<void> {
    await humanDelay(1000, 2000);
}

/**
 * Type text like a human (with variable speed and occasional pauses)
 */
export async function humanType(page: Page, selector: string, text: string): Promise<void> {
    await page.click(selector);
    await shortDelay();

    for (const char of text) {
        await page.keyboard.type(char, { delay: getTypingDelay() });

        // Occasional pause (like thinking)
        if (Math.random() < 0.05) {
            await humanDelay(100, 300);
        }
    }
}

/**
 * Get random typing delay (faster for common letters, slower for numbers/symbols)
 */
function getTypingDelay(): number {
    const base = Math.floor(Math.random() * 100) + 50; // 50-150ms base
    return base;
}

/**
 * Move mouse naturally to element before clicking
 */
export async function humanClick(page: Page, selector: string): Promise<void> {
    const element = await page.$(selector);
    if (!element) {
        throw new Error(`Element not found: ${selector}`);
    }

    const box = await element.boundingBox();
    if (!box) {
        throw new Error(`Element has no bounding box: ${selector}`);
    }

    // Click at a random point within the element (not always center)
    const x = box.x + box.width * (0.3 + Math.random() * 0.4);
    const y = box.y + box.height * (0.3 + Math.random() * 0.4);

    // Move mouse with slight delay
    await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
    await shortDelay();
    await page.mouse.click(x, y);
}

/**
 * Scroll page like a human (not instant, variable speed)
 */
export async function humanScroll(page: Page, direction: 'down' | 'up' = 'down', amount?: number): Promise<void> {
    const scrollAmount = amount || (Math.floor(Math.random() * 300) + 200);
    const steps = Math.floor(Math.random() * 5) + 3;
    const stepAmount = scrollAmount / steps;

    for (let i = 0; i < steps; i++) {
        await page.mouse.wheel(0, direction === 'down' ? stepAmount : -stepAmount);
        await humanDelay(50, 150);
    }
}

/**
 * Simulate reading content (delay based on content length)
 */
export async function simulateReading(contentLength: number): Promise<void> {
    // Average reading speed: ~250 words per minute
    // Assume 5 chars per word
    const words = contentLength / 5;
    const readingTimeMs = (words / 250) * 60 * 1000;

    // Cap at 5 seconds max, minimum 500ms
    const delay = Math.min(Math.max(readingTimeMs, 500), 5000);
    await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Random mouse movement to simulate active user
 */
export async function randomMouseMovement(page: Page): Promise<void> {
    const viewport = page.viewportSize();
    if (!viewport) return;

    const x = Math.floor(Math.random() * viewport.width * 0.8) + viewport.width * 0.1;
    const y = Math.floor(Math.random() * viewport.height * 0.8) + viewport.height * 0.1;

    await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 15) + 5 });
}

/**
 * Wait for page to be interactive with human-like checking
 */
export async function waitForInteractive(page: Page): Promise<void> {
    await page.waitForLoadState('domcontentloaded');
    await humanDelay(300, 600);

    // Small mouse movement to show "activity"
    await randomMouseMovement(page);
}
