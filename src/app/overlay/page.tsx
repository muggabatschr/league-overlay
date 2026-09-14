'use client';

import { useCallback, useEffect, useState } from 'react';

interface SessionGame {
  matchId: string;
  championName: string;
  championIconUrl: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
}

interface RankedInfo {
  queue: string;
  tier: string;
  division: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  winRate: number;
  crestUrl: string;
}

interface SessionStats {
  riotId: string;
  sessionStart: number;
  wins: number;
  losses: number;
  winRate: number;
  games: SessionGame[];
  ranked: RankedInfo | null;
  refreshSeconds: number;
  design: string;
  boxOpacity: number;
}

const GOLD = '#C8AA6E';
const GOLD_DARK = '#785A28';
const WIN = '#0AC8B9';
const LOSS = '#E84057';
const TEXT = '#F0E6D2';
const MUTED = '#A09B8C';

/** Panel-Grundstil; `opacity` (0–100) steuert nur den Hintergrund, nicht Schrift/Icons/Rahmen. */
function panelStyle(opacity: number): React.CSSProperties {
  const a = Math.min(100, Math.max(0, opacity)) / 100;
  // Je durchsichtiger die Box, desto kräftiger die dunkle Schrift-Kontur,
  // damit der Text auch direkt auf dem Spielgeschehen lesbar bleibt.
  const s = Math.round((1 - a) * 100) / 100;
  return {
    background: `linear-gradient(135deg, rgba(1,10,19,${a}) 0%, rgba(10,20,40,${a}) 100%)`,
    border: `2px solid ${GOLD_DARK}`,
    boxShadow: '0 0 12px rgba(200,170,110,0.35)',
    borderRadius: 8,
    color: TEXT,
    textShadow:
      s > 0
        ? `0 1px 2px rgba(0,0,0,${s}), 0 0 4px rgba(0,0,0,${s}), 0 0 10px rgba(0,0,0,${0.8 * s})`
        : undefined,
  };
}

/** Dunkler Schlagschatten für Bilder (Rank-Emblem), analog zur Schrift-Kontur. */
const crestShadow: React.CSSProperties = {
  filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.7))',
};

function formatTier(tier: string): string {
  return tier.charAt(0) + tier.slice(1).toLowerCase();
}

/** Kurzform für Variante D: "B II", "GM", "Chall" */
function shortTier(ranked: RankedInfo): string {
  if (ranked.tier === 'GRANDMASTER') return 'GM';
  if (ranked.tier === 'CHALLENGER') return 'Chall';
  const letter = ranked.tier.charAt(0);
  return ranked.division ? `${letter} ${ranked.division}` : letter;
}

function wrColor(rate: number): string {
  return rate >= 50 ? WIN : LOSS;
}

function SessionLabel() {
  return (
    <span
      className="text-[9px] font-bold tracking-[0.18em] uppercase"
      style={{ color: GOLD }}
    >
      Session
    </span>
  );
}

function WinLoss({ wins, losses, size = 15 }: { wins: number; losses: number; size?: number }) {
  return (
    <span style={{ fontSize: size }}>
      <span className="font-bold" style={{ color: WIN }}>{wins}W</span>{' '}
      <span className="font-bold" style={{ color: LOSS }}>{losses}L</span>
    </span>
  );
}

function WinRateBadge({ rate, size = 15 }: { rate: number; size?: number }) {
  return (
    <span
      className="font-extrabold rounded-[5px] px-[7px] py-px"
      style={{
        fontSize: size,
        color: '#010A13',
        background: wrColor(rate),
        boxShadow: `0 0 8px ${wrColor(rate)}`,
        // Die Panel-Textkontur (bei transparenter Box) macht den dunklen
        // Text auf dem hellen Badge unscharf — hier deshalb keine.
        textShadow: 'none',
      }}
    >
      {rate}%
    </span>
  );
}

function ChampIcon({ game, size }: { game: SessionGame; size: number }) {
  const color = game.win ? WIN : LOSS;
  return (
    <span className="flex flex-col items-center flex-none gap-[3px]">
      <span
        className="rounded-full overflow-hidden flex-none block"
        style={{
          width: size,
          height: size,
          border: `2px solid ${color}`,
          boxShadow: `0 0 6px ${color}`,
          boxSizing: 'border-box',
        }}
      >
        <img
          src={game.championIconUrl}
          alt={game.championName}
          title={`${game.championName} ${game.kills}/${game.deaths}/${game.assists}`}
          className="w-full h-full block"
          style={{ transform: 'scale(1.18)' }}
        />
      </span>
      <span
        className="font-semibold leading-none whitespace-nowrap"
        style={{ fontSize: 8.5, color: MUTED }}
      >
        {game.kills}/{game.deaths}/{game.assists}
      </span>
    </span>
  );
}

