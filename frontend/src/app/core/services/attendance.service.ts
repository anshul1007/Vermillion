import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { 
  Attendance, 
  AttendanceLoginRequest, 
  AttendanceLogoutRequest, 
  AttendanceResponse,
  TodayAttendanceStatus 
} from '../../shared/models/attendance.model';
import { ApiResponse, PaginatedResponse } from '../../shared/models/api-response.model';

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/attendance`;

  login(request: AttendanceLoginRequest = {}): Observable<AttendanceResponse> {
    return this.http.post<ApiResponse<AttendanceResponse>>(`${this.apiUrl}/login`, request)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.error || 'Attendance login failed');
        })
      );
  }

  logout(): Observable<AttendanceResponse> {
    return this.http.post<ApiResponse<AttendanceResponse>>(`${this.apiUrl}/logout`, {})
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.error || 'Attendance logout failed');
        })
      );
  }

  getTodayAttendance(): Observable<AttendanceResponse | null> {
    return this.http.get<ApiResponse<AttendanceResponse>>(`${this.apiUrl}/today`)
      .pipe(
        map(response => {
          if (response.success) {
            return response.data || null;
          }
          throw new Error(response.error || 'Failed to fetch today attendance');
        })
      );
  }

  getAttendanceHistory(startDate?: string, endDate?: string): Observable<Attendance[]> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);
    
    return this.http.get<ApiResponse<Attendance[]>>(`${this.apiUrl}/history`, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.error || 'Failed to fetch attendance history');
        })
      );
  }

  getTeamAttendance(date?: string): Observable<Attendance[]> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    
    return this.http.get<ApiResponse<Attendance[]>>(`${this.apiUrl}/team`, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.error || 'Failed to fetch team attendance');
        })
      );
  }

  approveAttendance(attendanceId: string): Observable<void> {
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/approve`, { attendanceId })
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.error || 'Failed to approve attendance');
          }
        })
      );
  }

  rejectAttendance(attendanceId: string, reason: string): Observable<void> {
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/reject`, { attendanceId, reason })
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.error || 'Failed to reject attendance');
          }
        })
      );
  }

  getMyAttendance(startDate?: Date, endDate?: Date, page: number = 1, pageSize: number = 10): Observable<PaginatedResponse<Attendance>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (startDate) {
      params = params.set('startDate', startDate.toISOString());
    }
    if (endDate) {
      params = params.set('endDate', endDate.toISOString());
    }

    return this.http.get<ApiResponse<PaginatedResponse<Attendance>>>(`${this.apiUrl}/my-attendance`, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.error || 'Failed to fetch attendance');
        })
      );
  }

  getAttendanceById(id: string): Observable<Attendance> {
    return this.http.get<ApiResponse<Attendance>>(`${this.apiUrl}/${id}`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.error || 'Failed to fetch attendance');
        })
      );
  }

  getTodayStatus(): Observable<TodayAttendanceStatus> {
    return this.http.get<ApiResponse<TodayAttendanceStatus>>(`${this.apiUrl}/today`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.error || 'Failed to fetch today\'s status');
        })
      );
  }
}
