/**
 * Browser Pool Manager
 * Manages pre-launched Chromium instances for efficient reuse
 */

import { chromium, Browser } from 'playwright';
import { v4 as uuid } from 'uuid';
import type { BrowserInstance, PoolStatus, BrowserConfig, ProxyConfig } from '../types/index.js';
import { config as appConfig } from '../config/index.js';
import { createContext, type CreatedContext } from './contextFactory.js';

// Re-export for use in other modules
export type { CreatedContext };

export interface BrowserPoolOptions {
    minBrowsers?: number;
    maxBrowsers?: number;
    maxContextsPerBrowser?: number;
    browserIdleTimeout?: number;
    healthCheckInterval?: number;
}

export interface AcquireOptions {
    browser?: BrowserConfig;
    proxy?: ProxyConfig;
    timeout?: number;
}

/**
 * Browser Pool for managing Chromium instances
 */
export class BrowserPool {
    private instances: Map<string, BrowserInstance> = new Map();
    private contextCounts: Map<string, number> = new Map();
    private queue: Array<{
        resolve: (context: CreatedContext & { browserId: string }) => void;
        reject: (error: Error) => void;
        options: AcquireOptions;
        timeout: NodeJS.Timeout;
    }> = [];
    private healthCheckTimer?: NodeJS.Timeout;
    private isShuttingDown = false;
    private initPromise?: Promise<void>;

    private readonly minBrowsers: number;
    private readonly maxBrowsers: number;
    private readonly maxContextsPerBrowser: number;
    private readonly browserIdleTimeout: number;
    private readonly healthCheckInterval: number;

    constructor(options: BrowserPoolOptions = {}) {
        this.minBrowsers = options.minBrowsers ?? appConfig.pool.minBrowsers;
        this.maxBrowsers = options.maxBrowsers ?? appConfig.pool.maxBrowsers;
        this.maxContextsPerBrowser = options.maxContextsPerBrowser ?? appConfig.pool.maxContextsPerBrowser;
        this.browserIdleTimeout = options.browserIdleTimeout ?? appConfig.pool.browserIdleTimeout;
        this.healthCheckInterval = options.healthCheckInterval ?? appConfig.pool.healthCheckInterval;
    }

    /**
     * Initialize the pool with minimum browsers
     */
    async initialize(): Promise<void> {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this._initialize();
        return this.initPromise;
    }

    private async _initialize(): Promise<void> {
        console.log(`[BrowserPool] Initializing with ${this.minBrowsers} browsers...`);

        // Launch minimum number of browsers
        const launchPromises = Array.from({ length: this.minBrowsers }, () => this.launchBrowser());
        await Promise.all(launchPromises);

        // Start health check timer
        this.healthCheckTimer = setInterval(() => this.healthCheck(), this.healthCheckInterval);

        console.log(`[BrowserPool] Initialized! ${this.instances.size} browsers ready.`);
    }

    /**
     * Launch a new browser instance
     */
    private async launchBrowser(): Promise<BrowserInstance | null> {
        if (this.instances.size >= this.maxBrowsers) {
            return null;
        }

        try {
            const browser = await chromium.launch({
                headless: true,
                channel: 'chrome', // Use actual Chrome instead of Chromium
                args: [
                    // Core anti-detection
                    '--disable-blink-features=AutomationControlled',
                    '--disable-automation',
                    '--disable-extensions-except=',
                    '--disable-component-extensions-with-background-pages',

                    // Remove headless indicators
                    '--disable-features=IsolateOrigins,site-per-process,TranslateUI',
                    '--disable-site-isolation-trials',
                    '--disable-ipc-flooding-protection',

                    // Performance/stability
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-first-run',
                    '--no-default-browser-check',

                    // Window settings
                    '--window-size=1366,768',
                    '--start-maximized',

                    // Audio/Video
                    '--mute-audio',
                    '--autoplay-policy=no-user-gesture-required',

                    // Network
                    '--disable-background-networking',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',

                    // Additional stealth
                    '--disable-popup-blocking',
                    '--ignore-certificate-errors',
                    '--disable-infobars',
                    '--lang=en-US,en',
                ],
            });

            const instance: BrowserInstance = {
                id: uuid(),
                browser,
                contextCount: 0,
                createdAt: new Date(),
                lastUsedAt: new Date(),
                isHealthy: true,
            };

            this.instances.set(instance.id, instance);
            this.contextCounts.set(instance.id, 0);

            // Handle browser disconnection
            browser.on('disconnected', () => {
                console.log(`[BrowserPool] Browser ${instance.id} disconnected`);
                this.handleBrowserDisconnect(instance.id);
            });

            console.log(`[BrowserPool] Launched browser ${instance.id}`);
            return instance;
        } catch (error) {
            console.error(`[BrowserPool] Failed to launch browser:`, error);
            return null;
        }
    }

