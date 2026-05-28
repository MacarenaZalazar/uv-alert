import { NextRequest, NextResponse } from 'next/server';
import {
    listSubscriptions,
    updateSubscriptionByEndpoint,
    deleteSubscriptionByEndpoint,
    type PushSubscriptionRow,
} from '@/lib/supabase';
import { fetchUv, gridKey, type UvReading } from '@/lib/openMeteo';
import { shouldNotify, DEFAULT_THRESHOLD, DEFAULT_COOLDOWN_MS } from '@/lib/uvRules';
import { sendPush } from '@/lib/webPush';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const HARD_LIMIT = 200;
const PUSH_CONCURRENCY = 5;

interface RunSummary {
    processed: number;
    sent: number;
    deleted: number;
    errors: number;
}

function authorize(req: NextRequest): boolean {
    const header = req.headers.get('Authorization');

    return header === `Bearer ${process.env.CRON_SECRET}`;
}

function groupByGrid(subs: PushSubscriptionRow[]): Map<string, PushSubscriptionRow[]> {
    const map = new Map<string, PushSubscriptionRow[]>();

    for (const sub of subs) {
        const key = gridKey(sub.lat, sub.lon);
        const bucket = map.get(key) ?? [];
        bucket.push(sub);
        map.set(key, bucket);
    }

    return map;
}

async function fetchGridReadings(
    gridMap: Map<string, PushSubscriptionRow[]>,
): Promise<Map<string, UvReading | null>> {
    const entries = Array.from(gridMap.entries());
    const results = new Map<string, UvReading | null>();
    const chunks: Array<typeof entries> = [];

    for (let i = 0; i < entries.length; i += PUSH_CONCURRENCY) {
        chunks.push(entries.slice(i, i + PUSH_CONCURRENCY));
    }

    for (const chunk of chunks) {
        await Promise.all(
            chunk.map(async ([key, subs]) => {
                const { lat, lon } = subs[0];
                const result = await fetchUv(lat, lon);

                if (!result.success) {
                    console.error(
                        `[uv-check] fetchUv failed for grid ${key}:`,
                        result.error.message,
                    );
                    results.set(key, null);

                    return;
                }

                results.set(key, result.data);
            }),
        );
    }

    return results;
}

async function processSub(
    sub: PushSubscriptionRow,
    reading: UvReading,
    summary: RunSummary,
): Promise<void> {
    const now = new Date();
    const nowIso = now.toISOString();

    const decision = shouldNotify({
        currentUv: reading.uv,
        lastUv: sub.last_uv ?? null,
        lastNotifiedAt: sub.last_notified_at ? new Date(sub.last_notified_at) : null,
        threshold: sub.threshold ?? DEFAULT_THRESHOLD,
        cooldownMs: DEFAULT_COOLDOWN_MS,
        now,
    });

    if (!decision.notify) {
        if (decision.reason === 'no-data') {
            await updateSubscriptionByEndpoint(sub.endpoint, { last_polled_at: nowIso });
        } else {
            await updateSubscriptionByEndpoint(sub.endpoint, {
                last_uv: reading.uv,
                last_polled_at: nowIso,
            });
        }

        return;
    }

    const pushResult = await sendPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        { title: decision.title, body: decision.body, url: '/' },
    );

    if (pushResult.success) {
        summary.sent++;
        await updateSubscriptionByEndpoint(sub.endpoint, {
            last_uv: reading.uv,
            last_notified_at: nowIso,
            last_polled_at: nowIso,
        });

        return;
    }

    const failure = pushResult.error;

    if (failure.reason === 'gone') {
        summary.deleted++;
        await deleteSubscriptionByEndpoint(sub.endpoint);

        return;
    }

    summary.errors++;
    console.error(`[uv-check] sendPush failed (${failure.reason}):`, failure.message);
    await updateSubscriptionByEndpoint(sub.endpoint, { last_polled_at: nowIso });
}

async function runWithConcurrency<T>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<void>,
): Promise<void> {
    const chunks: T[][] = [];

    for (let i = 0; i < items.length; i += limit) {
        chunks.push(items.slice(i, i + limit));
    }

    for (const chunk of chunks) {
        await Promise.all(chunk.map(worker));
    }
}

/**
 * POST /api/uv-check
 *
 * Cron-invoked orchestration endpoint that:
 * 1. Validates the CRON_SECRET bearer token.
 * 2. Loads up to HARD_LIMIT (200) subscriptions ordered by last_polled_at nulls first.
 * 3. Deduplicates by 0.1° grid cell and fetches UV from Open-Meteo once per cell.
 * 4. Evaluates shouldNotify per subscription and sends Web Push where warranted.
 * 5. Updates last_uv, last_notified_at, and last_polled_at in Supabase accordingly.
 * 6. Returns a JSON summary: { processed, sent, deleted, errors }.
 *
 * Requires Authorization: Bearer <CRON_SECRET> header.
 * Never throws — all errors are caught and returned as non-200 responses or counted in `errors`.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    if (!authorize(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subsResult = await listSubscriptions(HARD_LIMIT);

    if (!subsResult.success) {
        console.error('[uv-check] listSubscriptions failed:', subsResult.error.message);

        return NextResponse.json({ error: 'Failed to load subscriptions' }, { status: 500 });
    }

    const subs = subsResult.data;

    if (subs.length === 0) {
        return NextResponse.json({ processed: 0, sent: 0, deleted: 0, errors: 0 }, { status: 200 });
    }

    const gridMap = groupByGrid(subs);
    const readings = await fetchGridReadings(gridMap);

    const summary: RunSummary = { processed: subs.length, sent: 0, deleted: 0, errors: 0 };

    await runWithConcurrency(subs, PUSH_CONCURRENCY, async (sub) => {
        const reading = readings.get(gridKey(sub.lat, sub.lon));

        if (reading === undefined || reading === null) {
            return;
        }

        await processSub(sub, reading, summary);
    });

    console.info(
        `[uv-check] done — processed=${summary.processed} sent=${summary.sent} deleted=${summary.deleted} errors=${summary.errors}`,
    );

    return NextResponse.json(summary, { status: 200 });
}
