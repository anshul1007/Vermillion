import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

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
  photoBase64: string;  // Sent as base64, backend converts to blob URL
  projectId: number;
  contractorId: number;
  classificationId?: number;
  barcode: string;
  labourId?: number;
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
  photoBase64: string;  // Sent as base64, backend converts to blob URL
  projectId: number;
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

  constructor(private http: HttpClient) { }

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
  registerLabour(data: CreateLabourRegistrationDto): Observable<ApiResponse<LabourRegistrationDto>> {
    return this.http.post<ApiResponse<LabourRegistrationDto>>(`${this.entryExitApiUrl}/labour/register`, data, {
      headers: this.getHeaders()
    });
  }

  searchLabour(query: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.entryExitApiUrl}/labour/search?query=${encodeURIComponent(query)}`, {
      headers: this.getHeaders()
    });
  }

  // Visitor endpoints
  registerVisitor(data: CreateVisitorRegistrationDto): Observable<ApiResponse<VisitorRegistrationDto>> {
    return this.http.post<ApiResponse<VisitorRegistrationDto>>(`${this.entryExitApiUrl}/visitor/register`, data, {
      headers: this.getHeaders()
    });
  }

  searchVisitor(query: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.entryExitApiUrl}/visitor/search?query=${encodeURIComponent(query)}`, {
      headers: this.getHeaders()
    });
  }

  // Entry/Exit records
  createRecord(data: CreateRecordDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.entryExitApiUrl}/records`, data, {
      headers: this.getHeaders()
    });
  }

  getTodayRecords(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.entryExitApiUrl}/records/today`, {
      headers: this.getHeaders()
    });
  }

  // Sync endpoint
  syncBatch(data: SyncBatchDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.entryExitApiUrl}/sync/batch`, data, {
      headers: this.getHeaders()
    });
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
  getRecords(fromDate?: string, toDate?: string, labourId?: number, visitorId?: number): Observable<ApiResponse<any>> {
    let url = `${this.entryExitApiUrl}/records?`;
    const params: string[] = [];

    if (fromDate) params.push(`fromDate=${encodeURIComponent(fromDate)}`);
    if (toDate) params.push(`toDate=${encodeURIComponent(toDate)}`);
    if (labourId) params.push(`labourId=${labourId}`);
    if (visitorId) params.push(`visitorId=${visitorId}`);

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

  getDashboardStats(): Observable<any> {
    return this.http.get<any>(`${this.entryExitApiUrl}/admin/dashboard-stats`, {
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

    return this.http.get(`${base}/photos/${safePath}`, { headers, responseType: 'blob' as 'blob' });
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
