#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const nodeModulesDir = path.join(projectRoot, 'node_modules');
const publicOcrDir = path.join(projectRoot, 'public', 'tesseract');

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyFileIfPresent(source, destination) {
  if (!(await fileExists(source))) {
    return false;
  }
  await ensureDir(path.dirname(destination));
  await fs.copyFile(source, destination);
  return true;
}

async function main() {
  const logPrefix = '[setup:ocr]';
  const results = [];

  const workerSourceCandidates = [
    path.join(nodeModulesDir, 'tesseract.js', 'dist', 'tesseract.worker.min.js'),
    path.join(nodeModulesDir, 'tesseract.js', 'dist', 'worker.min.js')
  ];

  const coreJsCandidates = [
    path.join(nodeModulesDir, 'tesseract.js-core', 'tesseract-core.wasm.js'),
    path.join(nodeModulesDir, '@tesseract.js', 'core', 'tesseract-core.wasm.js')
  ];

  const coreWasmCandidates = [
    path.join(nodeModulesDir, 'tesseract.js-core', 'tesseract-core.wasm'),
    path.join(nodeModulesDir, '@tesseract.js', 'core', 'tesseract-core.wasm')
  ];

  const languageCandidates = [
    path.join(nodeModulesDir, 'tesseract.js', 'dist', 'tessdata', 'eng.traineddata'),
    path.join(nodeModulesDir, 'tesseract.js', 'dist', 'data', 'eng.traineddata'),
    path.join(nodeModulesDir, 'tesseract.js', 'src', 'data', 'eng.traineddata'),
    path.join(nodeModulesDir, 'tesseract.js-core', 'tessdata', 'eng.traineddata')
  ];

  const languageDownloadUrl = 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/eng.traineddata';

  const downloadLanguage = async (destination) => {
    console.log(`${logPrefix} Downloading English language data from ${languageDownloadUrl}`);
    const buffer = await new Promise((resolve, reject) => {
      https
        .get(languageDownloadUrl, (response) => {
          if ((response.statusCode ?? 500) >= 400) {
            reject(new Error(`Unexpected status code ${response.statusCode}`));
            return;
          }

          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => resolve(Buffer.concat(chunks)));
        })
        .on('error', (error) => reject(error));
    });

    await ensureDir(path.dirname(destination));
    await fs.writeFile(destination, buffer);
    results.push(`eng.traineddata <- downloaded from tessdata_fast`);
    return true;
  };

  const copyWithCandidates = async (candidates, targetFilename) => {
    for (const candidate of candidates) {
      if (await copyFileIfPresent(candidate, path.join(publicOcrDir, targetFilename))) {
        results.push(`${targetFilename} <- ${candidate}`);
        return true;
      }
    }
    return false;
  };

  const workerCopied = await copyWithCandidates(workerSourceCandidates, 'tesseract.worker.min.js');

  let coreDir = null;
  for (const candidate of [
    path.join(nodeModulesDir, 'tesseract.js-core'),
    path.join(nodeModulesDir, '@tesseract.js', 'core')
  ]) {
    if (await fileExists(candidate)) {
      coreDir = candidate;
      break;
    }
  }

  let coreFilesCopied = false;
  if (coreDir) {
    const entries = await fs.readdir(coreDir);
    for (const entry of entries) {
      if (!/^tesseract-core.*\.(wasm(\.js)?|js)$/.test(entry)) {
        continue;
      }
      const source = path.join(coreDir, entry);
      const destination = path.join(publicOcrDir, entry);
      await ensureDir(path.dirname(destination));
      await fs.copyFile(source, destination);
      results.push(`${entry} <- ${source}`);
      coreFilesCopied = true;
    }
  }

  const coreJsCopied = coreFilesCopied || await copyWithCandidates(coreJsCandidates, 'tesseract-core.wasm.js');
  const coreWasmCopied = coreFilesCopied || await copyWithCandidates(coreWasmCandidates, 'tesseract-core.wasm');
  let languageCopied = await copyWithCandidates(languageCandidates, 'eng.traineddata');
  if (!languageCopied) {
    try {
      languageCopied = await downloadLanguage(path.join(publicOcrDir, 'eng.traineddata'));
    } catch (error) {
      console.error(`${logPrefix} Failed to download language data: ${error instanceof Error ? error.message : error}`);
      languageCopied = false;
    }
  }

  if (!workerCopied || !coreJsCopied || !coreWasmCopied || !languageCopied) {
    const missing = [
      !workerCopied ? 'worker' : null,
      !coreJsCopied ? 'core wasm js' : null,
      !coreWasmCopied ? 'core wasm' : null,
      !languageCopied ? 'language data' : null
    ].filter(Boolean);

    console.error(`${logPrefix} Failed to locate required OCR files: ${missing.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  console.log(`${logPrefix} Copied OCR assets to ${path.relative(projectRoot, publicOcrDir)}`);
  results.forEach(line => console.log(`${logPrefix}   ${line}`));
}

main().catch((err) => {
  console.error('[setup:ocr] Unexpected error while preparing OCR assets.');
  console.error(err);
  process.exitCode = 1;
});
