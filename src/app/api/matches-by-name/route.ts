import { NextResponse } from 'next/server';
import { getPuuidByRiotId, getMatchHistory, getMatchDetails } from '@/utils/riotApi';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const summonerName = searchParams.get('name');
  const count = searchParams.get('count') || '10';

  if (!summonerName) {
    return NextResponse.json(
      { error: 'Summoner name is required' },
      { status: 400 }
    );
  }

  try {
    const puuid = await getPuuidByRiotId(summonerName);
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
