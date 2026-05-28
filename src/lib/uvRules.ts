export const DEFAULT_THRESHOLD = 3;
export const DEFAULT_COOLDOWN_MS = 60 * 60 * 1000;

export type NotifyReason = 'crossed-up' | 'crossed-down' | 'cooldown' | 'no-edge' | 'no-data';

export type ShouldNotifyDecision =
    | { notify: true; reason: 'crossed-up' | 'crossed-down'; title: string; body: string }
    | { notify: false; reason: 'cooldown' | 'no-edge' | 'no-data' };

export interface ShouldNotifyInput {
    currentUv: number | null;
    lastUv: number | null;
    lastNotifiedAt: Date | null;
    threshold?: number;
    cooldownMs?: number;
    now?: Date;
}

type Edge = 'crossed-up' | 'crossed-down' | null;

function detectEdge(current: number, last: number | null, threshold: number): Edge {
    const prev = last ?? 0;

    if (prev <= threshold && current > threshold) {
        return 'crossed-up';
    }

    const prevAbove = last !== null && last > threshold;

    if (prevAbove && current <= threshold) {
        return 'crossed-down';
    }

    return null;
}

function inCooldown(lastNotifiedAt: Date | null, cooldownMs: number, now: Date): boolean {
    if (lastNotifiedAt === null) {
        return false;
    }

    return now.getTime() - lastNotifiedAt.getTime() < cooldownMs;
}

function buildCopy(
    edge: 'crossed-up' | 'crossed-down',
    currentUv: number,
): { title: string; body: string } {
    if (edge === 'crossed-up') {
        return {
            title: '☀️ UV alto',
            body: `El índice UV es ${currentUv.toFixed(1)}. Protégete con bloqueador y sombrero.`,
        };
    }

    return {
        title: '✅ UV seguro',
        body: `El índice UV bajó a ${currentUv.toFixed(1)}. Ya podés exponerte sin problema.`,
    };
}

/**
 * Pure decision function — determines whether a Web Push notification should fire
 * for a subscription given the current and previous UV observations.
 */
export function shouldNotify(input: ShouldNotifyInput): ShouldNotifyDecision {
    const { currentUv, lastUv, lastNotifiedAt } = input;
    const threshold = input.threshold ?? DEFAULT_THRESHOLD;
    const cooldownMs = input.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    const now = input.now ?? new Date();

    if (currentUv === null) {
        return { notify: false, reason: 'no-data' };
    }

    const edge = detectEdge(currentUv, lastUv, threshold);

    if (edge === null) {
        return { notify: false, reason: 'no-edge' };
    }

    if (inCooldown(lastNotifiedAt, cooldownMs, now)) {
        return { notify: false, reason: 'cooldown' };
    }

    const { title, body } = buildCopy(edge, currentUv);

    return { notify: true, reason: edge, title, body };
}
