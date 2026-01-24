/**
 * Application Configuration
 * Environment-based settings with sensible defaults
 */

import type { AppConfig } from '../types/index.js';

function getEnvNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
}

export const config: AppConfig = {
    server: {
        port: getEnvNumber('PORT', 3000),
        host: process.env.HOST || '0.0.0.0',
        cors: getEnvBoolean('CORS_ENABLED', true),
    },

    pool: {
        minBrowsers: getEnvNumber('POOL_MIN_BROWSERS', 1),
        maxBrowsers: getEnvNumber('POOL_MAX_BROWSERS', 3),
        maxContextsPerBrowser: getEnvNumber('POOL_MAX_CONTEXTS', 5),
        browserIdleTimeout: getEnvNumber('BROWSER_IDLE_TIMEOUT', 300000), // 5 min
        healthCheckInterval: getEnvNumber('HEALTH_CHECK_INTERVAL', 30000), // 30 sec
    },

    rateLimit: {
        enabled: getEnvBoolean('RATE_LIMIT_ENABLED', true),
        windowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 60000), // 1 min
        maxRequests: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 30),
    },

    defaults: {
        render: {
            wait_until: 'networkidle',
            timeout_ms: 30000,
            javascript: true,
            scroll: {
                enabled: false,
                max_scrolls: 5,
                delay_ms: 500,
            },
        },
        browser: {
            viewport: { width: 1366, height: 768 },
            locale: 'en-US',
            timezone: 'America/New_York',
        },
    },
};

// Common user agents for rotation
export const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
];

// Common timezones for geo-matching
export const TIMEZONES: Record<string, string> = {
    'US': 'America/New_York',
    'UK': 'Europe/London',
    'DE': 'Europe/Berlin',
    'IN': 'Asia/Kolkata',
    'JP': 'Asia/Tokyo',
    'AU': 'Australia/Sydney',
};

export default config;
