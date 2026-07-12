// Core Identity & Multi-Tenancy
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  logoUrl?: string;
  branding: {
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
  };
  createdAt: Date;
}

export interface User {
  id: string;
  tenantId: string;
  email?: string;
  phone?: string;
  studentId?: string;
  staffId?: string;
  fullName: string;
  role: 'student' | 'staff' | 'admin' | 'superadmin';
  avatarUrl?: string;
  isActive: boolean;
  createdAt: Date;
  lastLogin?: Date;
}

// Academic Hierarchy
export interface Faculty {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
}

export interface Department {
  id: string;
  facultyId: string;
  tenantId: string;
  name: string;
}

export interface Cohort {
  id: string;
  departmentId: string;
  tenantId: string;
  name: string;
}

// Communication
export interface Group {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  type: 'private' | 'public' | 'course' | 'club' | 'announcement';
  academicContextId?: string;
  createdBy: string;
  createdAt: Date;
}

export interface Message {
  id: string;
  tenantId: string;
  groupId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'file' | 'voice' | 'poll';
  metadata?: any;
  isEdited: boolean;
  createdAt: Date;
}
