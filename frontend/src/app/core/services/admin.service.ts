import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../shared/models/api-response.model';
import { User, CreateUserRequest, UpdateUserRequest } from '../../shared/models/admin.model';

export interface PublicHoliday {
  id?: string;
  name: string;
  date: string;
  description?: string;
}

export interface LeaveEntitlementRequest {
  userId: string;
  year: number;
  casualLeaveBalance: number;
  earnedLeaveBalance: number;
  compensatoryOffBalance: number;
}

export interface LeaveEntitlementResponse {
  userId: string;
  year: number;
  casualLeaveBalance: number;
  earnedLeaveBalance: number;
  compensatoryOffBalance: number;
}

export interface Department {
  id?: string;
  name: string;
  description?: string;
  weeklyOffDays: string;
  isActive?: boolean;
}

export interface TeamMember {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  casualLeaveBalance?: number;
  earnedLeaveBalance?: number;
  compensatoryOffBalance?: number;
  upcomingLeaves?: UpcomingLeave[];
}

export interface UpcomingLeave {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: string;
}

export interface AssignCompOffRequest {
  employeeId: string;
  days: number;
  reason: string;
}

export interface LogPastAttendanceRequest {
  employeeId: string;
  date: string;
  loginTime: string;
  logoutTime?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.attendanceApiUrl}/admin`;

  // User Management
  getAllUsers(): Observable<User[]> {
    return this.http.get<ApiResponse<User[]>>(`${this.apiUrl}/users`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || response.error || 'Failed to fetch users');
        }),
        catchError(err => {
          console.error('Error fetching users', err);
          return of([] as User[]);
        })
      );
  }

  createUser(request: CreateUserRequest): Observable<User> {
    const authApiUrl = `${environment.apiUrl}/Admin/users`;
    const body = {
      username: request.email,
      email: request.email,
      password: request.password,
      role: this.mapRoleNumberToString(request.role),
      tenantDomain: 'attendance', // Default tenant for attendance system
      employeeId: request.employeeId,
      firstName: request.firstName,
      lastName: request.lastName,
      departmentId: request.departmentId,
      managerId: request.managerId
    };

    return this.http.post<ApiResponse<any>>(authApiUrl, body)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            // Map AuthAPI user response to frontend User model
            return {
              id: response.data.id?.toString() || '',
              email: request.email,
              firstName: request.firstName,
              lastName: request.lastName,
              employeeId: request.employeeId,
              role: this.mapRoleNumberToString(request.role),
              managerId: request.managerId,
              departmentId: request.departmentId,
              isActive: true
            } as User;
          }
          throw new Error(response.message || response.error || 'Failed to create user');
        }),
        catchError(err => {
          console.error('Error creating user in AuthAPI', err);
          throw err;
        })
      );
  }

  private mapRoleNumberToString(role: number): string {
    switch (role) {
      case 0: return 'Employee';
      case 1: return 'Manager';
      case 2: return 'Admin';
      default: return 'Employee';
    }
  }

  updateUser(userId: string, request: UpdateUserRequest): Observable<User> {
    return this.http.put<ApiResponse<User>>(`${this.apiUrl}/users/${userId}`, request)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || response.error || 'Failed to update user');
        }),
        catchError(err => {
          console.error('Error updating user', err);
          throw err;
        })
      );
  }

  // Department Management
  getAllDepartments(): Observable<Department[]> {
    return this.http.get<ApiResponse<Department[]>>(`${this.apiUrl}/departments`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || response.error || 'Failed to fetch departments');
        }),
        catchError(err => {
          console.error('Error fetching departments', err);
          return of([] as Department[]);
        })
      );
  }

  createDepartment(request: Department): Observable<Department> {
    return this.http.post<ApiResponse<Department>>(`${this.apiUrl}/departments`, request)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || response.error || 'Failed to create department');
        }),
        catchError(err => {
          console.error('Error creating department', err);
          throw err;
        })
      );
  }

  updateDepartment(departmentId: string, request: Department): Observable<Department> {
    return this.http.put<ApiResponse<Department>>(`${this.apiUrl}/departments/${departmentId}`, request)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || response.error || 'Failed to update department');
        }),
        catchError(err => {
          console.error('Error updating department', err);
          throw err;
        })
      );
  }

  deleteDepartment(departmentId: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/departments/${departmentId}`)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message || response.error || 'Failed to delete department');
          }
        }),
        catchError(err => {
          console.error('Error deleting department', err);
          throw err;
        })
      );
  }

  // Leave Entitlement Management
  allocateLeaveEntitlement(request: LeaveEntitlementRequest): Observable<LeaveEntitlementResponse> {
    return this.http.post<ApiResponse<boolean>>(`${this.apiUrl}/leave-entitlement`, request)
      .pipe(
        map(response => {
          if (response.success) {
            return {
              userId: request.userId,
              year: request.year,
              casualLeaveBalance: request.casualLeaveBalance,
              earnedLeaveBalance: request.earnedLeaveBalance,
              compensatoryOffBalance: request.compensatoryOffBalance
            } as LeaveEntitlementResponse;
          }
          throw new Error(response.message || response.error || 'Failed to allocate leave entitlement');
        }),
        catchError(err => {
          console.error('Error allocating leave entitlement', err);
          throw err;
        })
      );
  }

  getLeaveEntitlement(userId: string, year?: number): Observable<LeaveEntitlementResponse> {
    const yearParam = year || new Date().getFullYear();
    return this.http.get<ApiResponse<LeaveEntitlementResponse>>(`${this.apiUrl}/leave-entitlement/${userId}?year=${yearParam}`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || response.error || 'Failed to fetch leave entitlement');
        }),
        catchError(err => {
          console.error('Error fetching leave entitlement', err);
          // Return default values if not found
          return of({
            userId: userId,
            year: yearParam,
            casualLeaveBalance: 0,
            earnedLeaveBalance: 0,
            compensatoryOffBalance: 0
          } as LeaveEntitlementResponse);
        })
      );
  }

  // Public Holiday Management
  createPublicHoliday(holiday: PublicHoliday): Observable<PublicHoliday> {
    return this.http.post<ApiResponse<PublicHoliday>>(`${this.apiUrl}/holidays`, holiday)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || response.error || 'Failed to create holiday');
        }),
        catchError(err => {
          console.error('Error creating holiday', err);
          throw err;
        })
      );
  }

  getPublicHolidays(year?: number): Observable<PublicHoliday[]> {
    const yearParam = year || new Date().getFullYear();
    return this.http.get<ApiResponse<PublicHoliday[]>>(`${this.apiUrl}/holidays?year=${yearParam}`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.error || 'Failed to fetch holidays');
        }),
        catchError(err => {
          console.error('Error fetching holidays', err);
          return of([] as PublicHoliday[]);
        })
      );
  }

  deletePublicHoliday(holidayId: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/holidays/${holidayId}`)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message || response.error || 'Failed to delete holiday');
          }
        }),
        catchError(err => {
          console.error('Error deleting holiday', err);
          throw err;
        })
      );
  }

  // Team Management
  getAllTeamMembers(): Observable<TeamMember[]> {
    return this.http.get<ApiResponse<TeamMember[]>>(`${this.apiUrl}/team-members`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || response.error || 'Failed to fetch team members');
        }),
        catchError(err => {
          console.error('Error fetching team members', err);
          return of([] as TeamMember[]);
        })
      );
  }

  assignCompensatoryOff(request: AssignCompOffRequest): Observable<void> {
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/assign-comp-off`, request)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message || response.error || 'Failed to assign compensatory off');
          }
        }),
        catchError(err => {
          console.error('Error assigning comp-off', err);
          throw err;
        })
      );
  }

  logPastAttendance(request: LogPastAttendanceRequest): Observable<void> {
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/log-past-attendance`, request)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message || response.error || 'Failed to log past attendance');
          }
        }),
        catchError(err => {
          console.error('Error logging past attendance', err);
          throw err;
        })
      );
  }

  getTeamAttendanceHistory(startDate: string, endDate: string): Observable<any[]> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);

    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/attendance/history`, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.error || 'Failed to fetch team attendance history');
        }),
        catchError(err => {
          console.error('Error fetching team attendance history', err);
          return of([] as any[]);
        })
      );
  }

  getTeamLeaveHistory(startDate: string, endDate: string): Observable<any[]> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);

    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/leave/history`, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.error || 'Failed to fetch team leave history');
        }),
        catchError(err => {
          console.error('Error fetching team leave history', err);
          return of([] as any[]);
        })
      );
  }

  getPendingAttendance(date?: string): Observable<any[]> {
    let params = new HttpParams();
    if (date) {
      params = params.set('date', date);
    }

    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/attendance/pending`, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.error || 'Failed to fetch pending attendance');
        }),
        catchError(err => {
          console.error('Error fetching pending attendance', err);
          return of([] as any[]);
        })
      );
  }

  approveAttendance(attendanceId: string): Observable<void> {
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/attendance/${attendanceId}/approve`, {})
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.error || 'Failed to approve attendance');
          }
        }),
        catchError(err => {
          console.error('Error approving attendance', err);
          throw err;
        })
      );
  }

  rejectAttendance(attendanceId: string, reason: string): Observable<void> {
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/attendance/${attendanceId}/reject`, {
      rejectionReason: reason
    })
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.error || 'Failed to reject attendance');
          }
        }),
        catchError(err => {
          console.error('Error rejecting attendance', err);
          throw err;
        })
      );
  }

  getPendingLeaveRequests(): Observable<any[]> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/leave/pending`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.error || 'Failed to fetch pending leave requests');
        }),
        catchError(err => {
          console.error('Error fetching pending leave requests', err);
          return of([] as any[]);
        })
      );
  }

  approveOrRejectLeave(leaveRequestId: string, approved: boolean, rejectionReason?: string): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/leave/approve`, {
      leaveRequestId,
      approved,
      rejectionReason
    })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.error || 'Failed to process leave request');
        }),
        catchError(err => {
          console.error('Error processing leave request', err);
          throw err;
        })
      );
  }
}
