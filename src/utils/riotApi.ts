import axios from 'axios';
import { Summoner, Match } from '@/types/league';
import { getRiotApiKey } from '@/utils/apiKey';

/** Maps a platform routing value (summoner-v4) to its regional routing value (match-v5 / account-v1). */
const PLATFORM_TO_REGION: Record<string, string> = {
  euw1: 'europe',
  eun1: 'europe',
  tr1: 'europe',
  ru: 'europe',
  na1: 'americas',
  br1: 'americas',
  la1: 'americas',
  la2: 'americas',
  kr: 'asia',
  jp1: 'asia',
  oc1: 'sea',
  ph2: 'sea',
  sg2: 'sea',
  th2: 'sea',
  tw2: 'sea',
  vn2: 'sea',
};

export function regionForPlatform(platform: string): string {
  return PLATFORM_TO_REGION[platform] ?? 'europe';
}

/**
 * Builds a Riot client for a routing host. The key is resolved per call, so a
 * key saved in the control panel takes effect without restarting the server.
 */
async function riotClient(host: string) {
  const apiKey = await getRiotApiKey();
  return axios.create({
    baseURL: `https://${host}.api.riotgames.com`,
    headers: {
      'X-Riot-Token': apiKey,
    },
  });
}

export type ApiKeyCheck =
  | { valid: true }
  | { valid: false; reason: 'invalid' | 'rate-limited' | 'unreachable'; message: string };

/**
 * Checks a key against the Riot platform-status endpoint — the cheapest call
 * that still requires authentication — without touching the stored key.
 */
export async function checkApiKey(apiKey: string, platform = 'euw1'): Promise<ApiKeyCheck> {
  try {
    await axios.get(`https://${platform}.api.riotgames.com/lol/status/v4/platform-data`, {
      headers: { 'X-Riot-Token': apiKey },
      timeout: 10_000,
    });
    return { valid: true };
  } catch (error) {
    if (!axios.isAxiosError(error) || !error.response) {
      return {
        valid: false,
        reason: 'unreachable',
        message: 'Riot-API nicht erreichbar — Internetverbindung prüfen und erneut versuchen.',
      };
    }
    const status = error.response.status;
    if (status === 401 || status === 403) {
      return {
        valid: false,
        reason: 'invalid',
        message:
          'Key wurde von Riot abgelehnt (ungültig oder abgelaufen). Development-Keys laufen nach 24 Stunden ab.',
      };
    }
    if (status === 429) {
      return {
        valid: false,
        reason: 'rate-limited',
        message: 'Rate-Limit der Riot-API erreicht — bitte in einer Minute erneut prüfen.',
      };
    }
    return {
      valid: false,
      reason: 'unreachable',
      message: `Riot-API antwortete mit HTTP ${status}. Bitte später erneut versuchen.`,
    };
  }
}

const puuidCache = new Map<string, string>();

export const getPuuidByRiotId = async (riotId: string, platform = 'euw1'): Promise<string> => {
  const cached = puuidCache.get(riotId);
  if (cached) return cached;

  const [gameName, tagLine] = riotId.split('#');
  if (!gameName || !tagLine) {
    throw new Error(`Invalid Riot ID "${riotId}" — expected format "GameName#TAG"`);
  }
  const response = await (await riotClient(regionForPlatform(platform))).get(
    `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
  );
  puuidCache.set(riotId, response.data.puuid);
  return response.data.puuid;
};

export const getSummonerByName = async (riotId: string, platform = 'euw1'): Promise<Summoner> => {
  const puuid = await getPuuidByRiotId(riotId, platform);
  const response = await (await riotClient(platform)).get(`/lol/summoner/v4/summoners/by-puuid/${puuid}`);
  return response.data;
};

export interface MatchHistoryOptions {
  count?: number;
  /** Unix timestamp in seconds — only matches started after this are returned. */
  startTime?: number;
  /** Riot queue id, e.g. 420 = Ranked Solo/Duo, 450 = ARAM */
  queue?: number;
  /** Match type filter, e.g. "ranked" or "normal" */
  type?: string;
  platform?: string;
}

export const getMatchHistory = async (
  puuid: string,
  { count = 10, startTime, queue, type, platform = 'euw1' }: MatchHistoryOptions = {}
): Promise<string[]> => {
  const response = await (await riotClient(regionForPlatform(platform))).get(
    `/lol/match/v5/matches/by-puuid/${puuid}/ids`,
    {
      params: {
        start: 0,
        count,
        ...(startTime ? { startTime } : {}),
        ...(queue ? { queue } : {}),
        ...(type ? { type } : {}),
      },
    }
  );
  return response.data;
};

// Finished matches never change, so cache them for the lifetime of the server process.
const matchCache = new Map<string, Match>();

export const getMatchDetails = async (matchId: string, platform = 'euw1'): Promise<Match> => {
  const cached = matchCache.get(matchId);
  if (cached) return cached;

  const response = await (await riotClient(regionForPlatform(platform))).get(`/lol/match/v5/matches/${matchId}`);
  matchCache.set(matchId, response.data);
  return response.data;
};

export interface LeagueEntry {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  hotStreak: boolean;
}

export const getLeagueEntries = async (puuid: string, platform = 'euw1'): Promise<LeagueEntry[]> => {
  const response = await (await riotClient(platform)).get(`/lol/league/v4/entries/by-puuid/${puuid}`);
  return response.data;
};

let ddragonVersion: { value: string; fetchedAt: number } | null = null;

/** Latest Data Dragon version, cached for one hour. */
export const getDataDragonVersion = async (): Promise<string> => {
  if (ddragonVersion && Date.now() - ddragonVersion.fetchedAt < 60 * 60 * 1000) {
    return ddragonVersion.value;
  }
  const response = await axios.get<string[]>('https://ddragon.leagueoflegends.com/api/versions.json');
  ddragonVersion = { value: response.data[0], fetchedAt: Date.now() };
  return ddragonVersion.value;
};
