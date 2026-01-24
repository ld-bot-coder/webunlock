/**
 * Browser Fingerprint Manager
 * Applies realistic fingerprints and removes automation flags
 */

import type { BrowserContext, Page } from 'playwright';
import type { BrowserConfig } from '../types/index.js';
import { USER_AGENTS } from '../config/index.js';

/**
 * Get a random user agent
 */
export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Generate default device scale factor based on viewport
 */
export function getDeviceScaleFactor(width: number): number {
  // Common DPR values based on screen width
  if (width >= 2560) return 2; // 4K/Retina
  if (width >= 1920) return 1.5;
  return 1;
}

/**
 * Script to inject for removing automation flags
 * This runs before any page JavaScript
 */
/**
 * Script to inject for removing automation flags
 * This runs before any page JavaScript
 */
export function getStealthScript(): string {
  return `
    // protect against repeated injection
    if (window.__stealth_injected) return;
    Object.defineProperty(window, '__stealth_injected', { value: true, enumerable: false });

    // 1. Remove webdriver flag (Robust)
    const newProto = navigator.__proto__;
    delete newProto.webdriver;
    navigator.__proto__ = newProto;

    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
      enumerable: true,
      configurable: true
    });

    // 2. Mock Chrome Object
    if (!window.chrome) {
      window.chrome = {
        runtime: {
            OnInstalledReason: {
                INSTALL: "install",
                UPDATE: "update",
                CHROME_UPDATE: "chrome_update",
                SHARED_MODULE_UPDATE: "shared_module_update"
            },
            OnRestartRequiredReason: {
                APP_UPDATE: "app_update",
                OS_UPDATE: "os_update",
                PERIODIC: "periodic"
            },
            PlatformArch: {
                ARM: "arm",
                ARM64: "arm64",
                MIPS: "mips",
                MIPS64: "mips64",
                X86_32: "x86-32",
                X86_64: "x86-64"
            },
            PlatformNaclArch: {
                ARM: "arm",
                MIPS: "mips",
                MIPS64: "mips64",
                X86_32: "x86-32",
                X86_64: "x86-64"
            },
            PlatformOs: {
                ANDROID: "android",
                CROS: "cros",
                LINUX: "linux",
                MAC: "mac",
                OPENBSD: "openbsd",
                WIN: "win"
            },
            RequestUpdateCheckStatus: {
                NO_UPDATE: "no_update",
                THROTTLED: "throttled",
                UPDATE_AVAILABLE: "update_available"
            },
            connect: function() {},
            sendMessage: function() {}
        },
        loadTimes: function() {},
        csi: function() {},
        app: {
            isInstalled: false,
            getIsInstalled: function() { return false; },
            installState: function() { return "not_installed"; },
            runningState: function() { return "cannot_run"; }
        }
      };
    }

    // 3. Mock Permissions (Passes "Notification" check)
    if (window.navigator.permissions) {
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ state: 'promp', onchange: null });
        }
        return originalQuery.call(window.navigator.permissions, parameters);
      };
    }

    // 4. Mock Plugins & MimeTypes (Crucial for Google)
    const makePluginArray = (plugins) => {
        const pluginArray = plugins;
        pluginArray.refresh = () => {};
        pluginArray.item = (i) => plugins[i];
        pluginArray.namedItem = (name) => plugins.find(p => p.name === name);
        return pluginArray;
    };

    const pluginsData = [
        { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer", description: "Portable Document Format" },
        { name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai", description: "" },
        { name: "Native Client", filename: "internal-nacl-plugin", description: "" }
    ];

    const pluginObjects = pluginsData.map(data => {
        const p = Object.create(Plugin.prototype);
        Object.defineProperties(p, {
            name: { value: data.name, enumerable: true },
            filename: { value: data.filename, enumerable: true },
            description: { value: data.description, enumerable: true },
            length: { value: 0, enumerable: true }
        });
        return p;
    });

    const pluginArray = makePluginArray(pluginObjects);
    Object.defineProperty(navigator, 'plugins', {
        get: () => pluginArray,
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(navigator, 'mimeTypes', {
        get: () => {
            const mimeTypes = [];
            mimeTypes.item = () => null;
            mimeTypes.namedItem = () => null;
            return mimeTypes;
        },
        enumerable: true,
        configurable: true
    });

    // 5. Hide Webdriver Leak via Error Stack Traces
    const originalError = window.Error;
    window.Error = function Error(...args) {
        if (args.length > 0) return new originalError(...args);
        return new originalError();
    };
    window.Error.prototype = originalError.prototype;
    window.Error.captureStackTrace = originalError.captureStackTrace;

    // 6. Fix Hairline (Dimensions)
    Object.defineProperty(window, 'outerWidth', {
      get: () => window.innerWidth,
    });
    Object.defineProperty(window, 'outerHeight', {
      get: () => window.innerHeight + 85,
    });

    // 7. Mask WebGL Vendor/Renderer (Hardware Concurrency)
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      // 37445: UNMASKED_VENDOR_WEBGL
      if (parameter === 37445) return 'Intel Inc.';
      // 37446: UNMASKED_RENDERER_WEBGL
      if (parameter === 37446) return 'Intel(R) Iris(R) Xe Graphics';
      return getParameter.call(this, parameter);
    };

    // 8. Broken Image Handling (Avoids 0x0 images indicating headless)
    ['height', 'width'].forEach(property => {
      const imageDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, property);
      Object.defineProperty(HTMLImageElement.prototype, property, {
        ...imageDescriptor,
        get: function() {
          if (this.complete && this.naturalHeight == 0) return 20;
          return imageDescriptor.get.apply(this);
        },
      });
    });

    // 9. Hardware Concurrency
    Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8, // Typical value
        enumerable: true,
        configurable: true
    });

    // 10. Connection RTT/Downlink
    if (!navigator.connection) {
        Object.defineProperty(navigator, 'connection', {
            get: () => ({
                rtt: 50,
                downlink: 10,
                effectiveType: '4g',
                saveData: false,
                onchange: null,
                addEventListener: function() {},
                removeEventListener: function() {},
                dispatchEvent: function() { return false; }
            }),
            enumerable: true
        });
    }

    // 11. Device Memory
    if (!navigator.deviceMemory) {
        Object.defineProperty(navigator, 'deviceMemory', {
            get: () => 8,
            enumerable: true
        });
    }

    // 12. Canvas Noise
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type) {
        if (type === 'image/png' && this.width > 0 && this.height > 0) {
            const ctx = this.getContext('2d');
            if (ctx) {
                const imageData = ctx.getImageData(0, 0, this.width, this.height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    if (Math.random() < 0.0001) {
                        data[i] = (data[i] + 1) % 256;
                    }
                }
                ctx.putImageData(imageData, 0, 0);
            }
        }
        return originalToDataURL.apply(this, arguments);
    };
    `;
}

