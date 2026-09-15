/**
 * Assembles the self-contained Next.js server for the desktop app.
 *
 * `next build` writes a traced server to `.next/standalone`, but deliberately
 * leaves out the static assets. This copies everything the packaged app needs
 * into `electron-dist/server`, which electron-builder ships as `app-server`.
 */
import { cp, readdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const standaloneRoot = path.join(root, '.next', 'standalone');
const target = path.join(root, 'electron-dist', 'server');

if (!existsSync(standaloneRoot)) {
  console.error('Fehler: .next/standalone fehlt — bitte zuerst `pnpm run build` ausführen.');
  process.exit(1);
}

/**
 * Locates server.js: with a workspace root above the app, Next nests the
 * standalone output in a sub-directory mirroring the app's path.
 */
async function findServerDir(dir, depth = 0) {
  if (existsSync(path.join(dir, 'server.js'))) return dir;
  if (depth > 4) return null;
  for (const entry of await readdir(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const candidate = path.join(dir, entry);
    if (!(await stat(candidate)).isDirectory()) continue;
    const found = await findServerDir(candidate, depth + 1);
    if (found) return found;
  }
  return null;
}

const serverDir = await findServerDir(standaloneRoot);
if (!serverDir) {
  console.error('Fehler: server.js im Standalone-Build nicht gefunden.');
  process.exit(1);
}

await rm(target, { recursive: true, force: true });
await cp(serverDir, target, { recursive: true });

// node_modules and .next/server are traced into the standalone root, which is
// a level above serverDir when Next nests the output.
if (serverDir !== standaloneRoot) {
  for (const shared of ['node_modules']) {
    const from = path.join(standaloneRoot, shared);
    if (existsSync(from)) await cp(from, path.join(target, shared), { recursive: true });
  }
}

// Next copies the developer's `.env` and the local `data/` directory into the
// standalone output. Both would end up inside the installer, so drop them —
// the packaged app keeps its key and config in the user's AppData folder.
for (const secret of ['.env', '.env.local', '.env.production', '.env.production.local', 'data']) {
  await rm(path.join(target, secret), { recursive: true, force: true });
}

// Client bundles and CSS — not part of the traced output.
await cp(path.join(root, '.next', 'static'), path.join(target, '.next', 'static'), {
  recursive: true,
});

if (existsSync(path.join(root, 'public'))) {
  await cp(path.join(root, 'public'), path.join(target, 'public'), { recursive: true });
}

console.log(`Server-Bundle bereit: ${path.relative(root, target)}`);
