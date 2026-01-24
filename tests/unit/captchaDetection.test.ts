/**
 * Unit Tests for CAPTCHA Detection
 */

import { describe, it, expect } from 'vitest';

// Mock page object for testing
function createMockPage(content: string, text: string = '') {
    return {
        content: async () => content,
        evaluate: async (fn: () => string) => text,
        $: async (selector: string) => null,
        $$: async (selector: string) => [],
    };
}

describe('CAPTCHA Detection Patterns', () => {
    describe('reCAPTCHA patterns', () => {
        it('should match reCAPTCHA text patterns', () => {
            const patterns = [
                /recaptcha/i,
                /i'm not a robot/i,
                /verify you're human/i,
            ];

            expect(patterns[0].test('Please complete the reCAPTCHA')).toBe(true);
            expect(patterns[1].test("I'm not a robot")).toBe(true);
            expect(patterns[2].test("Verify you're human")).toBe(true);
        });
    });

    describe('hCaptcha patterns', () => {
        it('should match hCaptcha patterns', () => {
            const pattern = /hcaptcha/i;
            expect(pattern.test('hCaptcha challenge')).toBe(true);
            expect(pattern.test('HCAPTCHA')).toBe(true);
        });
    });

    describe('Cloudflare patterns', () => {
        it('should match Cloudflare challenge patterns', () => {
            const patterns = [
                /checking your browser/i,
                /cloudflare/i,
                /attention required/i,
                /just a moment/i,
                /ray id/i,
            ];

            expect(patterns[0].test('Checking your browser before accessing')).toBe(true);
            expect(patterns[1].test('Performance & security by Cloudflare')).toBe(true);
            expect(patterns[2].test('Attention Required!')).toBe(true);
            expect(patterns[3].test('Just a moment...')).toBe(true);
            expect(patterns[4].test('Ray ID: abc123')).toBe(true);
        });
    });

    describe('Generic CAPTCHA patterns', () => {
        it('should match generic captcha indicators', () => {
            const patterns = [
                /captcha/i,
                /prove you're human/i,
                /human verification/i,
                /security check/i,
                /are you a robot/i,
            ];

            expect(patterns[0].test('Complete the CAPTCHA')).toBe(true);
            expect(patterns[1].test("Prove you're human")).toBe(true);
            expect(patterns[2].test('Human verification required')).toBe(true);
            expect(patterns[3].test('Security check')).toBe(true);
            expect(patterns[4].test('Are you a robot?')).toBe(true);
        });
    });
});