/**
 * Apply fingerprint settings to a browser context
 */
export async function applyFingerprint(
  context: BrowserContext,
  config?: BrowserConfig
): Promise<void> {
  // Add initialization script for stealth
  await context.addInitScript(getStealthScript());

  const ua = config?.user_agent || '';
  const isChrome = ua.includes('Chrome');
  const isMac = ua.includes('Mac');
  const isWindows = ua.includes('Windows');
  const isLinux = ua.includes('Linux');

  // Base headers
  const headers: Record<string, string> = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': config?.locale || 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Upgrade-Insecure-Requests': '1',
  };

  // Chrome-specific headers (Client Hints)
  if (isChrome) {
    // Extract version major if possible, default to 122
    const versionMatch = ua.match(/Chrome\/(\d+)/);
    const version = versionMatch ? versionMatch[1] : '122';

    headers['Sec-Ch-Ua'] = `"Chromium";v="${version}", "Not(A:Brand";v="24", "Google Chrome";v="${version}"`;
    headers['Sec-Ch-Ua-Mobile'] = '?0';

    if (isWindows) headers['Sec-Ch-Ua-Platform'] = '"Windows"';
    else if (isMac) headers['Sec-Ch-Ua-Platform'] = '"macOS"';
    else if (isLinux) headers['Sec-Ch-Ua-Platform'] = '"Linux"';

    headers['Sec-Fetch-Dest'] = 'document';
    headers['Sec-Fetch-Mode'] = 'navigate';
    headers['Sec-Fetch-Site'] = 'none';
    headers['Sec-Fetch-User'] = '?1';
  }

  // Set extra HTTP headers for more realistic requests
  await context.setExtraHTTPHeaders(headers);
}

/**
 * Apply additional stealth measures to a page
 * (Now largely handled by context-level scripts)
 */
export async function applyPageStealth(page: Page): Promise<void> {
  // Additional page-level actions if needed
  // Most logic moved to getStealthScript for full iframe support
}

/**
 * Get context options for fingerprinting
 */
export function getFingerprintOptions(config?: BrowserConfig): object {
  const userAgent = config?.user_agent || getRandomUserAgent();
  const viewport = config?.viewport || { width: 1366, height: 768 };
  const locale = config?.locale || 'en-US';
  const timezone = config?.timezone || 'America/New_York';

  return {
    userAgent,
    viewport,
    locale,
    timezoneId: timezone,
    deviceScaleFactor: getDeviceScaleFactor(viewport.width),
    hasTouch: false,
    isMobile: false,
    javaScriptEnabled: true,
    ignoreHTTPSErrors: true,
    // Permissions
    permissions: ['geolocation'],
    // Geolocation (approximate, based on timezone)
    geolocation: getGeolocationFromTimezone(timezone),
  };
}

/**
 * Get approximate geolocation based on timezone
 */
function getGeolocationFromTimezone(timezone: string): { latitude: number; longitude: number } {
  const geoMap: Record<string, { latitude: number; longitude: number }> = {
    'America/New_York': { latitude: 40.7128, longitude: -74.0060 },
    'America/Los_Angeles': { latitude: 34.0522, longitude: -118.2437 },
    'America/Chicago': { latitude: 41.8781, longitude: -87.6298 },
    'Europe/London': { latitude: 51.5074, longitude: -0.1278 },
    'Europe/Berlin': { latitude: 52.5200, longitude: 13.4050 },
    'Europe/Paris': { latitude: 48.8566, longitude: 2.3522 },
    'Asia/Tokyo': { latitude: 35.6762, longitude: 139.6503 },
    'Asia/Kolkata': { latitude: 28.6139, longitude: 77.2090 },
    'Asia/Shanghai': { latitude: 31.2304, longitude: 121.4737 },
    'Australia/Sydney': { latitude: -33.8688, longitude: 151.2093 },
  };

  return geoMap[timezone] || { latitude: 40.7128, longitude: -74.0060 };
}
