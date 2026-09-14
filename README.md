This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Twitch/Streamlabs Stream-Overlay

Das Projekt enthält ein Session-Overlay für League of Legends, das als **Browser-Quelle** in Streamlabs/OBS eingebunden werden kann.

### Seiten

- `/admin` — Backend: Riot ID, Region, Spielmodus, Session-Start, Aktualisierungsintervall und Overlay-Design einstellen. Von hier aus lässt sich per Klick eine neue Session starten.

### Spielmodus-Filter

Im Backend lässt sich per Dropdown wählen, welcher Spielmodus für die Session zählt: Alle Modi, Ranked Solo/Duo, Ranked Flex, ARAM, ARAM: Mayhem, Normal (Draft/Blind/Swiftplay) oder Arena. Der Filter wird über den `queue`/`type`-Parameter der Match-V5-API angewendet. Bei „Ranked Flex“ zeigt der Season-Block die Flex-Statistik, in allen anderen Fällen Solo/Duo (Fallback Flex, falls kein Solo-Rank vorhanden).

### Overlay-Designs

Im Backend stehen vier Layout-Varianten zur Auswahl (das Overlay übernimmt Änderungen beim nächsten Poll automatisch, ohne Neuladen der Browser-Quelle):

- **A — Kompakt einzeilig** (≈ 330 px): Session + Rank in einer Zeile, Champion-Icons darunter
- **B — Zweizeilig gestapelt** (≈ 230 px): Session oben, Season inkl. W/L darunter
- **C — Vertikale Eck-Karte** (≈ 150 px breit): hochkant für den Bildschirmrand
- **D — Minimal-Ribbon** (≈ 300 × 34 px): ultra-flach, Hextech-Rauten statt Champion-Icons

Zusätzlich lässt sich per Slider die Deckkraft des Box-Hintergrunds einstellen (0–100 %, Standard 92 %). Schrift, Icons und der goldene Rahmen bleiben davon unberührt.
- `/overlay` — Das eigentliche Overlay (transparenter Hintergrund). Zeigt die Session-Winrate (hervorgehoben) mit Wins/Loses, daneben die Season-Statistik aus der Ranked-Queue (Rank-Emblem, Tier/Division, LP und Overall-Winrate; Solo/Duo bevorzugt, sonst Flex) sowie pro Spiel das Champion-Icon (grün = Sieg, rot = Niederlage) inkl. KDA.

### Einrichtung in Streamlabs/OBS

1. Dev-Server oder Produktionsbuild starten (`npm run dev`)
2. In Streamlabs eine neue Quelle **"Browser-Quelle"** hinzufügen
3. URL: `http://localhost:3000/overlay`, Breite ~800, Höhe ~200
4. Fertig — das Overlay aktualisiert sich automatisch (Intervall im Backend einstellbar)

### API-Key

In `.env` muss ein gültiger Riot-API-Key hinterlegt sein (server-seitig, nicht `NEXT_PUBLIC_`):

```
RIOT_API_KEY=RGAPI-...
```

Development-Keys von https://developer.riotgames.com laufen nach 24 Stunden ab und müssen erneuert werden.

### Session-Logik

Der Session-Start wird in `data/overlay-config.json` gespeichert. Das Overlay zählt alle Matches, die nach diesem Zeitpunkt gestartet wurden (Riot Match-V5 `startTime`-Filter). Remakes (Early Surrender unter 5 Minuten) werden nicht gewertet. Champion-Icons kommen von Data Dragon in der jeweils aktuellsten Version.
