import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchCurrentWeather } from '@/lib/openMeteo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lon: z.coerce.number().min(-180).max(180),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({
        lat: searchParams.get('lat'),
        lon: searchParams.get('lon'),
    });

    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
    }

    const result = await fetchCurrentWeather(parsed.data.lat, parsed.data.lon);

    if (!result.success) {
        console.error('weather fetch failed', result.error.message);

        return NextResponse.json({ error: 'Weather fetch failed' }, { status: 502 });
    }

    return NextResponse.json(result.data, {
        headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300' },
    });
}
