/**
 * Web Render API - Type Definitions
 * Complete TypeScript interfaces for request/response structures
 */

// ─────────────────────────────────────────────────────────────
// Request Types
// ─────────────────────────────────────────────────────────────

export interface ScrollConfig {
    enabled: boolean;
    max_scrolls: number;
    delay_ms: number;
}

export interface RenderConfig {
    wait_until: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
    timeout_ms: number;
    javascript: boolean;
    scroll: ScrollConfig;
    // Advanced wait conditions (Crawl4AI-style)
    wait_for?: string;  // "css:.selector" or "js:() => condition"
    js_code?: string | string[];  // JavaScript to execute before extraction
}

export interface ViewportConfig {
    width: number;
    height: number;
}

export interface BrowserConfig {
    user_agent?: string;
    viewport: ViewportConfig;
    locale: string;
    timezone: string;
}

export interface ProxyConfig {
    server: string;
    username?: string;
    password?: string;
    rotate?: boolean;
}

export interface DebugConfig {
    screenshot: boolean;
    har: boolean;
}

export interface RenderRequest {
    url: string;
    render: RenderConfig;
    browser?: BrowserConfig;
    proxy?: ProxyConfig;
    debug?: DebugConfig;
}

// ─────────────────────────────────────────────────────────────
// Response Types
// ─────────────────────────────────────────────────────────────

export interface RenderContent {
    html: string;
    screenshot?: string; // Base64 encoded PNG
    har?: object;
}

export interface RenderMeta {
    js_rendered: boolean;
    proxy_used: boolean;
    captcha_detected: boolean;
    blocked: boolean;
    http_status: number;
    load_time_ms: number;
    final_url: string;
    page_title?: string;
}

export interface RenderError {
    code: string;
    message: string;
    details?: string;
}

export interface RenderResponse {
    success: boolean;
    request_id: string;
    final_url: string;
    content: RenderContent | null;
    meta: RenderMeta | null;
    errors: RenderError[] | null;
    timestamp: string;
}

// ─────────────────────────────────────────────────────────────
// Internal Types
// ─────────────────────────────────────────────────────────────

export interface BrowserInstance {
    id: string;
    browser: import('playwright').Browser;
    contextCount: number;
    createdAt: Date;
    lastUsedAt: Date;
    isHealthy: boolean;
}

export interface PoolStatus {
    totalBrowsers: number;
    activeBrowsers: number;
    totalContexts: number;
    availableSlots: number;
    queueLength: number;
}

export interface RenderJob {
    id: string;
    request: RenderRequest;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    status: 'queued' | 'processing' | 'completed' | 'failed';
}

export interface DetectionResult {
    captchaDetected: boolean;
    captchaType?: string;
    blocked: boolean;
    blockReason?: string;
    challengeDetected: boolean;
    challengeType?: string;
}

// ─────────────────────────────────────────────────────────────
// Configuration Types
// ─────────────────────────────────────────────────────────────

export interface ServerConfig {
    port: number;
    host: string;
    cors: boolean;
}

export interface PoolConfig {
    minBrowsers: number;
    maxBrowsers: number;
    maxContextsPerBrowser: number;
    browserIdleTimeout: number;
    healthCheckInterval: number;
}

export interface RateLimitConfig {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
}

export interface AppConfig {
    server: ServerConfig;
    pool: PoolConfig;
    rateLimit: RateLimitConfig;
    defaults: {
        render: RenderConfig;
        browser: BrowserConfig;
    };
}
