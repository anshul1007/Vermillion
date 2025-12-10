import { Injectable } from '@angular/core';

type TesseractWorker = any;

export interface AadharOcrResult {
  rawText: string;
  confidence: number | null;
  name?: string;
  aadharNumber?: string;
  address?: string;
  phoneNumber?: string;
}

interface ParsedAadharFields {
  name?: string;
  aadharNumber?: string;
  address?: string;
  phoneNumber?: string;
}

@Injectable({ providedIn: 'root' })
export class OcrService {
  private static readonly baseAssetPath = ((): string => {
    try {
      if (typeof document !== 'undefined') {
        const baseEl = document.querySelector('base');
        const baseHref = baseEl ? (baseEl.getAttribute('href') || '/') : '/';
        return (baseHref.endsWith('/') ? baseHref : baseHref + '/') + 'tesseract/';
      }
    } catch (e) {
      // fallback to root
    }
    return '/tesseract/';
  })();
  private static readonly workerPath = `${OcrService.baseAssetPath}tesseract.worker.min.js`;
  private static readonly corePath = `${OcrService.baseAssetPath}tesseract-core.wasm.js`;
  private static readonly langPath = OcrService.baseAssetPath;
  private worker: TesseractWorker | null = null;
  private workerInitPromise: Promise<TesseractWorker> | null = null;

  async extractAadharFields(imageDataUrl: string, progress?: (value: number) => void): Promise<AadharOcrResult> {
    if (!imageDataUrl) {
      throw new Error('No image provided for OCR processing.');
    }

    if (progress) {
      progress(0.05);
    }

    const worker = await this.getWorker(progress);

    if (progress) {
      progress(0.75);
    }

    const result = await worker.recognize(imageDataUrl);

    if (progress) {
      progress(1);
    }

    const parsed = this.parseText(result.data.text ?? '');

    return {
      rawText: result.data.text ?? '',
      confidence: typeof result.data.confidence === 'number' ? result.data.confidence : null,
      ...parsed,
    };
  }

  private async getWorker(progress?: (value: number) => void): Promise<TesseractWorker> {
    if (typeof window === 'undefined') {
      throw new Error('OCR can only run in a browser environment.');
    }

    if (this.worker) {
      return this.worker;
    }

    if (!this.workerInitPromise) {
      this.workerInitPromise = (async () => {
        if (progress) {
          progress(0.1);
        }

        // Lazy-load tesseract.js so the heavy library and its assets
        // are not part of the main bundle and are only loaded when OCR is used.
        let tesseract: any;
        try {
          tesseract = await import('tesseract.js');
        } catch (err) {
          throw new Error('Failed to load tesseract.js: ' + (err instanceof Error ? err.message : String(err)) + '. Ensure tesseract is installed and available in production build.');
        }
        const { createWorker, PSM } = tesseract as any;

        try {
          const toAbsoluteUrl = (path: string) => {
            if (/^https?:\/\//i.test(path)) {
              return path;
            }
            try {
              if (typeof location !== 'undefined') {
                if (path.startsWith('/')) {
                  return `${location.origin}${path}`;
                }
                return `${location.origin}/${path}`;
              }
            } catch (e) {
              // ignore and fall back to original path
            }
            return path;
          };

          const workerUrl = toAbsoluteUrl(OcrService.workerPath);
          let coreJsUrl = toAbsoluteUrl(OcrService.corePath);
          const langBaseUrl = toAbsoluteUrl(OcrService.langPath);
          const trainedDataUrl = `${langBaseUrl.endsWith('/') ? langBaseUrl : `${langBaseUrl}/`}eng.traineddata`;

          // ALWAYS force non-SIMD core because Azure Static Web Apps doesn't set COOP/COEP headers
          // Without SharedArrayBuffer, SIMD variants fail with "n is not a function"
          const base = coreJsUrl.substring(0, coreJsUrl.lastIndexOf('/') + 1);
          coreJsUrl = `${base}tesseract-core.wasm.js`;
          console.debug('Forcing non-SIMD tesseract-core.wasm.js for compatibility', { originalCore: OcrService.corePath, forcedCore: coreJsUrl });

          const fetchAssetMeta = async (url: string) => {
            try {
              const resp = await fetch(url, { method: 'GET', cache: 'no-store' });
              if (!resp.ok) {
                throw new Error(`HTTP ${resp.status}`);
              }
              const contentType = resp.headers.get('content-type') || '';
              if (contentType.includes('text/html')) {
                const sample = await resp.clone().text().then((text) => text.slice(0, 200)).catch(() => '');
                throw new Error(`Unexpected content-type ${contentType}; sample: ${sample}`);
              }
              const contentLength = resp.headers.get('content-length');
              return {
                status: resp.status,
                contentType,
                contentLength,
              };
            } catch (error: any) {
              throw new Error(`Failed to fetch OCR asset ${url}: ${error instanceof Error ? error.message : String(error)}`);
            }
          };

          const workerMeta = await fetchAssetMeta(workerUrl);
          const coreMeta = await fetchAssetMeta(coreJsUrl);
          const trainedMeta = await fetchAssetMeta(trainedDataUrl);

          const attemptCreateWorker = async (options: Record<string, any>, variant: 'normal' | 'blob') => {
            const instance: TesseractWorker = await createWorker('eng', undefined, options);
            progress?.(0.4);
            await instance.setParameters({
              tessedit_pageseg_mode: String(PSM.AUTO),
              tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ,:/-@().',
              preserve_interword_spaces: '1',
            });
            progress?.(0.6);
            console.debug(`Tesseract worker created (${variant})`, { workerMeta, coreMeta, trainedMeta });
            this.worker = instance;
            this.workerInitPromise = null;
            return instance;
          };

          const baseOptions = {
            workerPath: workerUrl,
            corePath: coreJsUrl,
            langPath: langBaseUrl,
            cacheMethod: 'none',
            gzip: false,
          };

          try {
            return await attemptCreateWorker(baseOptions, 'normal');
          } catch (firstErr: any) {
            console.warn('createWorker normal path failed, trying blob fallback', firstErr);
            try {
              return await attemptCreateWorker({ ...baseOptions, workerBlobURL: true }, 'blob');
            } catch (secondErr: any) {
              const diag = `workerMeta=${JSON.stringify(workerMeta)} coreMeta=${JSON.stringify(coreMeta)} trainedMeta=${JSON.stringify(trainedMeta)}`;
              throw new Error(
                `createWorker failed. normal=${firstErr instanceof Error ? firstErr.message : String(firstErr)}; blob=${secondErr instanceof Error ? secondErr.message : String(secondErr)}; ${diag}`,
              );
            }
          }
        } catch (err) {
          throw new Error('Failed to initialize Tesseract worker. Ensure OCR assets are present at ' + OcrService.baseAssetPath + ': ' + (err instanceof Error ? err.message : String(err)));
        }
      })();
    }

    return this.workerInitPromise!;
  }

