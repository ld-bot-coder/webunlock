# Web Render API - Operations Guide

A production-grade web rendering API that returns fully rendered HTML using real Chromium browsers, with enterprise-grade proxy flexibility and anti-detection measures.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Environment Setup](#environment-setup)
3. [Configuration](#configuration)
4. [API Reference](#api-reference)
5. [Proxy Configuration](#proxy-configuration)
6. [Common Block Scenarios](#common-block-scenarios)
7. [Scaling Strategy](#scaling-strategy)
8. [Production Deployment](#production-deployment)
9. [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Install Dependencies

```bash
cd /Users/rahul/Downloads/automation
npm install
```

### 2. Install Chromium Browser

```bash
npm run install:browsers
```

### 3. Start the Server

**Development mode (with hot reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

### 4. Test the API

```bash
curl -X POST http://localhost:3000/v1/render \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "render": {
      "wait_until": "networkidle",
      "timeout_ms": 30000
    }
  }'
```

---

## Environment Setup

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Node.js | 18.x | 20.x LTS |
| RAM | 2 GB | 4+ GB |
| CPU | 2 cores | 4+ cores |
| Disk | 2 GB | 5 GB |

### Environment Variables

Create a `.env` file or set these environment variables:

```bash
# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
LOG_LEVEL=info

# Browser Pool Configuration
POOL_MIN_BROWSERS=1
POOL_MAX_BROWSERS=3
POOL_MAX_CONTEXTS=5
BROWSER_IDLE_TIMEOUT=300000
HEALTH_CHECK_INTERVAL=30000

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=30

# CORS
CORS_ENABLED=true
```

---

## Configuration

### Browser Pool Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `POOL_MIN_BROWSERS` | 1 | Minimum browsers to keep warm |
| `POOL_MAX_BROWSERS` | 3 | Maximum concurrent browsers |
| `POOL_MAX_CONTEXTS` | 5 | Max tabs per browser |
| `BROWSER_IDLE_TIMEOUT` | 300000 | Close idle browsers after 5 min |

### Memory Estimation

```
Memory = (POOL_MAX_BROWSERS × 200MB) + (Total Contexts × 75MB)

Example: 3 browsers × 5 contexts = 15 concurrent requests
Memory: (3 × 200MB) + (15 × 75MB) = 1.725 GB
```

---

## API Reference

### POST /v1/render

Render a webpage and return the fully rendered HTML.

#### Request Body

```json
{
  "url": "https://example.com",
  "render": {
    "wait_until": "networkidle",
    "timeout_ms": 45000,
    "javascript": true,
    "scroll": {
      "enabled": true,
      "max_scrolls": 8,
      "delay_ms": 700
    }
  },
  "browser": {
    "user_agent": "Mozilla/5.0...",
    "viewport": { "width": 1366, "height": 768 },
    "locale": "en-US",
    "timezone": "Asia/Kolkata"
  },
  "proxy": {
    "server": "http://proxy.example.com:8080",
    "username": "user",
    "password": "pass",
    "rotate": false
  },
  "debug": {
    "screenshot": true,
    "har": false
  }
}
```

#### Response

```json
{
  "success": true,
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "final_url": "https://example.com/",
  "content": {
    "html": "<!DOCTYPE html>...",
    "screenshot": "base64-encoded-png..."
  },
  "meta": {
    "js_rendered": true,
    "proxy_used": true,
    "captcha_detected": false,
    "blocked": false,
    "http_status": 200,
    "load_time_ms": 3456,
    "final_url": "https://example.com/",
    "page_title": "Example Domain"
  },
  "errors": null,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Wait Until Options

| Value | Description | Use Case |
|-------|-------------|----------|
| `commit` | First response received | Fastest, minimal JS |
| `domcontentloaded` | DOM parsed | Static sites |
| `load` | All resources loaded | Most sites |
| `networkidle` | No network activity for 500ms | JS-heavy SPAs |

### GET /health

Check server and pool health.

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "pool": {
    "browsers": 2,
    "activeBrowsers": 2,
    "contexts": 3,
    "availableSlots": 7,
    "queueLength": 0
  }
}
```

---

## Proxy Configuration

### Supported Proxy Types

| Type | Format | Example |
|------|--------|---------|
| HTTP | `http://host:port` | `http://proxy.example.com:8080` |
| HTTPS | `https://host:port` | `https://proxy.example.com:443` |
| SOCKS5 | `socks5://host:port` | `socks5://proxy.example.com:1080` |
| Authenticated | Include in request | See below |

### Authentication

```json
{
  "proxy": {
    "server": "http://proxy.example.com:8080",
    "username": "your_username",
    "password": "your_password"
  }
}
```

### Example with Residential Proxy

```bash
curl -X POST http://localhost:3000/v1/render \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://httpbin.org/ip",
    "proxy": {
      "server": "http://gate.smartproxy.com:7000",
      "username": "spuser123",
      "password": "secretpass"
    }
  }'
```

### Proxy Providers Compatibility

This API works with any standard HTTP/HTTPS/SOCKS5 proxy:

- **Oxylabs**: `http://customer-USER:PASS@pr.oxylabs.io:7777`
- **Bright Data**: `http://USER:PASS@zproxy.lum-superproxy.io:22225`
- **Smartproxy**: `http://USER:PASS@gate.smartproxy.com:7000`
- **Any datacenter/residential proxy**

---

## Common Block Scenarios

### CAPTCHA Detected

The API detects CAPTCHAs but does NOT solve them:

```json
{
  "success": true,
  "meta": {
    "captcha_detected": true,
    "blocked": false
  }
}
```

**Solutions:**
- Use residential proxies
- Rotate proxies more frequently
- Add longer delays between requests
- Use premium proxy services with CAPTCHA bypass

### Access Denied (403)

```json
{
  "success": true,
  "meta": {
    "blocked": true,
    "http_status": 403
  }
}
```

**Solutions:**
- Switch to residential proxies
- Enable scrolling to appear more human
- Set matching timezone/locale for proxy geo
- Add random delays between requests

### Cloudflare Challenge

```json
{
  "meta": {
    "blocked": true,
    "captcha_detected": true
  }
}
```

**Solutions:**
- Use high-quality residential proxies
- Ensure User-Agent is realistic
- Match timezone to proxy location
- Consider premium proxy services

---

## Scaling Strategy

### Single Server Limits

| Scenario | Max RPS | Memory |
|----------|---------|--------|
| Simple pages | 5-8 | 2 GB |
| JS-heavy SPAs | 2-4 | 3 GB |
| With scrolling | 1-2 | 4 GB |

### Horizontal Scaling

```
┌─────────────────┐
│  Load Balancer  │
│  (nginx/HAProxy)│
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│ Node 1│ │ Node 2│
│ 3 Br  │ │ 3 Br  │
│ 15 Ctx│ │ 15 Ctx│
└───────┘ └───────┘
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-render-api
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: api
          image: web-render-api:latest
          resources:
            requests:
              memory: "2Gi"
              cpu: "1"
            limits:
              memory: "4Gi"
              cpu: "2"
          env:
            - name: POOL_MAX_BROWSERS
              value: "3"
            - name: POOL_MAX_CONTEXTS
              value: "5"
```

---

## Production Deployment

### Docker

```dockerfile
FROM mcr.microsoft.com/playwright:v1.42.1-jammy

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Build and Run

```bash
# Build TypeScript
npm run build

# Build Docker image
docker build -t web-render-api .

# Run container
docker run -d \
  -p 3000:3000 \
  -e POOL_MAX_BROWSERS=3 \
  -e POOL_MAX_CONTEXTS=5 \
  --name web-render-api \
  web-render-api
```

### Health Check

Add to your monitoring:

```bash
# Liveness probe
curl -f http://localhost:3000/health

# Check pool capacity
curl http://localhost:3000/v1/pool/status
```

---

## Troubleshooting

### Browser Launch Failures

```
Error: Failed to launch browser
```

**Fix:** Install browser dependencies:
```bash
npx playwright install-deps chromium
npm run install:browsers
```

### Out of Memory

```
JavaScript heap out of memory
```

**Fix:** Reduce pool size or increase Node memory:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

### Timeout Errors

```
Navigation timeout: 30000ms exceeded
```

**Causes:**
- Target site is slow
- Proxy is slow/unreliable
- Network issues

**Fix:** Increase timeout:
```json
{
  "render": {
    "timeout_ms": 60000
  }
}
```

### Proxy Connection Refused

```
Error: Proxy connection refused
```

**Check:**
1. Proxy server is accessible
2. Credentials are correct
3. Proxy supports HTTPS CONNECT
4. No firewall blocking

---

## Example Requests

### Basic Render

```bash
curl -X POST http://localhost:3000/v1/render \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

### Google Search with Scroll

```bash
curl -X POST http://localhost:3000/v1/render \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.google.com/search?q=playwright",
    "render": {
      "wait_until": "networkidle",
      "timeout_ms": 45000,
      "scroll": {
        "enabled": true,
        "max_scrolls": 5,
        "delay_ms": 700
      }
    }
  }'
```

### With Screenshot

```bash
curl -X POST http://localhost:3000/v1/render \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "debug": {
      "screenshot": true
    }
  }'
```

### Full Configuration

```bash
curl -X POST http://localhost:3000/v1/render \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.justdial.com/Delhi/Restaurants",
    "render": {
      "wait_until": "networkidle",
      "timeout_ms": 60000,
      "javascript": true,
      "scroll": {
        "enabled": true,
        "max_scrolls": 10,
        "delay_ms": 800
      }
    },
    "browser": {
      "viewport": { "width": 1920, "height": 1080 },
      "locale": "en-IN",
      "timezone": "Asia/Kolkata"
    },
    "proxy": {
      "server": "http://your-proxy:8080",
      "username": "user",
      "password": "pass"
    },
    "debug": {
      "screenshot": true
    }
  }'
```
