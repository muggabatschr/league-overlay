import { promises as fs } from 'fs';
import path from 'path';

export type OverlayDesign = 'A' | 'B' | 'C' | 'D';

export type QueueFilter = 'all' | 'solo' | 'flex' | 'aram' | 'aram-mayhem' | 'normal' | 'arena';

export interface OverlayConfig {
  /** Riot ID in the form "GameName#TAG" */
  riotId: string;
  /** Platform routing value, e.g. "euw1" */
  platform: string;
  /** Session start as unix timestamp in milliseconds */
  sessionStart: number;
  /** Poll interval for the overlay in seconds */
  refreshSeconds: number;
  /** Overlay layout variant */
  design: OverlayDesign;
  /** Which game mode counts for the session and which ranked queue is shown */
  queueFilter: QueueFilter;
  /** Background opacity of the overlay box in percent (0 = fully transparent, 100 = opaque) */
  boxOpacity: number;
}

const CONFIG_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(CONFIG_DIR, 'overlay-config.json');

const DEFAULT_CONFIG: OverlayConfig = {
  riotId: '',
  platform: 'euw1',
  sessionStart: Date.now(),
  refreshSeconds: 60,
  design: 'A',
  queueFilter: 'all',
  boxOpacity: 92,
};

export async function readConfig(): Promise<OverlayConfig> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function writeConfig(update: Partial<OverlayConfig>): Promise<OverlayConfig> {
  const current = await readConfig();
  const next: OverlayConfig = { ...current, ...update };
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}
