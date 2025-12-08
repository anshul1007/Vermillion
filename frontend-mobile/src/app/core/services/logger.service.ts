import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoggerService {
  // Toggle debug/info in one place
  private enableDebug = true;

  debug(...args: any[]) {
    if (this.enableDebug && console && console.debug) console.debug(...args);
  }

  info(...args: any[]) {
    if (console && console.info) console.info(...args);
  }

  warn(...args: any[]) {
    if (console && console.warn) console.warn(...args);
  }

  error(...args: any[]) {
    if (console && console.error) console.error(...args);
  }
}
