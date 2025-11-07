export interface PublicHoliday {
  id: string;
  date: Date;
  name: string;
  description?: string;
  year: number;
  isActive: boolean;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  phoneNumber?: string;
  role: string;
  managerId?: string;
  departmentId?: string;
  departmentName?: string;
  isActive: boolean;
}

export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  role: number;
  managerId?: string;
  departmentId?: string;
  password: string;
}

export interface UpdateUserRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: number;
  managerId?: string;
  departmentId?: string;
  isActive?: boolean;
}

export interface LeaveEntitlement {
  id: string;
  userId: string;
  year: number;
  casualLeaveBalance: number;
  earnedLeaveBalance: number;
  compensatoryOffBalance: number;
}

export interface LeaveEntitlementRequest {
  userId: string;
  year: number;
  casualLeave: number;
  earnedLeave: number;
}
