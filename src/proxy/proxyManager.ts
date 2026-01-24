/**
 * Proxy Manager
 * Vendor-agnostic proxy handling for any provider
 */

import type { ProxyConfig } from '../types/index.js';

export interface ParsedProxy {
    server: string;
    protocol: 'http' | 'https' | 'socks5';
    host: string;
    port: number;
    username?: string;
    password?: string;
}

export interface ProxyValidationResult {
    valid: boolean;
    error?: string;
    parsed?: ParsedProxy;
}

/**
 * Parse and validate a proxy configuration
 */
export function parseProxy(config: ProxyConfig): ProxyValidationResult {
    try {
        const { server, username, password } = config;

        // Parse the proxy URL
        let url: URL;
        try {
            // Handle servers without protocol prefix
            const serverWithProtocol = server.includes('://')
                ? server
                : `http://${server}`;
            url = new URL(serverWithProtocol);
        } catch {
            return {
                valid: false,
                error: `Invalid proxy server URL: ${server}`,
            };
        }

        // Extract protocol
        const protocol = url.protocol.replace(':', '') as ParsedProxy['protocol'];
        if (!['http', 'https', 'socks5'].includes(protocol)) {
            return {
                valid: false,
                error: `Unsupported proxy protocol: ${protocol}. Use http, https, or socks5.`,
            };
        }

        // Extract host and port
        const host = url.hostname;
        const port = parseInt(url.port, 10) || (protocol === 'https' ? 443 : 8080);

        if (!host) {
            return {
                valid: false,
                error: 'Proxy host is required',
            };
        }

        // Build parsed proxy
        const parsed: ParsedProxy = {
            server: `${protocol}://${host}:${port}`,
            protocol,
            host,
            port,
            username: username || url.username || undefined,
            password: password || url.password || undefined,
        };

        // Validate authentication
        if ((parsed.username && !parsed.password) || (!parsed.username && parsed.password)) {
            return {
                valid: false,
                error: 'Both username and password must be provided for authenticated proxies',
            };
        }

        return { valid: true, parsed };
    } catch (error) {
        return {
            valid: false,
            error: `Proxy parsing error: ${error}`,
        };
    }
}

/**
 * Convert proxy config to Playwright format
 */
export function toPlaywrightProxy(config: ProxyConfig): {
    server: string;
    username?: string;
    password?: string;
} | null {
    const result = parseProxy(config);

    if (!result.valid || !result.parsed) {
        return null;
    }

    const { server, username, password } = result.parsed;

    return {
        server,
        ...(username && password ? { username, password } : {}),
    };
}

/**
 * Mask proxy credentials for logging
 */
export function maskProxy(config: ProxyConfig): string {
    const result = parseProxy(config);

    if (!result.valid || !result.parsed) {
        return '[invalid proxy]';
    }

    const { protocol, host, port, username } = result.parsed;

    if (username) {
        return `${protocol}://${username}:****@${host}:${port}`;
    }

    return `${protocol}://${host}:${port}`;
}

/**
 * Check if proxy configuration is provided
 */
export function hasProxy(config?: ProxyConfig): boolean {
    return !!(config?.server && config.server.trim().length > 0);
}

/**
 * Generate a proxy rotation hint for session management
 * This is a hint for sticky vs rotating proxy behavior
 */
export function getSessionId(config: ProxyConfig, requestId: string): string {
    if (config.rotate) {
        // For rotating proxies, use unique ID per request
        return requestId;
    }

    // For sticky sessions, create a more persistent session
    // based on timestamp window (5 minute buckets)
    const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
    return `session_${bucket}`;
}

/**
 * Proxy manager class for handling multiple proxies
 */
export class ProxyManager {
    private proxies: ProxyConfig[] = [];
    private currentIndex = 0;

    constructor(proxies: ProxyConfig[] = []) {
        this.proxies = proxies.filter(p => parseProxy(p).valid);
    }

    /**
     * Add a proxy to the pool
     */
    addProxy(proxy: ProxyConfig): boolean {
        const validation = parseProxy(proxy);
        if (validation.valid) {
            this.proxies.push(proxy);
            return true;
        }
        return false;
    }

    /**
     * Get the next proxy in rotation
     */
    getNext(): ProxyConfig | null {
        if (this.proxies.length === 0) {
            return null;
        }

        const proxy = this.proxies[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        return proxy;
    }

    /**
     * Get a random proxy from the pool
     */
    getRandom(): ProxyConfig | null {
        if (this.proxies.length === 0) {
            return null;
        }

        const index = Math.floor(Math.random() * this.proxies.length);
        return this.proxies[index];
    }

    /**
     * Get the number of available proxies
     */
    get count(): number {
        return this.proxies.length;
    }
}
