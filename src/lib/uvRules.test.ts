import { describe, it, expect } from 'vitest';
import {
    shouldNotify,
    DEFAULT_COOLDOWN_MS,
    type ShouldNotifyInput,
    type ShouldNotifyDecision,
} from './uvRules';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date('2026-05-28T12:00:00Z');

function minutesAgo(minutes: number): Date {
    return new Date(NOW.getTime() - minutes * 60 * 1000);
}

function call(overrides: Partial<ShouldNotifyInput>): ShouldNotifyDecision {
    return shouldNotify({
        currentUv: null,
        lastUv: null,
        lastNotifiedAt: null,
        now: NOW,
        ...overrides,
    });
}

// ---------------------------------------------------------------------------
// Rising edge
// ---------------------------------------------------------------------------

describe('rising edge', () => {
    it('returns crossed-up when rising from 2 to 5 with no prior notification', () => {
        // Arrange / Act
        const result = call({ currentUv: 5, lastUv: 2, lastNotifiedAt: null });

        // Assert
        expect(result.notify).toBe(true);

        if (result.notify) {
            expect(result.reason).toBe('crossed-up');
        }
    });

    it('returns crossed-up when lastUv is exactly at threshold (3) and currentUv just exceeds it (3.1)', () => {
        // lastUv = 3 means prev <= threshold (3 <= 3), so crossing up to 3.1 is valid
        const result = call({ currentUv: 3.1, lastUv: 3, lastNotifiedAt: null });

        expect(result.notify).toBe(true);

        if (result.notify) {
            expect(result.reason).toBe('crossed-up');
        }
    });

    it('returns crossed-up on first-ever observation above threshold (lastUv = null, currentUv = 7)', () => {
        // null baseline → prev treated as 0, 0 <= 3 and 7 > 3 → crossed-up
        const result = call({ currentUv: 7, lastUv: null, lastNotifiedAt: null });

        expect(result.notify).toBe(true);

        if (result.notify) {
            expect(result.reason).toBe('crossed-up');
        }
    });

    it('returns no-edge when lastUv = 2.9 and currentUv = 3.0 (3.0 is not strictly above threshold)', () => {
        // currentUv > threshold requires strictly greater; 3.0 > 3 is false
        const result = call({ currentUv: 3.0, lastUv: 2.9, lastNotifiedAt: null });

        expect(result.notify).toBe(false);

        if (!result.notify) {
            expect(result.reason).toBe('no-edge');
        }
    });

    it('includes Spanish copy for crossed-up: title contains "UV alto" and body contains UV value with one decimal', () => {
        const result = call({ currentUv: 5, lastUv: 2, lastNotifiedAt: null });

        expect(result.notify).toBe(true);

        if (result.notify) {
            expect(result.title).toContain('UV alto');
            expect(result.body).toContain('5.0');
        }
    });
});

// ---------------------------------------------------------------------------
// Falling edge
// ---------------------------------------------------------------------------

describe('falling edge', () => {
    it('returns crossed-down when falling from 5 to 2 with no prior notification', () => {
        const result = call({ currentUv: 2, lastUv: 5, lastNotifiedAt: null });

        expect(result.notify).toBe(true);

        if (result.notify) {
            expect(result.reason).toBe('crossed-down');
        }
    });

    it('returns crossed-down when lastUv = 3.1 and currentUv = 3.0 (crossing back to threshold counts)', () => {
        // prevAbove = 3.1 > 3 = true; 3.0 <= 3 = true → crossed-down
        const result = call({ currentUv: 3.0, lastUv: 3.1, lastNotifiedAt: null });

        expect(result.notify).toBe(true);

        if (result.notify) {
            expect(result.reason).toBe('crossed-down');
        }
    });

    it('returns no-edge when lastUv = null and currentUv = 2 (null baseline never fires falling edge)', () => {
        // null baseline means no "was above" state, so no crossing-down is possible
        const result = call({ currentUv: 2, lastUv: null, lastNotifiedAt: null });

        expect(result.notify).toBe(false);

        if (!result.notify) {
            expect(result.reason).toBe('no-edge');
        }
    });

    it('includes Spanish copy for crossed-down: title contains "UV seguro" and body contains UV value', () => {
        const result = call({ currentUv: 2, lastUv: 5, lastNotifiedAt: null });

        expect(result.notify).toBe(true);

        if (result.notify) {
            expect(result.title).toContain('UV seguro');
            expect(result.body).toContain('2.0');
        }
    });
});

