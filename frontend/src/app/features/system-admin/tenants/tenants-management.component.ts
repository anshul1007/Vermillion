import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SystemAdminService, Tenant, UpdateTenantRequest } from '../../../core/services/system-admin.service';
import { Subject } from 'rxjs';
import { takeUntil, take } from 'rxjs/operators';

@Component({
  selector: 'app-tenants-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="tenants-container">
      <div class="dashboard-header">
        <div>
          <h1>Tenants Management</h1>
          <p>Manage application tenants and configurations</p>
        </div>
      </div>

      @if (loading()) {
        <div class="alert alert-info">Loading tenants...</div>
      } @else if (error()) {
        <div class="alert alert-danger">{{ error() }}</div>
      } @else {
        <div class="card">
          <div class="tenants-grid">
            @for (tenant of tenants(); track tenant.id) {
              <div class="role-card tenant-card" [class.inactive]="!tenant.isActive">
                <div class="tenant-header">
                  <h3>{{ tenant.name }}</h3>
                  <span class="badge" [class.badge-success]="tenant.isActive" [class.badge-inactive]="!tenant.isActive">
                    {{ tenant.isActive ? 'Active' : 'Inactive' }}
                  </span>
                </div>
                <div class="tenant-info">
                  <div class="info-row">
                    <span class="label">Domain:</span>
                    <span class="value domain-badge">{{ tenant.domain }}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">Users:</span>
                    <span class="value">{{ tenant.userCount || 0 }}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">Created:</span>
                    <span class="value">{{ formatDate(tenant.createdAt) }}</span>
                  </div>
                  <!-- API Key removed -->
                </div>
                <div class="tenant-actions">
                  <button class="btn btn-sm btn-warning" (click)="editTenant(tenant)">
                    Edit Details
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Edit Tenant Modal -->
      @if (showTenantModal()) {
        <div class="modal-overlay" (click)="closeModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2>Edit Tenant</h2>
              <button class="close-btn" (click)="closeModal()">×</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>Tenant Name</label>
                <input type="text" [(ngModel)]="tenantForm.name" placeholder="Enter tenant name" class="form-control" />
              </div>
              <div class="form-group">
                <label>Domain</label>
                <input type="text" [(ngModel)]="tenantForm.domain" placeholder="Enter domain (e.g., attendance)" class="form-control" />
                <small class="help-text">⚠️ Changing domain may affect JWT claims and authentication</small>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="closeModal()">Cancel</button>
              <button class="btn btn-primary" (click)="saveTenant()">Update</button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class TenantsManagementComponent implements OnInit {
  private destroy$ = new Subject<void>();
  tenants = signal<Tenant[]>([]);
  loading = signal(false);
  error = signal('');
  
  showTenantModal = signal(false);
  editingTenant = signal<Tenant | null>(null);

  tenantForm: any = {
    name: '',
    domain: ''
  };

  constructor(private systemAdminService: SystemAdminService) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.loadTenants();
  }

  loadTenants(): void {
    this.loading.set(true);
    this.systemAdminService.getAllTenants().pipe(takeUntil(this.destroy$)).subscribe({
      next: (tenants) => {
        this.tenants.set(tenants);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load tenants');
        this.loading.set(false);
        console.error(err);
      }
    });
  }

  editTenant(tenant: Tenant): void {
    this.editingTenant.set(tenant);
    this.tenantForm = {
      name: tenant.name,
      domain: tenant.domain
    };
    this.showTenantModal.set(true);
  }

  saveTenant(): void {
    const tenant = this.editingTenant();
    if (!tenant) return;

    const request: UpdateTenantRequest = {
      name: this.tenantForm.name !== tenant.name ? this.tenantForm.name : undefined,
      domain: this.tenantForm.domain !== tenant.domain ? this.tenantForm.domain : undefined
    };

    this.systemAdminService.updateTenant(tenant.id, request).pipe(take(1)).subscribe({
      next: () => {
        this.closeModal();
        this.loadTenants();
      },
      error: (err) => {
        alert('Failed to update tenant: ' + (err.error?.message || err.message));
        console.error(err);
      }
    });
  }

  closeModal(): void {
    this.showTenantModal.set(false);
    this.editingTenant.set(null);
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString();
  }

  // API Key helpers removed
}

