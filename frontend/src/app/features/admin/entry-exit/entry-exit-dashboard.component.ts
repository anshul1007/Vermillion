import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EntryExitService, Project, Contractor, Guard, CreateProjectDto, CreateContractorDto, AssignGuardToProjectDto } from '../../../shared/services/entry-exit.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AdminService, Department } from '../../../core/services/admin.service';
import { User } from '../../../shared/models/admin.model';

interface GuardWithAssignments extends Guard {
  assignedProjectNames?: string[];
}

@Component({
  selector: 'app-entry-exit-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './entry-exit-dashboard.component.html'
})
export class EntryExitDashboardComponent implements OnInit, OnDestroy {
  // destroy$ used to unsubscribe from observables on component destroy
  private destroy$ = new Subject<void>();
  private entryExitService = inject(EntryExitService);
  private adminService = inject(AdminService);
  private fb = inject(FormBuilder);

  activeTab = signal<'projects' | 'contractors' | 'guards'>('projects');
  
  projects = signal<Project[]>([]);
  contractors = signal<Contractor[]>([]);
  guards = signal<GuardWithAssignments[]>([]);
  departments = signal<Department[]>([]);
  
  loading = signal(false);
  message = signal('');
  error = signal(false);
  
  showProjectForm = signal(false);
  showContractorForm = signal(false);
  showGuardForm = signal(false);
  showGuardCreateForm = signal(false);
  editingGuardAuthUserId = signal<number | null>(null);
  showAssignForm = signal(false);
  
  projectForm: FormGroup;
  contractorForm: FormGroup;
  guardForm: FormGroup;
  guardCreateForm: FormGroup;
  assignForm: FormGroup;
  
  editingProjectId = signal<number | null>(null);
  editingContractorId = signal<number | null>(null);
  editingGuardId = signal<number | null>(null);

