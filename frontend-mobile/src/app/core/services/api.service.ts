import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, timer, defer, firstValueFrom } from 'rxjs';
import { catchError, retryWhen, mergeMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { LoggerService } from './logger.service';
import { OfflineStorageService } from './offline-storage.service';
import { NetworkQualityService } from './network-quality.service';
import { Network } from '@capacitor/network';
import { generateClientId } from '../utils/id.util';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface CreateLabourDto {
  name: string;
  phoneNumber: string;
  aadharNumber?: string;
}

export interface CreateLabourRegistrationDto {
  // Flattened to match backend CreateLabourDto (expected top-level fields)
  name: string;
  phoneNumber: string;
  aadharNumber?: string;
  // optional inline base64 photo (prefer using `photoPath` when available)
  projectId: number;
  contractorId: number;
  classificationId?: number;
  barcode: string;
  labourId?: number;
  photoPath?: string; // server-side stored photo path when uploaded separately
  photoBase64?: string;
}

export interface LabourRegistrationDto {
  id: number;
  labourId: number;
  labourName: string;
  phoneNumber: string;
  aadharNumber?: string;
  photoUrl: string;
  projectId: number;
  projectName: string;
  contractorId: number;
  contractorName: string;
  barcode: string;
  isActive: boolean;
  registeredBy?: string;
  registeredAt: string;
  updatedAt?: string;
}

export interface CreateVisitorRegistrationDto {
  name: string;
  phoneNumber: string;
  companyName?: string;
  purpose: string;
  photoBase64?: string;  // Sent as base64, backend converts to blob URL
  projectId: number;
  photoPath?: string; // server-side stored photo path when uploaded separately
}

export interface VisitorRegistrationDto {
  id: number;
  name: string;
  phoneNumber: string;
  companyName?: string;
  purpose: string;
  photoUrl: string;
  registeredBy: string;
  registeredAt: string;
  projectId: number;
  projectName: string;
}

export interface CreateRecordDto {
  personType: 'Labour' | 'Visitor';
  labourId?: number;
  visitorId?: number;
  action: 'Entry' | 'Exit';
  photoPath?: string;
  clientId?: string;
}

export interface SyncBatchDto {
  operations: SyncOperation[];
}

export interface SyncOperation {
  id: number;
  operationType: string;
  entityType: string;
  data: unknown;
  clientId: string;
  timestamp: string;
}

export interface Project {
  id: number;
  name: string;
}

export interface Contractor {
  id: number;
  name: string;
  contactPerson: string;
  phoneNumber: string;
  projectId: number;
  isActive: boolean;
}

export interface GuardProfile {
  id: number;
  authUserId: number;
  firstName: string;
  lastName: string;
  guardId: string;
  phoneNumber: string;
  projectId: number;
  projectName: string;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private authApiUrl = environment.authApiUrl;
  private entryExitApiUrl = environment.apiUrl;

  private logger = inject(LoggerService);
  private offline = inject(OfflineStorageService);
  private networkQuality = inject(NetworkQualityService);

  constructor(private http: HttpClient) { }

  // Use shared generateClientId() util from ../utils/id.util

  private async shouldEnqueue(): Promise<boolean> {
    try {
      const status = await Network.getStatus();
      // enqueue if offline or network is slow
      return !status.connected || this.networkQuality.isSlow();
    } catch (e) {
      return false;
    }
  }

  // Generic helper: perform an observable with retries and exponential backoff
  private requestWithRetry<T>(obs: Observable<T>, retries = 3, baseDelay = 500): Observable<T> {
    return obs.pipe(
      retryWhen(errors => errors.pipe(
        mergeMap((err, i) => {
          const attempt = i + 1;
          if (attempt > retries) return throwError(() => err);
          const delay = baseDelay * Math.pow(2, i); // exponential backoff
          this.logger.debug('[ApiService] retry attempt', attempt, 'delay', delay);
          return timer(delay);
        })
      )),
      catchError(err => {
        this.logger.error('[ApiService] request failed', err);
        return throwError(() => err);
      })
    );
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('accessToken');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  // Auth endpoints
  login(username: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.authApiUrl}/auth/login`, {
      username,
      password,
      tenantDomain: 'entryexit'
    });
  }

  refreshToken(refreshToken: string): Observable<any> {
    return this.http.post<any>(`${this.authApiUrl}/auth/refresh`, {
      refreshToken
    });
  }

  // Labour endpoints
  registerLabour(data: CreateLabourRegistrationDto, options: { enqueueIfNeeded?: boolean } = { enqueueIfNeeded: true }): Observable<ApiResponse<LabourRegistrationDto>> {
    return defer(async () => {
      const enqueueIfNeeded = options?.enqueueIfNeeded !== false;
      // enqueue-first: persist locally when offline/slow and avoid immediate network call
      if (enqueueIfNeeded && await this.shouldEnqueue()) {
        try {
          const payload: any = { ...data };
          if (!payload.clientId) payload.clientId = generateClientId();
          if (payload.photoBase64) {
            try {
              const saved = await this.offline.savePhotoFromDataUrl(payload.photoBase64, `labour_${Date.now()}.jpg`);
              payload.photoLocalId = saved.id;
              delete payload.photoBase64;
            } catch (e) {
              this.logger.error('[ApiService] savePhotoFromDataUrl failed while enqueueing labour', e);
            }
          }
          await this.offline.enqueueAction('registerLabour', payload);
          this.logger.debug('[ApiService] registerLabour enqueued due to offline/slow network');
          return { success: true, message: 'enqueued-offline' } as ApiResponse<LabourRegistrationDto>;
        } catch (e) {
          this.logger.error('[ApiService] failed to enqueue registerLabour', e);
          // fallthrough to network attempt
        }
      }

      // If we have an inline photo and we're online, upload photo first to reduce payload size
      try {
        if (data && (data as any).photoBase64) {
          try {
            const uploadResp = await firstValueFrom(this.uploadPhoto((data as any).photoBase64, `labour_${Date.now()}.jpg`));
            if (uploadResp && uploadResp.success && uploadResp.data && uploadResp.data.path) {
              (data as any).photoPath = uploadResp.data.path;
              delete (data as any).photoBase64;
            }
          } catch (e) {
            this.logger.warn('[ApiService] labour photo upload failed, sending inline base64 as fallback', e);
          }
        }
      } catch {}

      const req = this.http.post<ApiResponse<LabourRegistrationDto>>(`${this.entryExitApiUrl}/labour/register`, data, {
        headers: this.getHeaders()
      });
      return await firstValueFrom(this.requestWithRetry(req, 2, 300));
    });
  }

  searchLabour(query: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.entryExitApiUrl}/labour/search?query=${encodeURIComponent(query)}`, {
      headers: this.getHeaders()
    });
  }

  // Visitor endpoints
  registerVisitor(data: CreateVisitorRegistrationDto, options: { enqueueIfNeeded?: boolean } = { enqueueIfNeeded: true }): Observable<ApiResponse<VisitorRegistrationDto>> {
    return defer(async () => {
      const enqueueIfNeeded = options?.enqueueIfNeeded !== false;
      if (enqueueIfNeeded && await this.shouldEnqueue()) {
        try {
          const payload: any = { ...data };
          if (!payload.clientId) payload.clientId = generateClientId();
          if (payload.photoBase64) {
            try {
              const saved = await this.offline.savePhotoFromDataUrl(payload.photoBase64, `visitor_${Date.now()}.jpg`);
              payload.photoLocalId = saved.id;
              delete payload.photoBase64;
            } catch (e) {
              this.logger.error('[ApiService] savePhotoFromDataUrl failed while enqueueing visitor', e);
            }
          }
          await this.offline.enqueueAction('registerVisitor', payload);
          this.logger.debug('[ApiService] registerVisitor enqueued due to offline/slow network');
          return { success: true, message: 'enqueued-offline' } as ApiResponse<VisitorRegistrationDto>;
        } catch (e) {
          this.logger.error('[ApiService] failed to enqueue registerVisitor', e);
        }
      }

      // If we have an inline photo and we're online, upload photo first to reduce payload size
      try {
        if (data && (data as any).photoBase64) {
          try {
            const uploadResp = await firstValueFrom(this.uploadPhoto((data as any).photoBase64, `visitor_${Date.now()}.jpg`));
            if (uploadResp && uploadResp.success && uploadResp.data && uploadResp.data.path) {
              (data as any).photoPath = uploadResp.data.path;
              delete (data as any).photoBase64;
            }
          } catch (e) {
            this.logger.warn('[ApiService] visitor photo upload failed, sending inline base64 as fallback', e);
          }
        }
      } catch {}

      const req = this.http.post<ApiResponse<VisitorRegistrationDto>>(`${this.entryExitApiUrl}/visitor/register`, data, {
        headers: this.getHeaders()
      });
      return await firstValueFrom(this.requestWithRetry(req, 2, 300));
    });
  }

  searchVisitor(query: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.entryExitApiUrl}/visitor/search?query=${encodeURIComponent(query)}`, {
      headers: this.getHeaders()
    });
  }

  // Entry/Exit records
  createRecord(data: CreateRecordDto, options: { enqueueIfNeeded?: boolean } = { enqueueIfNeeded: true }): Observable<ApiResponse<any>> {
    return defer(async () => {
      const enqueueIfNeeded = options?.enqueueIfNeeded !== false;
      if (enqueueIfNeeded && await this.shouldEnqueue()) {
        try {
          const payload: any = { ...data };
          if (!payload.clientId) payload.clientId = generateClientId();
          // If caller passed a data URL as photoPath, persist it locally and reference by photoLocalId
          if (payload.photoPath && typeof payload.photoPath === 'string' && payload.photoPath.startsWith('data:')) {
            try {
              const saved = await this.offline.savePhotoFromDataUrl(payload.photoPath, `record_${Date.now()}.jpg`);
              payload.photoLocalId = saved.id;
              delete payload.photoPath;
            } catch (e) {
              this.logger.error('[ApiService] savePhotoFromDataUrl failed while enqueueing record', e);
            }
          }
          await this.offline.enqueueAction('createRecord', payload);
          this.logger.debug('[ApiService] createRecord enqueued due to offline/slow network');
          return { success: true, message: 'enqueued-offline' } as ApiResponse<any>;
        } catch (e) {
          this.logger.error('[ApiService] failed to enqueue createRecord', e);
        }
      }

      // If caller passed a data URL as photoPath (inline base64), try uploading first when online
      try {
        if (data && (data as any).photoPath && typeof (data as any).photoPath === 'string' && (data as any).photoPath.startsWith('data:')) {
          try {
            const uploadResp = await firstValueFrom(this.uploadPhoto((data as any).photoPath, `record_${Date.now()}.jpg`));
            if (uploadResp && uploadResp.success && uploadResp.data && uploadResp.data.path) {
              (data as any).photoPath = uploadResp.data.path;
            }
          } catch (e) {
            this.logger.warn('[ApiService] record photo upload failed, sending inline data as fallback', e);
          }
        }
      } catch {}

      const req = this.http.post<ApiResponse<any>>(`${this.entryExitApiUrl}/records`, data, { headers: this.getHeaders() });
      return await firstValueFrom(this.requestWithRetry(req, 2, 300));
    });
  }

  getTodayRecords(projectId?: number): Observable<ApiResponse<any>> {
    let url = `${this.entryExitApiUrl}/records/today`;
    if (projectId) {
      url += `?projectId=${projectId}`;
    }
    const req = this.http.get<ApiResponse<any>>(url, { headers: this.getHeaders() });
    return this.requestWithRetry(req, 2, 300);
  }

  // Sync endpoint
  syncBatch(data: SyncBatchDto): Observable<ApiResponse<any>> {
    const req = this.http.post<ApiResponse<any>>(`${this.entryExitApiUrl}/sync-batch`, data, { headers: this.getHeaders() });
    return this.requestWithRetry(req, 3, 500);
  }

  // Admin endpoints
  getProjects(): Observable<ApiResponse<Project[]>> {
    return this.http.get<ApiResponse<Project[]>>(`${this.entryExitApiUrl}/admin/projects`, {
      headers: this.getHeaders()
    });
  }

  getContractors(projectId: number): Observable<ApiResponse<Contractor[]>> {
    return this.http.get<ApiResponse<Contractor[]>>(`${this.entryExitApiUrl}/admin/projects/${projectId}/contractors`, {
      headers: this.getHeaders()
    });
  }

  getContractorsByProject(projectId: number): Observable<ApiResponse<Contractor[]>> {
    return this.http.get<ApiResponse<Contractor[]>>(`${this.entryExitApiUrl}/admin/contractors?projectId=${projectId}`, {
      headers: this.getHeaders()
    });
  }

  // Search method for general use (searches both labour and visitors)
  search(query: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.entryExitApiUrl}/records/search-person?query=${encodeURIComponent(query)}`, {
      headers: this.getHeaders()
    });
  }

  // Reports and statistics endpoints
  getRecords(fromDate?: string, toDate?: string, labourId?: number, visitorId?: number, projectId?: number): Observable<ApiResponse<any>> {
    let url = `${this.entryExitApiUrl}/records?`;
    const params: string[] = [];

    if (fromDate) params.push(`fromDate=${encodeURIComponent(fromDate)}`);
    if (toDate) params.push(`toDate=${encodeURIComponent(toDate)}`);
    if (labourId) params.push(`labourId=${labourId}`);
    if (visitorId) params.push(`visitorId=${visitorId}`);
    if (projectId) params.push(`projectId=${projectId}`);

    url += params.join('&');

    return this.http.get<ApiResponse<any>>(url, {
      headers: this.getHeaders()
    });
  }

  getOpenSessions(projectId?: number): Observable<ApiResponse<any>> {
    let url = `${this.entryExitApiUrl}/records/open-sessions`;
    if (projectId) {
      url += `?projectId=${projectId}`;
    }
    return this.http.get<ApiResponse<any>>(url, {
      headers: this.getHeaders()
    });
  }

  getDashboardStats(projectId?: number): Observable<any> {
    let url = `${this.entryExitApiUrl}/admin/dashboard-stats`;
    if (projectId) {
      url += `?projectId=${projectId}`;
    }
    return this.http.get<any>(url, {
      headers: this.getHeaders()
    });
  }

  // Contractor-based search
  searchByContractor(contractorName: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.entryExitApiUrl}/records/search-by-contractor?contractorName=${encodeURIComponent(contractorName)}`, {
      headers: this.getHeaders()
    });
  }

  // Bulk check-in/check-out
  bulkCheckIn(labourIds: number[], action: number, gate?: string, notes?: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.entryExitApiUrl}/records/bulk-checkin`, {
      labourIds,
      action,
      gate,
      notes
    }, {
      headers: this.getHeaders()
    });
  }

  // Fetch private photo blob by blob path
  getPhotoBlob(blobPath: string): Observable<Blob> {
    const headers = this.getHeaders();
    // Accept either a raw blob path (e.g. "visitor/xxx.jpg") or a full api path ("/api/entryexit/photos/visitor/xxx.jpg" or "/api/photos/visitor/xxx.jpg").
    let path = blobPath || '';
    if (path.startsWith('/api/entryexit/photos/')) {
      path = path.replace(/^\/api\/entryexit\/photos\//, '');
    } else if (path.startsWith('/api/photos/')) {
      path = path.replace(/^\/api\/photos\//, '');
    }
    if (path.startsWith('api/entryexit/photos/')) {
      path = path.replace(/^api\/entryexit\/photos\//, '');
    } else if (path.startsWith('api/photos/')) {
      path = path.replace(/^api\/photos\//, '');
    }
    // Photos controller may be mounted at /api/entryexit/photos or /api/photos depending on deployment
    // Preserve slashes in the blobPath by encoding each segment separately.
    const safePath = path.split('/').map(segment => encodeURIComponent(segment)).join('/');

    // Some deployments mount the photos endpoint under /api/entryexit/photos
    // If the configured entryExit API url contains 'entryexit', request that variant first.
    const prefersEntryExit = this.entryExitApiUrl && this.entryExitApiUrl.includes('/entryexit');
    const base = prefersEntryExit ? this.entryExitApiUrl.replace(/\/$/, '') : this.authApiUrl.replace(/\/$/, '');

    // Try the preferred base first; on error, fall back to the alternate base
    const primary = `${base}/photos/${safePath}`;
    // Alternate base: if primary used entryExitApiUrl, alternate is authApiUrl, and vice-versa
    const alternateBase = base === this.entryExitApiUrl.replace(/\/$/, '') ? this.authApiUrl.replace(/\/$/, '') : this.entryExitApiUrl.replace(/\/$/, '');
    const fallback = `${alternateBase}/photos/${safePath}`;

    this.logger.debug('[ApiService] fetching photo blob, primary:', primary, 'fallback:', fallback);
    const primaryReq = this.http.get(primary, { headers, responseType: 'blob' as 'blob' });
    const fallbackReq = this.http.get(fallback, { headers, responseType: 'blob' as 'blob' });

    // Try primary with a couple of retries; on failure, try fallback once.
    return this.requestWithRetry(primaryReq, 2, 300).pipe(
      catchError((err) => {
        this.logger.debug('[ApiService] primary photo fetch failed, trying fallback', err);
        return this.requestWithRetry(fallbackReq, 1, 300);
      })
    );
  }

  // Labour classifications lookup
  getLabourClassifications(): Observable<ApiResponse<Array<{ key: number; value: string }>>> {
    return this.http.get<ApiResponse<Array<{ key: number; value: string }>>>(`${this.entryExitApiUrl}/labour/classifications`, {
      headers: this.getHeaders()
    });
  }

  // Admin CRUD for labour classifications
  getAdminClassifications(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.entryExitApiUrl}/admin/labour-classifications`, {
      headers: this.getHeaders()
    });
  }

  createAdminClassification(name: string, isActive = true): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.entryExitApiUrl}/admin/labour-classifications`, { name, isActive }, {
      headers: this.getHeaders()
    });
  }

  updateAdminClassification(id: number, name: string, isActive = true): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.entryExitApiUrl}/admin/labour-classifications/${id}`, { id, name, isActive }, {
      headers: this.getHeaders()
    });
  }

  deleteAdminClassification(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.entryExitApiUrl}/admin/labour-classifications/${id}`, {
      headers: this.getHeaders()
    });
  }

  changeLabourClassification(labourId: number, classificationId: number): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.entryExitApiUrl}/admin/labour-classifications/labour/${labourId}/classification/${classificationId}`, {}, {
      headers: this.getHeaders()
    });
  }

  // Upload a photo as base64; backend should return the stored path in data.path
  uploadPhoto(base64Data: string, filename?: string): Observable<ApiResponse<{ path: string }>> {
    const body = { base64: base64Data, filename: filename || `photo_${Date.now()}.jpg` };
    return this.http.post<ApiResponse<{ path: string }>>(`${this.entryExitApiUrl}/photos/upload`, body, {
      headers: this.getHeaders()
    });
  }
}
