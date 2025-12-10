import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timer, of, Subject } from 'rxjs';
import { exhaustMap, switchMap, catchError, takeUntil, take } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class NetworkQualityService {
  // allow clean unsubscribe when service is destroyed (e.g., during HMR tests)
  private destroy$ = new Subject<void>();
  private http = inject(HttpClient);
  private entryExitApiUrl = environment.baseUrl;

  // public signals for components to observe
  isSlow = signal(false);
  latencyMs = signal<number | null>(null);
  lastCheckedAt = signal<number | null>(null);

  private pollIntervalMs = 15000; // measure every 15s
  private slowThresholdMs = 2000; // latency above this considered slow

  constructor() {
    // start polling
    timer(0, this.pollIntervalMs)
      .pipe(
        exhaustMap(() => this.pollHealth()),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  private pollHealth() {
    try {
      const url = (this.entryExitApiUrl || '').replace(/\/$/, '') + '/health';
      const start = Date.now();
      return this.http.get(url, { responseType: 'text' as 'json' }).pipe(
        catchError(() => of(null)),
        switchMap((res) => {
          const latency = Date.now() - start;
          this.latencyMs.set(latency);
          this.isSlow.set(latency > this.slowThresholdMs);
          this.lastCheckedAt.set(Date.now());
          return of(res);
        })
      );
    } catch (e) {
      // return observable of null if something goes wrong
      return of(null);
    }
  }

  // Allow manual polling (useful for diagnostics)
  forcePoll() {
    // only take the first result so we don't leave an open subscription
    this.pollHealth().pipe(take(1)).subscribe();
  }

  // Clean up polling when Angular destroys the service (rare in normal app lifecycle)
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
