import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';
import { ApprovalService, TeamMember } from '../../../core/services/approval.service';
import { AdminService } from '../../../core/services/admin.service';
import { LeaveService } from '../../../core/services/leave.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './manager-dashboard.component.html'
})
export class ManagerDashboardComponent implements OnInit {
  private destroy$ = new Subject<void>();

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  private authService = inject(AuthService);
  private approvalService = inject(ApprovalService);
  private adminService = inject(AdminService);
  private leaveService = inject(LeaveService);

  currentUser = this.authService.currentUser;
  activeTab = signal<'attendance' | 'leaves' | 'reports' | 'management'>('attendance');
  teamAttendance = signal<any[]>([]);
  pendingLeaveRequests = signal<any[]>([]);
  teamAttendanceHistory = signal<any[]>([]);
  teamLeaveHistory = signal<any[]>([]);
  teamMembers = signal<TeamMember[]>([]);
  selectedDate = signal(new Date().toISOString().split('T')[0]);
  reportStartDate = signal(this.getFirstDayOfMonth());
  reportEndDate = signal(new Date().toISOString().split('T')[0]);
  loading = signal(false);
  message = signal('');
  error = signal(false);
  // Separate messages for each employee's forms
  compOffMessages = signal<Map<string, {text: string, isError: boolean}>>(new Map());
  attendanceMessages = signal<Map<string, {text: string, isError: boolean}>>(new Map());
  // Track expanded/collapsed state for each employee panel
  expandedPanels = signal<Set<string>>(new Set());

  ngOnInit() {
    this.loadTeamAttendance();
    this.loadPendingLeaveRequests();
    this.loadReports();
    this.loadTeamMembers();
  }

  getFirstDayOfMonth(): string {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
  }

  setActiveTab(tab: 'attendance' | 'leaves' | 'reports' | 'management') {
    this.activeTab.set(tab);
  }

  togglePanel(employeeId: string) {
    const expanded = new Set(this.expandedPanels());
    if (expanded.has(employeeId)) {
      expanded.delete(employeeId);
    } else {
      expanded.add(employeeId);
    }
    this.expandedPanels.set(expanded);
  }

  isPanelExpanded(employeeId: string): boolean {
    return this.expandedPanels().has(employeeId);
  }

  onDateChange(event: any) {
    this.selectedDate.set(event.target.value);
    this.loadTeamAttendance();
  }

  loadTeamAttendance() {
    this.loading.set(true);
    const user = this.currentUser;
    const isAdmin = user?.role === 'SystemAdmin' || user?.role === 'Admin';
    const service = isAdmin ? 
      this.adminService.getPendingAttendance(this.selectedDate()) : 
      this.approvalService.getPendingAttendance(this.selectedDate());
    
    service.pipe(takeUntil(this.destroy$)).subscribe({
      next: (records: any) => {
        this.teamAttendance.set(records);
        this.loading.set(false);
      },
      error: (err: any) => {
        console.error('Error loading team attendance:', err);
        this.message.set('Failed to load team attendance');
        this.error.set(true);
        this.loading.set(false);
      }
    });
  }

  loadPendingLeaveRequests() {
    const user = this.currentUser;
    const isAdmin = user?.role === 'SystemAdmin' || user?.role === 'Admin';
    const service = isAdmin ? 
      this.adminService.getPendingLeaveRequests() : 
      this.leaveService.getPendingLeaveRequestsForApproval();
    
    service.pipe(takeUntil(this.destroy$)).subscribe({
      next: (requests: any) => {
        this.pendingLeaveRequests.set(requests);
      },
      error: (err: any) => {
        console.error('Error loading pending leave requests:', err);
      }
    });
  }

