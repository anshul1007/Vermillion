export enum UserRole {
  Employee = 'Employee',
  Manager = 'Manager',
  Admin = 'Admin',
  SystemAdmin = 'SystemAdmin',
  Guard = 'Guard'
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  role: UserRole;
  tenants?: Array<{
    tenantId?: number;
    tenantName?: string;
    domain?: string;
    roleName?: string;
    permissions?: string[];
  }>;
  managerId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  token: string;
  refreshToken?: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}