/** Die neuesten `max` Spiele — ältere fliegen raus, damit die Box nicht breiter wird als die Stats-Zeile. */
function latestGames(games: SessionGame[], max: number): { shown: SessionGame[]; hidden: number } {
  if (games.length <= max) return { shown: games, hidden: 0 };
  return { shown: games.slice(games.length - max), hidden: games.length - max };
}

function HiddenCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="self-center font-semibold" style={{ color: MUTED, fontSize: 10 }}>
      +{count}
    </span>
  );
}

function ChampIconRow({
  games,
  size = 26,
  max,
  center = false,
  wrap = false,
}: {
  games: SessionGame[];
  size?: number;
  max: number;
  center?: boolean;
  wrap?: boolean;
}) {
  if (games.length === 0) return null;
  const { shown, hidden } = latestGames(games, max);
  return (
    <div
      className={`flex gap-1.5 items-center ${center ? 'justify-center' : ''} ${wrap ? 'flex-wrap' : ''}`}
    >
      <HiddenCount count={hidden} />
      {shown.map((g) => <ChampIcon key={g.matchId} game={g} size={size} />)}
    </div>
  );
}

function GoldDivider() {
  return <span className="self-stretch w-px" style={{ background: GOLD_DARK }} />;
}

/* ====== Variante A: Kompakt einzeilig ====== */
function DesignA({ stats }: { stats: SessionStats }) {
  const sessionLine = (
    <>
      <SessionLabel />
      <WinLoss wins={stats.wins} losses={stats.losses} />
      <WinRateBadge rate={stats.winRate} />
    </>
  );

  if (!stats.ranked) {
    return (
      <div className="inline-flex flex-col gap-[7px] px-3 py-2" style={panelStyle(stats.boxOpacity)}>
        <div className="flex items-center gap-[9px]">{sessionLine}</div>
        <ChampIconRow games={stats.games} max={9} />
      </div>
    );
  }

  /* Emblem überspannt Text- und Icon-Zeile */
  return (
    <div className="inline-flex px-3 py-2" style={panelStyle(stats.boxOpacity)}>
      <div className="grid grid-cols-[auto_auto] items-center gap-x-[11px] gap-y-[7px]">
        <img
          src={stats.ranked.crestUrl}
          alt={stats.ranked.tier}
          className="w-12 h-12 row-span-2"
          style={crestShadow}
        />
        <div className="flex items-center gap-2" style={{ fontSize: 12.5 }}>
          <span className="font-bold">
            {formatTier(stats.ranked.tier)}{stats.ranked.division ? ` ${stats.ranked.division}` : ''}
          </span>
          <span style={{ color: GOLD }}>{stats.ranked.leaguePoints} LP</span>
          <span style={{ color: GOLD_DARK }}>·</span>
          <span className="font-extrabold" style={{ color: wrColor(stats.ranked.winRate) }}>
            {stats.ranked.winRate}%
          </span>
          <GoldDivider />
          {sessionLine}
        </div>
        <ChampIconRow games={stats.games} max={9} />
      </div>
    </div>
  );
}

/* ====== Variante B: Zweizeilig gestapelt ====== */
function DesignB({ stats }: { stats: SessionStats }) {
  return (
    <div className="inline-flex flex-col gap-[6px] px-3 py-2" style={panelStyle(stats.boxOpacity)}>
      {stats.ranked ? (
        /* Emblem überspannt Rang- und Session-Zeile (Variante 1) */
        <div className="grid grid-cols-[auto_auto] items-center gap-x-[11px] gap-y-[5px]">
          <img
            src={stats.ranked.crestUrl}
            alt={stats.ranked.tier}
            className="w-14 h-14 row-span-2"
            style={crestShadow}
          />
          <div className="flex items-center gap-2" style={{ fontSize: 12.5 }}>
            <span className="font-bold">
              {formatTier(stats.ranked.tier)}{stats.ranked.division ? ` ${stats.ranked.division}` : ''}
            </span>
            <span style={{ color: GOLD }}>{stats.ranked.leaguePoints} LP</span>
            <span style={{ color: GOLD_DARK }}>·</span>
            <span style={{ color: MUTED }}>{stats.ranked.wins}W {stats.ranked.losses}L</span>
            <span className="font-extrabold" style={{ color: wrColor(stats.ranked.winRate) }}>
              {stats.ranked.winRate}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <SessionLabel />
            <WinLoss wins={stats.wins} losses={stats.losses} />
            <WinRateBadge rate={stats.winRate} />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <SessionLabel />
          <WinLoss wins={stats.wins} losses={stats.losses} />
          <WinRateBadge rate={stats.winRate} />
        </div>
      )}
      <ChampIconRow games={stats.games} max={7} />
    </div>
  );
}

