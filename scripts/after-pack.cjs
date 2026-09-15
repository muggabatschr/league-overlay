'use strict';

/**
 * Copies the Next.js server bundle into the packaged app.
 *
 * This cannot go through `extraResources`: electron-builder strips
 * `node_modules` from those copies, which would leave the traced server
 * without its runtime dependencies.
 */

const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  const source = path.join(context.packager.projectDir, 'electron-dist', 'server');
  const target = path.join(context.appOutDir, 'resources', 'app-server');

  if (!fs.existsSync(path.join(source, 'server.js'))) {
    throw new Error(
      `Server-Bundle fehlt (${source}). Bitte zuerst "pnpm run build:server" ausführen.`
    );
  }

  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });

  const moduleCount = fs.readdirSync(path.join(target, 'node_modules')).length;
  console.log(`  • app-server kopiert  modules=${moduleCount}`);
};
