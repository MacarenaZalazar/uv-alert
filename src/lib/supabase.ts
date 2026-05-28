import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface PushSubscriptionRow {
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    lat: number;
    lon: number;
    threshold: number;
    last_uv: number | null;
    last_notified_at: string | null;
    last_polled_at: string | null;
    user_agent: string | null;
    created_at: string;
    updated_at: string;
}

export interface PushSubscriptionInsert {
    endpoint: string;
    p256dh: string;
    auth: string;
    lat: number;
    lon: number;
    threshold?: number;
    user_agent?: string | null;
}

export interface PushSubscriptionUpdate {
    last_uv?: number | null;
    last_notified_at?: string | null;
    last_polled_at?: string | null;
}

type Result<T> = { success: true; data: T } | { success: false; error: Error };

let cached: SupabaseClient | null = null;

/**
 * Server-only Supabase client using Service Role key.
 * MUST NEVER be imported by client components.
 */
export function getSupabaseAdmin(): SupabaseClient {
    if (cached) {
        return cached;
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var missing');
    }

    cached = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    return cached;
}

/**
 * Insert or update a push subscription, keyed on endpoint.
 */
export async function upsertSubscription(
    input: PushSubscriptionInsert,
): Promise<Result<PushSubscriptionRow>> {
    try {
        const db = getSupabaseAdmin();
        const { data, error } = await db
            .from('push_subscriptions')
            .upsert(input, { onConflict: 'endpoint' })
            .select()
            .single();

        if (error) {
            return { success: false, error: new Error(error.message) };
        }

        return { success: true, data: data as PushSubscriptionRow };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
}

/**
 * Remove a push subscription by its endpoint URL.
 */
export async function deleteSubscriptionByEndpoint(endpoint: string): Promise<Result<boolean>> {
    try {
        const db = getSupabaseAdmin();
        const { error } = await db.from('push_subscriptions').delete().eq('endpoint', endpoint);

        if (error) {
            return { success: false, error: new Error(error.message) };
        }

        return { success: true, data: true };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
}

/**
 * List all subscriptions ordered by last_polled_at nulls first (oldest processed first).
 * Pass a limit to cap the result set.
 */
export async function listSubscriptions(limit?: number): Promise<Result<PushSubscriptionRow[]>> {
    try {
        const db = getSupabaseAdmin();
        let query = db
            .from('push_subscriptions')
            .select('*')
            .order('last_polled_at', { ascending: true, nullsFirst: true });

        if (limit !== undefined) {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) {
            return { success: false, error: new Error(error.message) };
        }

        return { success: true, data: (data ?? []) as PushSubscriptionRow[] };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
}

/**
 * Apply a partial update to a subscription identified by its endpoint URL.
 */
export async function updateSubscriptionByEndpoint(
    endpoint: string,
    patch: PushSubscriptionUpdate,
): Promise<Result<PushSubscriptionRow>> {
    try {
        const db = getSupabaseAdmin();
        const { data, error } = await db
            .from('push_subscriptions')
            .update(patch)
            .eq('endpoint', endpoint)
            .select()
            .single();

        if (error) {
            return { success: false, error: new Error(error.message) };
        }

        return { success: true, data: data as PushSubscriptionRow };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
}
