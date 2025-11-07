import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SystemAdminService, Role, Permission, CreateRoleRequest, UpdateRoleRequest } from '../../../core/services/system-admin.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-roles-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="roles-container">
      <div class="header">
        <h1>Roles Management</h1>
        <button class="btn-primary" (click)="showCreateModal()">
          <span>+ Create Role</span>
        </button>
      </div>

      @if (loading()) {
        <div class="loading">Loading roles...</div>
      } @else if (error()) {
        <div class="error">{{ error() }}</div>
      } @else {
        <div class="roles-grid">
          @for (role of roles(); track role.id) {
            <div class="role-card" [class.inactive]="!role.isActive">
              <div class="role-header">
                <h3>{{ role.name }}</h3>
                <span class="status-badge" [class.active]="role.isActive">
                  {{ role.isActive ? 'Active' : 'Inactive' }}
                </span>
              </div>
              <p class="role-description">{{ role.description || 'No description' }}</p>
              <div class="role-stats">
                <span class="stat">
                  <strong>{{ role.permissionCount || 0 }}</strong> Permissions
                </span>
              </div>
              <div class="role-actions">
                <button class="btn-sm btn-info" (click)="viewPermissions(role)">
                  View Permissions
                </button>
                <button class="btn-sm btn-warning" (click)="editRole(role)">
                  Edit
                </button>
                @if (role.isActive) {
                  <button class="btn-sm btn-secondary" (click)="toggleStatus(role)">
                    Deactivate
                  </button>
                } @else {
                  <button class="btn-sm btn-success" (click)="toggleStatus(role)">
                    Activate
                  </button>
                }
                <button class="btn-sm btn-danger" (click)="deleteRole(role)">
                  Delete
                </button>
              </div>
            </div>
          }
        </div>
      }

      <!-- Create/Edit Role Modal -->
      @if (showRoleModal()) {
        <div class="modal-overlay" (click)="closeModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2>{{ editingRole() ? 'Edit Role' : 'Create Role' }}</h2>
              <button class="close-btn" (click)="closeModal()">×</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>Role Name *</label>
                <input type="text" [(ngModel)]="roleForm.name" placeholder="Enter role name" />
              </div>
              <div class="form-group">
                <label>Description</label>
                <textarea [(ngModel)]="roleForm.description" placeholder="Enter role description" rows="3"></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" (click)="closeModal()">Cancel</button>
              <button class="btn-primary" (click)="saveRole()">
                {{ editingRole() ? 'Update' : 'Create' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Permissions Modal -->
      @if (showPermissionsModal()) {
        <div class="modal-overlay" (click)="closePermissionsModal()">
          <div class="modal modal-lg" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2>Permissions - {{ selectedRole()?.name }}</h2>
              <button class="close-btn" (click)="closePermissionsModal()">×</button>
            </div>
            <div class="modal-body">
              <h3>Assigned Permissions</h3>
              <div class="permissions-grid">
                @for (perm of selectedRole()?.permissions; track perm.id) {
                  <div class="permission-item">
                    <div class="permission-info">
                      <strong>{{ perm.name }}</strong>
                      <span class="resource-tag">{{ perm.resource }}.{{ perm.action }}</span>
                      <p>{{ perm.description }}</p>
                    </div>
                    <button class="btn-sm btn-danger" (click)="removePermission(perm.id)">
                      Remove
                    </button>
                  </div>
                }
              </div>

              <h3>Add Permission</h3>
              <div class="add-permission-form">
                <select [(ngModel)]="newPermissionId" class="form-control">
                  <option [value]="0">Select Permission</option>
                  @for (perm of availablePermissions(); track perm.id) {
                    <option [value]="perm.id">{{ perm.name }} ({{ perm.resource }}.{{ perm.action }})</option>
                  }
                </select>
                <button class="btn-primary" (click)="addPermission()">Add</button>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" (click)="closePermissionsModal()">Close</button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})

export class RolesManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  roles = signal<Role[]>([]);
  allPermissions = signal<Permission[]>([]);
  loading = signal(false);
  error = signal('');
  
  showRoleModal = signal(false);
  showPermissionsModal = signal(false);
  editingRole = signal<Role | null>(null);
  selectedRole = signal<Role | null>(null);
  newPermissionId = 0;

  roleForm: any = {
    name: '',
    description: ''
  };

  constructor(private systemAdminService: SystemAdminService) {}

  ngOnInit(): void {
    this.loadRoles();
    this.loadPermissions();
  }

  loadRoles(): void {
    this.loading.set(true);
  this.systemAdminService.getAllRoles().pipe(takeUntil(this.destroy$)).subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load roles');
        this.loading.set(false);
        console.error(err);
      }
    });
  }

  loadPermissions(): void {
  this.systemAdminService.getAllPermissions().pipe(takeUntil(this.destroy$)).subscribe({
      next: (permissions) => this.allPermissions.set(permissions),
      error: (err) => console.error('Failed to load permissions', err)
    });
  }

  availablePermissions(): Permission[] {
    const role = this.selectedRole();
    if (!role) return this.allPermissions();
    
    const assignedIds = new Set(role.permissions?.map(p => p.id) || []);
    return this.allPermissions().filter(p => !assignedIds.has(p.id));
  }

  showCreateModal(): void {
    this.editingRole.set(null);
    this.roleForm = { name: '', description: '' };
    this.showRoleModal.set(true);
  }

  editRole(role: Role): void {
    this.editingRole.set(role);
    this.roleForm = {
      name: role.name,
      description: role.description || ''
    };
    this.showRoleModal.set(true);
  }

  saveRole(): void {
    const role = this.editingRole();
    if (role) {
      const request: UpdateRoleRequest = {
        name: this.roleForm.name !== role.name ? this.roleForm.name : undefined,
        description: this.roleForm.description !== role.description ? this.roleForm.description : undefined
      };

      this.systemAdminService.updateRole(role.id, request).pipe(take(1)).subscribe({
        next: () => {
          this.closeModal();
          this.loadRoles();
        },
        error: (err) => {
          alert('Failed to update role: ' + (err.error?.message || err.message));
          console.error(err);
        }
      });
    } else {
      const request: CreateRoleRequest = {
        name: this.roleForm.name,
        description: this.roleForm.description || undefined
      };

      this.systemAdminService.createRole(request).pipe(take(1)).subscribe({
        next: () => {
          this.closeModal();
          this.loadRoles();
        },
        error: (err) => {
          alert('Failed to create role: ' + (err.error?.message || err.message));
          console.error(err);
        }
      });
    }
  }

  deleteRole(role: Role): void {
    if (!confirm(`Are you sure you want to delete role "${role.name}"?`)) {
      return;
    }

    this.systemAdminService.deleteRole(role.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.loadRoles();
      },
      error: (err) => {
        alert('Failed to delete role: ' + (err.error?.message || err.message));
        console.error(err);
      }
    });
  }

  toggleStatus(role: Role): void {
    const action = role.isActive ? this.systemAdminService.deactivateRole(role.id) : this.systemAdminService.activateRole(role.id);
    
    action.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.loadRoles();
      },
      error: (err) => {
        alert('Failed to change role status: ' + (err.error?.message || err.message));
        console.error(err);
      }
    });
  }

  viewPermissions(role: Role): void {
    // Load full role details with permissions
    this.systemAdminService.getRoleById(role.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (fullRole) => {
        this.selectedRole.set(fullRole);
        this.newPermissionId = 0;
        this.showPermissionsModal.set(true);
      },
      error: (err) => {
        alert('Failed to load role details: ' + (err.error?.message || err.message));
        console.error(err);
      }
    });
  }

  addPermission(): void {
    const role = this.selectedRole();
    if (!role || !this.newPermissionId) {
      alert('Please select a permission');
      return;
    }

    this.systemAdminService.assignPermissionToRole(role.id, this.newPermissionId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.newPermissionId = 0;
        this.viewPermissions(role); // Reload permissions
        this.loadRoles(); // Update permission count
      },
      error: (err) => {
        alert('Failed to add permission: ' + (err.error?.message || err.message));
        console.error(err);
      }
    });
  }

  removePermission(permissionId: number): void {
    const role = this.selectedRole();
    if (!role) return;

    if (!confirm('Are you sure you want to remove this permission?')) {
      return;
    }

    this.systemAdminService.removePermissionFromRole(role.id, permissionId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.viewPermissions(role); // Reload permissions
        this.loadRoles(); // Update permission count
      },
      error: (err) => {
        alert('Failed to remove permission: ' + (err.error?.message || err.message));
        console.error(err);
      }
    });
  }

  closeModal(): void {
    this.showRoleModal.set(false);
    this.editingRole.set(null);
  }

  closePermissionsModal(): void {
    this.showPermissionsModal.set(false);
    this.selectedRole.set(null);
  }
}

