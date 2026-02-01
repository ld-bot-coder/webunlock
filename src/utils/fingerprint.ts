/**
 * Fingerprint Randomization
 * Generates realistic browser fingerprints to avoid tracking
 */

export interface BrowserFingerprint {
    userAgent: string;
    viewport: { width: number; height: number };
    locale: string;
    timezone: string;
    platform: string;
}

// Real Chrome User-Agents (rotated)
const USER_AGENTS = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

// Common screen resolutions
const VIEWPORTS = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 2560, height: 1440 },
];

// Locales (matching with user agents)
const LOCALES = ['en-US', 'en-GB', 'en-IN'];

// Timezones
const TIMEZONES = [
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Asia/Kolkata',
];

/**
 * Pick a random item from array
 */
function randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a consistent fingerprint for a session
 */
export function generateFingerprint(): BrowserFingerprint {
    const userAgent = randomChoice(USER_AGENTS);

    // Match platform with user agent
    let platform = 'MacIntel';
    if (userAgent.includes('Windows')) {
        platform = 'Win32';
    } else if (userAgent.includes('Linux')) {
        platform = 'Linux x86_64';
    }

    return {
        userAgent,
        viewport: randomChoice(VIEWPORTS),
        locale: randomChoice(LOCALES),
        timezone: randomChoice(TIMEZONES),
        platform,
    };
}

/**
 * Get a fingerprint optimized for Indian users (Google India)
 */
export function getIndianFingerprint(): BrowserFingerprint {
    return {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-IN',
        timezone: 'Asia/Kolkata',
        platform: 'MacIntel',
    };
}

/**
 * Slightly vary viewport to avoid fingerprinting
 */
export function varyViewport(viewport: { width: number; height: number }): { width: number; height: number } {
    // Add small random variation (-10 to +10 pixels)
    const wVariation = Math.floor(Math.random() * 21) - 10;
    const hVariation = Math.floor(Math.random() * 21) - 10;

    return {
        width: viewport.width + wVariation,
        height: viewport.height + hVariation,
    };
}
