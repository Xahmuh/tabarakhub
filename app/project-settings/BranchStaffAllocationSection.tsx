import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Building2,
  Shield,
  Truck,
  Wrench,
  CheckCircle2,
  Search,
  Filter,
  RefreshCw
} from 'lucide-react';
import Swal from 'sweetalert2';
import { Branch } from '../../types';
import {
  BranchStaffAssignment,
  BranchStaffRole,
  StaffAssignmentType
} from '../control-center/types';
import { controlCenterService } from '../control-center/services/controlCenterService';
import samplePayload from '../control-center/fixtures/samplePayload.json';
import { workforceService, Employee } from '../../services/workforceService';

interface BranchStaffAllocationSectionProps {
  branches: Branch[];
  canEdit?: boolean;
}

interface PersonnelItem {
  id: string;
  name: string;
  role: BranchStaffRole;
  code: string;
  cpr: string;
}

// Fallback baseline personnel
const FALLBACK_PERSONNEL: PersonnelItem[] = [
  // Pharmacists
  { id: '87041928-3000-4000-a000-000000000001', name: 'Dr. Ayman Khalil', role: 'Pharmacist', code: 'P-005', cpr: '870419283' },
  { id: '65b2cc82-055a-4552-8fec-82cd8b40ae25', name: 'Dr. Ahmed Elkholy', role: 'Pharmacist', code: 'P-018', cpr: '930918294' },
  { id: '43ccc615-b329-4d26-b868-c032983e9b59', name: 'Dr. Ebrahim Ayoub', role: 'Pharmacist', code: 'P-001', cpr: '940618291' },
  { id: '4fedfaf6-c27e-4f76-85fe-0f09aaaad77e', name: 'Dr. Dalia Abdelall', role: 'Pharmacist', code: 'P-002', cpr: '950718292' },
  { id: 'd052ae48-1f79-417c-87f6-01b208d1ab4b', name: 'Dr. Amira Rady', role: 'Pharmacist', code: 'P-003', cpr: '920818293' },
  { id: 'b08ed0a0-2019-4f0d-9d85-ed5d0bddafd3', name: 'Dr. Ahmed Elkomy', role: 'Pharmacist', code: 'P-008', cpr: '910118295' },

  // Drivers
  { id: 'a3000000-0000-4000-8000-000000000003', name: 'Ali Hassan Al-Balooshi', role: 'Driver', code: 'DRV-005', cpr: '960518293' },
  { id: 'd1000000-0000-4000-8000-000000000001', name: 'Sayed Mohamed Jawad', role: 'Driver', code: 'DRV-001', cpr: '920319482' },
  { id: 'd1000000-0000-4000-8000-000000000002', name: 'Hussain Ahmed Abdulla', role: 'Driver', code: 'DRV-002', cpr: '940821948' },
  { id: 'd1000000-0000-4000-8000-000000000003', name: 'Mahmood Redha Ebrahim', role: 'Driver', code: 'DRV-003', cpr: '910712984' },

  // Workers
  { id: 'a4000000-0000-4000-8000-000000000004', name: 'Kumar Rajan', role: 'Worker', code: 'WRK-005', cpr: '910219482' },
  { id: 'w1000000-0000-4000-8000-000000000001', name: 'Suresh Babu', role: 'Worker', code: 'WRK-001', cpr: '930129481' },
  { id: 'w1000000-0000-4000-8000-000000000002', name: 'Mohamed Faisal', role: 'Worker', code: 'WRK-002', cpr: '950419283' }
];

