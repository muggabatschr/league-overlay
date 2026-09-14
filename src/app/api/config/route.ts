import { NextResponse } from 'next/server';
import { readConfig, writeConfig, OverlayConfig } from '@/utils/config';

export async function GET() {
  const config = await readConfig();
  return NextResponse.json(config);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const update: Partial<OverlayConfig> = {};

    if (typeof body.riotId === 'string') update.riotId = body.riotId.trim();
    if (typeof body.platform === 'string') update.platform = body.platform;
    if (typeof body.sessionStart === 'number') update.sessionStart = body.sessionStart;
    if (typeof body.refreshSeconds === 'number' && body.refreshSeconds >= 15) {
      update.refreshSeconds = body.refreshSeconds;
    }
    if (['A', 'B', 'C', 'D'].includes(body.design)) update.design = body.design;
    if (['all', 'solo', 'flex', 'aram', 'aram-mayhem', 'normal', 'arena'].includes(body.queueFilter)) {
      update.queueFilter = body.queueFilter;
    }
    if (typeof body.boxOpacity === 'number' && body.boxOpacity >= 0 && body.boxOpacity <= 100) {
      update.boxOpacity = Math.round(body.boxOpacity);
    }

    const config = await writeConfig(update);
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error updating config:', error);
    return NextResponse.json(
      { error: 'Failed to update config' },
      { status: 500 }
    );
  }
}
