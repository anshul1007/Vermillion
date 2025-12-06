#!/usr/bin/env node
// Set-Location -Path "e:\Vermillion\frontend-mobile"; node scripts/find-unused-styles.mjs
import { promises as fs } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd(), '../frontend-mobile');
const stylesPath = path.join(projectRoot, 'src', 'styles.scss');

const targetExtensions = new Set(['.ts', '.html', '.scss']);

async function readFileSafe(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (err) {
    return null;
  }
}

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else if (targetExtensions.has(path.extname(entry.name))) {
      yield fullPath;
    }
  }
}

function extractSelectors(stylesSource) {
  const selectorRegex = /^\s*\.([A-Za-z0-9_-]+)\s*(?=[,{])/gm;
  const selectors = new Set();
  let match;
  while ((match = selectorRegex.exec(stylesSource)) !== null) {
    const [raw, name] = match;
    // Skip Sass placeholders or nested selectors referencing parent (e.g. .btn svg)
    if (!name || name.startsWith('-')) {
      continue;
    }
    selectors.add(name);
  }
  return [...selectors];
}

async function main() {
  const styles = await readFileSafe(stylesPath);
  if (!styles) {
    console.error('Could not read styles.scss at', stylesPath);
    process.exit(1);
  }

  const selectors = extractSelectors(styles);

  const fileCache = new Map();
  for await (const filePath of walk(path.join(projectRoot, 'src'))) {
    if (filePath === stylesPath) {
      continue;
    }
    const content = await readFileSafe(filePath);
    if (content !== null) {
      fileCache.set(filePath, content);
    }
  }

  const results = selectors.map((selector) => {
    const classToken = selector;
    const usageFiles = [];
    const exactRegex = new RegExp(`\\b${classToken.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`);
    for (const [filePath, content] of fileCache.entries()) {
      if (exactRegex.test(content)) {
        usageFiles.push(path.relative(projectRoot, filePath));
      }
    }
    return {
      selector,
      usageCount: usageFiles.length,
      files: usageFiles,
    };
  });

  const unused = results.filter((item) => item.usageCount === 0);
  const redundantReport = {
    totalSelectors: results.length,
    unusedCount: unused.length,
    unusedSelectors: unused.map((item) => item.selector).sort(),
    detailed: results.sort((a, b) => a.selector.localeCompare(b.selector)),
  };

  const outputPath = path.join(projectRoot, 'unused-styles-report.json');
  await fs.writeFile(outputPath, JSON.stringify(redundantReport, null, 2));

  console.log(`Scanned ${results.length} selectors.`);
  console.log(`Unused selectors: ${unused.length}`);
  console.log(`Report written to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
