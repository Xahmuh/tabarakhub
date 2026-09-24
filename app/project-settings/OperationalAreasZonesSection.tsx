import React, { useState, useMemo, useEffect } from 'react';
import {
  Layers,
  MapPin,
  Plus,
  Clock,
  CheckCircle2,
  Calendar,
  Building2,
  Trash2,
  ChevronDown,
  ChevronRight,
  UserCheck,
  Edit3,
  X,
  Mail,
  ShieldCheck,
  ArrowRightLeft,
  Search,
  Check,
  Filter
} from 'lucide-react';
import Swal from 'sweetalert2';
import { Branch } from '../../types';
import {
  OperationalArea,
  OperationalZone,
  AreaSupervisor
} from '../control-center/types';
import { controlCenterService } from '../control-center/services/controlCenterService';

interface OperationalAreasZonesSectionProps {
  branches: Branch[];
  canEdit?: boolean;
}

export const OperationalAreasZonesSection: React.FC<OperationalAreasZonesSectionProps> = ({
  branches,
  canEdit = true
}) => {
  const [areas, setAreas] = useState<OperationalArea[]>(() => controlCenterService.getAreas());
  const [zones, setZones] = useState<OperationalZone[]>(() => controlCenterService.getZones());
  const [supervisors, setSupervisors] = useState<AreaSupervisor[]>(() => controlCenterService.getSupervisors());
  const [expandedAreaId, setExpandedAreaId] = useState<string | null>(areas[0]?.id || null);

  // Branch Area Dynamic Mapping State
  const [branchAreaMap, setBranchAreaMap] = useState<Record<string, string>>(() =>
    controlCenterService.getBranchAreaMapping(branches)
  );
  const [showManageBranchesModal, setShowManageBranchesModal] = useState(false);
  const [selectedAreaForBranches, setSelectedAreaForBranches] = useState<OperationalArea | null>(null);
  const [branchSearchQuery, setBranchSearchQuery] = useState('');
  const [selectedBatchBranchIds, setSelectedBatchBranchIds] = useState<string[]>([]);

  // Load live registered supervisors and branch classifications from system database
  useEffect(() => {
    controlCenterService.fetchLiveSupervisors().then(setSupervisors).catch(console.error);
    controlCenterService.fetchLiveBranchAreaMapping(branches).then(setBranchAreaMap).catch(console.error);
  }, [branches]);

  // Modal States
  const [showCreateAreaModal, setShowCreateAreaModal] = useState(false);
  const [showEditAreaModal, setShowEditAreaModal] = useState(false);
  const [showCreateZoneModal, setShowCreateZoneModal] = useState(false);
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [selectedAreaForZone, setSelectedAreaForZone] = useState<string>('');
  const [selectedZoneForShift, setSelectedZoneForShift] = useState<string>('');

  // Form States for Editing Area
  const [editingArea, setEditingArea] = useState<OperationalArea | null>(null);
  const [editAreaCode, setEditAreaCode] = useState('');
  const [editAreaNameEn, setEditAreaNameEn] = useState('');
  const [editAreaSupervisorId, setEditAreaSupervisorId] = useState('');
  const [editAreaDesc, setEditAreaDesc] = useState('');

  // Form States for New Area
  const [newAreaCode, setNewAreaCode] = useState('');
  const [newAreaNameEn, setNewAreaNameEn] = useState('');
  const [newAreaSupervisorId, setNewAreaSupervisorId] = useState(() => controlCenterService.getSupervisors()[0]?.id || '');
  const [newAreaDesc, setNewAreaDesc] = useState('');

  // Custom Supervisor Form State (used inside modals)
  const [showAddCustomSupervisor, setShowAddCustomSupervisor] = useState(false);
  const [customSupervisorName, setCustomSupervisorName] = useState('');
  const [customSupervisorTitle, setCustomSupervisorTitle] = useState('');
  const [customSupervisorEmail, setCustomSupervisorEmail] = useState('');

  // Form States for New Zone
  const [newZoneCode, setNewZoneCode] = useState('');
  const [newZoneNameEn, setNewZoneNameEn] = useState('');

  // Form States for New Shift
  const [newShiftName, setNewShiftName] = useState('');
  const [newShiftStart, setNewShiftStart] = useState('08:00');
  const [newShiftEnd, setNewShiftEnd] = useState('16:00');
  const [newShiftHours, setNewShiftHours] = useState(8);
  const [newShiftType, setNewShiftType] = useState<'regular' | 'weekend_on_call' | 'full_day_24h'>('regular');
  const [newShiftNotes, setNewShiftNotes] = useState('');

  // Dynamic mapping of branches to Operational Areas
  const branchesByArea = useMemo(() => {
    const map = new Map<string, Branch[]>();
    areas.forEach(a => map.set(a.id, []));
    const defaultAreaId = areas[0]?.id;

    branches.forEach(b => {
      const assignedAreaId = branchAreaMap[b.id] || defaultAreaId;
      if (assignedAreaId && map.has(assignedAreaId)) {
        map.get(assignedAreaId)!.push(b);
      } else if (defaultAreaId && map.has(defaultAreaId)) {
        map.get(defaultAreaId)!.push(b);
      }
    });
    return map;
  }, [branches, areas, branchAreaMap]);

  // Branch Reassignment Handlers
  const handleOpenManageBranches = (area: OperationalArea) => {
    setSelectedAreaForBranches(area);
    setBranchSearchQuery('');
    setSelectedBatchBranchIds([]);
    setShowManageBranchesModal(true);
  };

  const handleReassignBranchToArea = (branchId: string, targetAreaId: string) => {
    controlCenterService.setBranchArea(branchId, targetAreaId);
    setBranchAreaMap(prev => ({
      ...prev,
      [branchId]: targetAreaId
    }));
  };

  const handleBatchTransferToArea = (targetAreaId: string) => {
    if (selectedBatchBranchIds.length === 0) return;
    controlCenterService.batchAssignBranchesToArea(selectedBatchBranchIds, targetAreaId);
    setBranchAreaMap(prev => {
      const next = { ...prev };
      selectedBatchBranchIds.forEach(id => {
        next[id] = targetAreaId;
      });
      return next;
    });
    const count = selectedBatchBranchIds.length;
    setSelectedBatchBranchIds([]);
    const targetArea = areas.find(a => a.id === targetAreaId);
    Swal.fire({
      icon: 'success',
      title: 'Branches Reassigned',
      text: `Successfully transferred ${count} branches to ${targetArea?.name_en || 'target area'}.`,
      timer: 1600,
      showConfirmButton: false
    });
  };

  const handleQuickReassignBranch = async (branch: Branch, currentArea: OperationalArea) => {
    if (!canEdit) return;
    const otherAreas = areas.filter(a => a.id !== currentArea.id);
    if (otherAreas.length === 0) {
      Swal.fire('Notice', 'No other operational areas are currently available to transfer this branch to.', 'info');
      return;
    }

    const inputOptions: Record<string, string> = {};
    otherAreas.forEach(a => {
      inputOptions[a.id] = `${a.name_en} (${a.code})`;
    });

    const { value: targetAreaId } = await Swal.fire({
      title: 'Reassign Network Branch',
      html: `
        <div style="text-align: left; font-size: 13px; color: #334155; line-height: 1.6;">
          <p style="margin-bottom: 6px;"><strong>Pharmacy:</strong> ${branch.code} · ${branch.name.replace('Tabarak Pharmacy - ', '')}</p>
          <p style="margin-bottom: 10px;"><strong>Current Area:</strong> ${currentArea.name_en} (${currentArea.code})</p>
          <p style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Select the operational area to assign this branch to:</p>
        </div>
      `,
      input: 'select',
      inputOptions,
      inputPlaceholder: 'Select Target Operational Area',
      showCancelButton: true,
      confirmButtonText: 'Confirm Transfer',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#b91c1c',
      inputValidator: (val) => {
        if (!val) {
          return 'Please select an operational area';
        }
        return null;
      }
    });

    if (targetAreaId) {
      handleReassignBranchToArea(branch.id, targetAreaId);
      const targetArea = areas.find(a => a.id === targetAreaId);
      Swal.fire({
        icon: 'success',
        title: 'Branch Reassigned',
        text: `${branch.code} has been assigned to ${targetArea?.name_en || targetAreaId}.`,
        timer: 1600,
        showConfirmButton: false
      });
    }
  };

  const toggleExpandArea = (areaId: string) => {
    setExpandedAreaId(prev => (prev === areaId ? null : areaId));
  };

  const handleOpenEditArea = (area: OperationalArea) => {
    setEditingArea(area);
    setEditAreaCode(area.code);
    setEditAreaNameEn(area.name_en);
    setEditAreaSupervisorId(area.supervisor_id);
    setEditAreaDesc(area.description || '');
    setShowAddCustomSupervisor(false);
    setCustomSupervisorName('');
    setCustomSupervisorTitle('');
    setCustomSupervisorEmail('');
    setShowEditAreaModal(true);
  };

  const handleSaveEditArea = () => {
    if (!editingArea) return;
    if (!editAreaCode.trim() || !editAreaNameEn.trim()) {
      Swal.fire('Missing Information', 'Please provide both the Area Code and Area Name', 'warning');
      return;
    }

    let supervisorIdToAssign = editAreaSupervisorId;

    if (showAddCustomSupervisor) {
      if (!customSupervisorName.trim()) {
        Swal.fire('Missing Information', 'Please provide the supervisor full name', 'warning');
        return;
      }
      const newSupId = `sup-${Date.now()}`;
      const newSup: AreaSupervisor = {
        id: newSupId,
        name: customSupervisorName.trim(),
        title: customSupervisorTitle.trim() || 'Area Operations Supervisor',
        email: customSupervisorEmail.trim() || undefined,
        is_custom: true
      };
      controlCenterService.saveSupervisor(newSup);
      const updatedSupervisors = controlCenterService.getSupervisors();
      setSupervisors(updatedSupervisors);
      supervisorIdToAssign = newSupId;
    }

    const updated = controlCenterService.updateArea(editingArea.id, {
      code: editAreaCode.trim().toUpperCase(),
      name_en: editAreaNameEn.trim(),
      name_ar: editAreaNameEn.trim(),
      supervisor_id: supervisorIdToAssign,
      description: editAreaDesc.trim() || null
    });

    if (updated) {
      setAreas(controlCenterService.getAreas());
      setShowEditAreaModal(false);
      setEditingArea(null);

      const assignedSup = controlCenterService.getSupervisors().find(s => s.id === supervisorIdToAssign);

      Swal.fire({
        title: 'Area & Supervisor Updated',
        text: `${updated.name_en} is now assigned to ${assignedSup?.name || 'Supervisor'}`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    }
  };

  const handleCreateArea = () => {
    if (!newAreaCode.trim() || !newAreaNameEn.trim()) {
      Swal.fire('Missing Information', 'Please provide both the Area Code and Area Name', 'warning');
      return;
    }

    let supervisorIdToAssign = newAreaSupervisorId;

    if (showAddCustomSupervisor) {
      if (!customSupervisorName.trim()) {
        Swal.fire('Missing Information', 'Please provide the supervisor full name', 'warning');
        return;
      }
      const newSupId = `sup-${Date.now()}`;
      const newSup: AreaSupervisor = {
        id: newSupId,
        name: customSupervisorName.trim(),
        title: customSupervisorTitle.trim() || 'Area Operations Supervisor',
        email: customSupervisorEmail.trim() || undefined,
        is_custom: true
      };
      controlCenterService.saveSupervisor(newSup);
      const updatedSupervisors = controlCenterService.getSupervisors();
      setSupervisors(updatedSupervisors);
      supervisorIdToAssign = newSupId;
    }

    const created = controlCenterService.createArea({
      code: newAreaCode.trim().toUpperCase(),
      name_en: newAreaNameEn.trim(),
      name_ar: newAreaNameEn.trim(),
      supervisor_id: supervisorIdToAssign,
      description: newAreaDesc.trim() || null
    });

    setAreas(controlCenterService.getAreas());
    setShowCreateAreaModal(false);
    setNewAreaCode('');
    setNewAreaNameEn('');
    setNewAreaDesc('');
    setShowAddCustomSupervisor(false);
    setCustomSupervisorName('');
    setCustomSupervisorTitle('');
    setCustomSupervisorEmail('');

    Swal.fire({
      title: 'Area Created Successfully',
      text: `${created.name_en} has been added to the operational hierarchy`,
      icon: 'success',
      timer: 2000,
      showConfirmButton: false
    });
  };

  const handleCreateZone = () => {
    if (!newZoneCode.trim() || !newZoneNameEn.trim()) {
      Swal.fire('Missing Information', 'Please provide both the Zone Code and Zone Name', 'warning');
      return;
    }

    const created = controlCenterService.createZone({
      area_id: selectedAreaForZone,
      code: newZoneCode,
      name_en: newZoneNameEn,
      name_ar: newZoneNameEn,
      coverage_parameters: { minimum_pharmacists_on_duty: 1 },
      shift_rules: []
    });

    setZones(controlCenterService.getZones());
    setShowCreateZoneModal(false);
    setNewZoneCode('');
    setNewZoneNameEn('');

    Swal.fire({
      title: 'Zone Created Successfully',
      text: `Added ${created.name_en}`,
      icon: 'success',
      timer: 2000,
      showConfirmButton: false
    });
  };

  const handleAddShiftToZone = () => {
    if (!newShiftName.trim() || !newShiftStart || !newShiftEnd) {
      Swal.fire('Missing Information', 'Please provide the Shift Name and Working Hours', 'warning');
      return;
    }

    const targetZone = zones.find(z => z.id === selectedZoneForShift);
    if (!targetZone) return;

    const currentRules = Array.isArray(targetZone.shift_rules) ? [...targetZone.shift_rules] : [];
    const newShift = {
      id: `shift-${Date.now()}`,
      shift_name: newShiftName,
      start_time: newShiftStart,
      end_time: newShiftEnd,
      duration_hours: Number(newShiftHours),
      coverage_type: newShiftType,
      notes: newShiftNotes
    };

    currentRules.push(newShift);
    controlCenterService.updateZoneShiftRules(selectedZoneForShift, currentRules);
    setZones(controlCenterService.getZones());
    setShowAddShiftModal(false);

    setNewShiftName('');
    setNewShiftNotes('');

    Swal.fire({
      title: 'Shift Rule Added',
      text: 'Zone shift schedule has been updated successfully',
      icon: 'success',
      timer: 1500,
      showConfirmButton: false
    });
  };

  const handleDeleteShift = (zoneId: string, shiftIndex: number) => {
    const targetZone = zones.find(z => z.id === zoneId);
    if (!targetZone) return;

    const currentRules = Array.isArray(targetZone.shift_rules) ? [...targetZone.shift_rules] : [];
    currentRules.splice(shiftIndex, 1);
    controlCenterService.updateZoneShiftRules(zoneId, currentRules);
    setZones(controlCenterService.getZones());
  };

  return (
    <div className="space-y-6">
      {/* ── Section Header ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200">
              <Layers className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Operational Areas, Zones & Shift Schedules
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Operational Hierarchy: Manage supervisory areas, assigned leaders, operational zones, and duty shift tables
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={() => setShowCreateAreaModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-700 text-white text-xs font-bold shadow-sm shadow-red-700/20 hover:bg-red-800 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create New Area</span>
          </button>
        )}
      </div>

      {/* ── KPI Ribbon ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Operational Areas</span>
            <Building2 className="w-4 h-4 text-red-700" />
          </div>
          <p className="text-2xl font-black text-slate-950 mt-2">{areas.length}</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Area 1 & Area 2 + Dynamic Extensions</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Operational Zones</span>
            <MapPin className="w-4 h-4 text-red-700" />
          </div>
          <p className="text-2xl font-black text-slate-950 mt-2">{zones.length}</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Workforce Coverage Clusters</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Assigned Pharmacies</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-950 mt-2">{branches.length}</p>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">100% Network Coverage</p>
        </div>
      </div>

      {/* ── Areas & Zones Listing ─────────────────────────────── */}
      <div className="space-y-4">
        {areas.map(area => {
          const areaBranches = branchesByArea.get(area.id) || [];
          const areaZones = zones.filter(z => z.area_id === area.id);
          const supervisor = supervisors.find(s => s.id === area.supervisor_id);
          const isExpanded = expandedAreaId === area.id;

          return (
            <div
              key={area.id}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all"
            >
              {/* Area Card Header */}
              <div
                onClick={() => toggleExpandArea(area.id)}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 border-b border-slate-100 transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-red-50 text-red-700 border border-red-200/60 flex items-center justify-center font-black text-sm shrink-0">
                    {area.code.replace('AREA-', 'A')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-slate-900">{area.name_en}</h3>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                        {area.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-red-700" />
                        <strong className="text-slate-800 font-bold">{supervisor?.name || 'Unassigned Supervisor'}</strong>
                        {supervisor?.title && (
                          <span className="text-[11px] text-slate-400 font-normal">({supervisor.title})</span>
                        )}
                      </span>
                      <span>·</span>
                      <span>{areaBranches.length} Affiliated Branches</span>
                      <span>·</span>
                      <span>{areaZones.length} Operational Zones</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleOpenEditArea(area);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-900 text-xs font-bold transition-all border border-red-200/60 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        title="Edit Area Details & Assign Real Supervisor"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-red-700" />
                        <span>Edit Area</span>
                      </button>

                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedAreaForZone(area.id);
                          setShowCreateZoneModal(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 text-xs font-bold transition-all border border-slate-200 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Add Zone</span>
                      </button>
                    </>
                  )}
                  <div className="p-2 rounded-lg text-slate-400 hover:text-slate-700">
                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </div>
                </div>
              </div>

              {/* Area Body: Zones & Shift Schedules */}
              {isExpanded && (
                <div className="p-5 bg-slate-50/50 space-y-5">
                  {/* Affiliated Pharmacies Badges */}
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                          Affiliated Network Branches ({areaBranches.length} Branches)
                        </p>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200/60">
                          Supervised Territory
                        </span>
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleOpenManageBranches(area);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/80 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                          title="Open branch assignment manager to reassign pharmacies"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-red-700" />
                          <span>Manage / Reassign Branches</span>
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {areaBranches.map(b => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleQuickReassignBranch(b, area);
                          }}
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 shadow-2xs hover:border-red-300 hover:text-red-700 hover:bg-red-50/30 transition-all ${
                            canEdit ? 'cursor-pointer group' : ''
                          }`}
                          title={canEdit ? `Click to quickly reassign ${b.name} to another area` : undefined}
                        >
                          <Building2 className="w-3 h-3 text-red-700" />
                          <span className="text-slate-900 font-black">{b.code}</span>
                          <span className="text-slate-500">· {b.name.replace('Tabarak Pharmacy - ', '')}</span>
                          {canEdit && (
                            <ArrowRightLeft className="w-2.5 h-2.5 text-slate-400 group-hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                          )}
                        </button>
                      ))}
                      {areaBranches.length === 0 && (
                        <div className="p-3 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400 w-full">
                          No branches currently assigned to this area. Click "Manage / Reassign Branches" to assign branches.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Zones List & Shift Schedule Tables */}
                  <div className="space-y-4 pt-2 border-t border-slate-200">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Operational Zones & Duty Shift Coverage
                    </p>

                    {areaZones.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400">
                        No operational zones created for this area yet. Click "+ Add Zone" to create one.
                      </div>
                    ) : (
                      areaZones.map(zone => {
                        const shiftRules = Array.isArray(zone.shift_rules) ? zone.shift_rules : [];

                        return (
                          <div
                            key={zone.id}
                            className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3"
                          >
                            {/* Zone Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-700" />
                                <h4 className="text-xs font-black text-slate-900">{zone.name_en}</h4>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  {zone.code}
                                </span>
                              </div>

                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedZoneForShift(zone.id);
                                    setShowAddShiftModal(true);
                                  }}
                                  className="px-2.5 py-1 rounded-md bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 text-[11px] font-bold flex items-center gap-1 transition-all"
                                >
                                  <Clock className="w-3 h-3" />
                                  <span>+ Add Shift Rule</span>
                                </button>
                              )}
                            </div>

                            {/* Zone Shift Schedule Table */}
                            <div>
                              <div className="text-[11px] font-black text-slate-700 mb-2 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-red-700" />
                                <span>Duty Shift Schedule Table</span>
                              </div>

                              {shiftRules.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">
                                  No shift rules scheduled for this zone yet. Click "+ Add Shift Rule" to configure operating hours.
                                </p>
                              ) : (
                                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                                      <tr>
                                        <th className="px-3 py-2">Shift Name</th>
                                        <th className="px-3 py-2">Operating Window</th>
                                        <th className="px-3 py-2">Duration</th>
                                        <th className="px-3 py-2">Coverage Type</th>
                                        <th className="px-3 py-2">Notes</th>
                                        {canEdit && <th className="px-3 py-2 text-right">Actions</th>}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                                      {shiftRules.map((shift: any, sIdx: number) => (
                                        <tr key={sIdx} className="hover:bg-slate-50/50">
                                          <td className="px-3 py-2.5 font-bold text-slate-950">
                                            {shift.shift_name}
                                          </td>
                                          <td className="px-3 py-2.5 tabular-nums text-slate-700 font-semibold">
                                            {shift.start_time} - {shift.end_time}
                                          </td>
                                          <td className="px-3 py-2.5 tabular-nums">
                                            {shift.duration_hours} Hours
                                          </td>
                                          <td className="px-3 py-2.5">
                                            <span
                                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                                shift.coverage_type === 'full_day_24h'
                                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                                  : shift.coverage_type === 'weekend_on_call'
                                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                              }`}
                                            >
                                              {shift.coverage_type === 'full_day_24h'
                                                ? '24-Hour Continuous'
                                                : shift.coverage_type === 'weekend_on_call'
                                                ? 'Weekend On-Call'
                                                : 'Standard Daily'}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2.5 text-slate-500 text-[11px]">
                                            {shift.notes || '—'}
                                          </td>
                                          {canEdit && (
                                            <td className="px-3 py-2.5 text-right">
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteShift(zone.id, sIdx)}
                                                className="p-1 rounded text-slate-400 hover:text-red-600 transition-colors"
                                                title="Delete Shift Rule"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </td>
                                          )}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Modal: Edit Area & Supervisor Modal ──────────────────────── */}
      {showEditAreaModal && editingArea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-4xl w-full p-6 space-y-4 text-slate-900 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-700 flex items-center justify-center font-black text-xs border border-red-200/60 shrink-0">
                  {editingArea.code.replace('AREA-', 'A')}
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Edit Operational Area & Supervisor</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Reassign leadership or update territory parameters for {editingArea.code}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditAreaModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs font-bold">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1">Area Code</label>
                  <input
                    type="text"
                    value={editAreaCode}
                    onChange={e => setEditAreaCode(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1">Area Name (English)</label>
                  <input
                    type="text"
                    value={editAreaNameEn}
                    onChange={e => setEditAreaNameEn(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700">Assigned Area Supervisor</label>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomSupervisor(prev => !prev)}
                    className="text-[11px] font-bold text-red-700 hover:text-red-900 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {showAddCustomSupervisor ? 'Select Registered Supervisor' : '+ Register Custom Supervisor'}
                  </button>
                </div>

                {!showAddCustomSupervisor ? (
                  <select
                    value={editAreaSupervisorId}
                    onChange={e => setEditAreaSupervisorId(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20 bg-white"
                  >
                    {supervisors.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.title}){s.email ? ` · ${s.email}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/40 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-red-900 text-[11px] font-bold">
                      <ShieldCheck className="w-3.5 h-3.5 text-red-700" />
                      <span>Register & Assign New Supervisor</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Supervisor Full Name (e.g. Dr. Ahmed Al-Hashimi)"
                      value={customSupervisorName}
                      onChange={e => setCustomSupervisorName(e.target.value)}
                      className="w-full h-8.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-600"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Job Title (e.g. Senior Area Supervisor)"
                        value={customSupervisorTitle}
                        onChange={e => setCustomSupervisorTitle(e.target.value)}
                        className="w-full h-8.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-600"
                      />
                      <input
                        type="email"
                        placeholder="Email (e.g. supervisor@tabarak.com)"
                        value={customSupervisorEmail}
                        onChange={e => setCustomSupervisorEmail(e.target.value)}
                        className="w-full h-8.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-600"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Operational Description & Geographic Notes</label>
                <textarea
                  rows={2}
                  placeholder="Territory boundaries, major landmarks, and branch distribution..."
                  value={editAreaDesc}
                  onChange={e => setEditAreaDesc(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEditAreaModal(false)}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditArea}
                className="px-4 py-2 rounded-lg bg-red-700 text-white font-bold text-xs hover:bg-red-800 shadow-sm cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 1: Create Area Modal ───────────────────────── */}
      {showCreateAreaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-4xl w-full p-6 space-y-4 text-slate-900 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900">+ Create Operational Area</h3>
              <button
                type="button"
                onClick={() => setShowCreateAreaModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-bold">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1">Area Code</label>
                  <input
                    type="text"
                    placeholder="e.g. AREA-3"
                    value={newAreaCode}
                    onChange={e => setNewAreaCode(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1">Area Name (English)</label>
                  <input
                    type="text"
                    placeholder="e.g. Area 3 (Central District)"
                    value={newAreaNameEn}
                    onChange={e => setNewAreaNameEn(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700">Assigned Area Supervisor</label>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomSupervisor(prev => !prev)}
                    className="text-[11px] font-bold text-red-700 hover:text-red-900 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {showAddCustomSupervisor ? 'Select Registered Supervisor' : '+ Register Custom Supervisor'}
                  </button>
                </div>

                {!showAddCustomSupervisor ? (
                  <select
                    value={newAreaSupervisorId}
                    onChange={e => setNewAreaSupervisorId(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20 bg-white"
                  >
                    {supervisors.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.title}){s.email ? ` · ${s.email}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/40 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-red-900 text-[11px] font-bold">
                      <ShieldCheck className="w-3.5 h-3.5 text-red-700" />
                      <span>Register & Assign New Supervisor</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Supervisor Full Name (e.g. Dr. Ahmed Al-Hashimi)"
                      value={customSupervisorName}
                      onChange={e => setCustomSupervisorName(e.target.value)}
                      className="w-full h-8.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-600"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Job Title (e.g. Senior Area Supervisor)"
                        value={customSupervisorTitle}
                        onChange={e => setCustomSupervisorTitle(e.target.value)}
                        className="w-full h-8.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-600"
                      />
                      <input
                        type="email"
                        placeholder="Email (e.g. supervisor@tabarak.com)"
                        value={customSupervisorEmail}
                        onChange={e => setCustomSupervisorEmail(e.target.value)}
                        className="w-full h-8.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-600"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Operational Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Territory boundaries, major landmarks, and branch distribution..."
                  value={newAreaDesc}
                  onChange={e => setNewAreaDesc(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreateAreaModal(false)}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateArea}
                className="px-4 py-2 rounded-lg bg-red-700 text-white font-bold text-xs hover:bg-red-800 shadow-sm cursor-pointer"
              >
                Confirm Creation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2: Create Zone Modal ────────────────────────── */}
      {showCreateZoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-3xl w-full p-6 space-y-4 text-slate-900 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900">+ Add Operational Zone</h3>
              <button
                type="button"
                onClick={() => setShowCreateZoneModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-slate-700 mb-1">Zone Code</label>
                <input
                  type="text"
                  placeholder="e.g. ZONE-1C"
                  value={newZoneCode}
                  onChange={e => setNewZoneCode(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Zone Name</label>
                <input
                  type="text"
                  placeholder="e.g. Zone 1C - Seef & Financial Harbor"
                  value={newZoneNameEn}
                  onChange={e => setNewZoneNameEn(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreateZoneModal(false)}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateZone}
                className="px-4 py-2 rounded-lg bg-red-700 text-white font-bold text-xs hover:bg-red-800 shadow-sm"
              >
                Save Zone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 3: Add Shift to Zone Modal ──────────────────── */}
      {showAddShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-3xl w-full p-6 space-y-4 text-slate-900 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900">+ Add Duty Shift Rule</h3>
              <button
                type="button"
                onClick={() => setShowAddShiftModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-slate-700 mb-1">Shift Name</label>
                <input
                  type="text"
                  placeholder="e.g. Evening Peak Shift"
                  value={newShiftName}
                  onChange={e => setNewShiftName(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1">Start Time (From)</label>
                  <input
                    type="time"
                    value={newShiftStart}
                    onChange={e => setNewShiftStart(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1">End Time (To)</label>
                  <input
                    type="time"
                    value={newShiftEnd}
                    onChange={e => setNewShiftEnd(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1">Duration (Hours)</label>
                  <input
                    type="number"
                    value={newShiftHours}
                    onChange={e => setNewShiftHours(Number(e.target.value))}
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1">Coverage Pattern</label>
                  <select
                    value={newShiftType}
                    onChange={e => setNewShiftType(e.target.value as any)}
                    className="w-full h-9 rounded-lg border border-slate-200 px-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20 bg-white"
                  >
                    <option value="regular">Standard Daily</option>
                    <option value="weekend_on_call">Weekend On-Call</option>
                    <option value="full_day_24h">24-Hour Continuous</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Coverage Notes & Dispatch Instructions</label>
                <input
                  type="text"
                  placeholder="e.g. Prioritize high-volume delivery dispatch and central refills"
                  value={newShiftNotes}
                  onChange={e => setNewShiftNotes(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddShiftModal(false)}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddShiftToZone}
                className="px-4 py-2 rounded-lg bg-red-700 text-white font-bold text-xs hover:bg-red-800 shadow-sm"
              >
                Add Shift Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 4: Manage & Reassign Affiliated Network Branches (Wide-Width max-w-5xl Layout) ──────────── */}
      {showManageBranchesModal && selectedAreaForBranches && (() => {
        const otherAreas = areas.filter(a => a.id !== selectedAreaForBranches.id);
        const q = branchSearchQuery.trim().toLowerCase();

        // Branches in this area
        const currentBranches = branches.filter(b => {
          const assigned = branchAreaMap[b.id] || areas[0]?.id;
          return assigned === selectedAreaForBranches.id;
        });

        // Branches in other areas
        const otherBranches = branches.filter(b => {
          const assigned = branchAreaMap[b.id] || areas[0]?.id;
          return assigned !== selectedAreaForBranches.id;
        });

        const filteredCurrent = currentBranches.filter(b =>
          !q || b.code.toLowerCase().includes(q) || b.name.toLowerCase().includes(q) || (b.city && b.city.toLowerCase().includes(q))
        );

        const filteredOther = otherBranches.filter(b =>
          !q || b.code.toLowerCase().includes(q) || b.name.toLowerCase().includes(q) || (b.city && b.city.toLowerCase().includes(q))
        );

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-5xl w-full flex flex-col max-h-[92vh] overflow-hidden text-slate-900">
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/70 shrink-0">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-red-700 text-white flex items-center justify-center font-black text-base shadow-md shadow-red-700/20 shrink-0">
                    <ArrowRightLeft className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-slate-950">Manage Affiliated Network Branches</h3>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200 uppercase">
                        {selectedAreaForBranches.code}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Assign, transfer, or reallocate pharmacies for <strong>{selectedAreaForBranches.name_en}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowManageBranchesModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                  title="Close Window"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search & Statistics Bar */}
              <div className="p-4 sm:p-5 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by branch code, name, city, or district..."
                    value={branchSearchQuery}
                    onChange={e => setBranchSearchQuery(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200 pl-10 pr-4 text-xs font-semibold text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600 transition-all"
                  />
                  {branchSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setBranchSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 shrink-0">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {currentBranches.length} in {selectedAreaForBranches.code}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                    {otherBranches.length} in Other Areas
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200">
                    {branches.length} Total Branches
                  </span>
                </div>
              </div>

              {/* Dual-Column Main Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-5 custom-scrollbar bg-slate-50/40">
                {/* Left Column: Currently Affiliated Branches */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col overflow-hidden">
                  <div className="p-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        Currently Affiliated ({filteredCurrent.length})
                      </h4>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">
                      Belongs to {selectedAreaForBranches.name_en}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[440px] custom-scrollbar">
                    {filteredCurrent.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400 font-medium">
                        {branchSearchQuery
                          ? 'No matching branches found in this area.'
                          : 'No branches currently assigned to this operational area.'}
                      </div>
                    ) : (
                      filteredCurrent.map(branch => {
                        return (
                          <div
                            key={branch.id}
                            className="p-3 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-2xs transition-all flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center justify-center font-black text-xs shrink-0">
                                {branch.code}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-black text-slate-900 truncate">
                                  {branch.name}
                                </p>
                                <p className="text-[11px] text-slate-400 font-medium truncate">
                                  {branch.city || branch.regionName || 'Operational Branch'}
                                </p>
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-1.5">
                              {otherAreas.length === 1 ? (
                                <button
                                  type="button"
                                  onClick={() => handleReassignBranchToArea(branch.id, otherAreas[0].id)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-700 text-[11px] font-bold border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                                  title={`Transfer ${branch.code} to ${otherAreas[0].name_en}`}
                                >
                                  <span>Transfer to {otherAreas[0].code}</span>
                                  <ArrowRightLeft className="w-3 h-3" />
                                </button>
                              ) : (
                                <select
                                  defaultValue=""
                                  onChange={e => {
                                    if (e.target.value) {
                                      handleReassignBranchToArea(branch.id, e.target.value);
                                      e.target.value = '';
                                    }
                                  }}
                                  className="text-[11px] font-bold px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 focus:outline-none"
                                >
                                  <option value="" disabled>Move to...</option>
                                  {otherAreas.map(oa => (
                                    <option key={oa.id} value={oa.id}>
                                      {oa.name_en} ({oa.code})
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Column: Available in Other Areas */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col overflow-hidden">
                  <div className="p-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        Available in Other Areas ({filteredOther.length})
                      </h4>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">
                      Click to transfer into this area
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[440px] custom-scrollbar">
                    {filteredOther.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400 font-medium">
                        {branchSearchQuery
                          ? 'No matching branches found in other areas.'
                          : 'All network branches are already assigned to this area.'}
                      </div>
                    ) : (
                      filteredOther.map(branch => {
                        const currentAssignedAreaId = branchAreaMap[branch.id] || areas[0]?.id;
                        const currentAssignedArea = areas.find(a => a.id === currentAssignedAreaId);

                        return (
                          <div
                            key={branch.id}
                            className="p-3 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-2xs transition-all flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center font-black text-xs shrink-0">
                                {branch.code}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-black text-slate-900 truncate">
                                  {branch.name}
                                </p>
                                <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5 truncate">
                                  <span>Currently in:</span>
                                  <strong className="text-slate-600 font-bold">
                                    {currentAssignedArea?.name_en || currentAssignedArea?.code || 'Area 1'}
                                  </strong>
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleReassignBranchToArea(branch.id, selectedAreaForBranches.id)}
                              className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-[11px] font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                              title={`Assign ${branch.code} to ${selectedAreaForBranches.name_en}`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>+ Assign Here</span>
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
                <p className="text-xs text-slate-500 font-medium">
                  Changes take effect immediately and are saved to the operational database.
                </p>
                <button
                  type="button"
                  onClick={() => setShowManageBranchesModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                >
                  Done / Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
