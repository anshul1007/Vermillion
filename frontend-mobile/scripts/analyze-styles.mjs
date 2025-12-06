#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd());
const stylesPath = path.join(projectRoot, 'src', 'styles.scss');

const targetExtensions = new Set(['.ts', '.html', '.scss']);

async function readFileSafe(p) {
  try { return await fs.readFile(p, 'utf8'); } catch { return null; }
}

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (targetExtensions.has(path.extname(entry.name))) yield full;
  }
}

function extractSelectorsAndBlocks(source) {
  const rx = /(^|\n)\s*\.([A-Za-z0-9_-]+)\s*\{([^}]*)\}/gm;
  const map = new Map();
  let m;
  while ((m = rx.exec(source)) !== null) {
    const name = m[2];
    const block = m[3].trim();
    map.set(name, block);
  }
  return map;
}

async function main() {
  const styles = await readFileSafe(stylesPath);
  if (!styles) return console.error('styles.scss not found');

  const selectors = extractSelectorsAndBlocks(styles);

  // invert map by block text to find duplicates
  const duplicateGroups = new Map();
  for (const [sel, block] of selectors) {
    const key = block.replace(/\s+/g, ' ').trim();
    if (!duplicateGroups.has(key)) duplicateGroups.set(key, []);
    duplicateGroups.get(key).push(sel);
  }

  const files = new Map();
  for await (const file of walk(path.join(projectRoot, 'src'))) {
    const content = await readFileSafe(file);
    if (content !== null) files.set(path.relative(projectRoot, file), content);
  }

  // Find inline classes/host usage in components
  const inlineUsage = [];
  for (const [filePath, content] of files) {
    if (filePath.endsWith('.ts')) {
      const hostClassRx = /host:\s*\{[^}]*class:[^}]*\}/g;
      const templateClassRx = /template:\s*`[^`]*`/g;
      if (hostClassRx.test(content)) inlineUsage.push({file: filePath, type: 'host-class', match: content.match(hostClassRx)});
      if (templateClassRx.test(content)) {
        const tMatches = [...content.matchAll(templateClassRx)].map(m=>m[0]);
        inlineUsage.push({file: filePath, type: 'inline-template', matches: tMatches});
      }

      // also look for styleUrls/styles inline
      const stylesHostRx = /styles:\s*\[[^\]]*\]/g;
      if (stylesHostRx.test(content)) inlineUsage.push({file: filePath, type: 'inline-styles', match: content.match(stylesHostRx)});
    }

    if (filePath.endsWith('.html')) {
      // look for class="..." occurrences
      const classRx = /class=\"([^\"]+)\"/g;
      const classes = [];
      for (const m of content.matchAll(classRx)) {
        classes.push(m[1]);
      }
      if (classes.length) inlineUsage.push({file: filePath, type: 'template-classes', classes});
    }
  }

  // Rework duplicateGroups: only keep groups with more than 1 selector
  const duplicates = [];
  for (const [block, arr] of duplicateGroups) {
    if (arr.length > 1) duplicates.push({block, selectors: arr});
  }

  const report = {selectors: Array.from(selectors.keys()), duplicates, inlineUsage};
  await fs.writeFile(path.join(projectRoot, 'duplicate-styles-report.json'), JSON.stringify(report, null, 2));
  console.log('Report written to duplicate-styles-report.json');
}

main().catch(err=>{ console.error(err); process.exit(1); });
