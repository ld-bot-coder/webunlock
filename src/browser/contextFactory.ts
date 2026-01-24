/**
 * Context Factory
 * Creates isolated browser contexts with fingerprinting and proxy support
 */

import type { Browser, BrowserContext, Page } from 'playwright';
import type { BrowserConfig, ProxyConfig } from '../types/index.js';
import { toPlaywrightProxy, hasProxy } from '../proxy/proxyManager.js';
import { applyFingerprint, applyPageStealth, getFingerprintOptions } from './fingerprint.js';
import { config as appConfig } from '../config/index.js';

export interface ContextOptions {
    browser?: BrowserConfig;
    proxy?: ProxyConfig;
}

export interface CreatedContext {
    context: BrowserContext;
    page: Page;
    proxyUsed: boolean;
    cleanup: () => Promise<void>;
}

/**
 * Create an isolated browser context with all stealth measures
 */
export async function createContext(
    browser: Browser,
    options: ContextOptions = {}
): Promise<CreatedContext> {
    const { browser: browserConfig, proxy } = options;

    // Merge with default browser config
    const mergedBrowserConfig: BrowserConfig = {
        ...appConfig.defaults.browser,
        ...browserConfig,
        viewport: {
            ...appConfig.defaults.browser.viewport,
            ...browserConfig?.viewport,
        },
    };

    // Ensure User Agent is consistent
    if (!mergedBrowserConfig.user_agent) {
        const { getRandomUserAgent } = await import('./fingerprint.js');
        mergedBrowserConfig.user_agent = getRandomUserAgent();
    }

    // Get fingerprint options
    const fingerprintOptions = getFingerprintOptions(mergedBrowserConfig);

    // Handle proxy
    const proxyUsed = hasProxy(proxy);
    let playwrightProxy: { server: string; username?: string; password?: string } | undefined;

    if (proxyUsed && proxy) {
        const parsedProxy = toPlaywrightProxy(proxy);
        if (parsedProxy) {
            playwrightProxy = parsedProxy;
        }
    }

    // Create the context
    const context = await browser.newContext({
        ...fingerprintOptions,
        ...(playwrightProxy ? { proxy: playwrightProxy } : {}),
    });

    // Apply fingerprinting and stealth
    await applyFingerprint(context, mergedBrowserConfig);

    // Create a new page
    const page = await context.newPage();

    // Apply page-level stealth
    await applyPageStealth(page);

    // Cleanup function
    const cleanup = async () => {
        try {
            await page.close();
        } catch {
            // Page might already be closed
        }
        try {
            await context.close();
        } catch {
            // Context might already be closed
        }
    };

    return {
        context,
        page,
        proxyUsed,
        cleanup,
    };
}

/**
 * Context wrapper with automatic cleanup
 */
export async function withContext<T>(
    browser: Browser,
    options: ContextOptions,
    fn: (page: Page, context: BrowserContext) => Promise<T>
): Promise<T> {
    const { page, context, cleanup } = await createContext(browser, options);

    try {
        return await fn(page, context);
    } finally {
        await cleanup();
    }
}
