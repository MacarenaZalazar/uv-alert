import webpush from 'web-push';

export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

export interface PushTarget {
    endpoint: string;
    p256dh: string;
    auth: string;
}

export interface PushPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    url?: string;
}

export type PushFailureReason = 'gone' | 'invalid' | 'unknown';

export interface PushSendResult {
    status: 'sent';
}

export interface PushSendFailure {
    status: 'failed';
    reason: PushFailureReason;
    statusCode?: number;
    message: string;
}

let configured = false;

function configure(): void {
    if (configured) {
        return;
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;

    if (!publicKey || !privateKey || !subject) {
        throw new Error(
            'VAPID env vars missing (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)',
        );
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
}

function mapError(err: webpush.WebPushError): PushSendFailure {
    const statusCode = err.statusCode;

    if (statusCode === 404 || statusCode === 410) {
        return { status: 'failed', reason: 'gone', statusCode, message: err.message };
    }

    if (statusCode >= 400 && statusCode < 500) {
        return { status: 'failed', reason: 'invalid', statusCode, message: err.message };
    }

    return { status: 'failed', reason: 'unknown', statusCode, message: err.message };
}

/**
 * Send a Web Push notification to a single subscription target.
 *
 * Returns `Result<PushSendResult, PushSendFailure>` — never throws.
 * - `gone` (404/410): caller should DELETE the subscription row from the DB.
 * - `invalid` (other 4xx): subscription is malformed; caller may also DELETE.
 * - `unknown` (5xx / network): transient; caller may retry on the next cron run.
 */
export async function sendPush(
    target: PushTarget,
    payload: PushPayload,
): Promise<Result<PushSendResult, PushSendFailure>> {
    try {
        configure();

        const subscription: webpush.PushSubscription = {
            endpoint: target.endpoint,
            keys: { p256dh: target.p256dh, auth: target.auth },
        };

        await webpush.sendNotification(subscription, JSON.stringify(payload));

        return { success: true, data: { status: 'sent' } };
    } catch (err) {
        if (err instanceof webpush.WebPushError) {
            return { success: false, error: mapError(err) };
        }

        const message = err instanceof Error ? err.message : String(err);

        return {
            success: false,
            error: { status: 'failed', reason: 'unknown', message },
        };
    }
}
