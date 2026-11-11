import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, copyFile, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const desktop = fileURLToPath(new URL('../', import.meta.url));
const target = path.join(desktop, 'src-tauri/resources/whisper');
const cache = path.join(desktop, '.speech-cache');
const version = 'v1.8.4';
const archiveHash = '74f973345cb52ef5ba3ec9e7e7af8e48cc8c71722d1528603b80588a11f82e3e';
const modelHash = 'ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb';
async function hash(file) {
  try { const digest = createHash('sha256'); for await (const chunk of createReadStream(file)) digest.update(chunk); return digest.digest('hex'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function download(url, file, expected) {
  if (await hash(file) === expected) return;
  console.log(`Downloading ${path.basename(file)} from ${new URL(url).hostname}...`);
  const response = await fetch(url, { signal: AbortSignal.timeout(600_000) });
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${url}`);
  const temporary = `${file}.partial`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
  if (await hash(temporary) !== expected) { await rm(temporary); throw new Error(`SHA-256 mismatch: ${file}`); }
  await rename(temporary, file);
}
await mkdir(target, { recursive: true }); await mkdir(cache, { recursive: true });
const archive = path.join(cache, `whisper-${version}.zip`);
await Promise.all([
  download(`https://github.com/ggml-org/whisper.cpp/releases/download/${version}/whisper-bin-x64.zip`, archive, archiveHash),
  download('https://huggingface.co/ggerganov/whisper.cpp/resolve/f281eb45af861ab5e5297d23694b7d46e090c02c/ggml-small-q5_1.bin', path.join(target, 'ggml-small-q5_1.bin'), modelHash),
]);
const manifestPath = path.join(target, 'runtime.json');
let valid = false;
try {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  valid = manifest.version === version;
  for (const [file, expected] of Object.entries(manifest.files)) if (await hash(path.join(target, file)) !== expected) valid = false;
} catch { /* Prepare missing or damaged runtime. */ }
if (!valid) {
  const names = execFileSync('tar', ['-tf', archive], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/);
  if (names.some(name => path.isAbsolute(name) || name.includes('..') || /^[a-z]:/i.test(name))) throw new Error('Unexpected archive path');
  const extracted = path.join(cache, 'runtime'); await mkdir(extracted, { recursive: true });
  execFileSync('tar', ['-xf', archive, '-C', extracted], { windowsHide: true });
  const files = {};
  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const source = path.join(directory, entry.name);
      if (entry.isDirectory()) await collect(source);
      else if (entry.name === 'whisper-cli.exe' || entry.name.endsWith('.dll')) {
        await copyFile(source, path.join(target, entry.name)); files[entry.name] = await hash(source);
      }
    }
  }
  await collect(extracted);
  if (!files['whisper-cli.exe']) throw new Error('Official runtime archive did not contain whisper-cli.exe');
  await writeFile(manifestPath, JSON.stringify({ version, archiveHash, modelHash, files }, null, 2));
}
for (const [file, url] of Object.entries({
  'LICENSE-whisper.cpp.txt': `https://raw.githubusercontent.com/ggml-org/whisper.cpp/${version}/LICENSE`,
  'LICENSE-whisper-model.txt': 'https://raw.githubusercontent.com/openai/whisper/main/LICENSE',
})) {
  try { await readFile(path.join(target, file)); } catch {
    const response = await fetch(url); if (!response.ok) throw new Error(`License download failed: ${url}`);
    await writeFile(path.join(target, file), await response.text());
  }
}
console.log('Offline Whisper small multilingual runtime is ready (SHA-256 verified).');