  approveAttendance(attendanceId: string) {
    if (!confirm('Are you sure you want to approve this attendance?')) {
      return;
    }

    const user = this.currentUser;
    const isAdmin = user?.role === 'SystemAdmin' || user?.role === 'Admin';
    const service = isAdmin ? 
      this.adminService.approveAttendance(attendanceId) : 
      this.approvalService.approveAttendance(attendanceId);
    
    service.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.message.set('Attendance approved successfully');
        this.error.set(false);
        this.loadTeamAttendance();
        setTimeout(() => this.message.set(''), 3000);
      },
      error: (err: any) => {
        this.message.set(err.message || 'Failed to approve attendance');
        this.error.set(true);
        setTimeout(() => this.message.set(''), 3000);
      }
    });
  }

  rejectAttendance(attendanceId: string) {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) {
      return;
    }

    const user = this.currentUser;
    const isAdmin = user?.role === 'SystemAdmin' || user?.role === 'Admin';
    const service = isAdmin ? 
      this.adminService.rejectAttendance(attendanceId, reason) : 
      this.approvalService.rejectAttendance(attendanceId, reason);
    
    service.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.message.set('Attendance rejected');
        this.error.set(false);
        this.loadTeamAttendance();
        setTimeout(() => this.message.set(''), 3000);
      },
      error: (err: any) => {
        this.message.set(err.message || 'Failed to reject attendance');
        this.error.set(true);
        setTimeout(() => this.message.set(''), 3000);
      }
    });
  }

  approveLeave(leaveRequestId: string) {
    if (!confirm('Are you sure you want to approve this leave request?')) {
      return;
    }

    const user = this.currentUser;
    const isAdmin = user?.role === 'SystemAdmin' || user?.role === 'Admin';
    const service = isAdmin ? 
      this.adminService.approveOrRejectLeave(leaveRequestId, true) : 
      this.leaveService.approveLeave(leaveRequestId);
    
    service.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.message.set('Leave request approved successfully');
        this.error.set(false);
        this.loadPendingLeaveRequests();
        setTimeout(() => this.message.set(''), 3000);
      },
      error: (err: any) => {
        this.message.set(err.message || 'Failed to approve leave');
        this.error.set(true);
        setTimeout(() => this.message.set(''), 3000);
      }
    });
  }

  rejectLeave(leaveRequestId: string) {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) {
      return;
    }

    const user = this.currentUser;
    const isAdmin = user?.role === 'SystemAdmin' || user?.role === 'Admin';
    const service = isAdmin ? 
      this.adminService.approveOrRejectLeave(leaveRequestId, false, reason) : 
      this.leaveService.rejectLeave(leaveRequestId, reason);
    
    service.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.message.set('Leave request rejected');
        this.error.set(false);
        this.loadPendingLeaveRequests();
        setTimeout(() => this.message.set(''), 3000);
      },
      error: (err: any) => {
        this.message.set(err.message || 'Failed to reject leave');
        this.error.set(true);
        setTimeout(() => this.message.set(''), 3000);
      }
    });
  }

  loadReports() {
    this.loadTeamAttendanceHistory();
    this.loadTeamLeaveHistory();
  }

  onReportDateChange() {
    this.loadReports();
  }

  loadTeamAttendanceHistory() {
    const user = this.currentUser;
    const isAdmin = user?.role === 'SystemAdmin' || user?.role === 'Admin';
    const service = isAdmin ? 
      this.adminService.getTeamAttendanceHistory(this.reportStartDate(), this.reportEndDate()) : 
      this.approvalService.getTeamAttendanceHistory(this.reportStartDate(), this.reportEndDate());
    
    service.pipe(takeUntil(this.destroy$)).subscribe({
      next: (records: any) => {
        this.teamAttendanceHistory.set(records);
      },
      error: (err: any) => {
        console.error('Error loading team attendance history:', err);
      }
    });
  }

  loadTeamLeaveHistory() {
    const user = this.currentUser;
    const isAdmin = user?.role === 'SystemAdmin' || user?.role === 'Admin';
    const service = isAdmin ? 
      this.adminService.getTeamLeaveHistory(this.reportStartDate(), this.reportEndDate()) : 
      this.approvalService.getTeamLeaveHistory(this.reportStartDate(), this.reportEndDate());
    
    service.pipe(takeUntil(this.destroy$)).subscribe({
      next: (records: any) => {
        this.teamLeaveHistory.set(records);
      },
      error: (err: any) => {
        console.error('Error loading team leave history:', err);
      }
    });
  }

  getLeaveTypeName(type: any): string {
    if (typeof type === 'string') {
      const typeMap: { [key: string]: string } = {
        'CasualLeave': 'Casual Leave',
        'EarnedLeave': 'Earned Leave',
        'CompensatoryOff': 'Compensatory Off'
      };
      return typeMap[type] || type;
    }
    return ['','Casual Leave','Earned Leave','Compensatory Off'][type] || 'Unknown';
  }

  loadTeamMembers() {
    const user = this.currentUser;
    const isAdmin = user?.role === 'SystemAdmin' || user?.role === 'Admin';
    const service = isAdmin ? this.adminService.getAllTeamMembers() : this.approvalService.getTeamMembers();
    
    service.pipe(takeUntil(this.destroy$)).subscribe({
      next: (members: any) => {
        this.teamMembers.set(members);
      },
      error: (err: any) => {
        console.error('Error loading team members:', err);
      }
    });
  }

  assignCompOff(employeeId: string, daysValue: string, reason: string, daysInput: HTMLInputElement, reasonInput: HTMLInputElement) {
    const days = parseFloat(daysValue);
    
    if (!daysValue || isNaN(days) || days <= 0) {
      this.setCompOffMessage(employeeId, 'Please enter valid number of days', true);
      return;
    }

    if (!reason || reason.trim() === '') {
      this.setCompOffMessage(employeeId, 'Please provide a reason', true);
      return;
    }

    const user = this.currentUser;
    const isAdmin = user?.role === 'SystemAdmin' || user?.role === 'Admin';
    const service = isAdmin ? 
      this.adminService.assignCompensatoryOff({ employeeId, days, reason }) : 
      this.approvalService.assignCompensatoryOff(employeeId, days, reason);

    service.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.setCompOffMessage(employeeId, `Successfully assigned ${days} compensatory off day(s)`, false);
        // Clear form only on success
        daysInput.value = '';
        reasonInput.value = '';
        // Reload team members to update balances
        this.loadTeamMembers();
      },
      error: (err: any) => {
        this.setCompOffMessage(employeeId, err.message || 'Failed to assign compensatory off', true);
        // Don't clear form on error
      }
    });
  }

  logPastAttendance(employeeId: string, date: string, loginTime: string, logoutTime: string, dateInput: HTMLInputElement, loginInput: HTMLInputElement, logoutInput: HTMLInputElement) {
    console.log('logPastAttendance called', { employeeId, date, loginTime, logoutTime });
    
    if (!date || !loginTime) {
      this.setAttendanceMessage(employeeId, 'Please provide date and login time', true);
      return;
    }

    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate >= today) {
      this.setAttendanceMessage(employeeId, 'Cannot log attendance for today or future dates', true);
      return;
    }

    // Validate logout time is after login time (only if logoutTime is provided and not empty)
    if (logoutTime && logoutTime.trim() !== '') {
      const [loginHour, loginMin] = loginTime.split(':').map(Number);
      const [logoutHour, logoutMin] = logoutTime.split(':').map(Number);
      const loginMinutes = loginHour * 60 + loginMin;
      const logoutMinutes = logoutHour * 60 + logoutMin;

      if (logoutMinutes <= loginMinutes) {
        this.setAttendanceMessage(employeeId, 'Logout time must be after login time', true);
        return;
      }
    }

    // Pass undefined or empty string as null/undefined
    const logoutTimeValue = (logoutTime && logoutTime.trim() !== '') ? logoutTime : undefined;

    console.log('Calling service...', { employeeId, date, loginTime, logoutTimeValue });

    const user = this.currentUser;
    const isAdmin = user?.role === 'SystemAdmin' || user?.role === 'Admin';
    const service = isAdmin ? 
      this.adminService.logPastAttendance({ employeeId, date, loginTime, logoutTime: logoutTimeValue }) : 
      this.approvalService.logPastAttendance(employeeId, date, loginTime, logoutTimeValue);

    service.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        console.log('Success!');
        this.setAttendanceMessage(employeeId, 'Past attendance logged successfully', false);
        // Clear form only on success
        dateInput.value = '';
        loginInput.value = '';
        logoutInput.value = '';
      },
      error: (err: any) => {
        console.error('Error:', err);
        this.setAttendanceMessage(employeeId, err.message || 'Failed to log past attendance', true);
        // Don't clear form on error
      }
    });
  }

  private setCompOffMessage(employeeId: string, text: string, isError: boolean) {
    const messages = new Map(this.compOffMessages());
    messages.set(employeeId, { text, isError });
    this.compOffMessages.set(messages);
  }

  private setAttendanceMessage(employeeId: string, text: string, isError: boolean) {
    const messages = new Map(this.attendanceMessages());
    messages.set(employeeId, { text, isError });
    this.attendanceMessages.set(messages);
  }

  getCompOffMessage(employeeId: string) {
    return this.compOffMessages().get(employeeId);
  }

  getAttendanceMessage(employeeId: string) {
    return this.attendanceMessages().get(employeeId);
  }

  private scrollToMessage() {
    // Scroll to top of the management section to show the message
    setTimeout(() => {
      const managementSection = document.querySelector('.management-section');
      if (managementSection) {
        managementSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }
}

