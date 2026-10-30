import assert from 'node:assert/strict';
import { resolveAccessLevel } from '../access';
import type { FeaturePermission, RolePermission } from '../../types';

const branchOverrides: FeaturePermission[] = [
  { id: '1', branchId: 'branch-1', featureName: 'payroll', accessLevel: 'edit' },
  { id: '2', branchId: 'branch-1', featureName: 'tqph', accessLevel: 'edit' }
];
const roleDefaults: RolePermission[] = [
  { role: 'branch', featureName: 'payroll', accessLevel: 'edit' },
  { role: 'branch', featureName: 'tqph', accessLevel: 'edit' }
];

assert.equal(resolveAccessLevel('payroll', 'branch', branchOverrides, roleDefaults), 'none');
assert.equal(resolveAccessLevel('payroll:export', 'branch', branchOverrides, roleDefaults), 'none');
assert.equal(resolveAccessLevel('tqph', 'branch', branchOverrides, roleDefaults), 'none');
assert.equal(resolveAccessLevel('tqph:appraisals', 'branch', branchOverrides, roleDefaults), 'none');
assert.equal(resolveAccessLevel('hr_requests', 'employee', [], []), 'none');
assert.equal(resolveAccessLevel('payroll', 'admin', [], []), 'none');
assert.equal(resolveAccessLevel('payroll', 'supervisor', [], []), 'none');
assert.equal(resolveAccessLevel('payroll', 'owner', [], []), 'edit');
assert.equal(resolveAccessLevel('payroll', 'accounts', [], []), 'edit');
assert.equal(resolveAccessLevel('payroll:salary_edit', 'accounts', [], []), 'none');
assert.equal(resolveAccessLevel('payroll:salary_edit', 'owner', [], []), 'edit');
assert.equal(resolveAccessLevel('driver_payroll', 'driver', [], []), 'read');

console.log('Access boundary tests passed.');
