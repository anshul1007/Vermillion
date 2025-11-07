import { Component, OnInit, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService, PublicHoliday, Department, TeamMember } from '../../../core/services/admin.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../core/auth/auth.service';
import { User } from '../../../shared/models/admin.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-dashboard.component.html'
})
export class AdminDashboardComponent implements OnInit {
  private destroy$ = new Subject<void>();
  private adminService = inject(AdminService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  currentUser = this.authService.currentUser;
  activeTab = signal<'users' | 'departments' | 'leaves' | 'holidays'>('users');
  users = signal<User[]>([]);
  departments = signal<Department[]>([]);
  holidays = signal<PublicHoliday[]>([]);
  loading = signal(false);
  message = signal('');
  error = signal(false);
  editingUserId = signal<string | null>(null);
  
  showUserForm = signal(false);
  showDepartmentForm = signal(false);
  showLeaveForm = signal(false);
  showHolidayForm = signal(false);
  
  userForm: FormGroup;
  departmentForm: FormGroup;
  leaveForm: FormGroup;
  holidayForm: FormGroup;

  constructor() {
    this.userForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      employeeId: ['', Validators.required],
      role: ['0', Validators.required],
      managerId: [''],
      departmentId: [''],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    this.departmentForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      weeklyOffDays: ['Saturday,Sunday', Validators.required]
    });

    this.leaveForm = this.fb.group({
      userId: ['', Validators.required],
      year: [new Date().getFullYear(), Validators.required],
      casualLeaveBalance: [12, [Validators.required, Validators.min(0)]],
      earnedLeaveBalance: [15, [Validators.required, Validators.min(0)]],
      compensatoryOffBalance: [0, [Validators.required, Validators.min(0)]]
    });

