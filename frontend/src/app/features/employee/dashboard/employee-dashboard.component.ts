import { Component, OnInit, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AttendanceService } from '../../../core/services/attendance.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LeaveService } from '../../../core/services/leave.service';
import { AuthService } from '../../../core/auth/auth.service';
import { CommonService, PublicHoliday } from '../../../core/services/common.service';

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './employee-dashboard.component.html'
})
export class EmployeeDashboardComponent implements OnInit, OnDestroy {
  private attendanceService = inject(AttendanceService);
  private leaveService = inject(LeaveService);
  private authService = inject(AuthService);
  private commonService = inject(CommonService);
  private fb = inject(FormBuilder);

  currentUser = this.authService.currentUser;
  todayAttendance = signal<any>(null);
  leaveBalance = signal<any>(null);
  attendanceHistory = signal<any[]>([]);
  myLeaveRequests = signal<any[]>([]);
  publicHolidays = signal<PublicHoliday[]>([]);
  loading = signal(false);
  attendanceMessage = signal('');
  attendanceError = signal(false);
  leaveMessage = signal('');
  leaveError = signal(false);
  leaveForm: FormGroup;
  
  // Expand/collapse state
  leaveRequestExpanded = signal(true);
  attendanceHistoryExpanded = signal(true);
  myLeaveRequestsExpanded = signal(true);
  publicHolidaysExpanded = signal(true);

  constructor() {
    this.leaveForm = this.fb.group({
      leaveType: ['', Validators.required],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      reason: ['', Validators.required]
    });
  }

  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.loadTodayAttendance();
    this.loadLeaveBalance();
    this.loadAttendanceHistory();
    this.loadMyLeaveRequests();
    this.loadPublicHolidays();
  }

  loadTodayAttendance() {
    this.attendanceService.getTodayAttendance().pipe(takeUntil(this.destroy$)).subscribe({
      next: (attendance) => this.todayAttendance.set(attendance),
      error: (err) => console.error(err)
    });
  }

  clockIn() {
    this.loading.set(true);
    this.attendanceService.login().pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        this.todayAttendance.set(response);
        this.attendanceMessage.set('Clocked in successfully!');
        this.attendanceError.set(false);
        this.loading.set(false);
      },
      error: (err) => {
        this.attendanceMessage.set(err.message || 'Failed to clock in');
        this.attendanceError.set(true);
        this.loading.set(false);
      }
    });
  }

  clockOut() {
    this.loading.set(true);
    this.attendanceService.logout().pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        this.todayAttendance.set(response);
        this.attendanceMessage.set('Clocked out successfully!');
        this.attendanceError.set(false);
        this.loading.set(false);
        this.loadLeaveBalance();
      },
      error: (err) => {
        this.attendanceMessage.set(err.message || 'Failed to clock out');
        this.attendanceError.set(true);
        this.loading.set(false);
      }
    });
  }

  loadLeaveBalance() {
    this.leaveService.getLeaveBalance().pipe(takeUntil(this.destroy$)).subscribe({
      next: (balance) => this.leaveBalance.set(balance),
      error: (err) => console.error(err)
    });
  }

  loadAttendanceHistory() {
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
    this.attendanceService.getAttendanceHistory(start, end).pipe(takeUntil(this.destroy$)).subscribe({
      next: (history) => this.attendanceHistory.set(history),
      error: (err) => console.error(err)
    });
  }

  loadMyLeaveRequests() {
    this.leaveService.getMyLeaveRequests().pipe(takeUntil(this.destroy$)).subscribe({
      next: (requests) => this.myLeaveRequests.set(requests),
      error: (err) => console.error(err)
    });
  }

  submitLeaveRequest() {
    if (this.leaveForm.invalid) return;
    this.loading.set(true);
    const v = this.leaveForm.value;
    this.leaveService.createLeaveRequest({
      leaveType: parseInt(v.leaveType),
      startDate: v.startDate,
      endDate: v.endDate,
      reason: v.reason
    } as any).subscribe({
      next: () => {
        this.leaveMessage.set('Leave submitted!');
        this.leaveError.set(false);
        this.leaveForm.reset();
        this.loadMyLeaveRequests();
        this.loading.set(false);
      },
      error: (err) => {
        this.leaveMessage.set(err.message || 'Failed to submit leave request');
        this.leaveError.set(true);
        this.loading.set(false);
      }
    });
  }

  getLeaveTypeName(type: any): string {
    // Handle both string and number formats
    if (typeof type === 'string') {
      const typeMap: { [key: string]: string } = {
        'CasualLeave': 'Casual Leave',
        'EarnedLeave': 'Earned Leave',
        'CompensatoryOff': 'Compensatory Off'
      };
      return typeMap[type] || type;
    }
    // Fallback for number format
    return ['','Casual Leave','Earned Leave','Compensatory Off'][type] || 'Unknown';
  }

  cancelLeaveRequest(leaveRequestId: string) {
    if (!confirm('Are you sure you want to cancel this leave request?')) {
      return;
    }

    this.loading.set(true);
    this.leaveService.cancelLeaveRequest(leaveRequestId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.leaveMessage.set('Leave request cancelled successfully!');
        this.leaveError.set(false);
        this.loadMyLeaveRequests();
        this.loading.set(false);
      },
      error: (err) => {
        this.leaveMessage.set(err.message || 'Failed to cancel leave request');
        this.leaveError.set(true);
        this.loading.set(false);
      }
    });
  }

  canCancelLeaveRequest(status: string): boolean {
    return status === 'Pending';
  }

  toggleLeaveRequest() {
    this.leaveRequestExpanded.set(!this.leaveRequestExpanded());
  }

  toggleAttendanceHistory() {
    this.attendanceHistoryExpanded.set(!this.attendanceHistoryExpanded());
  }

  toggleMyLeaveRequests() {
    this.myLeaveRequestsExpanded.set(!this.myLeaveRequestsExpanded());
  }

  togglePublicHolidays() {
    this.publicHolidaysExpanded.set(!this.publicHolidaysExpanded());
  }

  loadPublicHolidays() {
    this.commonService.getPublicHolidays(new Date().getFullYear()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (holidays) => {
        this.publicHolidays.set(holidays);
      },
      error: (err) => {
        console.error('Failed to load public holidays:', err);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
