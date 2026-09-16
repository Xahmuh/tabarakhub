import React, { useState, useEffect } from 'react';
import {
  X, Plus, Building2, ShieldCheck, UserCheck, FileText,
  AlertTriangle, Upload, Save, CheckCircle2, Search, Truck, Banknote,
  Clock, Sparkles
} from 'lucide-react';
import {
  OperationalRenewalRecord,
  OperationalRenewalInput,
  OperationalRenewalType,
  OperationalEntityType,
  Vehicle,
  RenewalCostCenter,
  WPDurationMonths
} from '../../types';
import { workforceService, Employee } from '../../services/workforceService';
import { crService, RegisteredCr } from '../../services/crService';
import { expenseService } from '../../services/expenseService';
import {
  operationalRenewalService,
  DEFAULT_RENEWAL_TARIFFS,
  resolveSmartCostCenter,
  calculateDefaultPaymentDate,
  lookupTariff
} from '../../services/operationalRenewalService';

interface RenewalFormModalProps {
  editRecord?: OperationalRenewalRecord | null;
  currentUser?: { id?: string; name?: string; code?: string };
  onClose: () => void;
  onSaved: (record: OperationalRenewalRecord) => void;
}

const NHRA_PHARMACY_LICENSE_TYPES = [
  'NHRA Pharmacy License',
  'NHRA Branch License',
  'NHRA Facility License',
  'NHRA Retail Pharmacy Permit'
];

const NHRA_PHARMACIST_LICENSE_TYPES = [
  'NHRA Pharmacist License',
  'NHRA Assistant Pharmacist License',
  'NHRA Professional Practice License'
];