    /**
     * Handle browser disconnection
     */
    private handleBrowserDisconnect(browserId: string): void {
        this.instances.delete(browserId);
        this.contextCounts.delete(browserId);

        // Replace with new browser if below minimum and not shutting down
        if (!this.isShuttingDown && this.instances.size < this.minBrowsers) {
            this.launchBrowser().catch(console.error);
        }
    }

    /**
     * Find an available browser with capacity
     */
    private findAvailableBrowser(): BrowserInstance | null {
        for (const instance of this.instances.values()) {
            if (!instance.isHealthy) continue;

            const currentContexts = this.contextCounts.get(instance.id) || 0;
            if (currentContexts < this.maxContextsPerBrowser) {
                return instance;
            }
        }
        return null;
    }

    /**
     * Acquire a browser context from the pool
     */
    async acquire(options: AcquireOptions = {}): Promise<CreatedContext & { browserId: string }> {
        if (this.isShuttingDown) {
            throw new Error('Browser pool is shutting down');
        }

        await this.initialize();

        // Try to find an available browser
        let instance = this.findAvailableBrowser();

        // If no available browser, try to launch a new one
        if (!instance && this.instances.size < this.maxBrowsers) {
            instance = await this.launchBrowser();
        }

        // If still no browser available, queue the request
        if (!instance) {
            return this.waitForAvailable(options);
        }

        return this.createContextFromInstance(instance, options);
    }

    /**
     * Create context from a browser instance
     */
    private async createContextFromInstance(
        instance: BrowserInstance,
        options: AcquireOptions
    ): Promise<CreatedContext & { browserId: string }> {
        // Increment context count
        const currentCount = this.contextCounts.get(instance.id) || 0;
        this.contextCounts.set(instance.id, currentCount + 1);
        instance.lastUsedAt = new Date();

        try {
            const createdContext = await createContext(instance.browser, {
                browser: options.browser,
                proxy: options.proxy,
            });

            // Override cleanup to also decrement counter
            const originalCleanup = createdContext.cleanup;
            const cleanup = async () => {
                await originalCleanup();

                const count = this.contextCounts.get(instance.id) || 0;
                this.contextCounts.set(instance.id, Math.max(0, count - 1));

                // Process queue if there are waiting requests
                this.processQueue();
            };

            return {
                ...createdContext,
                cleanup,
                browserId: instance.id,
            };
        } catch (error) {
            // Decrement on failure
            const count = this.contextCounts.get(instance.id) || 0;
            this.contextCounts.set(instance.id, Math.max(0, count - 1));
            throw error;
        }
    }