    this.holidayForm = this.fb.group({
      name: ['', Validators.required],
      date: ['', Validators.required],
      description: ['']
    });
  }

  ngOnInit() {
    this.loadUsers();
    this.loadDepartments();
    this.loadHolidays();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setActiveTab(tab: 'users' | 'departments' | 'leaves' | 'holidays') {
    this.activeTab.set(tab);
  }

  loadUsers() {
    this.loading.set(true);
  this.adminService.getAllUsers().pipe(takeUntil(this.destroy$)).subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading users:', err);
        this.loading.set(false);
      }
    });
  }

  loadDepartments() {
  this.adminService.getAllDepartments().pipe(takeUntil(this.destroy$)).subscribe({
      next: (departments) => {
        this.departments.set(departments);
      },
      error: (err) => {
        console.error('Error loading departments:', err);
      }
    });
  }

  loadHolidays() {
  this.adminService.getPublicHolidays(new Date().getFullYear()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (holidays) => {
        this.holidays.set(holidays);
      },
      error: (err) => {
        console.error('Error loading holidays:', err);
      }
    });
  }

  toggleUserForm() {
    this.showUserForm.set(!this.showUserForm());
    if (!this.showUserForm()) {
      this.cancelUserEdit();
    }
  }

  submitUserForm() {
    if (this.userForm.invalid) return;

    const editingId = this.editingUserId();
    if (editingId) {
      this.updateUser();
      return;
    }

    this.loading.set(true);
    const formValue = this.userForm.value;
    
    const request = {
      ...formValue,
      role: parseInt(formValue.role),
      managerId: formValue.managerId || undefined,
      departmentId: formValue.departmentId || undefined
    };

  this.adminService.createUser(request).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.message.set('User created successfully!');
        this.error.set(false);
  // reset to Employee by default for new users
  this.userForm.reset({ role: '0' });
        this.showUserForm.set(false);
        this.loadUsers();
        this.loading.set(false);
      },
      error: (err) => {
        this.message.set(err.message || 'Failed to create user');
        this.error.set(true);
        this.loading.set(false);
      }
    });
  }

  toggleLeaveForm() {
    this.showLeaveForm.set(!this.showLeaveForm());
    if (!this.showLeaveForm()) {
      this.leaveForm.reset({
        year: new Date().getFullYear(),
        casualLeaveBalance: 12,
        earnedLeaveBalance: 15,
        compensatoryOffBalance: 0
      });
    }
  }

  submitLeaveForm() {
    if (this.leaveForm.invalid) return;

    this.loading.set(true);
  this.adminService.allocateLeaveEntitlement(this.leaveForm.value).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.message.set('Leave entitlement allocated successfully!');
        this.error.set(false);
        this.leaveForm.reset({
          year: new Date().getFullYear(),
          casualLeaveBalance: 12,
          earnedLeaveBalance: 15,
          compensatoryOffBalance: 0
        });
        this.showLeaveForm.set(false);
        this.loading.set(false);
      },
      error: (err) => {
        this.message.set(err.message || 'Failed to allocate leave entitlement');
        this.error.set(true);
        this.loading.set(false);
      }
    });
  }

  toggleHolidayForm() {
    this.showHolidayForm.set(!this.showHolidayForm());
    if (!this.showHolidayForm()) {
      this.holidayForm.reset();
    }
  }

  submitHolidayForm() {
    if (this.holidayForm.invalid) return;

    this.loading.set(true);
  this.adminService.createPublicHoliday(this.holidayForm.value).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.message.set('Holiday created successfully!');
        this.error.set(false);
        this.holidayForm.reset();
        this.showHolidayForm.set(false);
        this.loadHolidays();
        this.loading.set(false);
      },
      error: (err) => {
        this.message.set(err.message || 'Failed to create holiday');
        this.error.set(true);
        this.loading.set(false);
      }
    });
  }

  deleteHoliday(holidayId: string) {
    if (!confirm('Are you sure you want to delete this holiday?')) return;

  this.adminService.deletePublicHoliday(holidayId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.message.set('Holiday deleted successfully');
        this.error.set(false);
        this.loadHolidays();
      },
      error: (err) => {
        this.message.set(err.message || 'Failed to delete holiday');
        this.error.set(true);
      }
    });
  }

  getRoleBadgeClass(role: string): string {
    switch(role) {
      case 'SystemAdmin': return 'badge-danger';
      case 'Admin': return 'badge-danger';
      case 'Manager': return 'badge-warning';
      case 'Employee': return 'badge-secondary';
      case 'Guard': return 'badge-info';
      default: return 'badge-secondary';
    }
  }

  getManagers(): User[] {
    // Only show Admin and Manager roles for attendance tenant users
    // (AttendanceAPI users are already scoped to attendance tenant)
    return this.users().filter(u => u.role === 'Manager' || u.role === 'Admin');
  }

  // Helper method to convert weeklyOffDays from numbers to day names
  formatWeeklyOffDays(weeklyOffDays: string | string[] | null | undefined): string {
    if (!weeklyOffDays) return '-';
    
    const dayMap: { [key: string]: string } = {
      '0': 'Sunday',
      '1': 'Monday',
      '2': 'Tuesday',
      '3': 'Wednesday',
      '4': 'Thursday',
      '5': 'Friday',
      '6': 'Saturday'
    };

    // Handle array type
    if (Array.isArray(weeklyOffDays)) {
      return weeklyOffDays
        .map(day => dayMap[day.toString().trim()] || day.toString().trim())
        .join(', ');
    }

    // Handle string type
    const daysString = weeklyOffDays.toString();
    return daysString.split(',')
      .map(day => dayMap[day.trim()] || day.trim())
      .join(', ');
  }

  // Department methods
  toggleDepartmentForm() {
    this.showDepartmentForm.set(!this.showDepartmentForm());
    if (!this.showDepartmentForm()) {
      this.departmentForm.reset({ weeklyOffDays: 'Saturday,Sunday' });
    }
  }

  submitDepartmentForm() {
    if (this.departmentForm.invalid) return;

    this.loading.set(true);
    const request = this.departmentForm.value;

  this.adminService.createDepartment(request).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.message.set('Department created successfully!');
        this.error.set(false);
        this.departmentForm.reset({ weeklyOffDays: 'Saturday,Sunday' });
        this.showDepartmentForm.set(false);
        this.loadDepartments();
        this.loading.set(false);
      },
      error: (err) => {
        this.message.set(err.message || 'Failed to create department');
        this.error.set(true);
        this.loading.set(false);
      }
    });
  }

  deleteDepartment(departmentId: string) {
    if (!confirm('Are you sure? This will unassign employees from this department.')) return;

  this.adminService.deleteDepartment(departmentId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.message.set('Department deleted successfully');
        this.error.set(false);
        this.loadDepartments();
      },
      error: (err) => {
        this.message.set(err.message || 'Failed to delete department');
        this.error.set(true);
      }
    });
  }

  // User edit methods
  editUser(user: User) {
    this.editingUserId.set(user.id);
    this.userForm.patchValue({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      employeeId: user.employeeId,
      // map role name to numeric value matching backend enum
      role: user.role === 'Employee' ? '0'
            : user.role === 'Manager' ? '1'
            : user.role === 'Admin' ? '2'
            : user.role === 'SystemAdmin' ? '3'
            : user.role === 'Guard' ? '4'
            : '0',
      managerId: user.managerId || '',
      departmentId: user.departmentId || ''
    });
    this.userForm.get('password')?.clearValidators();
    this.userForm.get('password')?.updateValueAndValidity();
    this.showUserForm.set(true);
  }

  cancelUserEdit() {
    this.editingUserId.set(null);
  this.userForm.reset({ role: '0' });
    this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    this.userForm.get('password')?.updateValueAndValidity();
    this.showUserForm.set(false);
  }

  updateUser() {
    if (this.userForm.invalid) return;

    const userId = this.editingUserId();
    if (!userId) return;

    this.loading.set(true);
    const formValue = this.userForm.value;
    const updateRequest: any = {
      email: formValue.email,
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      role: parseInt(formValue.role),
      managerId: formValue.managerId || null,
      departmentId: formValue.departmentId || null,
      isActive: true
    };

  this.adminService.updateUser(userId, updateRequest).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.message.set('User updated successfully!');
        this.error.set(false);
        this.cancelUserEdit();
        this.loadUsers();
        this.loading.set(false);
      },
      error: (err) => {
        this.message.set(err.message || 'Failed to update user');
        this.error.set(true);
        this.loading.set(false);
      }
    });
  }
}
