# Web Render API

A production-grade web rendering API that returns fully rendered HTML using real Chromium browsers, with enterprise-grade proxy flexibility and anti-detection measures.

## Features

- **Full JavaScript Rendering** - Real Chromium execution via Playwright
- **Any Proxy Provider** - HTTP, HTTPS, SOCKS5 with authentication
- **Browser Pooling** - Efficient resource management with auto-recovery
- **Anti-Detection** - Fingerprint masking, stealth measures
- **CAPTCHA Detection** - Detects but does not solve
- **Block Detection** - Cloudflare, Akamai, DataDome, PerimeterX
- **Lazy Loading Support** - Human-like scrolling engine
- **Production Ready** - Rate limiting, graceful shutdown, health checks

## Quick Start

```bash
# Install dependencies
npm install

# Install Chromium
npm run install:browsers

# Start development server
npm run dev

# Test the API
curl -X POST http://localhost:3000/v1/render \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

## API

### POST /v1/render

```json
{
  "url": "https://example.com",
  "render": {
    "wait_until": "networkidle",
    "timeout_ms": 30000,
    "scroll": { "enabled": true, "max_scrolls": 5 }
  },
  "proxy": {
    "server": "http://proxy:8080",
    "username": "user",
    "password": "pass"
  }
}
```

### Response

```json
{
  "success": true,
  "request_id": "uuid",
  "final_url": "https://example.com/",
  "content": { "html": "<!DOCTYPE html>..." },
  "meta": {
    "js_rendered": true,
    "proxy_used": true,
    "captcha_detected": false,
    "blocked": false,
    "http_status": 200,
    "load_time_ms": 3456
  }
}
```

## Documentation

See [OPERATIONS.md](./OPERATIONS.md) for complete documentation.

## License

MIT
