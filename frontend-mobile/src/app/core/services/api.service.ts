import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface LabourRegistrationDto {
  labourId: number;
  projectId: number;
  contractorId: number;
  barcode: string;
  photoPath?: string;
}

export interface VisitorRegistrationDto {
  name: string;
  phoneNumber: string;
  companyName?: string;
  purpose: string;
  photoPath: string;
}

export interface CreateRecordDto {
  personType: 'Labour' | 'Visitor';
  personId: number;
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
  data: any;
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
  registerLabour(data: LabourRegistrationDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.entryExitApiUrl}/labour/register`, data, {
      headers: this.getHeaders()
    });
  }

  searchLabour(query: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.entryExitApiUrl}/labour/search?query=${encodeURIComponent(query)}`, {
      headers: this.getHeaders()
    });
  }

  // Visitor endpoints
  registerVisitor(data: VisitorRegistrationDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.entryExitApiUrl}/visitor/register`, data, {
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

  getContractorsByProject(projectId: number): Observable<Contractor[]> {
    return this.http.get<Contractor[]>(`${this.entryExitApiUrl}/admin/contractors?projectId=${projectId}`, {
      headers: this.getHeaders()
    });
  }

  // Search method for general use
  search(query: string): Observable<ApiResponse<any>> {
    // Search both labour and visitors
    return this.searchLabour(query);
  }
}