  constructor() {
    this.projectForm = this.fb.group({
      name: ['', Validators.required],
      description: ['']
    });

    this.contractorForm = this.fb.group({
      name: ['', Validators.required],
      contactPerson: ['', Validators.required],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      projectId: [0, [Validators.required, Validators.min(1)]]
    });

    this.guardForm = this.fb.group({
      authUserId: [0, [Validators.required, Validators.min(1)]],
      projectId: [0, [Validators.required, Validators.min(1)]]
    });

    // Form for creating new guards (only Guard role allowed)
    this.guardCreateForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.minLength(6)]],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      employeeId: ['', Validators.required],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^[+]?[\d\s-()]+$/)]],
    });

    // Ensure password validators are correct for create vs edit flow
    this.setPasswordValidators(true);

    // Form for assigning guards to projects
    this.assignForm = this.fb.group({
      authUserId: [0, [Validators.required, Validators.min(1)]],
      projectId: [0, [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit(): void {
    this.loadProjects();
    this.loadContractors();
    this.loadGuards();
    this.loadDepartments();
  }

  loadDepartments(): void {
    this.adminService.getAllDepartments().pipe(takeUntil(this.destroy$)).subscribe({
      next: (departments: Department[]) => {
        this.departments.set(departments);
      },
      error: () => {
        console.error('Failed to load departments');
      }
    });
  }

  setActiveTab(tab: 'projects' | 'contractors' | 'guards'): void {
    this.activeTab.set(tab);
    this.message.set('');
  }

  // Projects
  loadProjects(): void {
    this.loading.set(true);
    this.entryExitService.getProjects().pipe(takeUntil(this.destroy$)).subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.loading.set(false);
      },
      error: (err) => {
        this.showError('Failed to load projects');
        this.loading.set(false);
      }
    });
  }

  toggleProjectForm(): void {
    this.showProjectForm.set(!this.showProjectForm());
    if (!this.showProjectForm()) {
      this.cancelProjectEdit();
    }
  }

  editProject(project: Project): void {
    this.editingProjectId.set(project.id);
    this.projectForm.patchValue({
      name: project.name,
      description: project.description
    });
    this.showProjectForm.set(true);
  }

  cancelProjectEdit(): void {
    this.editingProjectId.set(null);
    this.projectForm.reset();
  }

  submitProjectForm(): void {
    if (this.projectForm.invalid) return;

    this.loading.set(true);
    const dto: CreateProjectDto = this.projectForm.value;

    const operation = this.editingProjectId()
      ? this.entryExitService.updateProject(this.editingProjectId()!, dto)
      : this.entryExitService.createProject(dto);

    operation.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.showSuccess(this.editingProjectId() ? 'Project updated!' : 'Project created!');
        this.projectForm.reset();
        this.showProjectForm.set(false);
        this.editingProjectId.set(null);
        this.loadProjects();
        this.loading.set(false);
      },
      error: () => {
        this.showError('Failed to save project');
        this.loading.set(false);
      }
    });
  }

  deleteProject(id: number): void {
    if (!confirm('Delete this project? This action cannot be undone.')) return;

    this.loading.set(true);
    this.entryExitService.deleteProject(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.showSuccess('Project deleted');
        this.loadProjects();
        this.loading.set(false);
      },
      error: () => {
        this.showError('Failed to delete project');
        this.loading.set(false);
      }
    });
  }

  // Contractors
  loadContractors(): void {
    this.loading.set(true);
    this.entryExitService.getContractors().pipe(takeUntil(this.destroy$)).subscribe({
      next: (contractors) => {
        this.contractors.set(contractors);
        this.loading.set(false);
      },
      error: () => {
        this.showError('Failed to load contractors');
        this.loading.set(false);
      }
    });
  }

  toggleContractorForm(): void {
    this.showContractorForm.set(!this.showContractorForm());
    if (!this.showContractorForm()) {
      this.cancelContractorEdit();
    }
  }

  editContractor(contractor: Contractor): void {
    this.editingContractorId.set(contractor.id);
    this.contractorForm.patchValue({
      name: contractor.name,
      contactPerson: contractor.contactPerson,
      phoneNumber: contractor.phoneNumber,
      projectId: contractor.projectId
    });
    this.showContractorForm.set(true);
  }

  cancelContractorEdit(): void {
    this.editingContractorId.set(null);
    this.contractorForm.reset({ projectId: 0 });
  }

  submitContractorForm(): void {
    if (this.contractorForm.invalid) return;

    this.loading.set(true);
    const dto: CreateContractorDto = this.contractorForm.value;

    const operation = this.editingContractorId()
      ? this.entryExitService.updateContractor(this.editingContractorId()!, dto)
      : this.entryExitService.createContractor(dto);

    operation.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.showSuccess(this.editingContractorId() ? 'Contractor updated!' : 'Contractor created!');
        this.contractorForm.reset({ projectId: 0 });
        this.showContractorForm.set(false);
        this.editingContractorId.set(null);
        this.loadContractors();
        this.loading.set(false);
      },
      error: () => {
        this.showError('Failed to save contractor');
        this.loading.set(false);
      }
    });
  }

  deleteContractor(id: number): void {
    if (!confirm('Delete this contractor? This action cannot be undone.')) return;

    this.loading.set(true);
    this.entryExitService.deleteContractor(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.showSuccess('Contractor deleted');
        this.loadContractors();
        this.loading.set(false);
      },
      error: () => {
        this.showError('Failed to delete contractor');
        this.loading.set(false);
      }
    });
  }

  // Guards
  loadGuards(): void {
    this.loading.set(true);
    // Load all users with Guard role from EntryExitService (entryexit tenant)
    this.entryExitService.getUsers().pipe(takeUntil(this.destroy$)).subscribe({
      next: (users: User[]) => {
        // Filter only guards and map to GuardWithAssignments
        const guardUsers = users.filter((u: User) => u.role === 'Guard');
        const guardsWithAssignments: GuardWithAssignments[] = guardUsers.map((user: User) => ({
          authUserId: parseInt(user.id),
          employeeId: user.employeeId,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          email: user.email,
          isActive: user.isActive,
          assignedProjects: []
        }));

        // Load project assignments for each guard
        const assignmentPromises = guardsWithAssignments.map(guard =>
          this.entryExitService.getGuardAssignments(guard.authUserId).toPromise()
            .then(assignments => {
              if (assignments) {
                guard.assignedProjects = assignments;
                guard.assignedProjectNames = assignments.map(a => a.projectName);
              }
            })
            .catch(() => {
              guard.assignedProjectNames = [];
            })
        );

        Promise.all(assignmentPromises).then(() => {
          this.guards.set(guardsWithAssignments);
          this.loading.set(false);
        });
      },
      error: () => {
        this.showError('Failed to load guards');
        this.loading.set(false);
      }
    });
  }

  toggleGuardCreateForm(): void {
    this.showGuardCreateForm.set(!this.showGuardCreateForm());
    if (!this.showGuardCreateForm()) {
      this.guardCreateForm.reset();
      this.editingGuardAuthUserId.set(null);
    }
  }

  toggleAssignForm(): void {
    this.showAssignForm.set(!this.showAssignForm());
    if (!this.showAssignForm()) {
      this.assignForm.reset({ authUserId: 0, projectId: 0 });
    }
  }

  submitGuardCreateForm(): void {
    if (this.guardCreateForm.invalid) return;

    this.loading.set(true);
    const formValue = this.guardCreateForm.value;
    
    const request = {
      email: formValue.email,
      ...(formValue.password ? { password: formValue.password } : {}),
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      employeeId: formValue.employeeId,
      phoneNumber: formValue.phoneNumber
    };

    const editingId = this.editingGuardAuthUserId();
    if (editingId) {
  this.entryExitService.updateGuard(editingId, request).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.showSuccess('Security guard updated successfully!');
          this.guardCreateForm.reset();
          this.showGuardCreateForm.set(false);
          this.editingGuardAuthUserId.set(null);
          this.setPasswordValidators(true);
          this.loadGuards();
          this.loading.set(false);
        },
        error: (err) => {
          this.showError(err.error?.message || 'Failed to update guard');
          this.loading.set(false);
        }
      });
    } else {
  this.entryExitService.createGuard(request).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.showSuccess('Security guard created successfully!');
          this.guardCreateForm.reset();
          this.showGuardCreateForm.set(false);
          this.setPasswordValidators(true);
          this.loadGuards();
          this.loading.set(false);
        },
        error: (err) => {
          this.showError(err.error?.message || 'Failed to create guard');
          this.loading.set(false);
        }
      });
    }
  }

  editGuard(guard: GuardWithAssignments): void {
    // Prefill create form and switch to edit mode
    this.guardCreateForm.patchValue({
      email: guard.email || '',
      password: '', // leave empty; admin can set if needed
      firstName: guard.firstName,
      lastName: guard.lastName,
      employeeId: guard.employeeId,
      phoneNumber: guard.phoneNumber || ''
    });
    this.editingGuardAuthUserId.set(guard.authUserId);
    this.setPasswordValidators(false);
    this.showGuardCreateForm.set(true);
  }

  private setPasswordValidators(required: boolean) {
    const control = this.guardCreateForm.get('password');
    if (!control) return;

    if (required) {
      control.setValidators([Validators.required, Validators.minLength(6)]);
    } else {
      control.setValidators([]);
    }
    control.updateValueAndValidity();
  }

  submitAssignForm(): void {
    if (this.assignForm.invalid) return;

    this.loading.set(true);
    const dto: AssignGuardToProjectDto = this.assignForm.value;
    
  this.entryExitService.assignGuardToProject(dto).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.showSuccess('Guard assigned to project!');
        this.assignForm.reset({ authUserId: 0, projectId: 0 });
        this.showAssignForm.set(false);
        this.loadGuards();
        this.loading.set(false);
      },
      error: (err) => {
        this.showError(err.error?.message || 'Failed to assign guard to project');
        this.loading.set(false);
      }
    });
  }

  toggleGuardForm(): void {
    this.showGuardForm.set(!this.showGuardForm());
    if (!this.showGuardForm()) {
      this.cancelGuardEdit();
    }
  }

  submitGuardForm(): void {
    if (this.guardForm.invalid) return;

    this.loading.set(true);
    const dto: AssignGuardToProjectDto = this.guardForm.value;
    
  this.entryExitService.assignGuardToProject(dto).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.showSuccess('Security guard assigned to project!');
        this.guardForm.reset({ authUserId: 0, projectId: 0 });
        this.showGuardForm.set(false);
        this.editingGuardId.set(null);
        this.loadGuards();
        this.loading.set(false);
      },
      error: () => {
        this.showError('Failed to assign guard to project');
        this.loading.set(false);
      }
    });
  }

  

  cancelGuardEdit(): void {
    this.editingGuardId.set(null);
    this.guardForm.reset({ authUserId: 0, projectId: 0 });
  }

  deleteGuard(authUserId: number, projectId: number): void {
    if (!confirm('Unassign this guard from the project? This action cannot be undone.')) return;

    this.loading.set(true);
    this.entryExitService.unassignGuardFromProject({ authUserId, projectId }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.showSuccess('Security guard unassigned from project');
        this.loadGuards();
        this.loading.set(false);
      },
      error: () => {
        this.showError('Failed to unassign guard');
        this.loading.set(false);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Utility
  showSuccess(msg: string): void {
    this.message.set(msg);
    this.error.set(false);
    setTimeout(() => this.message.set(''), 3000);
  }

  showError(msg: string): void {
    this.message.set(msg);
    this.error.set(true);
    setTimeout(() => this.message.set(''), 3000);
  }

  getProjectName(projectId: number): string {
    return this.projects().find(p => p.id === projectId)?.name || 'Unknown';
  }
}
