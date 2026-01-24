/**
 * Integration Tests for Render API
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Note: These tests require a running server
// Run with: npm run dev (in another terminal) && npm test

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

describe('Render API', () => {
    describe('Health Check', () => {
        it('should return healthy status', async () => {
            const response = await fetch(`${API_BASE}/health`);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.status).toBe('healthy');
            expect(data.pool).toBeDefined();
        });
    });

    describe('POST /v1/render', () => {
        it('should render a simple page', async () => {
            const response = await fetch(`${API_BASE}/v1/render`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: 'https://example.com',
                    render: {
                        wait_until: 'load',
                        timeout_ms: 30000,
                    },
                }),
            });

            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.request_id).toBeDefined();
            expect(data.content.html).toContain('Example Domain');
            expect(data.meta.http_status).toBe(200);
        }, 60000);

        it('should validate URL format', async () => {
            const response = await fetch(`${API_BASE}/v1/render`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: 'not-a-valid-url',
                }),
            });

            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.errors).toBeDefined();
            expect(data.errors[0].code).toBe('VALIDATION_ERROR');
        });

        it('should handle missing URL', async () => {
            const response = await fetch(`${API_BASE}/v1/render`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });

            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
        });

        it('should handle timeout', async () => {
            const response = await fetch(`${API_BASE}/v1/render`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: 'https://httpbin.org/delay/30',
                    render: {
                        timeout_ms: 5000,
                    },
                }),
            });

            const data = await response.json();

            expect(data.success).toBe(false);
            expect(data.errors[0].code).toMatch(/TIMEOUT|NAVIGATION_FAILED/);
        }, 60000);

        it('should include rate limit headers', async () => {
            const response = await fetch(`${API_BASE}/v1/render`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: 'https://example.com',
                }),
            });

            expect(response.headers.get('X-RateLimit-Limit')).toBeDefined();
            expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
        }, 60000);
    });

    describe('Pool Status', () => {
        it('should return pool status', async () => {
            const response = await fetch(`${API_BASE}/v1/pool/status`);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.totalBrowsers).toBeGreaterThanOrEqual(0);
        });
    });
});
