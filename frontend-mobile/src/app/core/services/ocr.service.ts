import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

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
  private readonly OCR_API_KEY = 'K87899142388957'; // Free tier OCR.space API key
  private readonly OCR_API_URL = 'https://api.ocr.space/parse/image';

  constructor(private http: HttpClient) {}

  async extractAadharFields(imageDataUrl: string, progress?: (value: number) => void): Promise<AadharOcrResult> {
    if (!imageDataUrl) {
      throw new Error('No image provided for OCR processing.');
    }

    if (progress) {
      progress(0.1);
    }

    try {
      // Prepare form data
      const formData = new FormData();
      formData.append('base64Image', imageDataUrl);
      formData.append('language', 'eng');
      formData.append('isOverlayRequired', 'false');
      formData.append('detectOrientation', 'true');
      formData.append('scale', 'true');
      formData.append('OCREngine', '2'); // Use OCR Engine 2 for better results

      if (progress) {
        progress(0.3);
      }

      // Call OCR API
      const response: any = await firstValueFrom(
        this.http.post(this.OCR_API_URL, formData, {
          headers: {
            'apikey': this.OCR_API_KEY,
          },
        })
      );

      if (progress) {
        progress(0.8);
      }

      if (!response || !response.ParsedResults || response.ParsedResults.length === 0) {
        throw new Error('OCR API returned no results');
      }

      const ocrResult = response.ParsedResults[0];
      const rawText = ocrResult.ParsedText || '';
      const confidence = ocrResult.FileParseExitCode === 1 ? 0.85 : 0.5; // Estimate confidence

      if (progress) {
        progress(0.9);
      }

      const parsed = this.parseText(rawText);

      if (progress) {
        progress(1);
      }

      return {
        rawText,
        confidence,
        ...parsed,
      };
    } catch (error: any) {
      console.error('OCR API error:', error);
      throw new Error('Failed to process image with OCR API: ' + (error.message || String(error)));
    }
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
