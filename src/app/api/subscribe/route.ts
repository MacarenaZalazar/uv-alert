import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { upsertSubscription } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const subscribeSchema = z.object({
    subscription: z.object({
        endpoint: z.string().url(),
        keys: z.object({
            p256dh: z.string().min(1),
            auth: z.string().min(1),
        }),
    }),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    threshold: z.number().min(0).max(20).optional(),
});

/**
 * POST /api/subscribe
 *
 * Registers or updates a push subscription for UV-index alerts.
 * Accepts a Web Push subscription object plus the device's coordinates
 * and an optional UV threshold (defaults to 3.0 in the database).
 *
 * Returns 201 on first insert or 200 on update with `{ id, endpoint }`.
 * Returns 400 for invalid input or 500 for database errors.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    let body: unknown;

    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = subscribeSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Validation failed', details: parsed.error.flatten() },
            { status: 400 },
        );
    }

    const { subscription, lat, lon, threshold } = parsed.data;
    const userAgent = req.headers.get('user-agent') ?? undefined;

    const result = await upsertSubscription({
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        lat,
        lon,
        ...(threshold !== undefined && { threshold }),
        user_agent: userAgent,
    });

    if (!result.success) {
        console.error('[subscribe] upsertSubscription failed:', result.error.message);

        return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
    }

    return NextResponse.json(
        { id: result.data.id, endpoint: result.data.endpoint },
        { status: 201 },
    );
}
