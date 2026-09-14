import { NextResponse } from 'next/server';
import { getMatchHistory, getMatchDetails } from '@/utils/riotApi';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const puuid = searchParams.get('puuid');
  const count = searchParams.get('count') || '10';

  if (!puuid) {
    return NextResponse.json(
      { error: 'PUUID is required' },
      { status: 400 }
    );
  }

  try {
    const matchIds = await getMatchHistory(puuid, { count: parseInt(count) });
    const matches = await Promise.all(
      matchIds.map((matchId) => getMatchDetails(matchId))
    );
    return NextResponse.json(matches);
  } catch (error) {
    console.error('Error fetching matches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch match data' },
      { status: 500 }
    );
  }
} 