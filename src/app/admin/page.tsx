'use client';

import { useCallback, useEffect, useState } from 'react';

interface OverlayConfig {
  riotId: string;
  platform: string;
  sessionStart: number;
  refreshSeconds: number;
  design: string;
  queueFilter: string;
  boxOpacity: number;
}

const QUEUE_FILTERS = [
  { value: 'all', label: 'Alle Modi' },
  { value: 'solo', label: 'Ranked Solo/Duo' },
  { value: 'flex', label: 'Ranked Flex' },
  { value: 'aram', label: 'ARAM' },
  { value: 'aram-mayhem', label: 'ARAM: Mayhem' },
  { value: 'normal', label: 'Normal (Draft/Blind/Swiftplay)' },
  { value: 'arena', label: 'Arena' },
];

const DESIGNS = [
  {
    value: 'A',
    name: 'A — Kompakt einzeilig',
    hint: '≈ 330 px · Session + Rank in einer Zeile, Champion-Icons darunter',
  },
  {
    value: 'B',
    name: 'B — Zweizeilig gestapelt',
    hint: '≈ 230 px · Session oben, Season mit W/L darunter',
  },
  {
    value: 'C',
    name: 'C — Vertikale Eck-Karte',
    hint: '≈ 150 px breit · hochkant für den Bildschirmrand',
  },
  {
    value: 'D',
    name: 'D — Minimal-Ribbon',
    hint: '≈ 300 × 34 px · ultra-flach, Hextech-Rauten statt Champion-Icons',
  },
];

interface SessionStats {
  wins: number;
  losses: number;
  winRate: number;
  games: {
    matchId: string;
    championName: string;
    championIconUrl: string;
    win: boolean;
    kills: number;
    deaths: number;
    assists: number;
    queueName: string;
    gameEndTimestamp: number;
  }[];
  ranked: {
    queue: string;
    tier: string;
    division: string;
    leaguePoints: number;
    wins: number;
    losses: number;
    winRate: number;
    crestUrl: string;
  } | null;
}

const PLATFORMS = [
  { value: 'euw1', label: 'EUW (Europe West)' },
  { value: 'eun1', label: 'EUNE (Europe Nordic & East)' },
  { value: 'na1', label: 'NA (North America)' },
  { value: 'kr', label: 'KR (Korea)' },
  { value: 'br1', label: 'BR (Brazil)' },
  { value: 'jp1', label: 'JP (Japan)' },
  { value: 'oc1', label: 'OCE (Oceania)' },
  { value: 'tr1', label: 'TR (Turkey)' },
  { value: 'ru', label: 'RU (Russia)' },
];

