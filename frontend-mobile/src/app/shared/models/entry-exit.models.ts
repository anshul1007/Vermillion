export interface Worker {
  workerId?: number;
  fullName: string;
  employeeCode: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  company?: string;
  department?: string;
  designation?: string;
  photoBase64?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Visitor {
  visitorId?: number;
  fullName: string;
  phoneNumber?: string;
  email?: string;
  companyName?: string;
  purposeOfVisit?: string;
  personToMeet?: string;
  idProofType?: string;
  idProofNumber?: string;
  photoBase64?: string;
  createdAt?: Date;
}

export interface EntryExit {
  entryExitId?: number;
  personType: 'Worker' | 'Visitor';
  workerId?: number;
  visitorId?: number;
  entryExitType: 'Entry' | 'Exit';
  timestamp: Date;
  gateNumber?: string;
  recordedBy?: string;
  notes?: string;
  photoBase64?: string;
  temperature?: string;
  healthCheckPassed?: boolean;
  worker?: Worker;
  visitor?: Visitor;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}
