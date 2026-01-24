/**
 * Web Render API - Server Entry Point
 * Production-grade web rendering API with browser pooling and proxy support
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getBrowserPool, shutdownBrowserPool } from './browser/browserPool.js';
import { handleRender, handleHealth, handlePoolStatus } from './api/render.controller.js';
import { config } from './config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Fastify instance
const app = Fastify({
    logger: {
        level: process.env.LOG_LEVEL || 'info',
        transport: process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
    },
    requestTimeout: 120000, // 2 minutes max
    bodyLimit: 1024 * 1024, // 1MB max body
});

// Register plugins
async function setupPlugins(): Promise<void> {
    // CORS
    if (config.server.cors) {
        await app.register(cors, {
            origin: true,
            methods: ['GET', 'POST', 'OPTIONS'],
        });
    }

    // Compression - disabled for large responses as it can cause proxy issues
    await app.register(compress, {
        encodings: ['gzip', 'deflate'],
        threshold: 10 * 1024 * 1024, // Only compress responses > 10MB
    });

    // Static files (UI)
    await app.register(fastifyStatic, {
        root: join(__dirname, '..', 'public'),
        prefix: '/ui/',
    });
}

// Register routes
function setupRoutes(): void {
    // Health check
    app.get('/health', handleHealth);

    // Main render endpoint
    app.post('/v1/render', handleRender);

    // Pool status (debug)
    app.get('/v1/pool/status', handlePoolStatus);

    // Root endpoint
    app.get('/', async (request, reply) => {
        reply.send({
            name: 'Web Render API',
            version: '1.0.0',
            status: 'running',
            ui: '/ui/index.html',
            endpoints: {
                render: 'POST /v1/render',
                health: 'GET /health',
                poolStatus: 'GET /v1/pool/status',
                ui: 'GET /ui/index.html',
            },
            documentation: 'See OPERATIONS.md for usage instructions',
        });
    });

    // 404 handler
    app.setNotFoundHandler((request, reply) => {
        reply.status(404).send({
            success: false,
            error: 'Not found',
            message: `Route ${request.method} ${request.url} not found`,
        });
    });

    // Error handler
    app.setErrorHandler((error, request, reply) => {
        request.log.error(error);

        reply.status(error.statusCode || 500).send({
            success: false,
            error: error.name || 'Internal Server Error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred',
        });
    });
}

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
    console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);

    try {
        // Close server first (stop accepting new connections)
        await app.close();
        console.log('[Server] HTTP server closed');

        // Shutdown browser pool
        await shutdownBrowserPool();
        console.log('[Server] Browser pool closed');

        console.log('[Server] Shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('[Server] Error during shutdown:', error);
        process.exit(1);
    }
}

// Main startup
async function start(): Promise<void> {
    try {
        console.log('[Server] Starting Web Render API...');

        // Setup
        await setupPlugins();
        setupRoutes();

        // Pre-initialize browser pool
        console.log('[Server] Initializing browser pool...');
        const pool = getBrowserPool();
        await pool.initialize();
        console.log('[Server] Browser pool ready');

        // Start server
        const address = await app.listen({
            port: config.server.port,
            host: config.server.host,
        });

        console.log(`[Server] Web Render API running at ${address}`);
        console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log('[Server] Endpoints:');
        console.log(`  - POST ${address}/v1/render`);
        console.log(`  - GET  ${address}/health`);
        console.log(`  - GET  ${address}/v1/pool/status`);

        // Register shutdown handlers
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (error) {
        console.error('[Server] Failed to start:', error);
        process.exit(1);
    }
}

// Run
start();
