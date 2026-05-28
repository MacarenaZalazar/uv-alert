import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteSubscriptionByEndpoint } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const unsubscribeSchema = z.object({
    endpoint: z.string().url(),
});

/**
 * POST /api/unsubscribe
 *
 * Removes a push subscription identified by its endpoint URL.
 * Idempotent: returns 200 even if the endpoint was not found.
 * Returns 400 for invalid input or 500 for database errors.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    let body: unknown;

    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = unsubscribeSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Validation failed', details: parsed.error.flatten() },
            { status: 400 },
        );
    }

    const result = await deleteSubscriptionByEndpoint(parsed.data.endpoint);

    if (!result.success) {
        console.error('[unsubscribe] deleteSubscriptionByEndpoint failed:', result.error.message);

        return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
}
