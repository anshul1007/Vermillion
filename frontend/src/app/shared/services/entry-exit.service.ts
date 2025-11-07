import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { User } from '../models/admin.model';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: string[];
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Contractor {
  id: number;
  name: string;
  contactPerson: string;
  phoneNumber: string;
  projectId: number;
  projectName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Guard {
  authUserId: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  email?: string;
  isActive: boolean;
  assignedProjects?: GuardProjectInfo[];
}

export interface GuardProjectInfo {
  projectId: number;
  projectName: string;
  isActive: boolean;
  assignedAt: string;
}

export interface AssignGuardToProjectDto {
  authUserId: number;
  projectId: number;
}

export interface UnassignGuardFromProjectDto {
  authUserId: number;
  projectId: number;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateContractorDto {
  name: string;
  contactPerson: string;
  phoneNumber: string;
  projectId: number;
}

export interface UpdateContractorDto {
  name?: string;
  contactPerson?: string;
  phoneNumber?: string;
  projectId?: number;
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class EntryExitService {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.entryExitApiUrl;

  // Projects
  getProjects(): Observable<Project[]> {
    return this.http.get<ApiResponse<Project[]>>(`${this.apiUrl}/admin/projects`)
      .pipe(map(response => response.data));
  }

  createProject(dto: CreateProjectDto): Observable<Project> {
    return this.http.post<ApiResponse<Project>>(`${this.apiUrl}/admin/projects`, dto)
      .pipe(map(response => response.data));
  }

  updateProject(id: number, dto: UpdateProjectDto): Observable<Project> {
    return this.http.put<ApiResponse<Project>>(`${this.apiUrl}/admin/projects/${id}`, dto)
      .pipe(map(response => response.data));
  }

  deleteProject(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/projects/${id}`);
  }

  // Contractors
  getContractors(): Observable<Contractor[]> {
    return this.http.get<ApiResponse<Contractor[]>>(`${this.apiUrl}/admin/contractors`)
      .pipe(map(response => response.data));
  }

  getContractorsByProject(projectId: number): Observable<Contractor[]> {
    return this.http.get<ApiResponse<Contractor[]>>(`${this.apiUrl}/admin/contractors?projectId=${projectId}`)
      .pipe(map(response => response.data));
  }

  createContractor(dto: CreateContractorDto): Observable<Contractor> {
    return this.http.post<ApiResponse<Contractor>>(`${this.apiUrl}/admin/contractors`, dto)
      .pipe(map(response => response.data));
  }

  updateContractor(id: number, dto: UpdateContractorDto): Observable<Contractor> {
    return this.http.put<ApiResponse<Contractor>>(`${this.apiUrl}/admin/contractors/${id}`, dto)
      .pipe(map(response => response.data));
  }

  deleteContractor(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/contractors/${id}`);
  }

  // Users (guards from entryexit tenant)
  getUsers(): Observable<User[]> {
    return this.http.get<ApiResponse<User[]>>(`${this.apiUrl}/admin/guards/list`)
      .pipe(map(response => response.data));
  }

  // Create guard (no authentication required)
  createGuard(dto: any): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/admin/guards/create`, dto)
      .pipe(map(response => response.data));
  }

  updateGuard(authUserId: number | string, dto: any): Observable<any> {
    return this.http.put<ApiResponse<any>>(`${this.apiUrl}/admin/guards/${authUserId}`, dto)
      .pipe(map(response => response.data));
  }

  // Guards (from AuthAPI with project assignments)
  getGuards(projectId?: number, activeOnly: boolean = true): Observable<Guard[]> {
    let url = `${this.apiUrl}/admin/guards?activeOnly=${activeOnly}`;
    if (projectId) {
      url += `&projectId=${projectId}`;
    }
    return this.http.get<ApiResponse<Guard[]>>(url)
      .pipe(map(response => response.data));
  }

  assignGuardToProject(dto: AssignGuardToProjectDto): Observable<Guard> {
    return this.http.post<ApiResponse<Guard>>(`${this.apiUrl}/admin/guards/assign`, dto)
      .pipe(map(response => response.data));
  }

  unassignGuardFromProject(dto: UnassignGuardFromProjectDto): Observable<boolean> {
    return this.http.post<ApiResponse<boolean>>(`${this.apiUrl}/admin/guards/unassign`, dto)
      .pipe(map(response => response.data));
  }

  getGuardAssignments(authUserId: number): Observable<GuardProjectInfo[]> {
    return this.http.get<ApiResponse<GuardProjectInfo[]>>(`${this.apiUrl}/admin/guards/${authUserId}/assignments`)
      .pipe(map(response => response.data));
  }

  getMyAssignments(): Observable<GuardProjectInfo[]> {
    return this.http.get<ApiResponse<GuardProjectInfo[]>>(`${this.apiUrl}/admin/guards/my-assignments`)
      .pipe(map(response => response.data));
  }
}
