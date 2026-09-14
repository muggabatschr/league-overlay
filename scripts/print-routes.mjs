const port = process.env.PORT || 3000;
const base = `http://localhost:${port}`;

const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

console.log('');
console.log(bold('  Routen:'));
console.log(`  Backend (Admin):  ${cyan(`${base}/admin`)}`);
console.log(`  Overlay (OBS):    ${cyan(`${base}/overlay`)}`);
console.log('');