/** Formats a timestamp for a datetime-local input in the user's local timezone. */
function toDatetimeLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminPage() {
  const [config, setConfig] = useState<OverlayConfig | null>(null);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [statsError, setStatsError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [overlayUrl, setOverlayUrl] = useState('');

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/session-stats', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        setStats(null);
        setStatsError(data.error ?? 'Statistiken konnten nicht geladen werden.');
        return;
      }
      setStats(data);
      setStatsError('');
    } catch {
      setStatsError('Statistiken konnten nicht geladen werden.');
    }
  }, []);

  useEffect(() => {
    setOverlayUrl(`${window.location.origin}/overlay`);
    fetch('/api/config')
      .then((r) => r.json())
      .then((c: OverlayConfig) => {
        setConfig(c);
        if (c.riotId) loadStats();
      });
  }, [loadStats]);

  const save = async (update: Partial<OverlayConfig>) => {
    if (!config) return;
    setSaving(true);
    setSavedMessage('');
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, ...update }),
      });
      const next = await response.json();
      setConfig(next);
      setSavedMessage('Gespeichert ✓');
      await loadStats();
    } finally {
      setSaving(false);
    }
  };

  if (!config) {
    return <main className="min-h-screen p-8">Lade Konfiguration…</main>;
  }

  return (
    <main className="min-h-screen p-8 bg-slate-900 text-slate-100">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-amber-300">Overlay-Backend</h1>

        <section className="bg-slate-800 rounded-xl p-6 space-y-4 border border-slate-700">
          <h2 className="text-xl font-semibold">Spieler</h2>
          <div className="space-y-2">
            <label className="block text-sm text-slate-300">Riot ID (Name#TAG)</label>
            <input
              type="text"
              value={config.riotId}
              onChange={(e) => setConfig({ ...config, riotId: e.target.value })}
              placeholder="z.B. Faker#KR1"
              className="w-full p-2 rounded-lg bg-slate-900 border border-slate-600 focus:border-amber-400 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-slate-300">Region</label>
            <select
              value={config.platform}
              onChange={(e) => setConfig({ ...config, platform: e.target.value })}
              className="w-full p-2 rounded-lg bg-slate-900 border border-slate-600 focus:border-amber-400 outline-none"
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-slate-300">Spielmodus</label>
            <select
              value={config.queueFilter}
              onChange={(e) => setConfig({ ...config, queueFilter: e.target.value })}
              className="w-full p-2 rounded-lg bg-slate-900 border border-slate-600 focus:border-amber-400 outline-none"
            >
              {QUEUE_FILTERS.map((q) => (
                <option key={q.value} value={q.value}>{q.label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400">
              Bestimmt, welche Spiele für die Session zählen. Bei „Ranked Flex“ wird auch die
              Season-Statistik der Flex-Queue angezeigt, sonst Solo/Duo (falls vorhanden).
            </p>
          </div>
        </section>

        <section className="bg-slate-800 rounded-xl p-6 space-y-4 border border-slate-700">
          <h2 className="text-xl font-semibold">Session</h2>
          <p className="text-sm text-slate-400">
            Alle Spiele ab diesem Zeitpunkt zählen für Wins, Loses und Winrate im Overlay.
          </p>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="space-y-2">
              <label className="block text-sm text-slate-300">Session-Start</label>
              <input
                type="datetime-local"
                value={toDatetimeLocal(config.sessionStart)}
                onChange={(e) =>
                  setConfig({ ...config, sessionStart: new Date(e.target.value).getTime() })
                }
                className="p-2 rounded-lg bg-slate-900 border border-slate-600 focus:border-amber-400 outline-none"
              />
            </div>
            <button
              onClick={() => save({ sessionStart: Date.now() })}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 disabled:opacity-50"
            >
              Neue Session jetzt starten
            </button>
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-slate-300">
              Overlay-Aktualisierung (Sekunden, min. 15)
            </label>
            <input
              type="number"
              min={15}
              value={config.refreshSeconds}
              onChange={(e) =>
                setConfig({ ...config, refreshSeconds: parseInt(e.target.value) || 60 })
              }
              className="w-32 p-2 rounded-lg bg-slate-900 border border-slate-600 focus:border-amber-400 outline-none"
            />
          </div>
        </section>

        <section className="bg-slate-800 rounded-xl p-6 space-y-4 border border-slate-700">
          <h2 className="text-xl font-semibold">Overlay-Design</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {DESIGNS.map((d) => (
              <label
                key={d.value}
                className={`flex flex-col gap-1 p-4 rounded-lg border cursor-pointer transition-colors ${
                  config.design === d.value
                    ? 'border-amber-400 bg-slate-700'
                    : 'border-slate-600 bg-slate-900 hover:border-slate-400'
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="design"
                    value={d.value}
                    checked={config.design === d.value}
                    onChange={() => setConfig({ ...config, design: d.value })}
                    className="accent-amber-400"
                  />
                  <span className="font-semibold">{d.name}</span>
                </span>
                <span className="text-xs text-slate-400 pl-6">{d.hint}</span>
              </label>
            ))}
          </div>
          <div className="space-y-2 pt-2">
            <label className="block text-sm text-slate-300">
              Box-Transparenz — Hintergrund-Deckkraft:{' '}
              <span className="font-semibold text-amber-300">{config.boxOpacity}%</span>
              {config.boxOpacity === 0 && ' (voll durchsichtig)'}
              {config.boxOpacity === 100 && ' (deckend)'}
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={config.boxOpacity}
              onChange={(e) => setConfig({ ...config, boxOpacity: parseInt(e.target.value) })}
              className="w-full accent-amber-400"
            />
            <div
              className="rounded-lg px-4 py-2 inline-block"
              style={{
                backgroundImage:
                  'linear-gradient(45deg, #64748b 25%, transparent 25%, transparent 75%, #64748b 75%), linear-gradient(45deg, #64748b 25%, #94a3b8 25%, #94a3b8 75%, #64748b 75%)',
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 8px 8px',
              }}
            >
              <span
                className="inline-block rounded-lg px-4 py-1.5 text-sm font-semibold"
                style={{
                  background: `linear-gradient(135deg, rgba(1,10,19,${config.boxOpacity / 100}), rgba(10,20,40,${config.boxOpacity / 100}))`,
                  border: '2px solid #785A28',
                  color: '#F0E6D2',
                  textShadow: `0 1px 2px rgba(0,0,0,${1 - config.boxOpacity / 100}), 0 0 4px rgba(0,0,0,${1 - config.boxOpacity / 100})`,
                }}
              >
                Vorschau
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Wirkt nur auf den Box-Hintergrund — Schrift, Icons und Rahmen bleiben voll sichtbar.
            </p>
          </div>
        </section>

        <div className="flex items-center gap-4">
          <button
            onClick={() => save({})}
            disabled={saving}
            className="px-6 py-2 rounded-lg bg-emerald-500 text-slate-900 font-semibold hover:bg-emerald-400 disabled:opacity-50"
          >
            {saving ? 'Speichere…' : 'Speichern'}
          </button>
          {savedMessage && <span className="text-emerald-400">{savedMessage}</span>}
        </div>

        <section className="bg-slate-800 rounded-xl p-6 space-y-3 border border-slate-700">
          <h2 className="text-xl font-semibold">Overlay für Streamlabs / OBS</h2>
          <p className="text-sm text-slate-400">
            Diese URL als <strong>Browser-Quelle</strong> hinzufügen (empfohlen: Breite 800, Höhe 200,
            benutzerdefiniertes CSS leer lassen — der Hintergrund ist transparent):
          </p>
          <div className="flex gap-2">
            <code className="flex-1 p-2 rounded-lg bg-slate-900 border border-slate-600 text-amber-300 overflow-x-auto">
              {overlayUrl}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(overlayUrl)}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
            >
              Kopieren
            </button>
          </div>
          <a
            href="/overlay"
            target="_blank"
            className="inline-block text-sm text-amber-300 underline"
          >
            Overlay-Vorschau öffnen ↗
          </a>
        </section>

        <section className="bg-slate-800 rounded-xl p-6 space-y-3 border border-slate-700">
          <h2 className="text-xl font-semibold">Aktuelle Session-Statistik</h2>
          {statsError && <p className="text-red-400 text-sm">{statsError}</p>}
          {stats && (
            <div className="space-y-3">
              <p className="text-lg">
                <span className="text-slate-400 text-sm uppercase tracking-wide mr-2">Session</span>
                <span className="text-emerald-400 font-bold">{stats.wins}W</span>{' '}
                <span className="text-red-400 font-bold">{stats.losses}L</span>{' '}
                <span className="font-bold">({stats.winRate}%)</span>
              </p>
              {stats.ranked && (
                <p className="text-lg flex items-center gap-2">
                  <span className="text-slate-400 text-sm uppercase tracking-wide mr-2">
                    Season ({stats.ranked.queue})
                  </span>
                  <img src={stats.ranked.crestUrl} alt={stats.ranked.tier} className="w-8 h-8" />
                  <span className="font-bold text-amber-300">
                    {stats.ranked.tier.charAt(0) + stats.ranked.tier.slice(1).toLowerCase()}
                    {stats.ranked.division ? ` ${stats.ranked.division}` : ''} ·{' '}
                    {stats.ranked.leaguePoints} LP
                  </span>
                  <span className="text-emerald-400 font-bold">{stats.ranked.wins}W</span>
                  <span className="text-red-400 font-bold">{stats.ranked.losses}L</span>
                  <span className="font-bold">({stats.ranked.winRate}%)</span>
                </p>
              )}
              <div className="flex gap-2 flex-wrap">
                {stats.games.map((g) => (
                  <div key={g.matchId} className="relative group">
                    <div
                      className={`w-10 h-10 rounded-full overflow-hidden border-2 ${
                        g.win ? 'border-emerald-400' : 'border-red-400'
                      }`}
                    >
                      <img
                        src={g.championIconUrl}
                        alt={g.championName}
                        className="w-full h-full"
                        style={{ transform: 'scale(1.18)' }}
                      />
                    </div>
                    <div
                      className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10
                                 w-max max-w-56 px-3 py-2 rounded-lg bg-slate-950 border border-slate-600
                                 shadow-xl text-sm pointer-events-none"
                    >
                      <p className="font-semibold">
                        {g.championName}{' '}
                        <span className={g.win ? 'text-emerald-400' : 'text-red-400'}>
                          {g.win ? 'Sieg' : 'Niederlage'}
                        </span>{' '}
                        <span className="text-slate-400">
                          {g.kills}/{g.deaths}/{g.assists}
                        </span>
                      </p>
                      <p className="text-slate-300">{g.queueName}</p>
                      <p className="text-slate-400 text-xs">
                        {new Date(g.gameEndTimestamp).toLocaleString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        Uhr
                      </p>
                      <span
                        className="absolute top-full left-1/2 -translate-x-1/2 border-4
                                   border-transparent border-t-slate-600"
                      />
                    </div>
                  </div>
                ))}
                {stats.games.length === 0 && (
                  <p className="text-sm text-slate-400">Noch keine Spiele in dieser Session.</p>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
