# League Overlay

Session-Statistik-Overlay für League of Legends, das als **Browser-Quelle** in
Streamlabs/OBS eingebunden wird — wahlweise als Windows-App oder als lokaler
Next.js-Server.

- **Control-Panel** — Riot-API-Key, Riot ID, Region, Spielmodus, Session-Start,
  Aktualisierungsintervall und Overlay-Design einstellen.
- **Overlay** — transparente Seite mit Session-Winrate (Wins/Loses), Season-Statistik
  aus der Ranked-Queue (Rank-Emblem, Tier/Division, LP, Overall-Winrate) und pro Spiel
  das Champion-Icon (grün = Sieg, rot = Niederlage) inkl. KDA.

---

## Windows-App

### Installation

1. Auf der [Releases-Seite](../../releases) das aktuelle `LeagueOverlay-Setup-<version>.exe` laden.
2. Installer ausführen. Das Setup ist **nicht signiert** — Windows SmartScreen meldet sich
   beim ersten Start mit „Weitere Informationen“ → „Trotzdem ausführen“.
3. App starten. Das Control-Panel öffnet sich; alles Nötige (Node-Runtime, Server,
   Weboberfläche) ist mitgeliefert, es muss nichts zusätzlich installiert werden.

### Riot-API-Key eintragen

Ohne Key kann die App keine Daten von Riot holen. Im Control-Panel unter **Riot API-Key**:

1. Key von [developer.riotgames.com](https://developer.riotgames.com) einfügen.
2. **Prüfen & speichern** — der Key wird sofort gegen die Riot-API geprüft
   (`/lol/status/v4/platform-data` in der eingestellten Region).
3. Nur wenn Riot ihn akzeptiert, wird er gespeichert. Lehnt Riot ab (HTTP 401/403),
   bleibt nichts zurück und die Fehlermeldung nennt den Grund.

Danach zeigt das Control-Panel nur noch die **ersten und letzten 5 Zeichen**, alles
dazwischen als `*`:

```
RGAPI********************************a1b2c
```

So bleibt der Key beim Streamen oder Teilen des Bildschirms verdeckt. Über **Erneut
prüfen** lässt sich jederzeit testen, ob er noch gültig ist — Development-Keys laufen
nach 24 Stunden ab. **Entfernen** löscht ihn wieder.

Gespeichert wird der Key in
`%APPDATA%\League Overlay\riot-api-key.json` (Dateirechte `0600`, nur für das eigene
Windows-Konto lesbar). Dort liegt auch `overlay-config.json` mit den übrigen
Einstellungen. Eine Deinstallation lässt diesen Ordner stehen.

### Fenster und Infobereich

- **Control-Panel** — Hauptfenster, öffnet sich beim Start.
- **Overlay-Vorschau** — eigenes Fenster über `Overlay → Vorschau öffnen`.
- Das Schließen des Fensters **beendet die App nicht**: Der Overlay-Dienst läuft im
  Hintergrund weiter, damit die Browser-Quelle in OBS nicht ausfällt. Über das Symbol
  im Infobereich (Taskleiste rechts unten) lässt sich das Control-Panel wieder öffnen
  oder die App vollständig beenden.

Der Dienst lauscht nur auf `127.0.0.1` (Port 3000, bei Belegung der nächste freie bis
3020) — nichts davon ist aus dem Netzwerk erreichbar, es gibt also auch keine
Windows-Firewall-Abfrage.

### Einrichtung in Streamlabs/OBS

1. Neue Quelle **„Browser-Quelle“** hinzufügen.
2. URL: `http://127.0.0.1:3000/overlay`, Breite ~800, Höhe ~200.
   Die exakte URL liefert das Control-Panel per **Kopieren**-Button, alternativ
   `Overlay → URL für OBS/Streamlabs kopieren` im Menü oder im Infobereich-Menü.
3. Benutzerdefiniertes CSS leer lassen — der Hintergrund ist transparent.

Das Overlay aktualisiert sich selbst im eingestellten Intervall.

---

## Entwicklung

```bash
pnpm install
pnpm dev            # http://localhost:3000/admin
```

Im Dev-Modus liegen Konfiguration und Key in `./data/`. Alternativ kann der Key über
`.env` gesetzt werden (`.env.example` als Vorlage kopieren) — das Control-Panel zeigt
ihn dann maskiert mit dem Hinweis „aus .env übernommen“. Ein im Control-Panel
gespeicherter Key hat Vorrang vor der Umgebungsvariablen.

Das Datenverzeichnis lässt sich über `LEAGUE_OVERLAY_DATA_DIR` umbiegen; die Windows-App
setzt diese Variable auf den AppData-Ordner.

### Desktop-App lokal bauen

```bash
pnpm run build:server   # next build + Standalone-Bundle nach electron-dist/server
pnpm run electron       # Electron-Mantel gegen dieses Bundle starten
pnpm run dist:win       # Icon, Bundle und NSIS-Installer nach release/
```

`pnpm run dist:win` erzeugt unter macOS/Linux nur dann ein `.exe`, wenn Wine verfügbar
ist — der zuverlässige Weg ist der Workflow unten.

### Release über GitHub Actions

`.github/workflows/windows-installer.yml` baut den Installer auf `windows-latest`:

- **Manuell** über „Run workflow“ — das Setup hängt dann als Artefakt am Workflow-Lauf.
- **Automatisch** bei einem Tag `v*`. Die Version aus dem Tag landet in `package.json`,
  im Dateinamen und in den Exe-Metadaten, und das Setup wird an ein GitHub-Release gehängt.

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## Aufbau

| Pfad | Zweck |
| --- | --- |
| `src/app/admin` | Control-Panel |
| `src/app/overlay` | Overlay (Browser-Quelle) |
| `src/app/api/riot-key` | Key prüfen, speichern, maskiert ausliefern |
| `src/app/api/session-stats` | Aggregierte Session- und Season-Statistik |
| `src/utils/apiKey.ts` | Key-Ablage und Maskierung |
| `src/utils/config.ts` | Overlay-Konfiguration |
| `electron/main.js` | Electron-Mantel: startet den Server, Fenster, Infobereich |
| `scripts/prepare-standalone.mjs` | Standalone-Bundle für die App zusammenstellen |
| `scripts/after-pack.cjs` | Bundle ins gepackte Programmverzeichnis kopieren |
| `scripts/make-icon.mjs` | `build/icon.ico` aus Code erzeugen |

### Spielmodus-Filter

Im Control-Panel lässt sich wählen, welcher Spielmodus für die Session zählt: Alle Modi,
Ranked Solo/Duo, Ranked Flex, ARAM, ARAM: Mayhem, Normal (Draft/Blind/Swiftplay) oder
Arena. Der Filter wird über den `queue`/`type`-Parameter der Match-V5-API angewendet. Bei
„Ranked Flex“ zeigt der Season-Block die Flex-Statistik, sonst Solo/Duo (Fallback Flex,
falls kein Solo-Rank vorhanden).

### Overlay-Designs

Vier Layout-Varianten; das Overlay übernimmt Änderungen beim nächsten Poll automatisch,
ohne Neuladen der Browser-Quelle:

- **A — Kompakt einzeilig** (≈ 330 px): Session + Rank in einer Zeile, Champion-Icons darunter
- **B — Zweizeilig gestapelt** (≈ 230 px): Session oben, Season inkl. W/L darunter
- **C — Vertikale Eck-Karte** (≈ 150 px breit): hochkant für den Bildschirmrand
- **D — Minimal-Ribbon** (≈ 300 × 34 px): ultra-flach, Hextech-Rauten statt Champion-Icons

Zusätzlich lässt sich die Deckkraft des Box-Hintergrunds einstellen (0–100 %, Standard
92 %). Schrift, Icons und der goldene Rahmen bleiben davon unberührt.

### Session-Logik

Das Overlay zählt alle Matches, die nach dem eingestellten Session-Start begonnen wurden
(Riot Match-V5 `startTime`-Filter). Remakes (Early Surrender unter 5 Minuten) werden nicht
gewertet. Champion-Icons kommen von Data Dragon in der jeweils aktuellsten Version.

---

## Lizenz

MIT
