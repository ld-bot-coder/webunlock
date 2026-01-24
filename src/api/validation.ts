/**
 * Request Validation
 * Zod schemas for API request validation
 */

import { z } from 'zod';

// Scroll configuration schema
const scrollConfigSchema = z.object({
    enabled: z.boolean().default(false),
    max_scrolls: z.number().int().min(1).max(50).default(5),
    delay_ms: z.number().int().min(100).max(5000).default(500),
}).default({});

// Render configuration schema
const renderConfigSchema = z.object({
    wait_until: z.enum(['load', 'domcontentloaded', 'networkidle', 'commit']).default('networkidle'),
    timeout_ms: z.number().int().min(1000).max(120000).default(30000),
    javascript: z.boolean().default(true),
    scroll: scrollConfigSchema,
    // Advanced wait conditions (Crawl4AI-style)
    wait_for: z.string().optional(),  // "css:.selector" or "js:() => condition"
    js_code: z.union([z.string(), z.array(z.string())]).optional(),  // JS to execute before extraction
}).default({});

// Viewport schema
const viewportSchema = z.object({
    width: z.number().int().min(320).max(3840).default(1366),
    height: z.number().int().min(240).max(2160).default(768),
}).default({});

// Browser configuration schema
const browserConfigSchema = z.object({
    user_agent: z.string().optional(),
    viewport: viewportSchema,
    locale: z.string().default('en-US'),
    timezone: z.string().default('America/New_York'),
}).default({});

// Proxy configuration schema
const proxyConfigSchema = z.object({
    server: z.string().min(1),
    username: z.string().optional(),
    password: z.string().optional(),
    rotate: z.boolean().default(false),
}).optional();

// Debug configuration schema
const debugConfigSchema = z.object({
    screenshot: z.boolean().default(false),
    har: z.boolean().default(false),
}).default({});

// Main render request schema
export const renderRequestSchema = z.object({
    url: z.string().url('Invalid URL format'),
    render: renderConfigSchema,
    browser: browserConfigSchema,
    proxy: proxyConfigSchema,
    debug: debugConfigSchema,
});

// Type exports
export type ValidatedRenderRequest = z.infer<typeof renderRequestSchema>;

/**
 * Validate a render request
 */
export function validateRenderRequest(data: unknown): {
    success: boolean;
    data?: ValidatedRenderRequest;
    errors?: z.ZodError;
} {
    const result = renderRequestSchema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    return { success: false, errors: result.error };
}

/**
 * Format Zod errors for API response
 */
export function formatValidationErrors(
    errors: z.ZodError
): Array<{ field: string; message: string }> {
    return errors.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
    }));
}

/**
 * Quick URL validation
 */
export function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Sanitize URL (remove potentially dangerous characters)
 */
export function sanitizeUrl(url: string): string {
    // Basic sanitization - trim and decode
    const trimmed = url.trim();

    // Ensure protocol
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        return `https://${trimmed}`;
    }

    return trimmed;
}
