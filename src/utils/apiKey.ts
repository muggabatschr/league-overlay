import { promises as fs } from 'fs';
import path from 'path';
import { dataDir } from './paths';

/** Number of characters left readable at the start and at the end of a masked key. */
const VISIBLE_CHARS = 5;

/** Where the API key is kept once the control panel has validated it. */
export type ApiKeySource = 'stored' | 'env' | 'none';

export interface ApiKeyStatus {
  configured: boolean;
  source: ApiKeySource;
  /** First and last 5 characters, everything in between replaced by `*`. */
  masked: string;
  /** When the key was last validated against the Riot API (ms since epoch). */
  validatedAt: number | null;
}

interface KeyFile {
  apiKey: string;
  validatedAt: number;
  platform: string;
}

/** Thrown when neither the control panel nor the environment provides a key. */
export class MissingApiKeyError extends Error {
  constructor() {
    super('Kein Riot-API-Key hinterlegt. Im Control-Panel unter „Riot API-Key“ eintragen.');
    this.name = 'MissingApiKeyError';
  }
}

function keyFile(): string {
  return path.join(dataDir(), 'riot-api-key.json');
}

// The file is read on every request otherwise; cache it and drop the cache on write.
let cache: KeyFile | null | undefined;

async function readKeyFile(): Promise<KeyFile | null> {
  if (cache !== undefined) return cache;
  try {
    const raw = await fs.readFile(keyFile(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<KeyFile>;
    cache =
      typeof parsed.apiKey === 'string' && parsed.apiKey.length > 0
        ? {
            apiKey: parsed.apiKey,
            validatedAt: typeof parsed.validatedAt === 'number' ? parsed.validatedAt : 0,
            platform: typeof parsed.platform === 'string' ? parsed.platform : '',
          }
        : null;
  } catch {
    cache = null;
  }
  return cache;
}

export async function storeApiKey(apiKey: string, platform: string): Promise<void> {
  const payload: KeyFile = { apiKey, validatedAt: Date.now(), platform };
  await fs.mkdir(dataDir(), { recursive: true });
  // 0600: readable only by the Windows/Unix account that runs the overlay.
  await fs.writeFile(keyFile(), JSON.stringify(payload, null, 2), { encoding: 'utf-8', mode: 0o600 });
  cache = payload;
}

export async function clearApiKey(): Promise<void> {
  try {
    await fs.unlink(keyFile());
  } catch {
    // Already gone — nothing to do.
  }
  cache = null;
}

/**
 * The key the Riot client should use: the one saved from the control panel,
 * otherwise `RIOT_API_KEY` from the environment (dev convenience via `.env`).
 */
export async function getRiotApiKey(): Promise<string> {
  const stored = await readKeyFile();
  if (stored) return stored.apiKey;

  const fromEnv = process.env.RIOT_API_KEY?.trim();
  if (fromEnv) return fromEnv;

  throw new MissingApiKeyError();
}

/** Replaces everything but the first and last 5 characters with `*`. */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= VISIBLE_CHARS * 2) return '*'.repeat(apiKey.length);
  return (
    apiKey.slice(0, VISIBLE_CHARS) +
    '*'.repeat(apiKey.length - VISIBLE_CHARS * 2) +
    apiKey.slice(-VISIBLE_CHARS)
  );
}

export async function getApiKeyStatus(): Promise<ApiKeyStatus> {
  const stored = await readKeyFile();
  if (stored) {
    return {
      configured: true,
      source: 'stored',
      masked: maskApiKey(stored.apiKey),
      validatedAt: stored.validatedAt || null,
    };
  }

  const fromEnv = process.env.RIOT_API_KEY?.trim();
  if (fromEnv) {
    return { configured: true, source: 'env', masked: maskApiKey(fromEnv), validatedAt: null };
  }

  return { configured: false, source: 'none', masked: '', validatedAt: null };
}
