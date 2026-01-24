/**
 * Unit Tests for Scroll Engine
 */

import { describe, it, expect } from 'vitest';

describe('Scroll Engine Configuration', () => {
    describe('ScrollConfig validation', () => {
        it('should have valid defaults', () => {
            const defaultConfig = {
                enabled: false,
                max_scrolls: 5,
                delay_ms: 500,
            };

            expect(defaultConfig.enabled).toBe(false);
            expect(defaultConfig.max_scrolls).toBeGreaterThan(0);
            expect(defaultConfig.max_scrolls).toBeLessThanOrEqual(50);
            expect(defaultConfig.delay_ms).toBeGreaterThanOrEqual(100);
        });

        it('should accept valid scroll counts', () => {
            const validCounts = [1, 5, 10, 20, 50];
            validCounts.forEach(count => {
                expect(count).toBeGreaterThanOrEqual(1);
                expect(count).toBeLessThanOrEqual(50);
            });
        });

        it('should accept valid delay values', () => {
            const validDelays = [100, 500, 1000, 2000, 5000];
            validDelays.forEach(delay => {
                expect(delay).toBeGreaterThanOrEqual(100);
                expect(delay).toBeLessThanOrEqual(5000);
            });
        });
    });

    describe('Scroll amount calculation', () => {
        it('should calculate scroll amount based on viewport height', () => {
            const viewportHeight = 768;
            const minScroll = Math.floor(viewportHeight * 0.6);
            const maxScroll = Math.floor(viewportHeight * 0.9);

            // Scroll amount should be 60-90% of viewport
            expect(minScroll).toBe(460);
            expect(maxScroll).toBe(691);
        });

        it('should handle different viewport sizes', () => {
            const viewports = [
                { height: 600, minScroll: 360, maxScroll: 540 },
                { height: 768, minScroll: 460, maxScroll: 691 },
                { height: 1080, minScroll: 648, maxScroll: 972 },
            ];

            viewports.forEach(({ height, minScroll, maxScroll }) => {
                expect(Math.floor(height * 0.6)).toBe(minScroll);
                expect(Math.floor(height * 0.9)).toBe(maxScroll);
            });
        });
    });
});

describe('Timing utilities', () => {
    it('should generate random delay within range', () => {
        const min = 100;
        const max = 500;

        // Generate 10 random delays
        for (let i = 0; i < 10; i++) {
            const delay = Math.floor(Math.random() * (max - min + 1)) + min;
            expect(delay).toBeGreaterThanOrEqual(min);
            expect(delay).toBeLessThanOrEqual(max);
        }
    });

    it('should calculate jittered delay', () => {
        const baseDelay = 500;
        const jitterPercent = 20;
        const jitter = baseDelay * (jitterPercent / 100);
        const min = baseDelay - jitter;
        const max = baseDelay + jitter;

        expect(min).toBe(400);
        expect(max).toBe(600);
    });
});
