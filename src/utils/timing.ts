/**
 * Timing Utilities
 * Human-like delays and timing functions for anti-detection
 */

/**
 * Sleep for a fixed duration
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sleep for a random duration within a range
 * Provides human-like variability
 */
export function randomDelay(minMs: number, maxMs: number): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return sleep(delay);
}

/**
 * Add jitter to a base delay (±percentage)
 */
export function jitteredDelay(baseMs: number, jitterPercent: number = 20): Promise<void> {
    const jitter = baseMs * (jitterPercent / 100);
    const min = Math.max(0, baseMs - jitter);
    const max = baseMs + jitter;
    return randomDelay(min, max);
}

/**
 * Human-like typing delay (random between keystrokes)
 */
export function typingDelay(): Promise<void> {
    return randomDelay(50, 150);
}

/**
 * Delay before clicking (simulates human reaction time)
 */
export function clickDelay(): Promise<void> {
    return randomDelay(100, 300);
}

/**
 * Delay after page load (simulates human reading/processing)
 */
export function readingDelay(): Promise<void> {
    return randomDelay(500, 1500);
}

/**
 * Measure execution time of an async function
 */
export async function measureTime<T>(
    fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
    const start = performance.now();
    const result = await fn();
    const durationMs = Math.round(performance.now() - start);
    return { result, durationMs };
}

/**
 * Create a timeout promise that rejects after specified ms
 */
export function timeout(ms: number, message?: string): Promise<never> {
    return new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error(message || `Operation timed out after ${ms}ms`));
        }, ms);
    });
}

/**
 * Race a promise against a timeout
 */
export async function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    message?: string
): Promise<T> {
    return Promise.race([promise, timeout(ms, message)]);
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: {
        maxRetries?: number;
        initialDelayMs?: number;
        maxDelayMs?: number;
        backoffMultiplier?: number;
    } = {}
): Promise<T> {
    const {
        maxRetries = 3,
        initialDelayMs = 1000,
        maxDelayMs = 10000,
        backoffMultiplier = 2,
    } = options;

    let lastError: Error | undefined;
    let delay = initialDelayMs;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;

            if (attempt < maxRetries) {
                await sleep(delay);
                delay = Math.min(delay * backoffMultiplier, maxDelayMs);
            }
        }
    }

    throw lastError;
}