// ---------------------------------------------------------------------------
// No edge
// ---------------------------------------------------------------------------

describe('no edge', () => {
    it('returns no-edge when staying above threshold (5 → 6)', () => {
        const result = call({ currentUv: 6, lastUv: 5, lastNotifiedAt: null });

        expect(result.notify).toBe(false);

        if (!result.notify) {
            expect(result.reason).toBe('no-edge');
        }
    });

    it('returns no-edge when staying below threshold (1 → 2)', () => {
        const result = call({ currentUv: 2, lastUv: 1, lastNotifiedAt: null });

        expect(result.notify).toBe(false);

        if (!result.notify) {
            expect(result.reason).toBe('no-edge');
        }
    });

    it('returns no-edge when both lastUv and currentUv are 0', () => {
        const result = call({ currentUv: 0, lastUv: 0, lastNotifiedAt: null });

        expect(result.notify).toBe(false);

        if (!result.notify) {
            expect(result.reason).toBe('no-edge');
        }
    });

    it('returns no-edge when lastUv and currentUv are the same (3 → 3)', () => {
        const result = call({ currentUv: 3, lastUv: 3, lastNotifiedAt: null });

        expect(result.notify).toBe(false);

        if (!result.notify) {
            expect(result.reason).toBe('no-edge');
        }
    });
});

// ---------------------------------------------------------------------------
// Cooldown
// ---------------------------------------------------------------------------

describe('cooldown', () => {
    it('suppresses a rising edge when lastNotifiedAt is 10 min ago (cooldown = 60 min)', () => {
        const result = call({
            currentUv: 5,
            lastUv: 2,
            lastNotifiedAt: minutesAgo(10),
            cooldownMs: DEFAULT_COOLDOWN_MS,
        });

        expect(result.notify).toBe(false);

        if (!result.notify) {
            expect(result.reason).toBe('cooldown');
        }
    });

    it('fires a rising edge when lastNotifiedAt is 61 min ago (cooldown expired)', () => {
        const result = call({
            currentUv: 5,
            lastUv: 2,
            lastNotifiedAt: minutesAgo(61),
            cooldownMs: DEFAULT_COOLDOWN_MS,
        });

        expect(result.notify).toBe(true);

        if (result.notify) {
            expect(result.reason).toBe('crossed-up');
        }
    });

    it('fires a rising edge when lastNotifiedAt is exactly 60 min ago (boundary: < cooldownMs is false at equality)', () => {
        // The check is: now - lastNotifiedAt < cooldownMs
        // At exactly 60 min: difference = 60*60*1000 = cooldownMs → NOT in cooldown → should fire
        const result = call({
            currentUv: 5,
            lastUv: 2,
            lastNotifiedAt: minutesAgo(60),
            cooldownMs: DEFAULT_COOLDOWN_MS,
        });

        expect(result.notify).toBe(true);

        if (result.notify) {
            expect(result.reason).toBe('crossed-up');
        }
    });

    it('suppresses a falling edge when lastNotifiedAt is within cooldown', () => {
        const result = call({
            currentUv: 2,
            lastUv: 5,
            lastNotifiedAt: minutesAgo(10),
            cooldownMs: DEFAULT_COOLDOWN_MS,
        });

        expect(result.notify).toBe(false);

        if (!result.notify) {
            expect(result.reason).toBe('cooldown');
        }
    });

    it('returns no-edge (not cooldown) when there is no crossing and lastNotifiedAt is recent', () => {
        // Ordering: edge check happens before cooldown, so no-edge wins
        const result = call({
            currentUv: 5.1,
            lastUv: 5,
            lastNotifiedAt: minutesAgo(1),
            cooldownMs: DEFAULT_COOLDOWN_MS,
        });

        expect(result.notify).toBe(false);

        if (!result.notify) {
            expect(result.reason).toBe('no-edge');
        }
    });
});

