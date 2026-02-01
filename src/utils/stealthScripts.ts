/**
 * Stealth Scripts - JavaScript patches to hide automation indicators
 * These scripts are injected into every page to make the browser undetectable
 */

/**
 * Main stealth script that patches all detectable properties
 */
export const STEALTH_SCRIPT = `
// Override navigator.webdriver
Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
    configurable: true
});

// Override navigator.plugins to look like a real browser
Object.defineProperty(navigator, 'plugins', {
    get: () => {
        const plugins = [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
        ];
        plugins.length = 3;
        return plugins;
    },
    configurable: true
});

// Override navigator.languages
Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
    configurable: true
});

// Override navigator.platform
Object.defineProperty(navigator, 'platform', {
    get: () => 'MacIntel',
    configurable: true
});

// Override navigator.hardwareConcurrency
Object.defineProperty(navigator, 'hardwareConcurrency', {
    get: () => 8,
    configurable: true
});

// Override navigator.deviceMemory
Object.defineProperty(navigator, 'deviceMemory', {
    get: () => 8,
    configurable: true
});

// Fix permissions API
const originalQuery = window.Permissions?.prototype?.query;
if (originalQuery) {
    window.Permissions.prototype.query = function(parameters) {
        if (parameters.name === 'notifications') {
            return Promise.resolve({ state: Notification.permission });
        }
        return originalQuery.call(this, parameters);
    };
}

// Override chrome runtime
window.chrome = {
    runtime: {},
    loadTimes: function() {},
    csi: function() {},
    app: {}
};

// Fix WebGL vendor/renderer
const getParameterProxyHandler = {
    apply: function(target, thisArg, argumentsList) {
        const param = argumentsList[0];
        const gl = thisArg;
        
        // UNMASKED_VENDOR_WEBGL
        if (param === 37445) {
            return 'Intel Inc.';
        }
        // UNMASKED_RENDERER_WEBGL
        if (param === 37446) {
            return 'Intel Iris OpenGL Engine';
        }
        
        return Reflect.apply(target, thisArg, argumentsList);
    }
};

try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
        const originalGetParameter = gl.getParameter.bind(gl);
        gl.getParameter = new Proxy(originalGetParameter, getParameterProxyHandler);
    }
} catch (e) {}

// Override iframe contentWindow access
const originalContentWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
    get: function() {
        const iframe = originalContentWindow.get.call(this);
        if (iframe) {
            try {
                Object.defineProperty(iframe.navigator, 'webdriver', {
                    get: () => undefined
                });
            } catch (e) {}
        }
        return iframe;
    }
});

// Prevent detection via toString
const originalToString = Function.prototype.toString;
Function.prototype.toString = function() {
    if (this === navigator.webdriver) {
        return 'function webdriver() { [native code] }';
    }
    return originalToString.call(this);
};

// Override connection type
if (navigator.connection) {
    Object.defineProperty(navigator.connection, 'rtt', { get: () => 100, configurable: true });
}

// Remove automation indicators from user agent data
if (navigator.userAgentData) {
    Object.defineProperty(navigator.userAgentData, 'brands', {
        get: () => [
            { brand: 'Google Chrome', version: '120' },
            { brand: 'Chromium', version: '120' },
            { brand: 'Not_A Brand', version: '24' }
        ]
    });
}

console.log('[Stealth] Anti-detection patches applied');
`;

/**
 * Disable automation flags in CDP
 */
export const CDP_STEALTH_COMMANDS = [
    { method: 'Page.addScriptToEvaluateOnNewDocument', params: { source: STEALTH_SCRIPT } },
];

/**
 * Get random delay for human-like behavior
 */
export function getRandomDelay(min: number = 100, max: number = 500): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
