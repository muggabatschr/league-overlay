import { NextResponse } from 'next/server';
import { readConfig } from '@/utils/config';
import { checkApiKey } from '@/utils/riotApi';
import {
  ApiKeyStatus,
  clearApiKey,
  getApiKeyStatus,
  getRiotApiKey,
  storeApiKey,
} from '@/utils/apiKey';

export interface ApiKeyResponse extends ApiKeyStatus {
  /** Result of a live check against the Riot API, if one was performed. */
  check?: { valid: boolean; message: string };
}

export const dynamic = 'force-dynamic';

/**
 * Current key status — never the key itself, only the masked form.
 * With `?check=1` the stored key is additionally verified against Riot.
 */
export async function GET(request: Request) {
  const status = await getApiKeyStatus();
  const { searchParams } = new URL(request.url);

  if (searchParams.get('check') !== '1' || !status.configured) {
    return NextResponse.json(status satisfies ApiKeyResponse);
  }

  const config = await readConfig();
  const result = await checkApiKey(await getRiotApiKey(), config.platform);
  const response: ApiKeyResponse = {
    ...status,
    check: result.valid
      ? { valid: true, message: 'Key ist gültig.' }
      : { valid: false, message: result.message },
  };
  return NextResponse.json(response);
}

/** Validates a key against the Riot API and stores it only if Riot accepts it. */
export async function POST(request: Request) {
  let apiKey: string;
  try {
    const body = await request.json();
    apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'Bitte einen API-Key eingeben.' }, { status: 400 });
  }
  // Riot keys never contain whitespace — catches a half-pasted value early.
  if (/\s/.test(apiKey)) {
    return NextResponse.json(
      { error: 'Der Key enthält Leerzeichen oder Zeilenumbrüche — bitte vollständig einfügen.' },
      { status: 400 }
    );
  }

  const config = await readConfig();
  const result = await checkApiKey(apiKey, config.platform);

  if (!result.valid) {
    // Nothing is written: an unverified key would silently break the overlay.
    return NextResponse.json({ error: result.message, reason: result.reason }, { status: 400 });
  }

  await storeApiKey(apiKey, config.platform);
  const response: ApiKeyResponse = {
    ...(await getApiKeyStatus()),
    check: { valid: true, message: 'Key wurde von Riot bestätigt und gespeichert.' },
  };
  return NextResponse.json(response);
}

/** Removes the stored key. */
export async function DELETE() {
  await clearApiKey();
  return NextResponse.json(await getApiKeyStatus());
}
