declare module 'tesseract.js' {
  export interface RecognizeData {
    text?: string;
    confidence?: number;
  }

  export interface RecognizeResult {
    data: RecognizeData;
  }

  export interface Worker {
    loadLanguage(language: string): Promise<void>;
    initialize(language: string): Promise<void>;
    setParameters(parameters: Record<string, string>): Promise<void>;
    recognize(image: string, options?: Record<string, unknown>): Promise<RecognizeResult>;
  }

  export interface CreateWorkerOptions {
    workerPath?: string;
    corePath?: string;
    langPath?: string;
    cacheMethod?: 'none' | 'read' | 'write' | 'both';
    gzip?: boolean;
    logger?: (message: { status?: string; progress?: number }) => void;
  }

  export const PSM: {
    AUTO: number;
  };

  export function createWorker(
    langs?: string | string[],
    oem?: number,
    options?: CreateWorkerOptions,
    config?: Record<string, string>
  ): Promise<Worker>;
}
