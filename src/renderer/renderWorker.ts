/**
 * Render Worker
 * Orchestrates the full rendering pipeline
 */

import type { Page } from 'playwright';
import type {
    RenderRequest,
    RenderResponse,
    RenderMeta,
    RenderContent,
    RenderError,
    DetectionResult
} from '../types/index.js';
import { getBrowserPool, type CreatedContext } from '../browser/browserPool.js';
import { loadPage, extractHtml, getPageTitle, waitForStability } from './pageLoader.js';
import { performScroll } from './scrollEngine.js';
import { detectCaptcha } from '../utils/captchaDetection.js';
import { detectBlock } from '../utils/blockDetection.js';
import { measureTime, withTimeout } from '../utils/timing.js';
import { executeWaitFor, executeJsCode } from '../utils/waitConditions.js';
import { config as appConfig } from '../config/index.js';

export interface RenderResult {
    response: RenderResponse;
}

/**
 * Build a complete render request with defaults
 */
function buildCompleteRequest(request: RenderRequest): RenderRequest {
    return {
        ...request,
        render: {
            ...appConfig.defaults.render,
            ...request.render,
            scroll: {
                ...appConfig.defaults.render.scroll,
                ...request.render?.scroll,
            },
        },
        browser: {
            ...appConfig.defaults.browser,
            ...request.browser,
            viewport: {
                ...appConfig.defaults.browser.viewport,
                ...request.browser?.viewport,
            },
        },
        debug: {
            screenshot: false,
            har: false,
            ...request.debug,
        },
    };
}

/**
 * Create error response
 */
function createErrorResponse(
    requestId: string,
    code: string,
    message: string,
    details?: string
): RenderResponse {
    return {
        success: false,
        request_id: requestId,
        final_url: '',
        content: null,
        meta: null,
        errors: [{ code, message, details }],
        timestamp: new Date().toISOString(),
    };
}

/**
 * Perform detection checks on the loaded page
 */
async function performDetection(
    page: Page,
    response: import('playwright').Response | null
): Promise<DetectionResult> {
    const [captchaResult, blockResult] = await Promise.all([
        detectCaptcha(page),
        detectBlock(page, response),
    ]);

    return {
        captchaDetected: captchaResult.detected,
        captchaType: captchaResult.type,
        blocked: blockResult.blocked,
        blockReason: blockResult.reason,
        challengeDetected: blockResult.reason === 'bot_challenge',
        challengeType: blockResult.provider,
    };
}

/**
 * Capture debug artifacts if requested
 */
async function captureDebugArtifacts(
    page: Page,
    debug: RenderRequest['debug']
): Promise<{ screenshot?: string; har?: object }> {
    const result: { screenshot?: string; har?: object } = {};

    if (debug?.screenshot) {
        try {
            const screenshotBuffer = await page.screenshot({
                type: 'png',
                fullPage: true,
            });
            result.screenshot = screenshotBuffer.toString('base64');
        } catch (error) {
            console.error('[RenderWorker] Screenshot capture failed:', error);
        }
    }

    // Note: HAR capture requires special setup at context level
    // For now, we'll skip HAR as it requires context-level recording
    if (debug?.har) {
        result.har = { note: 'HAR capture requires context-level recording' };
    }

    return result;
}

/**
 * Main render function
 */
export async function render(
    requestId: string,
    request: RenderRequest
): Promise<RenderResult> {
    const startTime = performance.now();

    // Build complete request with defaults
    const completeRequest = buildCompleteRequest(request);
    const { url, render: renderConfig, browser: browserConfig, proxy, debug } = completeRequest;

    // Acquire browser context
    let context: (CreatedContext & { browserId: string }) | null = null;

    try {
        // Get context from browser pool
        const pool = getBrowserPool();

        context = await withTimeout(
            pool.acquire({
                browser: browserConfig,
                proxy,
                timeout: 30000,
            }),
            35000,
            'Timeout acquiring browser context'
        );

        const { page, proxyUsed, cleanup } = context;

        try {
            // Load the page
            const navigationResult = await loadPage(page, url, renderConfig);

            if (!navigationResult.success) {
                return {
                    response: createErrorResponse(
                        requestId,
                        'NAVIGATION_FAILED',
                        'Failed to load the page',
                        navigationResult.error
                    ),
                };
            }

            // Wait for additional stability if using networkidle
            if (renderConfig.wait_until === 'networkidle') {
                await waitForStability(page, { timeout: 3000 });
            }

            // Execute custom JavaScript code if provided (Crawl4AI-style)
            if (renderConfig.js_code) {
                await executeJsCode(page, renderConfig.js_code);
            }

            // Execute wait_for condition if provided (Crawl4AI-style)
            if (renderConfig.wait_for) {
                const waitResult = await executeWaitFor(
                    page,
                    renderConfig.wait_for,
                    renderConfig.timeout_ms
                );
                if (!waitResult.success) {
                    console.log(`[RenderWorker] wait_for condition failed: ${waitResult.error}`);
                }
            }

            // Perform scrolling if enabled
            let scrollResult = { scrollsPerformed: 0, contentChanges: 0 };
            if (renderConfig.scroll?.enabled) {
                scrollResult = await performScroll(page, renderConfig.scroll);
            }

            // Perform detection
            const detection = await performDetection(page, navigationResult.response);

            // Extract HTML content
            const html = await extractHtml(page);
            const pageTitle = await getPageTitle(page);

            // Capture debug artifacts
            const debugArtifacts = await captureDebugArtifacts(page, debug);

            // Calculate total time
            const totalTimeMs = Math.round(performance.now() - startTime);

            // Build content
            const content: RenderContent = {
                html,
                ...(debugArtifacts.screenshot ? { screenshot: debugArtifacts.screenshot } : {}),
                ...(debugArtifacts.har ? { har: debugArtifacts.har } : {}),
            };

            // Build meta
            const meta: RenderMeta = {
                js_rendered: renderConfig.javascript,
                proxy_used: proxyUsed,
                captcha_detected: detection.captchaDetected,
                blocked: detection.blocked,
                http_status: navigationResult.httpStatus,
                load_time_ms: totalTimeMs,
                final_url: navigationResult.finalUrl,
                page_title: pageTitle || undefined,
            };

            // Build response
            const response: RenderResponse = {
                success: true,
                request_id: requestId,
                final_url: navigationResult.finalUrl,
                content,
                meta,
                errors: null,
                timestamp: new Date().toISOString(),
            };

            return { response };
        } finally {
            // Always cleanup the context
            await cleanup();
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Determine error type
        let errorCode = 'RENDER_FAILED';
        if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
            errorCode = 'TIMEOUT';
        } else if (errorMessage.includes('proxy') || errorMessage.includes('Proxy')) {
            errorCode = 'PROXY_ERROR';
        } else if (errorMessage.includes('context') || errorMessage.includes('browser')) {
            errorCode = 'BROWSER_ERROR';
        }

        return {
            response: createErrorResponse(
                requestId,
                errorCode,
                'Render operation failed',
                errorMessage
            ),
        };
    }
}

/**
 * Render with full timeout enforcement
 */
export async function renderWithTimeout(
    requestId: string,
    request: RenderRequest,
    maxTimeoutMs: number = 60000
): Promise<RenderResult> {
    try {
        return await withTimeout(
            render(requestId, request),
            maxTimeoutMs,
            `Total render timeout exceeded: ${maxTimeoutMs}ms`
        );
    } catch (error) {
        return {
            response: createErrorResponse(
                requestId,
                'TOTAL_TIMEOUT',
                'Total render timeout exceeded',
                error instanceof Error ? error.message : String(error)
            ),
        };
    }
}
