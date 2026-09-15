/**
 * Assembles the self-contained Next.js server for the desktop app.
 *
 * `next build` writes a traced server to `.next/standalone`, but deliberately
 * leaves out the static assets. This copies everything the packaged app needs
 * into `electron-dist/server`, which the app ships as `app-server`.
 */
import { copyFile, mkdir, readdir, realpath, rm, stat } from 'node:fs/promises';
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

let danglingLinks = 0;

/**
 * Copies a tree, resolving every symlink into a real file or directory.
 *
 * The bundle must not contain symlinks at all, and neither built-in option
 * gets there: `fs.cp` rewrites relative links to absolute paths into this
 * repository, which exist on no other machine, while `verbatimSymlinks` keeps
 * them relative but leaves Windows to guess whether a link points at a file or
 * a directory — from a target that may not have been copied yet.
 *
 * A link whose target is gone is skipped rather than fatal: 7-Zip aborts the
 * installer build over such a link, so one must never reach the bundle.
 */
async function copyResolved(source, destination, visited = new Set(), accept = () => true) {
  let stats;
  try {
    // stat (not lstat) follows the link, so this is the target's type.
    stats = await stat(source);
  } catch (error) {
    if (error.code === 'ENOENT') {
      danglingLinks += 1;
      return;
    }
    throw error;
  }

  if (!stats.isDirectory()) {
    await copyFile(source, destination);
    return;
  }

  // pnpm's layout links packages to each other; without this a cycle would
  // recurse until the disk fills up.
  const real = await realpath(source);
  if (visited.has(real)) return;
  const nested = new Set(visited).add(real);

  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source)) {
    if (!accept(entry)) continue;
    await copyResolved(path.join(source, entry), path.join(destination, entry), nested, accept);
  }
}

const serverDir = await findServerDir(standaloneRoot);
if (!serverDir) {
  console.error('Fehler: server.js im Standalone-Build nicht gefunden.');
  process.exit(1);
}

/**
 * Rebuilds node_modules as a flat, npm-style tree.
 *
 * pnpm stores every package once under `.pnpm/` and wires the graph together
 * with symlinks, so resolution depends on `realpath`. Copying that layout
 * verbatim is not an option (see copyResolved), and materialising the links
 * breaks resolution: `node_modules/next` stops being a link into `.pnpm/`, so
 * Node no longer finds next's own dependencies next to it.
 *
 * A flat layout sidesteps both problems. It is only correct while no package
 * appears in two versions, which the collision check below enforces.
 */
async function flattenNodeModules(sourceRoot, destinationRoot) {
  const packages = new Map();

  /** Records one package directory, guarding against version conflicts. */
  const record = async (name, source, origin) => {
    const previous = packages.get(name);
    if (previous && previous.origin !== origin) {
      throw new Error(
        `Zwei Versionen von "${name}" im Bundle (${previous.origin} und ${origin}). ` +
          'Ein flaches node_modules ist dann nicht mehr korrekt.'
      );
    }
    if (!previous) packages.set(name, { source, origin });
  };

  /** Real directories in a node_modules folder are packages; symlinks are its deps. */
  const collect = async (nodeModulesDir, origin) => {
    for (const entry of await readdir(nodeModulesDir, { withFileTypes: true })) {
      if (entry.name === '.pnpm' || entry.name === '.bin') continue;
      const full = path.join(nodeModulesDir, entry.name);
      if (entry.isSymbolicLink()) continue;

      if (entry.name.startsWith('@')) {
        for (const scoped of await readdir(full, { withFileTypes: true })) {
          if (scoped.isSymbolicLink()) continue;
          await record(`${entry.name}/${scoped.name}`, path.join(full, scoped.name), origin);
        }
        continue;
      }
      await record(entry.name, full, origin);
    }
  };

  const store = path.join(sourceRoot, '.pnpm');
  if (existsSync(store)) {
    for (const pkgDir of await readdir(store)) {
      if (pkgDir === 'node_modules') continue;
      const inner = path.join(store, pkgDir, 'node_modules');
      if (!existsSync(inner)) continue;
      // "react-dom@19.1.0_react@19.1.0" — the part before "_" identifies the version.
      await collect(inner, pkgDir.split('_')[0]);
    }
  }
  await collect(sourceRoot, 'standalone');

  for (const [name, { source }] of packages) {
    await copyResolved(source, path.join(destinationRoot, ...name.split('/')));
  }

  return packages.size;
}

await rm(target, { recursive: true, force: true });
await copyResolved(serverDir, target, new Set(), (entry) => entry !== 'node_modules');

// node_modules is traced into the standalone root, which is a level above
// serverDir when Next nests the output.
const modulesSource = existsSync(path.join(serverDir, 'node_modules'))
  ? path.join(serverDir, 'node_modules')
  : path.join(standaloneRoot, 'node_modules');
const moduleCount = await flattenNodeModules(modulesSource, path.join(target, 'node_modules'));

// Next copies the developer's `.env` and the local `data/` directory into the
// standalone output. Both would end up inside the installer, so drop them —
// the packaged app keeps its key and config in the user's AppData folder.
for (const secret of ['.env', '.env.local', '.env.production', '.env.production.local', 'data']) {
  await rm(path.join(target, secret), { recursive: true, force: true });
}

// Client bundles and CSS — not part of the traced output.
await copyResolved(path.join(root, '.next', 'static'), path.join(target, '.next', 'static'));

if (existsSync(path.join(root, 'public'))) {
  await copyResolved(path.join(root, 'public'), path.join(target, 'public'));
}

console.log(
  `Server-Bundle bereit: ${path.relative(root, target)} — ${moduleCount} Pakete` +
    (danglingLinks > 0 ? `, ${danglingLinks} tote Symlinks übersprungen` : '')
);
