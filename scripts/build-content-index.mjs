#!/usr/bin/env node
/**
 * Copia content/generated -> public/content e monta public/content/index.json
 * com o syllabus completo + quais lições já têm conteúdo real gerado.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ALL_TRACKS } from './syllabus.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'content', 'generated');
const DST = path.join(ROOT, 'public', 'content');

fs.rmSync(DST, { recursive: true, force: true });
fs.mkdirSync(DST, { recursive: true });

const index = { generatedAt: new Date().toISOString(), tracks: [] };
let available = 0;

for (const track of ALL_TRACKS) {
  const srcDir = path.join(SRC, track.id);
  const dstDir = path.join(DST, track.id);
  const lessons = track.lessons.map((title, i) => {
    const file = `${String(i + 1).padStart(2, '0')}.json`;
    let has = false;
    if (fs.existsSync(path.join(srcDir, file))) {
      fs.mkdirSync(dstDir, { recursive: true });
      fs.copyFileSync(path.join(srcDir, file), path.join(dstDir, file));
      has = true;
      available++;
    }
    return { n: i + 1, title, slug: `${track.id}-${i + 1}`, has, xp: 20 + Math.min(30, i * 3) };
  });
  index.tracks.push({
    id: track.id, name: track.name, icon: track.icon, color: track.color,
    description: track.description, world: track.world, kind: track.kind,
    cefr: track.cefr || null, lessons,
  });
}

fs.writeFileSync(path.join(DST, 'index.json'), JSON.stringify(index));
console.log(`index.json: ${index.tracks.length} trilhas, ${available} lições com conteúdo real.`);
