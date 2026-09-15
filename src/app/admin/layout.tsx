import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Control-Panel',
  description: 'Riot API-Key, Spieler, Session und Overlay-Design einstellen',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
