import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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
  projectIds: number[];
  projects?: ContractorProjectSummary[];
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ContractorProjectSummary {
  id: number;
  name: string;
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
  projectIds: number[];
}

export interface UpdateContractorDto {
  name?: string;
  contactPerson?: string;
  phoneNumber?: string;
  projectIds?: number[];
  isActive?: boolean;
}

export interface LabourRegistration {
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

export interface VisitorRegistration {
  id: number;
  name: string;
  phoneNumber: string;
  photoUrl: string;
  projectId: number;
  projectName?: string;
  companyName?: string;
  purpose?: string;
  registeredBy?: string;
  registeredAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class EntryExitService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/entryexit`;

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

  // Labour
  getLabourByProject(projectId: number): Observable<LabourRegistration[]> {
    return this.http.get<ApiResponse<LabourRegistration[]>>(`${this.apiUrl}/labour/by-project/${projectId}`)
      .pipe(map(response => response.data));
  }

  getLabourByContractor(contractorId: number): Observable<LabourRegistration[]> {
    return this.http.get<ApiResponse<LabourRegistration[]>>(`${this.apiUrl}/labour/by-contractor/${contractorId}`)
      .pipe(map(response => response.data));
  }

  getLabourByProjectAndContractor(projectId: number, contractorId: number): Observable<LabourRegistration[]> {
    return this.http.get<ApiResponse<LabourRegistration[]>>(`${this.apiUrl}/labour/by-project/${projectId}/contractor/${contractorId}`)
      .pipe(map(response => response.data));
  }

  searchLabour(query: string): Observable<LabourRegistration[]> {
    return this.http.get<ApiResponse<LabourRegistration[]>>(`${this.apiUrl}/labour/search?query=${encodeURIComponent(query)}`)
      .pipe(map(response => response.data));
  }

  getLabourRegistration(id: number): Observable<LabourRegistration> {
    return this.http.get<ApiResponse<LabourRegistration>>(`${this.apiUrl}/labour/${id}`)
      .pipe(map(response => response.data));
  }

  // Visitors
  getVisitorsByProject(projectId: number): Observable<VisitorRegistration[]> {
    return this.http.get<ApiResponse<VisitorRegistration[]>>(`${this.apiUrl}/visitor/by-project/${projectId}`)
      .pipe(map(response => response.data));
  }

  getVisitorsByQuery(query: string): Observable<VisitorRegistration[]> {
    return this.http.get<ApiResponse<VisitorRegistration[]>>(`${this.apiUrl}/visitor/search?query=${encodeURIComponent(query)}`)
      .pipe(map(response => response.data));
  }

  getVisitorRegistration(id: number): Observable<VisitorRegistration> {
    return this.http.get<ApiResponse<VisitorRegistration>>(`${this.apiUrl}/visitor/${id}`)
      .pipe(map(response => response.data));
  }

  // Reports
  getRecords(
    labourId?: number | null,
    visitorId?: number | null,
    projectId?: number | null,
    fromDate?: Date,
    toDate?: Date
  ): Observable<any[]> {
    let params = new HttpParams();
    
    if (labourId) {
      params = params.set('labourRegistrationId', labourId.toString());
    }
    if (visitorId) {
      params = params.set('visitorId', visitorId.toString());
    }
    if (projectId != null && projectId > 0) {
      params = params.set('projectId', projectId.toString());
    }
    if (fromDate) {
      params = params.set('fromDate', fromDate.toISOString());
    }
    if (toDate) {
      params = params.set('toDate', toDate.toISOString());
    }
    
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/records`, { params })
      .pipe(map(response => response.data));
  }
}
