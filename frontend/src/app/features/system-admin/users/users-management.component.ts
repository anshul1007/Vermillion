import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SystemAdminService,
  SystemUser,
  Tenant,
  Role,
  CreateUserRequest,
  UpdateUserRequest,
} from '../../../core/services/system-admin.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-users-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="users-container">
      <div class="dashboard-header">
        <div>
          <h1>Users Management</h1>
          <p>Manage system users and access control</p>
        </div>
        <button class="btn btn-primary" (click)="showCreateModal()">
          + Create User
        </button>
      </div>

      @if (loading()) {
      <div class="alert alert-info">Loading users...</div>
      } @else if (error()) {
      <div class="alert alert-danger">{{ error() }}</div>
      } @else {
      <div class="card">
        <table class="table users-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Email</th>
              <th>Tenants & Roles</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (user of users(); track user.id) {
            <tr>
              <td>{{ user.id }}</td>
              <td>{{ user.username }}</td>
              <td>{{ user.email }}</td>
              <td>
                <div class="tenant-badges">
                  @for (tenant of user.tenants; track tenant.tenantId) {
                  <span class="badge" [class.badge-inactive]="!tenant.isActive">
                    {{ tenant.tenantName }}: {{ tenant.roleName }}
                  </span>
                  }
                </div>
              </td>
              <td>{{ formatDate(user.createdAt) }}</td>
              <td>
                <div class="action-buttons">
                  <button class="btn btn-sm btn-info" (click)="viewUser(user)" title="View Details">
                    👁️
                  </button>
                  <button class="btn btn-sm btn-warning" (click)="editUser(user)" title="Edit">
                    ✏️
                  </button>
                  <button
                    class="btn btn-sm btn-success"
                    (click)="manageAccess(user)"
                    title="Manage Access"
                  >
                    🔑
                  </button>
                  <button class="btn btn-sm btn-danger" (click)="deleteUser(user)" title="Delete">
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
            }
          </tbody>
        </table>
      </div>
      }

      <!-- Create/Edit User Modal -->
      @if (showUserModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingUser() ? 'Edit User' : 'Create User' }}</h2>
            <button class="close-btn" (click)="closeModal()">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Username *</label>
              <input type="text" [(ngModel)]="userForm.username" placeholder="Enter username" class="form-control" />
            </div>
            <div class="form-group">
              <label>Email *</label>
              <input type="email" [(ngModel)]="userForm.email" placeholder="Enter email" class="form-control" />
            </div>
            <div class="form-group">
              <label>Password {{ editingUser() ? '(leave blank to keep current)' : '*' }}</label>
              <input type="password" [(ngModel)]="userForm.password" placeholder="Enter password" class="form-control" />
            </div>
            <div class="form-group">
              <label>External Provider</label>
              <input
                type="text"
                [(ngModel)]="userForm.externalProvider"
                placeholder="e.g., Zoho, Google (optional)"
                class="form-control"
              />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Cancel</button>
            <button class="btn btn-primary" (click)="saveUser()">
              {{ editingUser() ? 'Update' : 'Create' }}
            </button>
          </div>
        </div>
      </div>
      }

      <!-- Manage Access Modal -->
      @if (showAccessModal()) {
      <div class="modal-overlay" (click)="closeAccessModal()">
        <div class="modal modal-lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Manage Access - {{ selectedUser()?.username }}</h2>
            <button class="close-btn" (click)="closeAccessModal()">×</button>
          </div>
          <div class="modal-body">
            <h3>Current Access</h3>
            <div class="access-list">
              @for (tenant of selectedUser()?.tenants; track tenant.tenantId) {
              <div class="access-item">
                <div class="access-info">
                  <strong>{{ tenant.tenantName }}</strong> ({{ tenant.tenantDomain }})
                  <br />
                  <span class="badge badge-info role-badge">{{ tenant.roleName }}</span>
                  <span class="badge" [class.badge-success]="tenant.isActive" [class.badge-inactive]="!tenant.isActive">
                    {{ tenant.isActive ? 'Active' : 'Inactive' }}
                  </span>
                </div>
                <button
                  class="btn btn-sm btn-danger"
                  (click)="removeAccess(tenant.tenantId, tenant.roleId)"
                >
                  Remove
                </button>
              </div>
              }
            </div>

            <h3 class="mt-8">Add New Access</h3>
            <div class="add-access-form">
              <div class="form-group">
                <select [(ngModel)]="newAccess.tenantId" class="form-control">
                  <option [value]="0">Select Tenant</option>
                  @for (tenant of tenants(); track tenant.id) {
                  <option [value]="tenant.id">{{ tenant.name }} ({{ tenant.domain }})</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <select [(ngModel)]="newAccess.roleId" class="form-control">
                  <option [value]="0">Select Role</option>
                  @for (role of roles(); track role.id) {
                  <option [value]="role.id">{{ role.name }}</option>
                  }
                </select>
              </div>
              <button class="btn btn-primary" (click)="addAccess()">Add Access</button>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeAccessModal()">Close</button>
          </div>
        </div>
      </div>
      }
    </div>
  `,
})
export class UsersManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  users = signal<SystemUser[]>([]);
  tenants = signal<Tenant[]>([]);
  roles = signal<Role[]>([]);
  loading = signal(false);
  error = signal('');

  showUserModal = signal(false);
  showAccessModal = signal(false);
  editingUser = signal<SystemUser | null>(null);
  selectedUser = signal<SystemUser | null>(null);

  userForm: any = {
    username: '',
    email: '',
    password: '',
    externalProvider: '',
  };

  newAccess = {
    tenantId: 0,
    roleId: 0,
  };

  constructor(private systemAdminService: SystemAdminService) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadTenants();
    this.loadRoles();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.systemAdminService
      .getAllUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          this.users.set(users);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set('Failed to load users');
          this.loading.set(false);
          console.error(err);
        },
      });
  }

  loadTenants(): void {
    this.systemAdminService
      .getAllTenants()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tenants) => this.tenants.set(tenants),
        error: (err) => console.error('Failed to load tenants', err),
      });
  }

  loadRoles(): void {
    this.systemAdminService
      .getAllRoles()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (roles) => {
          // Remove protected roles for non-SystemAdmin users in the UI (case-insensitive, trimmed)
          const protectedNames = new Set(['systemadmin', 'guard', 'superadmin']);
          const filtered = roles.filter((r) => {
            const name = (r.name ?? '').trim().toLowerCase();
            return !protectedNames.has(name);
          });
          this.roles.set(filtered);
        },
        error: (err) => console.error('Failed to load roles', err),
      });
  }

  showCreateModal(): void {
    this.editingUser.set(null);
    this.userForm = { username: '', email: '', password: '', externalProvider: '' };
    this.showUserModal.set(true);
  }

  editUser(user: SystemUser): void {
    this.editingUser.set(user);
    this.userForm = {
      username: user.username,
      email: user.email,
      password: '',
      externalProvider: user.externalProvider || '',
    };
    this.showUserModal.set(true);
  }

  viewUser(user: SystemUser): void {
    alert(
      `User Details:\n\nID: ${user.id}\nUsername: ${user.username}\nEmail: ${
        user.email
      }\n\nTenants:\n${user.tenants.map((t) => `${t.tenantName}: ${t.roleName}`).join('\n')}`
    );
  }

  saveUser(): void {
    const user = this.editingUser();
    if (user) {
      // Update existing user
      const request: UpdateUserRequest = {
        username: this.userForm.username !== user.username ? this.userForm.username : undefined,
        email: this.userForm.email !== user.email ? this.userForm.email : undefined,
        password: this.userForm.password ? this.userForm.password : undefined,
      };

      this.systemAdminService
        .updateUser(user.id, request)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.closeModal();
            this.loadUsers();
          },
          error: (err) => {
            alert('Failed to update user: ' + (err.error?.message || err.message));
            console.error(err);
          },
        });
    } else {
      // Create new user
      const request: CreateUserRequest = {
        username: this.userForm.username,
        email: this.userForm.email,
        password: this.userForm.password,
        externalProvider: this.userForm.externalProvider || undefined,
      };

      this.systemAdminService
        .createUser(request)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.closeModal();
            this.loadUsers();
          },
          error: (err) => {
            alert('Failed to create user: ' + (err.error?.message || err.message));
            console.error(err);
          },
        });
    }
  }

  deleteUser(user: SystemUser): void {
    if (!confirm(`Are you sure you want to delete user "${user.username}"?`)) {
      return;
    }

    this.systemAdminService
      .deleteUser(user.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadUsers();
        },
        error: (err) => {
          alert('Failed to delete user: ' + (err.error?.message || err.message));
          console.error(err);
        },
      });
  }

  manageAccess(user: SystemUser): void {
    this.selectedUser.set(user);
    this.newAccess = { tenantId: 0, roleId: 0 };
    this.showAccessModal.set(true);
  }

  addAccess(): void {
    const user = this.selectedUser();
    if (!user || !this.newAccess.tenantId || !this.newAccess.roleId) {
      alert('Please select both tenant and role');
      return;
    }

    this.systemAdminService
      .assignUserToTenantRole(user.id, this.newAccess.tenantId, this.newAccess.roleId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadUsers();
          this.newAccess = { tenantId: 0, roleId: 0 };
          // Refresh selected user data
          const updatedUser = this.users().find((u) => u.id === user.id);
          if (updatedUser) {
            this.selectedUser.set(updatedUser);
          }
        },
        error: (err) => {
          alert('Failed to add access: ' + (err.error?.message || err.message));
          console.error(err);
        },
      });
  }

  removeAccess(tenantId: number, roleId: number): void {
    const user = this.selectedUser();
    if (!user) return;

    if (!confirm('Are you sure you want to remove this access?')) {
      return;
    }

    this.systemAdminService
      .removeUserFromTenantRole(user.id, tenantId, roleId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadUsers();
          // Refresh selected user data
          const updatedUser = this.users().find((u) => u.id === user.id);
          if (updatedUser) {
            this.selectedUser.set(updatedUser);
          }
        },
        error: (err) => {
          alert('Failed to remove access: ' + (err.error?.message || err.message));
          console.error(err);
        },
      });
  }

  closeModal(): void {
    this.showUserModal.set(false);
    this.editingUser.set(null);
  }

  closeAccessModal(): void {
    this.showAccessModal.set(false);
    this.selectedUser.set(null);
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString();
  }
}