// ---------------------------------------------------------------------------
// No data
// ---------------------------------------------------------------------------

describe('no data', () => {
    it('returns no-data when currentUv is null regardless of lastUv and lastNotifiedAt', () => {
        const result = call({
            currentUv: null,
            lastUv: 5,
            lastNotifiedAt: minutesAgo(120),
        });

        expect(result.notify).toBe(false);

        if (!result.notify) {
            expect(result.reason).toBe('no-data');
        }
    });

    it('returns no-data when both currentUv and lastUv are null', () => {
        const result = call({
            currentUv: null,
            lastUv: null,
            lastNotifiedAt: null,
        });

        expect(result.notify).toBe(false);

        if (!result.notify) {
            expect(result.reason).toBe('no-data');
        }
    });
});

// ---------------------------------------------------------------------------
// Custom threshold
// ---------------------------------------------------------------------------

describe('custom threshold', () => {
    it('fires crossed-up when rising over a custom threshold of 5 (lastUv = 4, currentUv = 6)', () => {
        const result = call({
            currentUv: 6,
            lastUv: 4,
            lastNotifiedAt: null,
            threshold: 5,
        });

        expect(result.notify).toBe(true);

        if (result.notify) {
            expect(result.reason).toBe('crossed-up');
        }
    });

    it('returns no-edge when currentUv = 6 is below a custom threshold of 8 (lastUv = 4)', () => {
        const result = call({
            currentUv: 6,
            lastUv: 4,
            lastNotifiedAt: null,
            threshold: 8,
        });

        expect(result.notify).toBe(false);

        if (!result.notify) {
            expect(result.reason).toBe('no-edge');
        }
    });

    it('fires when custom cooldownMs = 5 min and lastNotifiedAt is 6 min ago (cooldown expired)', () => {
        const result = call({
            currentUv: 5,
            lastUv: 2,
            lastNotifiedAt: minutesAgo(6),
            cooldownMs: 5 * 60 * 1000,
        });

        expect(result.notify).toBe(true);

        if (result.notify) {
            expect(result.reason).toBe('crossed-up');
        }
    });
});

// ---------------------------------------------------------------------------
// `now` injection
// ---------------------------------------------------------------------------

describe('now injection', () => {
    it('uses injected now for cooldown math — exactly at boundary fires notification', () => {
        // now = 2026-05-28T12:00:00Z, lastNotifiedAt = 11:00:00Z → diff = 3600000ms = cooldownMs
        // Check: diff < cooldownMs → 3600000 < 3600000 is false → NOT in cooldown → fires
        const fixedNow = new Date('2026-05-28T12:00:00Z');
        const lastNotifiedAt = new Date('2026-05-28T11:00:00Z');

        const result = shouldNotify({
            currentUv: 5,
            lastUv: 2,
            lastNotifiedAt,
            cooldownMs: DEFAULT_COOLDOWN_MS,
            now: fixedNow,
        });

        expect(result.notify).toBe(true);

        if (result.notify) {
            expect(result.reason).toBe('crossed-up');
        }
    });

    it('uses injected now for cooldown math — 1ms inside cooldown suppresses notification', () => {
        // diff = cooldownMs - 1 → still in cooldown
        const fixedNow = new Date('2026-05-28T12:00:00Z');
        const lastNotifiedAt = new Date(fixedNow.getTime() - DEFAULT_COOLDOWN_MS + 1);

        const result = shouldNotify({
            currentUv: 5,
            lastUv: 2,
            lastNotifiedAt,
            cooldownMs: DEFAULT_COOLDOWN_MS,
            now: fixedNow,
        });

        expect(result.notify).toBe(false);

        if (!result.notify) {
            expect(result.reason).toBe('cooldown');
        }
    });

    it('does not use the real clock when now is injected (deterministic result regardless of wall time)', () => {
        // Two calls with identical injected now must return identical results
        const fixedNow = new Date('2030-01-01T00:00:00Z');
        const input: ShouldNotifyInput = {
            currentUv: 5,
            lastUv: 2,
            lastNotifiedAt: null,
            now: fixedNow,
        };

        const first = shouldNotify(input);
        const second = shouldNotify(input);

        expect(first).toEqual(second);
    });
});