export const BranchStaffAllocationSection: React.FC<BranchStaffAllocationSectionProps> = ({
  branches,
  canEdit = true
}) => {
  // Live workforce state
  const [liveEmployees, setLiveEmployees] = useState<Employee[]>([]);
  const [isLoadingWorkforce, setIsLoadingWorkforce] = useState(true);

  // Load saved assignments or initialize from sample payload
  const [assignments, setAssignments] = useState<BranchStaffAssignment[]>(() => {
    const existing = controlCenterService.getStaffAssignments();
    if (existing && existing.length > 0) return existing;
    return (samplePayload.staff_assignments as any[]) || [];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'all' | BranchStaffRole>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | StaffAssignmentType>('all');

  // Modal State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [targetBranchId, setTargetBranchId] = useState<string>(branches[0]?.id || '');
  const [modalRole, setModalRole] = useState<BranchStaffRole>('Pharmacist');
  const [modalUserId, setModalUserId] = useState<string>('');
  const [modalAssignmentType, setModalAssignmentType] = useState<StaffAssignmentType>('Primary Base');
  const [modalStartDate, setModalStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [modalEndDate, setModalEndDate] = useState('');

  // Fetch live employees on mount
  useEffect(() => {
    let isMounted = true;
    const fetchLiveWorkforce = async () => {
      try {
        setIsLoadingWorkforce(true);
        const emps = await workforceService.getAllEmployees();
        if (isMounted && emps && emps.length > 0) {
          setLiveEmployees(emps);
        }
      } catch (err) {
        console.warn('Could not load live workforce directory:', err);
      } finally {
        if (isMounted) setIsLoadingWorkforce(false);
      }
    };
    fetchLiveWorkforce();
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute personnel pool (Live workforce or Fallback)
  const personnelList = useMemo<PersonnelItem[]>(() => {
    if (liveEmployees.length > 0) {
      return liveEmployees
        .filter(e => e.status === 'Active')
        .map(e => {
          let role: BranchStaffRole = 'Pharmacist';
          if (e.category === 'Driver') role = 'Driver';
          else if (e.category === 'Worker') role = 'Worker';

          return {
            id: e.id,
            name: e.full_name,
            role,
            code: e.code,
            cpr: e.cpr_number || 'N/A'
          };
        });
    }
    return FALLBACK_PERSONNEL;
  }, [liveEmployees]);

  // Filtered available staff for modal based on chosen role
  const availableStaffForRole = useMemo(() => {
    return personnelList.filter(p => p.role === modalRole);
  }, [personnelList, modalRole]);

  // Handle Role change in modal
  const handleModalRoleChange = (role: BranchStaffRole) => {
    setModalRole(role);
    const firstMatch = personnelList.find(p => p.role === role);
    setModalUserId(firstMatch ? firstMatch.id : '');
  };

  // Group assignments by branch
  const assignmentsByBranch = useMemo(() => {
    const map = new Map<string, BranchStaffAssignment[]>();
    branches.forEach(b => map.set(b.id, []));

    assignments.forEach(asg => {
      if (map.has(asg.branch_id)) {
        map.get(asg.branch_id)!.push(asg);
      }
    });
    return map;
  }, [assignments, branches]);

  // Overall counts
  const totals = useMemo(() => {
    let pharmacists = 0;
    let drivers = 0;
    let workers = 0;

    assignments.forEach(asg => {
      if (asg.role === 'Pharmacist') pharmacists++;
      else if (asg.role === 'Driver') drivers++;
      else if (asg.role === 'Worker') workers++;
    });

    return { pharmacists, drivers, workers, total: assignments.length };
  }, [assignments]);

  // Filtered Branches to display
  const filteredBranches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return branches.filter(b => {
      const matchName = b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q);
      if (!matchName) return false;

      if (selectedRoleFilter !== 'all') {
        const branchAsgs = assignmentsByBranch.get(b.id) || [];
        const hasRole = branchAsgs.some(a => a.role === selectedRoleFilter);
        if (!hasRole) return false;
      }

      if (selectedTypeFilter !== 'all') {
        const branchAsgs = assignmentsByBranch.get(b.id) || [];
        const hasType = branchAsgs.some(a => a.assignment_type === selectedTypeFilter);
        if (!hasType) return false;
      }

      return true;
    });
  }, [branches, searchQuery, selectedRoleFilter, selectedTypeFilter, assignmentsByBranch]);

  const handleAssignStaff = () => {
    if (!targetBranchId || !modalUserId) {
      Swal.fire('Missing Information', 'Please select both the branch and the staff member', 'warning');
      return;
    }

    const assigned = controlCenterService.assignStaff({
      branch_id: targetBranchId,
      user_id: modalUserId,
      role: modalRole,
      assignment_type: modalAssignmentType,
      start_date: modalStartDate,
      end_date: modalEndDate || null
    });

    setAssignments(controlCenterService.getStaffAssignments());
    setShowAssignModal(false);

    Swal.fire({
      title: 'Staff Member Allocated',
      text: `Successfully assigned to ${branches.find(b => b.id === targetBranchId)?.name || 'target branch'}`,
      icon: 'success',
      timer: 1800,
      showConfirmButton: false
    });
  };

  const handleRemoveAssignment = (assignmentId: string) => {
    controlCenterService.removeStaffAssignment(assignmentId);
    setAssignments(controlCenterService.getStaffAssignments());
  };

  return (
    <div className="space-y-6">
      {/* ── Section Header ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200">
              <Users className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Branch Staff Allocation (Pharmacists, Drivers, Workers)
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Dynamic Multi-Branch Allocation: Licensed Pharmacists, Delivery Fleet Drivers, and Operations Workers
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isLoadingWorkforce && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 px-3 py-1.5 rounded-lg bg-slate-100">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
              Syncing Directory...
            </span>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setTargetBranchId(branches[0]?.id || '');
                handleModalRoleChange('Pharmacist');
                setShowAssignModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-700 text-white text-xs font-bold shadow-sm shadow-red-700/20 hover:bg-red-800 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Allocate Staff Member</span>
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Ribbon (Pharmacists, Drivers, Workers) ────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Licensed Pharmacists</span>
            <Shield className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-950 mt-2">{totals.pharmacists}</p>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">In-Charge & Staff Pharmacists</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Delivery Drivers</span>
            <Truck className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-slate-950 mt-2">{totals.drivers}</p>
          <p className="text-[11px] text-blue-600 font-medium mt-1">Branch Dispatch Fleet</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Support Workers</span>
            <Wrench className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-slate-950 mt-2">{totals.workers}</p>
          <p className="text-[11px] text-purple-600 font-medium mt-1">Store Support & Operations</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Total Allocations</span>
            <CheckCircle2 className="w-4 h-4 text-red-700" />
          </div>
          <p className="text-2xl font-black text-slate-950 mt-2">{totals.total}</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Network Deployment Count</p>
        </div>
      </div>

      {/* ── Search and Filter Controls ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search branch code, name, or staff member..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />

          {/* Role Filter Tabs */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setSelectedRoleFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                selectedRoleFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-600'
              }`}
            >
              All Roles
            </button>
            <button
              type="button"
              onClick={() => setSelectedRoleFilter('Pharmacist')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                selectedRoleFilter === 'Pharmacist' ? 'bg-emerald-600 text-white shadow-2xs font-black' : 'text-slate-600'
              }`}
            >
              Pharmacists
            </button>
            <button
              type="button"
              onClick={() => setSelectedRoleFilter('Driver')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                selectedRoleFilter === 'Driver' ? 'bg-blue-600 text-white shadow-2xs font-black' : 'text-slate-600'
              }`}
            >
              Drivers
            </button>
            <button
              type="button"
              onClick={() => setSelectedRoleFilter('Worker')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                selectedRoleFilter === 'Worker' ? 'bg-purple-600 text-white shadow-2xs font-black' : 'text-slate-600'
              }`}
            >
              Workers
            </button>
          </div>

          {/* Type Filter */}
          <select
            value={selectedTypeFilter}
            onChange={e => setSelectedTypeFilter(e.target.value as any)}
            className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:outline-none"
          >
            <option value="all">All Assignment Types</option>
            <option value="Primary Base">Primary Base</option>
            <option value="Floating / Relief Cover">Floating / Relief Cover</option>
          </select>
        </div>
      </div>

      {/* ── Branches Staff Cards Grid ─────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredBranches.map(branch => {
          const branchAsgs = assignmentsByBranch.get(branch.id) || [];
          const rxCount = branchAsgs.filter(a => a.role === 'Pharmacist').length;
          const drvCount = branchAsgs.filter(a => a.role === 'Driver').length;
          const wrkCount = branchAsgs.filter(a => a.role === 'Worker').length;

          return (
            <div
              key={branch.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 hover:border-slate-300 transition-all"
            >
              {/* Branch Header */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-xs text-slate-800">
                    {branch.code}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">{branch.name}</h3>
                    <p className="text-[11px] text-slate-400 font-medium">
                      CR: {branch.crNumber || '127506-01'} · Manager: {branch.branchManagerName || 'In-Charge'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {rxCount} Pharmacists
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    {drvCount} Drivers
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                    {wrkCount} Workers
                  </span>
                </div>
              </div>

              {/* Staff Table / List */}
              {branchAsgs.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400 italic">
                  No personnel allocated to this branch yet. Click "+ Add Staff" to assign pharmacists, drivers, or workers.
                </div>
              ) : (
                <div className="space-y-2">
                  {branchAsgs.map(asg => {
                    const person = personnelList.find(p => p.id === asg.user_id) || {
                      name: 'Allocated Personnel',
                      code: 'EMP',
                      cpr: 'N/A'
                    };

                    return (
                      <div
                        key={asg.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] ${
                              asg.role === 'Pharmacist'
                                ? 'bg-emerald-100 text-emerald-800'
                                : asg.role === 'Driver'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {asg.role === 'Pharmacist' ? (
                              <Shield className="w-3.5 h-3.5" />
                            ) : asg.role === 'Driver' ? (
                              <Truck className="w-3.5 h-3.5" />
                            ) : (
                              <Wrench className="w-3.5 h-3.5" />
                            )}
                          </span>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{person.name}</span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                  asg.assignment_type === 'Primary Base'
                                    ? 'bg-slate-200/60 text-slate-700 border-slate-300'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}
                              >
                                {asg.assignment_type}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400">
                              {person.code} · CPR: {person.cpr} · Started: {asg.start_date} {asg.end_date ? `· Until: ${asg.end_date}` : '· Ongoing'}
                            </p>
                          </div>
                        </div>

                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleRemoveAssignment(asg.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Deallocate Staff Member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Card Footer Quick Action */}
              {canEdit && (
                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetBranchId(branch.id);
                      handleModalRoleChange('Pharmacist');
                      setShowAssignModal(true);
                    }}
                    className="text-[11px] font-bold text-red-700 hover:text-red-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Staff to Branch</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Assign Staff Modal (Wide Width) ────────────────────── */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 sm:p-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl max-w-3xl w-full p-6 sm:p-8 space-y-6 text-slate-900 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-950 uppercase tracking-tight">Allocate Staff Member to Branch</h3>
                  <p className="text-[11px] font-semibold text-slate-400">Assign licensed pharmacists, delivery drivers, or operational staff</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5 text-xs font-bold">
              {/* 1. Target Branch and Operational Role in 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 mb-1.5 uppercase text-[10px] tracking-wider font-black">
                    Target Pharmacy Branch
                  </label>
                  <select
                    value={targetBranchId}
                    onChange={e => setTargetBranchId(e.target.value)}
                    className="w-full h-11 rounded-xl border border-slate-200 px-3.5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20 bg-slate-50 focus:bg-white transition-all"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.code} - {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1.5 uppercase text-[10px] tracking-wider font-black">
                    Operational Role
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Pharmacist', 'Driver', 'Worker'] as BranchStaffRole[]).map(role => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => handleModalRoleChange(role)}
                        className={`h-11 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          modalRole === role
                            ? 'border-red-700 bg-red-50 text-red-700 shadow-2xs'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {role === 'Pharmacist' && <Shield className="w-3.5 h-3.5" />}
                        {role === 'Driver' && <Truck className="w-3.5 h-3.5" />}
                        {role === 'Worker' && <Wrench className="w-3.5 h-3.5" />}
                        <span>{role}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. Personnel Selector & Assignment Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 mb-1.5 uppercase text-[10px] tracking-wider font-black">
                    Select Available {modalRole} ({availableStaffForRole.length} Available)
                  </label>
                  <select
                    value={modalUserId}
                    onChange={e => setModalUserId(e.target.value)}
                    className="w-full h-11 rounded-xl border border-slate-200 px-3.5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20 bg-slate-50 focus:bg-white transition-all"
                  >
                    {availableStaffForRole.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code} - CPR: {p.cpr})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1.5 uppercase text-[10px] tracking-wider font-black">
                    Assignment Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Primary Base', 'Floating / Relief Cover'] as StaffAssignmentType[]).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setModalAssignmentType(t)}
                        className={`h-11 px-2 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                          modalAssignmentType === t
                            ? 'border-slate-900 bg-slate-900 text-white shadow-2xs'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. Effective Start & End Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div>
                  <label className="block text-slate-600 mb-1.5 uppercase text-[10px] tracking-wider font-black">
                    Effective Start Date
                  </label>
                  <input
                    type="date"
                    value={modalStartDate}
                    onChange={e => setModalStartDate(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 font-semibold text-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1.5 uppercase text-[10px] tracking-wider font-black">
                    End Date (Optional / For Temporary Cover)
                  </label>
                  <input
                    type="date"
                    value={modalEndDate}
                    onChange={e => setModalEndDate(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 font-semibold text-slate-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignStaff}
                className="px-6 py-2.5 rounded-xl bg-red-700 text-white font-black text-xs hover:bg-red-800 shadow-md shadow-red-700/20 transition-all cursor-pointer"
              >
                Confirm Allocation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
