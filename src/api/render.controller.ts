/**
 * Render Controller
 * Main API endpoint handler for /v1/render
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuid } from 'uuid';
import { validateRenderRequest, formatValidationErrors } from './validation.js';
import { getRateLimiter, createRateLimitHeaders } from './rate-limiter.js';
import { renderWithTimeout } from '../renderer/renderWorker.js';
import { getBrowserPool } from '../browser/browserPool.js';
import type { RenderRequest, RenderResponse } from '../types/index.js';

/**
 * Extract client IP from request
 */
function getClientIp(request: FastifyRequest): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
        const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
        return ips.trim();
    }
    return request.ip || 'unknown';
}

/**
 * Handle POST /v1/render
 */
export async function handleRender(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    const requestId = uuid();
    const startTime = Date.now();
    const clientIp = getClientIp(request);

    // Log incoming request
    request.log.info({
        requestId,
        clientIp,
        method: 'POST',
        path: '/v1/render',
    }, 'Incoming render request');

    // Check rate limit
    const rateLimiter = getRateLimiter();
    const rateLimit = rateLimiter.isAllowed(clientIp);

    // Add rate limit headers
    const rateLimitHeaders = createRateLimitHeaders(rateLimit.remaining, rateLimit.resetAt);
    for (const [key, value] of Object.entries(rateLimitHeaders)) {
        reply.header(key, value);
    }

    if (!rateLimit.allowed) {
        reply.status(429).send({
            success: false,
            request_id: requestId,
            final_url: '',
            content: null,
            meta: null,
            errors: [{
                code: 'RATE_LIMITED',
                message: 'Too many requests. Please slow down.',
                details: `Rate limit: ${rateLimiter.getStats().maxRequests} requests per ${rateLimiter.getStats().windowMs / 1000}s`,
            }],
            timestamp: new Date().toISOString(),
        } as RenderResponse);
        return;
    }

    // Validate request body
    const validation = validateRenderRequest(request.body);

    if (!validation.success || !validation.data) {
        const errors = validation.errors
            ? formatValidationErrors(validation.errors)
            : [{ field: 'body', message: 'Invalid request body' }];

        reply.status(400).send({
            success: false,
            request_id: requestId,
            final_url: '',
            content: null,
            meta: null,
            errors: errors.map(e => ({
                code: 'VALIDATION_ERROR',
                message: e.message,
                details: `Field: ${e.field}`,
            })),
            timestamp: new Date().toISOString(),
        } as RenderResponse);
        return;
    }

    const renderRequest: RenderRequest = validation.data;

    // Log validated request
    request.log.info({
        requestId,
        url: renderRequest.url,
        proxyUsed: !!renderRequest.proxy,
        scrollEnabled: renderRequest.render?.scroll?.enabled,
    }, 'Processing render request');

    try {
        // Perform render
        const maxTimeout = (renderRequest.render?.timeout_ms || 30000) + 30000; // Add buffer
        const result = await renderWithTimeout(requestId, renderRequest, maxTimeout);

        const duration = Date.now() - startTime;

        // Log completion
        request.log.info({
            requestId,
            success: result.response.success,
            duration,
            httpStatus: result.response.meta?.http_status,
        }, 'Render complete');

        // Send response
        const statusCode = result.response.success ? 200 :
            (result.response.errors?.[0]?.code === 'TIMEOUT' ? 504 : 500);

        reply.status(statusCode).send(result.response);
    } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        request.log.error({
            requestId,
            error: errorMessage,
            duration,
        }, 'Render failed');

        reply.status(500).send({
            success: false,
            request_id: requestId,
            final_url: '',
            content: null,
            meta: null,
            errors: [{
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred',
                details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
            }],
            timestamp: new Date().toISOString(),
        } as RenderResponse);
    }
}

/**
 * Handle GET /health
 */
export async function handleHealth(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    try {
        const pool = getBrowserPool();
        const status = pool.getStatus();
        const rateLimiter = getRateLimiter();
        const rateLimitStats = rateLimiter.getStats();

        reply.send({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            pool: {
                browsers: status.totalBrowsers,
                activeBrowsers: status.activeBrowsers,
                contexts: status.totalContexts,
                availableSlots: status.availableSlots,
                queueLength: status.queueLength,
            },
            rateLimit: {
                activeIps: rateLimitStats.activeKeys,
                windowMs: rateLimitStats.windowMs,
                maxRequests: rateLimitStats.maxRequests,
            },
        });
    } catch (error) {
        reply.status(503).send({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}

/**
 * Handle GET /v1/pool/status (optional, for debugging)
 */
export async function handlePoolStatus(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    try {
        const pool = getBrowserPool();
        const status = pool.getStatus();

        reply.send({
            success: true,
            data: status,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        reply.status(500).send({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
