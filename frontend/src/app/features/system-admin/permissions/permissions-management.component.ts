import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SystemAdminService, Permission, CreatePermissionRequest, UpdatePermissionRequest } from '../../../core/services/system-admin.service';
import { Subject } from 'rxjs';
import { takeUntil, take } from 'rxjs/operators';

@Component({
  selector: 'app-permissions-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="permissions-container">
      <div class="dashboard-header">
        <div>
          <h1>Permissions Management</h1>
          <p>Define granular permissions for resources</p>
        </div>
        <button class="btn btn-primary" (click)="showCreateModal()">
          + Create Permission
        </button>
      </div>

      @if (loading()) {
        <div class="alert alert-info">Loading permissions...</div>
      } @else if (error()) {
        <div class="alert alert-danger">{{ error() }}</div>
      } @else {
        <div class="card">
          <table class="table permissions-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Resource</th>
                <th>Action</th>
                <th>Description</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (permission of permissions(); track permission.id) {
                <tr>
                  <td>{{ permission.id }}</td>
                  <td><strong>{{ permission.name }}</strong></td>
                  <td><span class="resource-tag">{{ permission.resource }}</span></td>
                  <td><span class="badge badge-info action-tag">{{ permission.action }}</span></td>
                  <td>{{ permission.description || '-' }}</td>
                  <td>
                    <span class="badge" [class.badge-success]="permission.isActive" [class.badge-inactive]="!permission.isActive">
                      {{ permission.isActive ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td>
                    <div class="action-buttons">
                      <button class="btn btn-sm btn-warning" (click)="editPermission(permission)" title="Edit">✏️</button>
                      <button class="btn btn-sm btn-danger" (click)="deletePermission(permission)" title="Delete">🗑️</button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- Create/Edit Permission Modal -->
      @if (showPermissionModal()) {
        <div class="modal-overlay" (click)="closeModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2>{{ editingPermission() ? 'Edit Permission' : 'Create Permission' }}</h2>
              <button class="close-btn" (click)="closeModal()">×</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>Permission Name *</label>
                <input type="text" [(ngModel)]="permissionForm.name" placeholder="e.g., user.create" class="form-control" />
              </div>
              <div class="form-group">
                <label>Resource *</label>
                <input type="text" [(ngModel)]="permissionForm.resource" placeholder="e.g., user, attendance, leave" class="form-control" />
              </div>
              <div class="form-group">
                <label>Action *</label>
                <input type="text" [(ngModel)]="permissionForm.action" placeholder="e.g., create, view, update, delete" class="form-control" />
              </div>
              <div class="form-group">
                <label>Description</label>
                <textarea [(ngModel)]="permissionForm.description" placeholder="Enter permission description" rows="3" class="form-control"></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="closeModal()">Cancel</button>
              <button class="btn btn-primary" (click)="savePermission()">
                {{ editingPermission() ? 'Update' : 'Create' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class PermissionsManagementComponent implements OnInit {
  private destroy$ = new Subject<void>();
  permissions = signal<Permission[]>([]);
  loading = signal(false);
  error = signal('');
  
  showPermissionModal = signal(false);
  editingPermission = signal<Permission | null>(null);

  permissionForm: any = {
    name: '',
    resource: '',
    action: '',
    description: ''
  };

  constructor(private systemAdminService: SystemAdminService) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.loadPermissions();
  }

  loadPermissions(): void {
    this.loading.set(true);
    this.systemAdminService.getAllPermissions().pipe(takeUntil(this.destroy$)).subscribe({
      next: (permissions) => {
        this.permissions.set(permissions);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load permissions');
        this.loading.set(false);
        console.error(err);
      }
    });
  }

  showCreateModal(): void {
    this.editingPermission.set(null);
    this.permissionForm = { name: '', resource: '', action: '', description: '' };
    this.showPermissionModal.set(true);
  }

  editPermission(permission: Permission): void {
    this.editingPermission.set(permission);
    this.permissionForm = {
      name: permission.name,
      resource: permission.resource,
      action: permission.action,
      description: permission.description || ''
    };
    this.showPermissionModal.set(true);
  }

  savePermission(): void {
    const permission = this.editingPermission();
    if (permission) {
      const request: UpdatePermissionRequest = {
        name: this.permissionForm.name !== permission.name ? this.permissionForm.name : undefined,
        resource: this.permissionForm.resource !== permission.resource ? this.permissionForm.resource : undefined,
        action: this.permissionForm.action !== permission.action ? this.permissionForm.action : undefined,
        description: this.permissionForm.description !== permission.description ? this.permissionForm.description : undefined
      };

      this.systemAdminService.updatePermission(permission.id, request).pipe(take(1)).subscribe({
        next: () => {
          this.closeModal();
          this.loadPermissions();
        },
        error: (err) => {
          alert('Failed to update permission: ' + (err.error?.message || err.message));
          console.error(err);
        }
      });
    } else {
      const request: CreatePermissionRequest = {
        name: this.permissionForm.name,
        resource: this.permissionForm.resource,
        action: this.permissionForm.action,
        description: this.permissionForm.description || undefined
      };

      this.systemAdminService.createPermission(request).pipe(take(1)).subscribe({
        next: () => {
          this.closeModal();
          this.loadPermissions();
        },
        error: (err) => {
          alert('Failed to create permission: ' + (err.error?.message || err.message));
          console.error(err);
        }
      });
    }
  }

  deletePermission(permission: Permission): void {
    if (!confirm(`Are you sure you want to delete permission "${permission.name}"?`)) {
      return;
    }

    this.systemAdminService.deletePermission(permission.id).pipe(take(1)).subscribe({
      next: () => {
        this.loadPermissions();
      },
      error: (err) => {
        alert('Failed to delete permission: ' + (err.error?.message || err.message));
        console.error(err);
      }
    });
  }

  closeModal(): void {
    this.showPermissionModal.set(false);
    this.editingPermission.set(null);
  }
}

