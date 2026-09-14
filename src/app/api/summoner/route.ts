import { NextResponse } from 'next/server';
import { getSummonerByName } from '@/utils/riotApi';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const summonerName = searchParams.get('name');

  if (!summonerName) {
    return NextResponse.json(
      { error: 'Summoner name is required' },
      { status: 400 }
    );
  }

  try {
    const summoner = await getSummonerByName(summonerName);
    return NextResponse.json(summoner);
  } catch (error) {
    console.error('Error fetching summoner:', error);
    return NextResponse.json(
      { error: 'Failed to fetch summoner data' },
      { status: 500 }
    );
  }
} 