/* ====== Variante C: Vertikale Eck-Karte ====== */
function DesignC({ stats }: { stats: SessionStats }) {
  return (
    <div
      className="inline-flex flex-col items-center gap-1 px-3.5 pt-2.5 pb-3"
      style={{ ...panelStyle(stats.boxOpacity), width: 158 }}
    >
      {stats.ranked && (
        <>
          {/* Zweispaltiger Kopf: großes Emblem links, Rang-Infos gestapelt rechts */}
          <div className="flex items-center gap-[9px] self-stretch">
            <img
              src={stats.ranked.crestUrl}
              alt={stats.ranked.tier}
              className="w-[60px] h-[60px]"
              style={crestShadow}
            />
            <span className="flex flex-col gap-0.5 min-w-0">
              <span className="font-bold" style={{ fontSize: 13, lineHeight: 1.15 }}>
                {formatTier(stats.ranked.tier)}{stats.ranked.division ? ` ${stats.ranked.division}` : ''}
              </span>
              <span style={{ fontSize: 11, color: GOLD }}>{stats.ranked.leaguePoints} LP</span>
              <span style={{ fontSize: 10.5, color: MUTED }}>
                Season{' '}
                <span className="font-bold" style={{ color: wrColor(stats.ranked.winRate) }}>
                  {stats.ranked.winRate}%
                </span>
              </span>
            </span>
          </div>
          <hr className="w-full my-1 border-0 border-t" style={{ borderColor: GOLD_DARK }} />
        </>
      )}
      <SessionLabel />
      <WinLoss wins={stats.wins} losses={stats.losses} size={14} />
      <span className="mt-0.5">
        <WinRateBadge rate={stats.winRate} />
      </span>
      {stats.games.length > 0 && (
        <div className="mt-1.5">
          <ChampIconRow games={stats.games} size={22} max={6} center wrap />
        </div>
      )}
    </div>
  );
}

/* ====== Variante D: Minimal-Ribbon ====== */
function DesignD({ stats }: { stats: SessionStats }) {
  return (
    <div
      className="inline-flex items-center gap-2 py-1 pl-[7px] pr-[13px]"
      style={{ ...panelStyle(stats.boxOpacity), borderRadius: 999, borderWidth: 1 }}
    >
      {stats.ranked && (
        <>
          {/* Emblem ragt bewusst leicht über den flachen Ribbon hinaus */}
          <img
            src={stats.ranked.crestUrl}
            alt={stats.ranked.tier}
            className="w-[38px] h-[38px] -my-2"
            style={crestShadow}
          />
          <span className="flex flex-col whitespace-nowrap" style={{ fontSize: 11, lineHeight: 1.25 }}>
            <span>
              <b>{shortTier(stats.ranked)}</b>{' '}
              <span style={{ color: GOLD }}>{stats.ranked.leaguePoints} LP</span>
            </span>
            <span className="font-bold" style={{ color: wrColor(stats.ranked.winRate) }}>
              {stats.ranked.winRate}%
            </span>
          </span>
          <GoldDivider />
        </>
      )}
      <SessionLabel />
      {stats.games.length > 0 && (() => {
        const { shown, hidden } = latestGames(stats.games, 8);
        return (
          <span className="flex gap-[5px] mx-0.5 items-center">
            <HiddenCount count={hidden} />
            {shown.map((g) => (
              <span
                key={g.matchId}
                title={`${g.championName} ${g.kills}/${g.deaths}/${g.assists}`}
                className="flex-none rotate-45 rounded-[2px]"
                style={{
                  width: 9,
                  height: 9,
                  background: g.win ? WIN : LOSS,
                  boxShadow: `0 0 5px ${g.win ? WIN : LOSS}`,
                }}
              />
            ))}
          </span>
        );
      })()}
      <WinLoss wins={stats.wins} losses={stats.losses} size={13} />
      <WinRateBadge rate={stats.winRate} size={13} />
    </div>
  );
}

const DESIGNS: Record<string, (props: { stats: SessionStats }) => React.ReactNode> = {
  A: DesignA,
  B: DesignB,
  C: DesignC,
  D: DesignD,
};

export default function OverlayPage() {
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [refreshSeconds, setRefreshSeconds] = useState(60);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/session-stats', { cache: 'no-store' });
      if (!response.ok) return;
      const data: SessionStats = await response.json();
      setStats(data);
      if (data.refreshSeconds >= 15) setRefreshSeconds(data.refreshSeconds);
    } catch {
      // Keep showing the last known stats if a poll fails.
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, refreshSeconds * 1000);
    return () => clearInterval(timer);
  }, [load, refreshSeconds]);

  const Design = stats ? (DESIGNS[stats.design] ?? DesignA) : null;

  return (
    <>
      {/* OBS/Streamlabs browser sources need a fully transparent page background. */}
      <style>{`html, body { background: transparent !important; }`}</style>

      {stats && Design && (
        <div className="inline-block p-3 font-sans select-none">
          <Design stats={stats} />
        </div>
      )}
    </>
  );
}