    /**
     * Wait for a browser to become available
     */
    private waitForAvailable(options: AcquireOptions): Promise<CreatedContext & { browserId: string }> {
        const timeoutMs = options.timeout || 30000;

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                const index = this.queue.findIndex(q => q.resolve === resolve);
                if (index >= 0) {
                    this.queue.splice(index, 1);
                }
                reject(new Error('Timeout waiting for available browser'));
            }, timeoutMs);

            this.queue.push({ resolve, reject, options, timeout });
        });
    }

    /**
     * Process the waiting queue
     */
    private async processQueue(): Promise<void> {
        if (this.queue.length === 0) return;

        const instance = this.findAvailableBrowser();
        if (!instance) return;

        const item = this.queue.shift();
        if (!item) return;

        clearTimeout(item.timeout);

        try {
            const context = await this.createContextFromInstance(instance, item.options);
            item.resolve(context);
        } catch (error) {
            item.reject(error as Error);
        }
    }

    /**
     * Perform health check on all browsers
     */
    private async healthCheck(): Promise<void> {
        for (const instance of this.instances.values()) {
            try {
                // Check if browser is still connected
                if (!instance.browser.isConnected()) {
                    console.log(`[BrowserPool] Browser ${instance.id} is disconnected`);
                    instance.isHealthy = false;
                    this.handleBrowserDisconnect(instance.id);
                    continue;
                }

                // Check idle timeout
                const idleTime = Date.now() - instance.lastUsedAt.getTime();
                const currentContexts = this.contextCounts.get(instance.id) || 0;

                if (
                    idleTime > this.browserIdleTimeout &&
                    currentContexts === 0 &&
                    this.instances.size > this.minBrowsers
                ) {
                    console.log(`[BrowserPool] Closing idle browser ${instance.id}`);
                    await instance.browser.close();
                    this.instances.delete(instance.id);
                    this.contextCounts.delete(instance.id);
                }
            } catch (error) {
                console.error(`[BrowserPool] Health check error for ${instance.id}:`, error);
                instance.isHealthy = false;
            }
        }
    }

    /**
     * Get pool status
     */
    getStatus(): PoolStatus {
        let totalContexts = 0;
        let availableSlots = 0;

        for (const [id, instance] of this.instances.entries()) {
            const contextCount = this.contextCounts.get(id) || 0;
            totalContexts += contextCount;

            if (instance.isHealthy) {
                availableSlots += this.maxContextsPerBrowser - contextCount;
            }
        }

        // Add potential slots from browsers that could be launched
        const potentialNewBrowsers = this.maxBrowsers - this.instances.size;
        availableSlots += potentialNewBrowsers * this.maxContextsPerBrowser;

        return {
            totalBrowsers: this.instances.size,
            activeBrowsers: Array.from(this.instances.values()).filter(i => i.isHealthy).length,
            totalContexts,
            availableSlots,
            queueLength: this.queue.length,
        };
    }

    /**
     * Gracefully shutdown the pool
     */
    async shutdown(): Promise<void> {
        console.log('[BrowserPool] Shutting down...');
        this.isShuttingDown = true;

        // Clear health check timer
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }

        // Reject all queued requests
        for (const item of this.queue) {
            clearTimeout(item.timeout);
            item.reject(new Error('Browser pool shutting down'));
        }
        this.queue = [];

        // Close all browsers
        const closePromises = Array.from(this.instances.values()).map(async (instance) => {
            try {
                await instance.browser.close();
            } catch (error) {
                console.error(`[BrowserPool] Error closing browser ${instance.id}:`, error);
            }
        });

        await Promise.all(closePromises);
        this.instances.clear();
        this.contextCounts.clear();

        console.log('[BrowserPool] Shutdown complete');
    }
}

// Singleton instance
let poolInstance: BrowserPool | null = null;

/**
 * Get the global browser pool instance
 */
export function getBrowserPool(): BrowserPool {
    if (!poolInstance) {
        poolInstance = new BrowserPool();
    }
    return poolInstance;
}

/**
 * Shutdown the global browser pool
 */
export async function shutdownBrowserPool(): Promise<void> {
    if (poolInstance) {
        await poolInstance.shutdown();
        poolInstance = null;
    }
}
