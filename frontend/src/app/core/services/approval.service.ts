import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../shared/models/api-response.model';

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

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  employeeId: string;
  user?: {
    firstName: string;
    lastName: string;
    employeeId: string;
  };
  date: Date;
  loginTime: Date;
  logoutTime?: Date;
  isWeekend: boolean;
  isPublicHoliday: boolean;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApprovalService {
  private http = inject(HttpClient);
  // Approval endpoints are served by the AttendanceAPI service
  private readonly apiUrl = `${environment.apiUrl}/attendance/approval`;

  getPendingAttendance(date?: string): Observable<AttendanceRecord[]> {
    let params = new HttpParams();
    if (date) {
      params = params.set('date', date);
    }

    return this.http.get<ApiResponse<AttendanceRecord[]>>(`${this.apiUrl}/pending`, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.error || 'Failed to fetch pending attendance');
        })
      );
  }

  approveAttendance(attendanceId: string): Observable<void> {
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/${attendanceId}/approve`, {})
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.error || 'Failed to approve attendance');
          }
        })
      );
  }

  rejectAttendance(attendanceId: string, reason: string): Observable<void> {
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/${attendanceId}/reject`, {
      rejectionReason: reason
    })
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.error || 'Failed to reject attendance');
          }
        })
      );
  }

  getTeamAttendanceHistory(startDate: string, endDate: string): Observable<AttendanceRecord[]> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);

    return this.http.get<ApiResponse<AttendanceRecord[]>>(`${this.apiUrl}/history`, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.error || 'Failed to fetch team attendance history');
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
        })
      );
  }

  getTeamMembers(): Observable<TeamMember[]> {
    return this.http.get<ApiResponse<TeamMember[]>>(`${this.apiUrl}/team-members`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.error || 'Failed to fetch team members');
        })
      );
  }

  assignCompensatoryOff(employeeId: string, days: number, reason: string): Observable<void> {
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/assign-comp-off`, {
      employeeId,
      days,
      reason
    })
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message || response.error || 'Failed to assign compensatory off');
          }
        })
      );
  }

  logPastAttendance(employeeId: string, date: string, loginTime: string, logoutTime?: string): Observable<void> {
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/log-past-attendance`, {
      employeeId,
      date,
      loginTime,
      logoutTime
    })
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message || response.error || 'Failed to log past attendance');
          }
        })
      );
  }
}