  private parseText(text: string): ParsedAadharFields {
    const normalized = text
      .replace(/\r/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const lowered = normalized.map((line) => line.toLowerCase());

    const joined = normalized.join(' ');
    const aadharMatch = joined.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/);
    const aadharNumber = aadharMatch ? aadharMatch[0].replace(/\s+/g, '') : undefined;

    const phoneMatch = joined.match(/(?:\+91[\s-]?)?([6-9]\d{9})\b/);
    const phoneNumber = phoneMatch ? phoneMatch[1] : undefined;

    const result: ParsedAadharFields = {};
    if (aadharNumber) {
      result.aadharNumber = aadharNumber;
    }
    if (phoneNumber) {
      result.phoneNumber = phoneNumber;
    }

    const keywordsToSkip = new Set([
      'government of india',
      'unique identification authority of india',
      'male',
      'female',
      'dob',
      'd0b',
      'year of birth',
      'yob',
    ]);

    const addressIndex = lowered.findIndex((line) => line.startsWith('address') || line.startsWith('addr'));
    if (addressIndex >= 0) {
      const addressLines: string[] = [];
      const baseLine = normalized[addressIndex];
      const colonIdx = baseLine.indexOf(':');
      if (colonIdx >= 0) {
        const trailing = baseLine.slice(colonIdx + 1).trim();
        if (trailing.length > 0) {
          addressLines.push(trailing);
        }
      }
      for (let i = addressIndex + 1; i < normalized.length; i += 1) {
        const value = normalized[i];
        const lowerValue = lowered[i];
        if (value.length === 0) {
          break;
        }
        if (lowerValue.includes('dob') || lowerValue.includes('year of birth') || lowerValue.includes('yob')) {
          break;
        }
        if (lowerValue.includes('phone') || lowerValue.includes('mobile')) {
          break;
        }
        if (/^[0-9]{4}\s?[0-9]{4}\s?[0-9]{4}$/.test(value)) {
          break;
        }
        addressLines.push(value);
      }
      if (addressLines.length > 0) {
        result.address = this.toSentenceCase(addressLines.join(', '));
      }
    }

    if (!result.address) {
      const fallback = normalized
        .filter((line) => /(?:w\/o|s\/o|d\/o|co|road|street|floor|district|pin|pincode|city|village|po|ps)/i.test(line))
        .slice(0, 4);
      if (fallback.length >= 2) {
        result.address = this.toSentenceCase(fallback.join(', '));
      }
    }

    let nameCandidate: string | undefined;

    const nameKeywordIndex = lowered.findIndex((line) => line.startsWith('name'));
    if (nameKeywordIndex >= 0) {
      const raw = normalized[nameKeywordIndex].replace(/^name[:\s]*/i, '').trim();
      if (raw.length > 2) {
        nameCandidate = raw;
      } else if (normalized[nameKeywordIndex + 1]) {
        nameCandidate = normalized[nameKeywordIndex + 1];
      }
    }

    if (!nameCandidate) {
      const dobIndex = lowered.findIndex((line) => line.includes('dob') || line.includes('year of birth') || line.includes('yob'));
      if (dobIndex > 0) {
        const possible = normalized[dobIndex - 1];
        if (possible && possible.length >= 3) {
          nameCandidate = possible;
        }
      }
    }

    if (!nameCandidate) {
      for (let i = 0; i < normalized.length; i += 1) {
        const value = normalized[i];
        const lowerValue = lowered[i];
        if (/\d/.test(value)) {
          continue;
        }
        if (keywordsToSkip.has(lowerValue)) {
          continue;
        }
        if (value.length < 3) {
          continue;
        }
        if (/^(s\/o|d\/o|w\/o)/i.test(value)) {
          continue;
        }
        if (value.toUpperCase() === value) {
          nameCandidate = value;
          break;
        }
      }
    }

    if (nameCandidate) {
      result.name = this.toTitleCase(nameCandidate);
    }

    return result;
  }

  private toTitleCase(input: string): string {
    return input
      .toLowerCase()
      .split(/\s+/)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private toSentenceCase(input: string): string {
    return input
      .split(',')
      .map((segment) => this.toTitleCase(segment.trim()))
      .filter((segment) => segment.length > 0)
      .join(', ');
  }
}
