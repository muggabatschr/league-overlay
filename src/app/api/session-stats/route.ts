import { NextResponse } from 'next/server';
import { OverlayConfig, readConfig } from '@/utils/config';
import { MissingApiKeyError } from '@/utils/apiKey';
import {
  getPuuidByRiotId,
  getMatchHistory,
  getMatchDetails,
  getDataDragonVersion,
  getLeagueEntries,
} from '@/utils/riotApi';

export interface SessionGame {
  matchId: string;
  championName: string;
  championIconUrl: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  queueId: number;
  queueName: string;
  gameEndTimestamp: number;
}

// Lesbare Namen für die gängigen Queue-IDs (https://static.developer.riotgames.com/docs/lol/queues.json)
const QUEUE_NAMES: Record<number, string> = {
  400: 'Normal (Draft)',
  420: 'Ranked Solo/Duo',
  430: 'Normal (Blind)',
  440: 'Ranked Flex',
  450: 'ARAM',
  480: 'Swiftplay',
  490: 'Quickplay',
  700: 'Clash',
  720: 'ARAM Clash',
  900: 'ARURF',
  1700: 'Arena',
  1900: 'URF',
  2400: 'ARAM: Mayhem',
};

export interface RankedInfo {
  queue: string;
  tier: string;
  division: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  winRate: number;
  crestUrl: string;
}

export interface SessionStats {
  riotId: string;
  sessionStart: number;
  wins: number;
  losses: number;
  winRate: number;
  games: SessionGame[];
  ranked: RankedInfo | null;
  ddragonVersion: string;
  refreshSeconds: number;
  design: string;
  boxOpacity: number;
  /** When these numbers were actually fetched from Riot (ms since epoch). */
  fetchedAt: number;
}

// Master+ hat keine Divisionen mehr.
const APEX_TIERS = ['MASTER', 'GRANDMASTER', 'CHALLENGER'];

// Abbildung des Backend-Spielmodus auf die Filter der Match-V5-API.
const QUEUE_FILTER_PARAMS: Record<string, { queue?: number; type?: string }> = {
  all: {},
  solo: { queue: 420 },
  flex: { queue: 440 },
  aram: { queue: 450 },
  'aram-mayhem': { queue: 2400 },
  normal: { type: 'normal' },
  arena: { queue: 1700 },
};

export const dynamic = 'force-dynamic';

/**
 * Last result from Riot, shared by every client.
 *
 * The overlay, the control panel and the preview window all poll this route.
 * Without a cache each of them would hit Riot separately, so the API load
 * would grow with the number of open windows instead of staying flat.
 */
let cache: { key: string; stats: SessionStats } | null = null;

/** Everything that changes which matches are counted — a new value voids the cache. */
function cacheKey(config: OverlayConfig): string {
  return [config.riotId, config.platform, config.queueFilter, config.sessionStart].join('|');
}

export async function GET(request: Request) {
  const config = await readConfig();
  const force = new URL(request.url).searchParams.get('force') === '1';

  if (!config.riotId) {
    return NextResponse.json(
      { error: 'Keine Riot ID hinterlegt — im Control-Panel unter „Spieler“ eintragen.' },
      { status: 400 }
    );
  }

  const key = cacheKey(config);
  const maxAge = Math.max(15, config.refreshSeconds) * 1000;

  if (!force && cache?.key === key && Date.now() - cache.stats.fetchedAt < maxAge) {
    // Design and interval come straight from the config, so changing them in
    // the control panel takes effect on the next poll instead of waiting for
    // the cache to expire.
    return NextResponse.json({
      ...cache.stats,
      refreshSeconds: config.refreshSeconds,
      design: config.design,
      boxOpacity: config.boxOpacity,
    } satisfies SessionStats);
  }

  try {
    const [puuid, ddragonVersion] = await Promise.all([
      getPuuidByRiotId(config.riotId, config.platform),
      getDataDragonVersion(),
    ]);

    const [matchIds, leagueEntries] = await Promise.all([
      getMatchHistory(puuid, {
        count: 50,
        startTime: Math.floor(config.sessionStart / 1000),
        platform: config.platform,
        ...QUEUE_FILTER_PARAMS[config.queueFilter],
      }),
      getLeagueEntries(puuid, config.platform).catch(() => []),
    ]);

    const soloEntry = leagueEntries.find((e) => e.queueType === 'RANKED_SOLO_5x5');
    const flexEntry = leagueEntries.find((e) => e.queueType === 'RANKED_FLEX_SR');
    // Passend zum gewählten Modus, sonst Solo/Duo bevorzugen.
    const entry =
      config.queueFilter === 'flex'
        ? flexEntry
        : config.queueFilter === 'solo'
          ? soloEntry
          : (soloEntry ?? flexEntry);

    const ranked: RankedInfo | null = entry
      ? {
          queue: entry.queueType === 'RANKED_SOLO_5x5' ? 'Solo/Duo' : 'Flex',
          tier: entry.tier,
          division: APEX_TIERS.includes(entry.tier) ? '' : entry.rank,
          leaguePoints: entry.leaguePoints,
          wins: entry.wins,
          losses: entry.losses,
          winRate:
            entry.wins + entry.losses > 0
              ? Math.round((entry.wins / (entry.wins + entry.losses)) * 100)
              : 0,
          crestUrl: `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/${entry.tier.toLowerCase()}.png`,
        }
      : null;

    const matches = await Promise.all(
      matchIds.map((matchId) => getMatchDetails(matchId, config.platform))
    );

    const games: SessionGame[] = matches
      .map((match) => {
        const participant = match.info.participants.find((p) => p.puuid === puuid);
        if (!participant) return null;
        // Remakes (early surrender) count neither as win nor loss.
        if (participant.gameEndedInEarlySurrender && match.info.gameDuration < 300) return null;
        return {
          matchId: match.metadata.matchId,
          championName: participant.championName,
          championIconUrl: `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${participant.championName}.png`,
          win: participant.win,
          kills: participant.kills,
          deaths: participant.deaths,
          assists: participant.assists,
          queueId: match.info.queueId,
          queueName: QUEUE_NAMES[match.info.queueId] ?? `Queue ${match.info.queueId}`,
          gameEndTimestamp: match.info.gameEndTimestamp,
        };
      })
      .filter((g): g is SessionGame => g !== null)
      .sort((a, b) => a.gameEndTimestamp - b.gameEndTimestamp);

    const wins = games.filter((g) => g.win).length;
    const losses = games.length - wins;
    const winRate = games.length > 0 ? Math.round((wins / games.length) * 100) : 0;

    const stats: SessionStats = {
      riotId: config.riotId,
      sessionStart: config.sessionStart,
      wins,
      losses,
      winRate,
      games,
      ranked,
      ddragonVersion,
      refreshSeconds: config.refreshSeconds,
      design: config.design,
      boxOpacity: config.boxOpacity,
      fetchedAt: Date.now(),
    };

    cache = { key, stats };
    return NextResponse.json(stats);
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return NextResponse.json({ error: error.message, missingApiKey: true }, { status: 400 });
    }
    console.error('Error building session stats:', error);
    return NextResponse.json(
      { error: 'Statistiken konnten nicht geladen werden — API-Key und Riot ID prüfen.' },
      { status: 500 }
    );
  }
}
