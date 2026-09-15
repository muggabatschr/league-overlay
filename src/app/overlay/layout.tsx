import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Stream-Overlay',
  description: 'Browser-Quelle für Streamlabs und OBS',
};

export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
