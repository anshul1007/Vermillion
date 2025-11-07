import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-system-admin',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="system-admin-container">
      <div class="dashboard-header">
        <div>
          <h1>System Administration</h1>
          <p>Manage users, roles, permissions, and tenants</p>
        </div>
      </div>

      <div class="admin-cards">
        <a routerLink="/system-admin/users" class="admin-card">
          <div class="card-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <h3>Users</h3>
          <p>Manage user accounts and their tenant assignments</p>
        </a>

        <a routerLink="/system-admin/roles" class="admin-card">
          <div class="card-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
          </div>
          <h3>Roles</h3>
          <p>Create and manage roles with permissions</p>
        </a>

        <a routerLink="/system-admin/permissions" class="admin-card">
          <div class="card-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h3>Permissions</h3>
          <p>Define granular permissions for resources</p>
        </a>

        <a routerLink="/system-admin/tenants" class="admin-card">
          <div class="card-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <h3>Tenants</h3>
          <p>Manage application tenants and configurations</p>
        </a>
      </div>
    </div>
  `
})
export class SystemAdminDashboardComponent implements OnInit {
  ngOnInit(): void {
    // Component initialization
  }
}