export const RenewalFormModal: React.FC<RenewalFormModalProps> = ({
  editRecord,
  currentUser,
  onClose,
  onSaved
}) => {
  const [renewalType, setRenewalType] = useState<OperationalRenewalType>(editRecord?.renewalType || 'WORK_PERMIT');
  const [entityType, setEntityType] = useState<OperationalEntityType>(editRecord?.entityType || 'EMPLOYEE');
  const [entityId, setEntityId] = useState<string>(editRecord?.entityId || '');
  const [entityName, setEntityName] = useState<string>(editRecord?.entityName || '');
  const [documentType, setDocumentType] = useState<string>(editRecord?.documentType || 'Employee Work Permit');
  const [documentNumber, setDocumentNumber] = useState<string>(editRecord?.documentNumber || '');
  const [issueDate, setIssueDate] = useState<string>(editRecord?.issueDate || '');
  const [expiryDate, setExpiryDate] = useState<string>(editRecord?.expiryDate || '');
  const [notes, setNotes] = useState<string>(editRecord?.notes || '');
  const [metadata, setMetadata] = useState<Record<string, any>>(editRecord?.metadata || {});

  // Duration State for Work Permits (6 / 12 / 24 months)
  const [renewalDurationMonths, setRenewalDurationMonths] = useState<WPDurationMonths>(
    (editRecord?.renewalDurationMonths as WPDurationMonths) || 12
  );
  const [matchedTariffInfo, setMatchedTariffInfo] = useState<string | null>(null);

  // Cost Center & Financial Budget State
  const [costCenterCode, setCostCenterCode] = useState<string>(editRecord?.costCenterCode || '');
  const [costCenterName, setCostCenterName] = useState<string>(editRecord?.costCenterName || '');
  const [estimatedCost, setEstimatedCost] = useState<number>(() => {
    if (editRecord?.estimatedCost !== undefined) return editRecord.estimatedCost;
    const initialLookup = operationalRenewalService.lookupTariff({
      renewalType: editRecord?.renewalType || 'WORK_PERMIT',
      durationMonths: (editRecord?.renewalDurationMonths as WPDurationMonths) || 12,
      entityName: editRecord?.entityName,
      documentNumber: editRecord?.documentNumber,
      branchCode: editRecord?.costCenterCode
    });
    return initialLookup.cost;
  });
  const [plannedPaymentDate, setPlannedPaymentDate] = useState<string>(editRecord?.plannedPaymentDate || '');
  const [paymentStatus, setPaymentStatus] = useState<any>(editRecord?.paymentStatus || 'UNPAID');

  // Master data state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [crs, setCrs] = useState<RegisteredCr[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [costCenters, setCostCenters] = useState<RenewalCostCenter[]>([]);
  const [loadingMaster, setLoadingMaster] = useState(true);

  // Search filter for dropdowns
  const [empSearch, setEmpSearch] = useState('');
  const [initialFile, setInitialFile] = useState<File | null>(null);

  // Duplicate warning
  const [duplicateWarning, setDuplicateWarning] = useState<OperationalRenewalRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Smart Tariff Auto-matching Helper
  const applyTariff = (
    type: OperationalRenewalType,
    duration?: WPDurationMonths,
    entName?: string,
    docNo?: string,
    brCode?: string
  ) => {
    const res = operationalRenewalService.lookupTariff({
      renewalType: type,
      durationMonths: duration !== undefined ? duration : (type === 'WORK_PERMIT' ? renewalDurationMonths : undefined),
      entityName: entName ?? entityName,
      documentNumber: docNo ?? documentNumber,
      branchCode: brCode ?? costCenterCode
    });

    setEstimatedCost(res.cost);
    setMatchedTariffInfo(`${res.ruleLabel}: ${res.cost.toFixed(3)} BHD`);
  };

  useEffect(() => {
    let mounted = true;
    setLoadingMaster(true);
    Promise.all([
      workforceService.getAllEmployees(),
      crService.list(),
      expenseService.vehicles.list(true).catch(() => []),
      operationalRenewalService.listCostCenters().catch(() => [])
    ]).then(([empList, crList, vehList, ccList]) => {
      if (!mounted) return;
      setEmployees(empList);
      setCrs(crList);
      setVehicles(vehList);
      setCostCenters(ccList);
      setLoadingMaster(false);
    }).catch(err => {
      console.warn('Error loading master data in modal:', err);
      if (mounted) setLoadingMaster(false);
    });

    return () => { mounted = false; };
  }, []);

  // When renewalType changes in creation mode, set reasonable defaults
  const handleTypeChange = (type: OperationalRenewalType) => {
    setRenewalType(type);
    setDuplicateWarning(null);

    const dur = type === 'WORK_PERMIT' ? renewalDurationMonths : undefined;
    applyTariff(type, dur);

    if (type === 'WORK_PERMIT') {
      setEntityType('EMPLOYEE');
      setDocumentType('Employee Work Permit');
    } else if (type === 'NHRA_PHARMACY' || type === 'NHRA') {
      setEntityType('BRANCH');
      setDocumentType('NHRA Pharmacy License');
    } else if (type === 'NHRA_PHARMACIST') {
      setEntityType('EMPLOYEE');
      setDocumentType('NHRA Pharmacist License');
    } else if (type === 'CR') {
      setEntityType('COMPANY');
      setDocumentType('Commercial Registration');
    } else if (type === 'CHAMBER_OF_COMMERCE') {
      setEntityType('COMPANY');
      setDocumentType('Chamber of Commerce Membership (BCCI)');
    } else if (type === 'FLEET_VEHICLE') {
      setEntityType('VEHICLE');
      setDocumentType('Vehicle Registration & Insurance');
    } else {
      setEntityType('OTHER');
      setDocumentType('Operational Document');
    }
  };

  // Handle Work Permit Duration Change
  const handleDurationChange = (dur: WPDurationMonths) => {
    setRenewalDurationMonths(dur);
    setMetadata(prev => ({ ...prev, manualDurationOverride: true }));
    applyTariff('WORK_PERMIT', dur);
  };

  // Handle vehicle selection
  const handleSelectVehicle = (vehId: string) => {
    const veh = vehicles.find(v => v.id === vehId);
    if (!veh) return;

    const opName = `${veh.vehicleCode} (${veh.plateNumber || 'No Plate'}) — ${veh.vehicleType || 'Vehicle'}`;
    const docNo = veh.plateNumber || `VEH-${veh.vehicleCode}`;

    setEntityId(veh.id);
    setEntityName(opName);
    setDocumentNumber(docNo);
    setDocumentType('Vehicle Registration & Insurance');
    if (veh.registrationExpiryDate) {
      setExpiryDate(veh.registrationExpiryDate);
    }
    setNotes(`Vehicle Type: ${veh.vehicleType}. Ownership: ${veh.ownershipType || 'Internal'}. Plate: ${veh.plateNumber || 'N/A'}. CR: ${veh.crNumber || 'N/A'}.`);
    setMetadata({
      vehicleId: veh.id,
      vehicleCode: veh.vehicleCode,
      plateNumber: veh.plateNumber,
      vehicleType: veh.vehicleType,
      ownershipType: veh.ownershipType,
      crNumber: veh.crNumber
    });

    applyTariff('FLEET_VEHICLE', undefined, opName, docNo);
  };

  // Handle employee selection
  const handleSelectEmployee = (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    setEntityId(emp.id);

    let finalName = emp.full_name;
    let finalDoc = documentNumber;

    if (renewalType === 'NHRA_PHARMACIST') {
      finalName = `${emp.full_name} — NHRA Pharmacist`;
      setEntityName(finalName);
      const nhraNo = emp.salary_matrix?.nhraLicenseNo || (emp as any).nhra_license_no || (emp as any).license || `NHRA-PH-${emp.code}`;
      const nhraExp = emp.salary_matrix?.nhraExpiryDate || (emp as any).nhra_expiry_date;
      if (!documentNumber) {
        setDocumentNumber(nhraNo);
        finalDoc = nhraNo;
      }
      if (nhraExp && !expiryDate) setExpiryDate(nhraExp);
    } else {
      setEntityName(finalName);
      const wpDate = emp.wp_expiry_date || emp.salary_matrix?.wpExpiryDate || emp.salary_matrix?.visaExpiryDate;
      if (wpDate && !expiryDate) {
        setExpiryDate(wpDate);
      }
      const wpDoc = emp.cpr_number ? `WP-${emp.cpr_number}` : `WP-${emp.code}`;
      if (!documentNumber) {
        setDocumentNumber(wpDoc);
        finalDoc = wpDoc;
      }
    }

    setMetadata(prev => ({
      ...prev,
      employeeId: emp.id,
      employeeCode: emp.code,
      jobTitle: emp.category,
      department: emp.category === 'Pharmacist' ? 'Pharmacy' : emp.category === 'Driver' ? 'Delivery Fleet' : 'Operations',
      cprNumber: emp.cpr_number,
      passportNumber: emp.passport_number || emp.salary_matrix?.expatPp,
      nationality: emp.nationality
    }));

    // Auto-calculate tariff based on selection and duration
    applyTariff(
      renewalType,
      renewalType === 'WORK_PERMIT' ? renewalDurationMonths : undefined,
      finalName,
      finalDoc
    );

    // Check duplicate
    operationalRenewalService.checkDuplicate(renewalType, finalDoc || '', emp.id, editRecord?.id)
      .then(setDuplicateWarning)
      .catch(() => {});
  };

  // Handle CR selection
  const handleSelectCr = (crId: string) => {
    const cr = crs.find(c => c.id === crId || c.cr_number === crId);
    if (!cr) return;

    const operationalName = cr.linked_branch_name || cr.cr_name || cr.cr_name_ar || `CR ${cr.cr_number}`;
    setEntityId(cr.id || cr.cr_number);
    setEntityName(operationalName);
    setDocumentNumber(cr.cr_number);
    if (cr.expiry_date) setExpiryDate(cr.expiry_date);

    setMetadata(prev => ({
      ...prev,
      crName: cr.cr_name,
      crNameAr: cr.cr_name_ar,
      operationalBranchName: cr.linked_branch_name,
      isMaster: cr.is_master,
      parentCrNumber: cr.parent_cr_number,
      taxNumber: cr.tax_number,
      phone: cr.phone
    }));

    // Auto-calculate tariff with CR override checks
    applyTariff(
      renewalType,
      undefined,
      operationalName,
      cr.cr_number,
      cr.linked_branch_name
    );

    operationalRenewalService.checkDuplicate(renewalType, cr.cr_number, cr.id, editRecord?.id)
      .then(setDuplicateWarning)
      .catch(() => {});
  };

  // Real-time duplicate check when document number changes
  const handleDocumentNumberChange = (val: string) => {
    setDocumentNumber(val);
    if (val.trim().length >= 4) {
      operationalRenewalService.checkDuplicate(renewalType, val.trim(), entityId, editRecord?.id)
        .then(setDuplicateWarning)
        .catch(() => {});
    } else {
      setDuplicateWarning(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityName.trim() || !documentNumber.trim() || !expiryDate) {
      setErrorMsg('Entity Name, Document Number, and Expiry Date are required.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      const payload: OperationalRenewalInput = {
        renewalType,
        entityType,
        entityId: entityId || undefined,
        entityName: entityName.trim(),
        documentType: documentType.trim(),
        documentNumber: documentNumber.trim(),
        issueDate: issueDate || undefined,
        expiryDate,
        renewalStatus: 'NOT_STARTED',
        notes: notes.trim() || undefined,
        metadata,
        costCenterCode: costCenterCode || undefined,
        costCenterName: costCenterName || undefined,
        estimatedCost: Number(estimatedCost) || 0,
        plannedPaymentDate: plannedPaymentDate || undefined,
        paymentStatus: paymentStatus || 'UNPAID',
        renewalDurationMonths: renewalType === 'WORK_PERMIT' ? renewalDurationMonths : undefined
      };

      let savedRecord: OperationalRenewalRecord;
      if (editRecord) {
        savedRecord = await operationalRenewalService.update(editRecord.id, payload, currentUser);
      } else {
        savedRecord = await operationalRenewalService.create(payload, currentUser, true);
      }

      // Initial file upload if provided
      if (initialFile) {
        try {
          await operationalRenewalService.uploadAttachment(
            savedRecord.id,
            initialFile,
            currentUser,
            'Initial document attached during record creation'
          );
        } catch (fileErr) {
          console.warn('Initial file upload warning:', fileErr);
        }
      }

      onSaved(savedRecord);
    } catch (err: any) {
      console.error('Save failed:', err);
      setErrorMsg(err?.message || 'Failed to save renewal record.');
    } finally {
      setSaving(false);
    }
  };

  const filteredEmployees = employees.filter(e =>
    !empSearch ||
    e.full_name.toLowerCase().includes(empSearch.toLowerCase()) ||
    e.code.toLowerCase().includes(empSearch.toLowerCase()) ||
    (e.cpr_number && e.cpr_number.includes(empSearch))
  );

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-5xl md:max-w-6xl w-full p-6 md:p-8 shadow-2xl border border-slate-100 space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-brand/10 text-brand rounded-xl">
                {renewalType === 'CR' ? <Building2 className="h-5 w-5" /> :
                 renewalType === 'NHRA_PHARMACY' ? <ShieldCheck className="h-5 w-5" /> :
                 renewalType === 'NHRA_PHARMACIST' ? <UserCheck className="h-5 w-5" /> :
                 renewalType === 'WORK_PERMIT' ? <UserCheck className="h-5 w-5" /> :
                 renewalType === 'FLEET_VEHICLE' ? <Truck className="h-5 w-5" /> :
                 <FileText className="h-5 w-5" />}
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {editRecord ? 'Edit Operational Renewal Record' : 'Add New Operational Renewal'}
                </h3>
                <p className="text-xs text-slate-500">
                  {editRecord ? `Update details for ${editRecord.entityName}` : 'Create a monitored expiry record for compliance tracking'}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Renewal Type Selector Tabs */}
        {!editRecord && (
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
              Select Renewal Type *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange('NHRA_PHARMACY')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  renewalType === 'NHRA_PHARMACY' || renewalType === 'NHRA'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <ShieldCheck className={`h-4 w-4 mb-1.5 ${renewalType === 'NHRA_PHARMACY' || renewalType === 'NHRA' ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span className="text-xs font-black block">NHRA Pharmacy</span>
                <span className="text-[10px] opacity-70">Pharmacy Facilities</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('NHRA_PHARMACIST')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  renewalType === 'NHRA_PHARMACIST'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <UserCheck className={`h-4 w-4 mb-1.5 ${renewalType === 'NHRA_PHARMACIST' ? 'text-teal-400' : 'text-slate-400'}`} />
                <span className="text-xs font-black block">NHRA Pharmacist</span>
                <span className="text-[10px] opacity-70">Pharmacist Staff</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('CR')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  renewalType === 'CR'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <Building2 className={`h-4 w-4 mb-1.5 ${renewalType === 'CR' ? 'text-blue-400' : 'text-slate-400'}`} />
                <span className="text-xs font-black block">Commercial Reg</span>
                <span className="text-[10px] opacity-70">Commercial Reg</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('CHAMBER_OF_COMMERCE')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  renewalType === 'CHAMBER_OF_COMMERCE'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <Building2 className={`h-4 w-4 mb-1.5 ${renewalType === 'CHAMBER_OF_COMMERCE' ? 'text-sky-400' : 'text-slate-400'}`} />
                <span className="text-xs font-black block">Chamber (BCCI)</span>
                <span className="text-[10px] opacity-70">Chamber of Commerce</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('WORK_PERMIT')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  renewalType === 'WORK_PERMIT'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <UserCheck className={`h-4 w-4 mb-1.5 ${renewalType === 'WORK_PERMIT' ? 'text-amber-400' : 'text-slate-400'}`} />
                <span className="text-xs font-black block">Work Permit</span>
                <span className="text-[10px] opacity-70">LMRA Permits</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('FLEET_VEHICLE')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  renewalType === 'FLEET_VEHICLE'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <Truck className={`h-4 w-4 mb-1.5 ${renewalType === 'FLEET_VEHICLE' ? 'text-amber-400' : 'text-slate-400'}`} />
                <span className="text-xs font-black block">Fleet Vehicle</span>
                <span className="text-[10px] opacity-70">Fleet & Logistics</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('OTHER')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  renewalType === 'OTHER'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <FileText className={`h-4 w-4 mb-1.5 ${renewalType === 'OTHER' ? 'text-purple-400' : 'text-slate-400'}`} />
                <span className="text-xs font-black block">Other Document</span>
                <span className="text-[10px] opacity-70">Custom Expiries</span>
              </button>
            </div>
          </div>
        )}

        {/* Duplicate Warning Alert */}
        {duplicateWarning && (
          <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 space-y-1">
            <div className="flex items-center gap-2 font-black">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>A similar active renewal already exists!</span>
            </div>
            <p className="text-[11px] text-amber-800">
              Record: <strong>{duplicateWarning.entityName}</strong> — {duplicateWarning.documentType} ({duplicateWarning.documentNumber}).
              Expires on: <strong>{duplicateWarning.expiryDate}</strong> ({duplicateWarning.daysRemaining} days remaining).
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dynamic Section: WORK PERMIT */}
          {renewalType === 'WORK_PERMIT' && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-brand" />
                  Select Existing Employee *
                </span>
                <span className="text-[10px] text-slate-500">Auto-populates staff details</span>
              </div>

              <div>
                <select
                  value={entityId}
                  onChange={e => handleSelectEmployee(e.target.value)}
                  className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                >
                  <option value="">-- Choose Employee from Directory --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.code}) — {emp.category} {emp.cpr_number ? `· CPR: ${emp.cpr_number}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {metadata.employeeCode && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/60 text-[11px]">
                  <div>
                    <span className="text-slate-400 block font-semibold">Staff Code:</span>
                    <span className="font-bold text-slate-800">{metadata.employeeCode}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Job Title:</span>
                    <span className="font-bold text-slate-800">{metadata.jobTitle || 'Staff'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Department:</span>
                    <span className="font-bold text-slate-800">{metadata.department || 'Operations'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">CPR / Passport:</span>
                    <span className="font-bold text-slate-800">{metadata.cprNumber || metadata.passportNumber || '—'}</span>
                  </div>
                </div>
              )}

              {/* Duration Tier Selector */}
              <div className="pt-2.5 border-t border-slate-200/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    Work Permit Duration *
                  </label>
                  <span className="text-[10px] font-mono font-black text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded">
                    Selected: {renewalDurationMonths} Months Tier
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[6, 12, 24].map(dur => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => handleDurationChange(dur as WPDurationMonths)}
                      className={`p-2 rounded-xl text-center border transition-all ${
                        renewalDurationMonths === dur
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs ring-2 ring-indigo-600/20'
                          : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      <div className="text-xs font-black">{dur} Months</div>
                      <div className={`text-[9px] font-semibold mt-0.5 ${renewalDurationMonths === dur ? 'text-indigo-100' : 'text-slate-400'}`}>
                        {dur === 6 ? 'Half Year' : dur === 12 ? '1 Year' : '2 Years'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Dynamic Section: COMMERCIAL REGISTRATION & CHAMBER OF COMMERCE */}
          {(renewalType === 'CR' || renewalType === 'CHAMBER_OF_COMMERCE') && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-brand" />
                  Select Registered Group CR *
                </span>
                <span className="text-[10px] text-slate-500">Auto-populates company details</span>
              </div>

              <select
                value={entityId}
                onChange={e => handleSelectCr(e.target.value)}
                className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              >
                <option value="">-- Choose from 21 Registered Group CRs --</option>
                {crs.map(cr => (
                  <option key={cr.id} value={cr.id}>
                    {cr.cr_name || cr.cr_name_ar} (CR: {cr.cr_number}) {cr.is_master ? '★ Master' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Dynamic Section: NHRA PHARMACY LICENSE */}
          {(renewalType === 'NHRA_PHARMACY' || renewalType === 'NHRA') && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-brand" />
                  NHRA Pharmacy License Details
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  License Type *
                </label>
                <select
                  value={documentType}
                  onChange={e => setDocumentType(e.target.value)}
                  className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                >
                  {NHRA_PHARMACY_LICENSE_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Dynamic Section: NHRA PHARMACIST LICENSE */}
          {renewalType === 'NHRA_PHARMACIST' && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-brand" />
                  Select Pharmacist *
                </span>
                <span className="text-[10px] text-slate-500">Auto-populates license and staff data</span>
              </div>

              <div>
                <select
                  value={entityId}
                  onChange={e => handleSelectEmployee(e.target.value)}
                  className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                >
                  <option value="">-- Choose Pharmacist from Directory --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.code}) — {emp.category} {emp.salary_matrix?.nhraLicenseNo ? `★ NHRA: ${emp.salary_matrix.nhraLicenseNo}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  License Type *
                </label>
                <select
                  value={documentType}
                  onChange={e => setDocumentType(e.target.value)}
                  className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                >
                  {NHRA_PHARMACIST_LICENSE_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Dynamic Section: FLEET VEHICLES */}
          {renewalType === 'FLEET_VEHICLE' && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-brand" />
                  Select Registered Vehicle
                </span>
                <span className="text-[10px] text-slate-500">Auto-populates vehicle data</span>
              </div>

              <div>
                <select
                  value={entityId}
                  onChange={e => handleSelectVehicle(e.target.value)}
                  className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                >
                  <option value="">-- Choose Vehicle from Fleet --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.vehicleCode} ({v.plateNumber || 'No Plate'}) — {v.vehicleType} · {v.ownershipType || 'Internal'}
                    </option>
                  ))}
                </select>
              </div>

              {metadata.vehicleCode && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/60 text-[11px]">
                  <div>
                    <span className="text-slate-400 block font-semibold">Vehicle Code:</span>
                    <span className="font-bold text-slate-800">{metadata.vehicleCode}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Plate Number:</span>
                    <span className="font-bold text-slate-800">{metadata.plateNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Vehicle Type:</span>
                    <span className="font-bold text-slate-800">{metadata.vehicleType || 'Vehicle'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Ownership:</span>
                    <span className="font-bold text-slate-800">{metadata.ownershipType || 'Internal'}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Standard Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                Entity Name *
              </label>
              <input
                type="text"
                required
                value={entityName}
                onChange={e => setEntityName(e.target.value)}
                placeholder="e.g. Tabarak Pharmacy Jerdab or Dr. Ali Hassan"
                className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                Document Number *
              </label>
              <input
                type="text"
                required
                value={documentNumber}
                onChange={e => handleDocumentNumberChange(e.target.value)}
                placeholder="e.g. 127506-01 or WP-910284712"
                className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                Document Description / Label
              </label>
              <input
                type="text"
                value={documentType}
                onChange={e => setDocumentType(e.target.value)}
                placeholder="e.g. Commercial Registration or Work Permit"
                className="w-full text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                Issue Date
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={e => setIssueDate(e.target.value)}
                className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-rose-700 mb-1">
                Expiry Date *
              </label>
              <input
                type="date"
                required
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                className="w-full text-xs font-black text-rose-700 bg-rose-50/50 border border-rose-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-rose-500"
              />
            </div>
          </div>

          {/* Cost Center & Financial Budget Planning */}
          <div className="p-4 bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-slate-50 rounded-2xl border border-emerald-100/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">
                    Cost Center & Budget Planning
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    Assign renewal costs to branch/department and schedule payment deadline
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                ERP Finance
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
              {/* Cost Center Selector */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Cost Center
                </label>
                <select
                  value={costCenterCode}
                  onChange={e => {
                    const selCode = e.target.value;
                    setCostCenterCode(selCode);
                    const match = costCenters.find(c => c.code === selCode);
                    if (match) setCostCenterName(match.name);
                  }}
                  className="w-full text-xs font-bold text-slate-900 bg-white border border-emerald-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="">Auto-Assign / Default</option>
                  <optgroup label="🏢 Branches">
                    {costCenters.filter(c => c.type === 'BRANCH').map(c => (
                      <option key={c.id} value={c.code}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="⚖️ Regulatory & Departments">
                    {costCenters.filter(c => c.type !== 'BRANCH').map(c => (
                      <option key={c.id} value={c.code}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Estimated Renewal Fee */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Estimated Fee (BHD)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={estimatedCost}
                    onChange={e => setEstimatedCost(parseFloat(e.target.value) || 0)}
                    placeholder="0.000"
                    className="w-full text-xs font-black text-emerald-950 bg-white border border-emerald-200 rounded-xl pl-3 pr-12 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                  />
                  <span className="absolute right-3 top-2 text-[10px] font-black text-slate-500">
                    BHD
                  </span>
                </div>
                {matchedTariffInfo && (
                  <div className="mt-1 flex items-center justify-between gap-1 text-[10px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200/80 rounded-lg px-2.5 py-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span className="truncate">Auto-tariff: {matchedTariffInfo}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => applyTariff(renewalType, renewalType === 'WORK_PERMIT' ? renewalDurationMonths : undefined)}
                      className="text-[9px] text-emerald-700 hover:text-emerald-900 underline font-semibold shrink-0 cursor-pointer"
                      title="Re-apply matched tariff rule"
                    >
                      Re-apply
                    </button>
                  </div>
                )}
              </div>

              {/* Planned Payment Date */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Planned Payment Date
                </label>
                <input
                  type="date"
                  value={plannedPaymentDate}
                  onChange={e => setPlannedPaymentDate(e.target.value)}
                  className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                />
              </div>

              {/* Payment Status */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Payment Status
                </label>
                <select
                  value={paymentStatus}
                  onChange={e => setPaymentStatus(e.target.value as any)}
                  className="w-full text-xs font-black text-slate-900 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                >
                  <option value="UNPAID">🔴 Unpaid</option>
                  <option value="SCHEDULED">🟡 Scheduled</option>
                  <option value="PAID">🟢 Paid</option>
                  <option value="WAIVED">⚪ Waived</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bottom Grid: Attachments and Notes side-by-side on wide screens */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Initial Document Attachment */}
            {!editRecord ? (
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Attach Initial Document Copy (Optional)
                </label>
                <input
                  type="file"
                  onChange={e => setInitialFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer p-1 bg-slate-50 rounded-xl border border-slate-200"
                />
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800 block">Record Status</span>
                  <span className="text-[11px] text-slate-500">Managing existing monitored record</span>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-mono text-[11px] font-black text-brand">
                  {editRecord.documentNumber}
                </span>
              </div>
            )}

            {/* Operational Notes */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                Operational Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add compliance notes, portal references, or application tracking numbers..."
                className="w-full text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !entityName || !documentNumber || !expiryDate}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-black text-white bg-brand hover:bg-brand-hover rounded-xl transition-all shadow-sm disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving...' : editRecord ? 'Update Record' : 'Save Renewal Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
