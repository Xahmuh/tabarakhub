// ============================================================================
// AUTH & IDENTITY TYPES
// ============================================================================

import type { Branch, Pharmacist } from './common';

export type Role = 'owner' | 'admin' | 'manager' | 'accounts' | 'supervisor' | 'warehouse' | 'branch' | 'driver' | 'worker';

export type SupervisorScopeMode = 'assigned_zones' | 'all_zones';

export interface AuthState {
  user: Branch | null;
  pharmacist: Pharmacist | null;
  permissions?: FeaturePermission[];
  rolePermissions?: RolePermission[];
}

export type BranchLoginApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';

export interface BranchLoginApproval {
  id: string;
  userId: string;
  userEmail?: string | null;
  branchId: string;
  branchCode?: string | null;
  branchName?: string | null;
  deviceFingerprintHash?: string | null;
  deviceLabel?: string | null;
  browserName?: string | null;
  osName?: string | null;
  userAgentHash?: string | null;
  lastIp?: string | null;
  status: BranchLoginApprovalStatus;
  requestedAt: string;
  expiresAt: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BranchLoginApprovalDeviceInfo {
  deviceFingerprintHash: string;
  deviceLabel: string;
  browserName: string;
  osName: string;
  userAgentHash: string;
}

export interface FeaturePermission {
  id: string;
  branchId: string;
  featureName: string;
  accessLevel: 'read' | 'edit' | 'none';
}

export interface RolePermission {
  role: Role;
  featureName: string;
  accessLevel: 'read' | 'edit' | 'none';
}

export interface UserFeaturePermission {
  userId: string;
  featureName: string;
  accessLevel: 'read' | 'edit' | 'none';
}

export interface AppUser {
  userId: string;
  email: string;
  role: Role;
  branchId?: string | null;
  branchCode?: string | null;
  branchName?: string | null;
  supervisorScopeMode?: SupervisorScopeMode | null;
  isActive: boolean;
  createdAt?: string;
}

export interface SupervisorBranchAssignment {
  supervisorUserId: string;
  branchId: string;
}

export interface BranchStaffAssignment {
  branchId: string;
  pharmacistIds: string[];
  driverIds: string[];
}

// --- Delivery Recording & Traceability Types ---
