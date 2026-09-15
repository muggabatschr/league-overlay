import path from 'path';

/**
 * Directory holding the runtime state (overlay config, Riot API key).
 *
 * The packaged Windows app is installed into a read-only location, so the
 * Electron shell points this at the user's AppData folder. During `pnpm dev`
 * it stays inside the repository (`./data`), unchanged from before.
 */
export function dataDir(): string {
  return process.env.LEAGUE_OVERLAY_DATA_DIR || path.join(process.cwd(), 'data');
}
