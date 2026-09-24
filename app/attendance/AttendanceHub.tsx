import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Clock,
  MapPin,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Users,
  Calendar,
  FileSpreadsheet,
  Download,
  Filter,
  Search,
  RefreshCw,
  Plus,
  Sliders,
  Sparkles,
  UserCheck,
  TrendingUp,
  Award,
  ChevronRight,
  Eye,
  AlertCircle,
  FileText,
  Navigation,
  Compass,
  Check,
  X,
  Fingerprint,
  Edit3,
  Trash2
} from 'lucide-react';
import Swal from 'sweetalert2';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  AttendancePunch,
  AttendanceDailyRecord,
  AttendanceStatus,
  GeofenceValidation,
  AttendanceMonthlyReport,
  AttendancePenaltyLedger,
  StaffCategory
} from '../../types';
import { attendanceService } from '../../services/attendanceService';
import { attendancePenaltyEngine } from '../../services/attendancePenaltyEngine';
import { workforceService, Employee } from '../../services/workforceService';
import { branchService } from '../../services/branchService';
import { AttendancePenaltyConfigPanel } from './AttendancePenaltyConfigPanel';

interface Props {
  currentUserId?: string;
  currentUserRole?: string;
}

export const AttendanceHub: React.FC<Props> = ({
  currentUserId = 'admin',
  currentUserRole = 'Admin'
}) => {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<'self' | 'team' | 'reports' | 'penalties'>('self');
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);

  // General State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Self-Service Clock In / Out State
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isAcquiringGps, setIsAcquiringGps] = useState<boolean>(false);
  const [geofenceStatus, setGeofenceStatus] = useState<GeofenceValidation>('GPS_UNAVAILABLE');
  const [nearestBranch, setNearestBranch] = useState<{ branchName: string; distance: number; radius: number } | null>(null);
  const [todayRecord, setTodayRecord] = useState<AttendanceDailyRecord | null>(null);
  const [todayPunches, setTodayPunches] = useState<AttendancePunch[]>([]);
  const [isPunching, setIsPunching] = useState<boolean>(false);

  // Team Dashboard State
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [teamBranchFilter, setTeamBranchFilter] = useState<string>('ALL');
  const [teamCategoryFilter, setTeamCategoryFilter] = useState<string>('ALL');
  const [teamFingerprintFilter, setTeamFingerprintFilter] = useState<string>('ALL');
  const [teamSearchQuery, setTeamSearchQuery] = useState<string>('');
  const [dailyRecords, setDailyRecords] = useState<AttendanceDailyRecord[]>([]);
  const [registeredFingerprints, setRegisteredFingerprints] = useState<Record<string, string>>({});

  // Manual Override Modal
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [manualEmpId, setManualEmpId] = useState<string>('');
  const [manualDate, setManualDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [manualClockIn, setManualClockIn] = useState<string>('08:00');
  const [manualClockOut, setManualClockOut] = useState<string>('16:00');
  const [manualReason, setManualReason] = useState<string>('');

  // Monthly Reports State
  const [reportMonth, setReportMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [monthlyReports, setMonthlyReports] = useState<AttendanceMonthlyReport[]>([]);
  const [reportSearch, setReportSearch] = useState<string>('');
  const [reportCategoryFilter, setReportCategoryFilter] = useState<string>('ALL');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Penalties State
  const [penalties, setPenalties] = useState<AttendancePenaltyLedger[]>([]);
  const [penaltyFilterType, setPenaltyFilterType] = useState<string>('ALL');

  // Clock Ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Initial Data Load
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [empList, branchList] = await Promise.all([
        workforceService.getAllEmployees(),
        branchService.getBranches().catch(() => [])
      ]);
      setEmployees(empList);
      setBranches(branchList);
      setRegisteredFingerprints(attendanceService.getAllRegisteredFingerprints());

      const activeEmps = empList.filter(e => e.status === 'Active');
      if (activeEmps.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(activeEmps[0].id);
      }
    } catch (err) {
      console.error('Error loading initial data in AttendanceHub:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Watch GPS and geofence for self-service
  useEffect(() => {
    if (activeTab !== 'self' || !selectedEmployeeId) return;

    acquireGpsPosition();
    loadEmployeeTodayStatus(selectedEmployeeId);
  }, [activeTab, selectedEmployeeId]);

  const acquireGpsPosition = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser');
      setGeofenceStatus('GPS_UNAVAILABLE');
      return;
    }

    setIsAcquiringGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
        setGpsLocation(coords);
        setIsAcquiringGps(false);

        // Validate Geofence with employee's branch assignments
        const validation = attendanceService.validateGeofence(coords.lat, coords.lng, selectedEmployeeId);
        setGeofenceStatus(validation.validation);
        if (validation.matchedBranch) {
          setNearestBranch({
            branchName: validation.matchedBranch.name || 'Assigned Branch',
            distance: Math.round(validation.distanceMeters || 0),
            radius: validation.matchedBranch.radiusM || 50
          });
        }
      },
      err => {
        setIsAcquiringGps(false);
        setGpsError(err.message || 'Unable to retrieve location');
        setGeofenceStatus('GPS_UNAVAILABLE');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const loadEmployeeTodayStatus = async (empId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const punches = attendanceService.getAllPunches().filter(p => p.employeeId === empId && p.punchTime.startsWith(today));
    setTodayPunches(punches);

    const record = await attendanceService.computeDailyRecord(empId, today);
    setTodayRecord(record);
  };

  // Clock In Action
  const handleClockIn = async () => {
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (!emp) return;

    // Hard Geofence Restriction: Cannot punch when outside
    if (geofenceStatus === 'OUTSIDE') {
      Swal.fire({
        icon: 'error',
        title: 'Outside Geofence Area',
        html: `
          <div class="text-left text-xs space-y-2 text-slate-700">
            <p class="text-sm font-bold text-red-700">Clock-in is strictly blocked outside your assigned branch perimeter.</p>
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <div>• Assigned Branch: <b class="text-slate-950 font-black">${nearestBranch?.branchName || 'Assigned Branch'}</b></div>
              <div>• Current Distance: <b class="text-red-700 font-bold">${nearestBranch?.distance ?? 0}m</b></div>
              <div>• Allowed Radius: <b class="text-emerald-700 font-bold">${nearestBranch?.radius ?? 50}m</b></div>
            </div>
            <p class="text-slate-500 mt-2">You must be physically present inside the branch perimeter to record your attendance.</p>
          </div>
        `,
        background: '#ffffff',
        color: '#0f172a',
        confirmButtonColor: '#b91c1c',
        confirmButtonText: 'Understood'
      });
      return;
    }

    setIsPunching(true);
    try {
      const browserFp = attendanceService.captureBrowserFingerprint();
      const res = await attendanceService.clockIn(
        emp,
        gpsLocation?.lat || null,
        gpsLocation?.lng || null,
        gpsLocation?.accuracy || null,
        browserFp
      );

      await loadEmployeeTodayStatus(emp.id);

      Swal.fire({
        icon: res.punch.geofenceValidation === 'INSIDE' ? 'success' : 'warning',
        title: 'Clocked In Successfully',
        text: `Time: ${new Date(res.punch.punchTime).toLocaleTimeString()} • Geofence: ${res.punch.geofenceValidation}`,
        timer: 2500,
        showConfirmButton: false,
        background: '#ffffff',
        color: '#0f172a'
      });
    } catch (e: any) {
      Swal.fire({
        title: 'Clock In Blocked',
        text: e.message || 'Could not record punch',
        icon: 'error',
        confirmButtonColor: '#b91c1c',
        background: '#ffffff',
        color: '#0f172a'
      });
    } finally {
      setIsPunching(false);
    }
  };

  // Clock Out Action
  const handleClockOut = async () => {
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (!emp) return;

    // Hard Geofence Restriction: Cannot punch when outside
    if (geofenceStatus === 'OUTSIDE') {
      Swal.fire({
        icon: 'error',
        title: 'Outside Geofence Area',
        html: `
          <div class="text-left text-xs space-y-2 text-slate-700">
            <p class="text-sm font-bold text-red-700">Clock-out is strictly blocked outside your assigned branch perimeter.</p>
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <div>• Assigned Branch: <b class="text-slate-950 font-black">${nearestBranch?.branchName || 'Assigned Branch'}</b></div>
              <div>• Current Distance: <b class="text-red-700 font-bold">${nearestBranch?.distance ?? 0}m</b></div>
              <div>• Allowed Radius: <b class="text-emerald-700 font-bold">${nearestBranch?.radius ?? 50}m</b></div>
            </div>
            <p class="text-slate-500 mt-2">You must be physically present inside the branch perimeter to clock out.</p>
          </div>
        `,
        background: '#ffffff',
        color: '#0f172a',
        confirmButtonColor: '#b91c1c',
        confirmButtonText: 'Understood'
      });
      return;
    }

    setIsPunching(true);
    try {
      const browserFp = attendanceService.captureBrowserFingerprint();
      const res = await attendanceService.clockOut(
        emp,
        gpsLocation?.lat || null,
        gpsLocation?.lng || null,
        gpsLocation?.accuracy || null,
        browserFp
      );

      await loadEmployeeTodayStatus(emp.id);

      Swal.fire({
        icon: 'success',
        title: 'Clocked Out Successfully',
        text: `Shift ended at ${new Date(res.punch.punchTime).toLocaleTimeString()}`,
        timer: 2500,
        showConfirmButton: false,
        background: '#ffffff',
        color: '#0f172a'
      });
    } catch (e: any) {
      Swal.fire({
        title: 'Clock Out Blocked',
        text: e.message || 'Could not record punch',
        icon: 'error',
        confirmButtonColor: '#b91c1c',
        background: '#ffffff',
        color: '#0f172a'
      });
    } finally {
      setIsPunching(false);
    }
  };

  // Load team records when date or tab changes
  useEffect(() => {
    if (activeTab === 'team') {
      loadTeamRecords();
    } else if (activeTab === 'reports') {
      loadMonthlyReports();
    } else if (activeTab === 'penalties') {
      loadPenalties();
    }
  }, [activeTab, selectedDate, reportMonth]);

  const loadTeamRecords = async () => {
    const [records, fps] = await Promise.all([
      attendanceService.getTeamDailyRecords(selectedDate),
      Promise.resolve(attendanceService.getAllRegisteredFingerprints())
    ]);
    setDailyRecords(records);
    setRegisteredFingerprints(fps);
  };

  const loadMonthlyReports = async () => {
    const reports = await attendanceService.getTeamMonthlyReport(reportMonth);
    setMonthlyReports(reports);
  };

  const loadPenalties = () => {
    const all = attendancePenaltyEngine.getAllLedger();
    setPenalties(all);
  };

  // Manual Entry Submit
  const handleManualSubmit = () => {
    const emp = employees.find(e => e.id === manualEmpId);
    if (!emp || !manualDate || !manualClockIn || !manualClockOut || !manualReason.trim()) {
      Swal.fire('Validation Error', 'Please complete all fields and provide a reason.', 'warning');
      return;
    }

    const clockInIso = `${manualDate}T${manualClockIn}:00`;
    const clockOutIso = `${manualDate}T${manualClockOut}:00`;

    attendanceService.submitManualEntry(
      currentUserId,
      emp,
      manualDate,
      clockInIso,
      clockOutIso,
      manualReason
    );

    setShowManualModal(false);
    setManualReason('');
    loadTeamRecords();

    Swal.fire('Success', 'Manual attendance entry recorded with manager audit trail.', 'success');
  };

  // Waive Penalty
  const handleWaivePenalty = (penaltyId: string) => {
    Swal.fire({
      title: 'Waive Penalty Record?',
      text: 'Provide the official managerial rationale for waiving this deduction.',
      input: 'textarea',
      inputPlaceholder: 'e.g. Traffic accident documented with police report / Approved emergency by HR',
      showCancelButton: true,
      confirmButtonColor: '#b91c1c',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Confirm Waiver',
      background: '#ffffff',
      color: '#0f172a',
      preConfirm: reason => {
        if (!reason || !reason.trim()) {
          Swal.showValidationMessage('Waiver reason is mandatory for audit compliance.');
        }
        return reason;
      }
    }).then(res => {
      if (res.isConfirmed && res.value) {
        attendancePenaltyEngine.waivePenalty(penaltyId, currentUserId, res.value);
        loadPenalties();
        Swal.fire({
          icon: 'success',
          title: 'Waived',
          text: 'The penalty has been waived and deducted amount nullified.',
          background: '#ffffff',
          color: '#0f172a',
          confirmButtonColor: '#b91c1c'
        });
      }
    });
  };

  // Edit or Register Fingerprint
  const handleEditFingerprint = async (empId: string, empName: string) => {
    const currentFp = registeredFingerprints[empId] || attendanceService.getRegisteredFingerprint(empId) || '';
    const suggestedToken = attendanceService.generateFingerprintToken();
    const browserFp = attendanceService.captureBrowserFingerprint();

    const { value: formValues } = await Swal.fire({
      title: `<div class="flex items-center justify-center gap-2 text-lg font-black text-slate-950"><span class="w-8 h-8 rounded-lg bg-red-50 text-red-700 border border-red-200 flex items-center justify-center">⚡</span> Edit Registered Fingerprint</div>`,
      html: `
        <div class="text-left text-xs space-y-3 font-sans text-slate-700 mt-2">
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div class="text-slate-500 text-xs">Staff Member: <b class="text-slate-950 font-black text-sm">${empName}</b></div>
            <div class="text-slate-500 text-xs">Status: ${
              currentFp
                ? `<span class="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold">${currentFp}</span>`
                : `<span class="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-bold">Not Registered</span>`
            }</div>
          </div>
          <div>
            <label class="block text-slate-800 font-bold mb-1 text-xs">Registered Biometric / Device Token:</label>
            <input id="swal-fp-input" class="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-2.5 font-mono text-sm uppercase focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600" value="${currentFp || suggestedToken}" placeholder="e.g. FP-9A4B12 or BIO-001" />
          </div>
          <div class="flex gap-2">
            <button type="button" id="swal-fp-gen" class="flex-1 py-2 px-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[11px] text-red-700 rounded-lg font-bold transition flex items-center justify-center gap-1">
              ⚡ Generate Token
            </button>
            <button type="button" id="swal-fp-browser" class="flex-1 py-2 px-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[11px] text-slate-700 rounded-lg font-bold transition flex items-center justify-center gap-1">
              📱 Capture Device
            </button>
          </div>
          <p class="text-[11px] text-slate-500">Admins can bind an employee to a specific mobile device hash or biometric scanner token. Punches will be audited against this token.</p>
        </div>
      `,
      background: '#ffffff',
      color: '#0f172a',
      showCancelButton: true,
      confirmButtonText: 'Save Fingerprint',
      confirmButtonColor: '#b91c1c',
      cancelButtonColor: '#64748b',
      cancelButtonText: 'Cancel',
      didOpen: () => {
        const input = document.getElementById('swal-fp-input') as HTMLInputElement;
        const genBtn = document.getElementById('swal-fp-gen');
        const browserBtn = document.getElementById('swal-fp-browser');
        if (genBtn && input) {
          genBtn.addEventListener('click', () => {
            input.value = attendanceService.generateFingerprintToken();
          });
        }
        if (browserBtn && input) {
          browserBtn.addEventListener('click', () => {
            input.value = browserFp;
          });
        }
      },
      preConfirm: () => {
        const input = document.getElementById('swal-fp-input') as HTMLInputElement;
        const val = input?.value?.trim();
        if (!val) {
          Swal.showValidationMessage('Please provide or generate a valid fingerprint token.');
          return false;
        }
        return val;
      }
    });

    if (formValues) {
      await attendanceService.setRegisteredFingerprint(empId, formValues, currentUserId);
      setRegisteredFingerprints(prev => ({ ...prev, [empId]: formValues.toUpperCase() }));
      await loadTeamRecords();
      Swal.fire({
        icon: 'success',
        title: 'Fingerprint Registered',
        text: `Registered fingerprint for ${empName} updated to ${formValues.toUpperCase()}.`,
        timer: 2000,
        showConfirmButton: false,
        background: '#ffffff',
        color: '#0f172a'
      });
    }
  };

  // Delete Registered Fingerprint
  const handleDeleteFingerprint = async (empId: string, empName: string) => {
    const currentFp = registeredFingerprints[empId] || attendanceService.getRegisteredFingerprint(empId);
    if (!currentFp) {
      Swal.fire({
        icon: 'info',
        title: 'No Fingerprint',
        text: `${empName} does not have a registered fingerprint.`,
        background: '#ffffff',
        color: '#0f172a',
        confirmButtonColor: '#b91c1c'
      });
      return;
    }

    const res = await Swal.fire({
      title: 'Delete Registered Fingerprint?',
      html: `
        <div class="text-left text-xs space-y-2 text-slate-700">
          <p class="text-red-700 font-bold text-sm">Are you sure you want to remove the registered biometric device token for ${empName}?</p>
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 my-2">
            <div class="text-slate-500">Employee: <b class="text-slate-950 font-black">${empName}</b></div>
            <div class="text-slate-500">Current Token: <span class="font-mono text-red-700 font-bold">${currentFp}</span></div>
          </div>
          <p class="text-slate-500">Once deleted, the employee will no longer have a trusted device/terminal bound to their profile until registered again.</p>
        </div>
      `,
      background: '#ffffff',
      color: '#0f172a',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete Fingerprint',
      confirmButtonColor: '#b91c1c',
      cancelButtonColor: '#64748b',
      cancelButtonText: 'Cancel'
    });

    if (res.isConfirmed) {
      await attendanceService.deleteRegisteredFingerprint(empId, currentUserId);
      setRegisteredFingerprints(prev => {
        const next = { ...prev };
        delete next[empId];
        return next;
      });
      await loadTeamRecords();
      Swal.fire({
        icon: 'success',
        title: 'Fingerprint Deleted',
        text: `Registered fingerprint for ${empName} has been removed.`,
        timer: 2000,
        showConfirmButton: false,
        background: '#ffffff',
        color: '#0f172a'
      });
    }
  };

  // Helper to build a styled worksheet for any category
  const buildAttendanceWorksheet = (
    workbook: ExcelJS.Workbook,
    sheetName: string,
    categoryTitle: string,
    records: AttendanceMonthlyReport[],
    month: string
  ) => {
    // Sanitize sheet name to comply with Excel limits (max 31 chars, no illegal chars)
    const sanitizedSheetName = sheetName.replace(/[\\/?*\[\]:]/g, '').substring(0, 31).trim();
    const sheet = workbook.addWorksheet(sanitizedSheetName, {
      views: [{ state: 'frozen', xSplit: 2, ySplit: 5 }]
    });

    sheet.columns = [
      { key: 'code', width: 14 },
      { key: 'name', width: 28 },
      { key: 'category', width: 16 },
      { key: 'branch', width: 24 },
      { key: 'scheduled', width: 16 },
      { key: 'present', width: 14 },
      { key: 'late', width: 12 },
      { key: 'earlyLeave', width: 13 },
      { key: 'absent', width: 12 },
      { key: 'leave', width: 12 },
      { key: 'lateMins', width: 14 },
      { key: 'otMins', width: 16 },
      { key: 'workedHrs', width: 18 },
      { key: 'rate', width: 15 },
      { key: 'punctuality', width: 17 },
      { key: 'penaltiesBhd', width: 16 },
      { key: 'waivedBhd', width: 15 }
    ];

    // Row 1: Company Header Banner
    sheet.mergeCells('A1:Q1');
    const row1 = sheet.getCell('A1');
    row1.value = 'TABARAK PHARMACIES & MEDICAL SERVICES';
    row1.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    row1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF881337' } }; // Brand Burgundy
    row1.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 28;

    // Row 2: Report Subtitle & Category
    sheet.mergeCells('A2:Q2');
    const row2 = sheet.getCell('A2');
    row2.value = `OFFICIAL ATTENDANCE & GEOFENCING AUDIT REPORT — ${categoryTitle.toUpperCase()}`;
    row2.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    row2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Slate 800
    row2.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(2).height = 22;

    // Row 3: Metadata Details
    sheet.mergeCells('A3:Q3');
    const row3 = sheet.getCell('A3');
    row3.value = `Audit Period: ${month}   |   Staff Count: ${records.length}   |   Export Date: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString()}   |   System: Tabarak Workforce Hub`;
    row3.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF475569' } };
    row3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // Slate 100
    row3.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(3).height = 18;

    // Row 4: Spacer row
    sheet.getRow(4).height = 8;

    // Row 5: Column Headers
    const headerRow = sheet.getRow(5);
    headerRow.height = 26;
    const headers = [
      'Emp Code',
      'Employee Full Name',
      'Role Category',
      'Assigned Branch',
      'Scheduled Days',
      'Present Days',
      'Late Days',
      'Early Leave',
      'Absent Days',
      'Leave Days',
      'Late (Mins)',
      'Overtime (Mins)',
      'Total Worked (Hrs)',
      'Attendance %',
      'Punctuality Score',
      'Penalties (BHD)',
      'Waived (BHD)'
    ];

    headers.forEach((h, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Slate 900
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF334155' } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        bottom: { style: 'thin', color: { argb: 'FF334155' } },
        right: { style: 'thin', color: { argb: 'FF334155' } }
      };
    });

    if (records.length === 0) {
      sheet.mergeCells('A6:Q6');
      const emptyCell = sheet.getCell('A6');
      emptyCell.value = `No staff records registered under "${categoryTitle}" for ${month}.`;
      emptyCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
      emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
      sheet.getRow(6).height = 26;
      return;
    }

    let totalScheduled = 0;
    let totalPresent = 0;
    let totalLate = 0;
    let totalEarly = 0;
    let totalAbsent = 0;
    let totalLeave = 0;
    let totalLateMins = 0;
    let totalOtMins = 0;
    let totalWorkedHrs = 0;
    let sumAttendancePct = 0;
    let sumPunctuality = 0;
    let totalPenalties = 0;
    let totalWaived = 0;

    records.forEach((r, rIdx) => {
      const rowNum = 6 + rIdx;
      const row = sheet.getRow(rowNum);
      row.height = 20;

      totalScheduled += r.scheduledDays || 0;
      totalPresent += r.presentDays || 0;
      totalLate += r.lateDays || 0;
      totalEarly += r.earlyLeaveDays || 0;
      totalAbsent += r.absentDays || 0;
      totalLeave += r.leaveDays || 0;
      totalLateMins += r.totalLateMinutes || 0;
      totalOtMins += r.totalOvertimeMinutes || 0;
      totalWorkedHrs += r.totalWorkedHours || 0;
      sumAttendancePct += r.attendancePercentage || 0;
      sumPunctuality += r.punctualityScore || 0;
      totalPenalties += r.totalPenaltiesBhd || 0;
      totalWaived += r.totalWaivedPenaltiesBhd || 0;

      const isEven = rIdx % 2 === 0;
      const rowBgColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

      const rowData = [
        { val: r.employeeCode, align: 'center', mono: true },
        { val: r.employeeName, align: 'left', bold: true },
        { val: r.category || categoryTitle, align: 'center' },
        { val: r.branchName || 'Unassigned', align: 'left' },
        { val: r.scheduledDays || 0, align: 'center' },
        { val: r.presentDays || 0, align: 'center' },
        { val: r.lateDays || 0, align: 'center' },
        { val: r.earlyLeaveDays || 0, align: 'center' },
        { val: r.absentDays || 0, align: 'center' },
        { val: r.leaveDays || 0, align: 'center' },
        { val: r.totalLateMinutes || 0, align: 'center' },
        { val: r.totalOvertimeMinutes || 0, align: 'center' },
        { val: Number((r.totalWorkedHours || 0).toFixed(1)), align: 'right' },
        { val: `${(r.attendancePercentage || 0).toFixed(1)}%`, align: 'center' },
        { val: `${Math.round(r.punctualityScore || 0)}/100`, align: 'center' },
        { val: Number((r.totalPenaltiesBhd || 0).toFixed(3)), align: 'right', numFmt: '#,##0.000' },
        { val: Number((r.totalWaivedPenaltiesBhd || 0).toFixed(3)), align: 'right', numFmt: '#,##0.000' }
      ];

      rowData.forEach((item, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.value = item.val;
        cell.font = {
          name: item.mono ? 'Consolas' : 'Calibri',
          size: 9.5,
          bold: !!item.bold,
          color: { argb: 'FF1E293B' }
        };
        if (item.numFmt) {
          cell.numFmt = item.numFmt;
        }
        cell.alignment = {
          vertical: 'middle',
          horizontal: (item.align as 'center' | 'left' | 'right') || 'left'
        };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    });

    // Summary / Totals Row
    const totalsRowNum = 6 + records.length;
    const totalsRow = sheet.getRow(totalsRowNum);
    totalsRow.height = 24;

    const avgAttendance = records.length > 0 ? (sumAttendancePct / records.length).toFixed(1) : '0.0';
    const avgPunctuality = records.length > 0 ? Math.round(sumPunctuality / records.length) : 0;

    const totalsData = [
      { col: 1, val: `TOTALS / AVERAGES (${records.length} Staff)` },
      { col: 2, val: '' },
      { col: 3, val: '' },
      { col: 4, val: '' },
      { col: 5, val: totalScheduled, align: 'center' },
      { col: 6, val: totalPresent, align: 'center' },
      { col: 7, val: totalLate, align: 'center' },
      { col: 8, val: totalEarly, align: 'center' },
      { col: 9, val: totalAbsent, align: 'center' },
      { col: 10, val: totalLeave, align: 'center' },
      { col: 11, val: totalLateMins, align: 'center' },
      { col: 12, val: totalOtMins, align: 'center' },
      { col: 13, val: Number(totalWorkedHrs.toFixed(1)), align: 'right' },
      { col: 14, val: `${avgAttendance}%`, align: 'center' },
      { col: 15, val: `${avgPunctuality}/100`, align: 'center' },
      { col: 16, val: Number(totalPenalties.toFixed(3)), align: 'right', numFmt: '#,##0.000' },
      { col: 17, val: Number(totalWaived.toFixed(3)), align: 'right', numFmt: '#,##0.000' }
    ];

    sheet.mergeCells(`A${totalsRowNum}:D${totalsRowNum}`);

    totalsData.forEach(item => {
      const cell = totalsRow.getCell(item.col);
      if (item.val !== '') {
        cell.value = item.val;
      }
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      if (item.numFmt) {
        cell.numFmt = item.numFmt;
      }
      cell.alignment = {
        vertical: 'middle',
        horizontal: (item.align as 'center' | 'left' | 'right') || (item.col === 1 ? 'left' : 'center')
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });
  };

  // Export Monthly Reports to Excel (Multi-Tab segmented by Category)
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      let reports = monthlyReports;
      if (!reports || reports.length === 0) {
        reports = await attendanceService.getTeamMonthlyReport(reportMonth);
        setMonthlyReports(reports);
      }

      if (!reports || reports.length === 0) {
        Swal.fire('No Data', `No attendance records found for month ${reportMonth} to export.`, 'info');
        setIsExporting(false);
        return;
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Tabarak Hub Attendance & Geofencing Engine';
      workbook.created = new Date();

      // Tab 1: All Staff
      buildAttendanceWorksheet(workbook, 'All Staff', 'All Staff (Company-Wide)', reports, reportMonth);

      // Define standard categories
      const standardCategories: StaffCategory[] = ['Pharmacist', 'Driver', 'Worker', 'Management'];
      // Extract any extra categories present in report data
      const extraCategories: string[] = Array.from(
        new Set(reports.map(r => r.category).filter((c): c is string => Boolean(c) && !standardCategories.includes(c as StaffCategory)))
      );

      const allCategoriesToExport: string[] = [...standardCategories, ...extraCategories];

      // Build a dedicated tab for each role category
      allCategoriesToExport.forEach((cat: string) => {
        const catReports = reports.filter(r => r.category === cat);
        buildAttendanceWorksheet(workbook, cat, cat, catReports, reportMonth);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      saveAs(blob, `Tabarak_Official_Attendance_Report_${reportMonth}.xlsx`);

      Swal.fire({
        icon: 'success',
        title: 'Report Exported Successfully',
        text: `Official attendance report downloaded with dedicated tabs for All Staff, ${allCategoriesToExport.join(', ')}.`,
        confirmButtonColor: '#059669'
      });
    } catch (err: any) {
      console.error('Failed to export multi-tab attendance report:', err);
      Swal.fire('Export Failed', err.message || 'An error occurred while generating the Excel workbook.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Filtered Monthly Reports for Tab 3 Table View
  const filteredMonthlyReports = useMemo(() => {
    return monthlyReports.filter(rep => {
      const matchesCat = reportCategoryFilter === 'ALL' || rep.category === reportCategoryFilter;
      const q = reportSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (rep.employeeName && rep.employeeName.toLowerCase().includes(q)) ||
        (rep.employeeCode && rep.employeeCode.toLowerCase().includes(q)) ||
        (rep.branchName && rep.branchName.toLowerCase().includes(q));
      return matchesCat && matchesSearch;
    });
  }, [monthlyReports, reportCategoryFilter, reportSearch]);

  // Filtered Team Records
  const filteredTeamRecords = useMemo(() => {
    return dailyRecords.filter(rec => {
      const matchesBranch = teamBranchFilter === 'ALL' || rec.scheduledBranchId === teamBranchFilter;
      const matchesCategory = teamCategoryFilter === 'ALL' || rec.category === teamCategoryFilter;
      const fp = registeredFingerprints[rec.employeeId] || rec.registeredFingerprint;
      const matchesFp =
        teamFingerprintFilter === 'ALL' ||
        (teamFingerprintFilter === 'REGISTERED' && !!fp) ||
        (teamFingerprintFilter === 'MISSING' && !fp);
      const q = teamSearchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        rec.employeeName?.toLowerCase().includes(q) ||
        rec.employeeCode?.toLowerCase().includes(q) ||
        (fp && fp.toLowerCase().includes(q));
      return matchesBranch && matchesCategory && matchesFp && matchesQuery;
    });
  }, [dailyRecords, teamBranchFilter, teamCategoryFilter, teamFingerprintFilter, teamSearchQuery, registeredFingerprints]);

  // Selected Employee Details
  const selectedEmp = employees.find(e => e.id === selectedEmployeeId);

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header Ribbon */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-700 shadow-sm">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-950 tracking-tight">
                Attendance &amp; Geofencing Engine
              </h1>
              <span className="text-[10px] bg-red-50 text-red-700 px-2.5 py-0.5 rounded-full border border-red-200 font-black uppercase tracking-wider">
                Bahrain GCC v1.0
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              GPS Radius Validation • Disciplinary Escalation Engine • Supabase Authority
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConfigModal(true)}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-xl flex items-center gap-2 border border-slate-200 transition shadow-sm hover:border-red-300"
          >
            <Sliders className="w-4 h-4 text-red-700" /> Disciplinary Settings &amp; Rules
          </button>
          <button
            onClick={loadInitialData}
            className="p-2 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-xl border border-slate-200 transition shadow-sm"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex border border-slate-200 bg-slate-100 p-1.5 rounded-2xl gap-2 shadow-sm">
        <button
          onClick={() => setActiveTab('self')}
          className={`flex-1 py-3 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
            activeTab === 'self'
              ? 'bg-white text-slate-950 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Navigation className={`w-4 h-4 ${activeTab === 'self' ? 'text-red-700' : 'text-slate-400'}`} />
          <span>Self-Service Clock In/Out</span>
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`flex-1 py-3 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
            activeTab === 'team'
              ? 'bg-white text-slate-950 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Users className={`w-4 h-4 ${activeTab === 'team' ? 'text-red-700' : 'text-slate-400'}`} />
          <span>Team Live Board</span>
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full font-black transition-colors ${
              activeTab === 'team'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {dailyRecords.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex-1 py-3 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
            activeTab === 'reports'
              ? 'bg-white text-slate-950 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <FileSpreadsheet className={`w-4 h-4 ${activeTab === 'reports' ? 'text-red-700' : 'text-slate-400'}`} />
          <span>Monthly Reports &amp; Audit</span>
        </button>
        <button
          onClick={() => setActiveTab('penalties')}
          className={`flex-1 py-3 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
            activeTab === 'penalties'
              ? 'bg-white text-slate-950 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <ShieldAlert className={`w-4 h-4 ${activeTab === 'penalties' ? 'text-red-700' : 'text-slate-400'}`} />
          <span>Penalty Ledger</span>
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full font-black transition-colors ${
              activeTab === 'penalties'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {penalties.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SELF-SERVICE CLOCK-IN / OUT */}
      {/* ========================================================================= */}
      {activeTab === 'self' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Clock-In Card */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
                  Employee Self-Service Kiosk
                </span>
                <div className="mt-1.5">
                  <select
                    value={selectedEmployeeId}
                    onChange={e => setSelectedEmployeeId(e.target.value)}
                    className="bg-white border border-slate-200 text-slate-900 text-sm font-bold rounded-xl px-3.5 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                  >
                    {employees
                      .filter(e => e.status === 'Active')
                      .map(e => (
                        <option key={e.id} value={e.id}>
                          {e.code} - {e.full_name} ({e.category})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Status Badge */}
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wide border ${
                    geofenceStatus === 'INSIDE'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : geofenceStatus === 'OUTSIDE'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {geofenceStatus === 'INSIDE' && <CheckCircle2 className="w-4 h-4" />}
                  {geofenceStatus === 'OUTSIDE' && <AlertTriangle className="w-4 h-4" />}
                  {geofenceStatus === 'GPS_UNAVAILABLE' && <AlertCircle className="w-4 h-4" />}
                  {geofenceStatus.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Big Live Digital Clock Display */}
            <div className="my-10 text-center">
              <div className="text-6xl md:text-7xl font-black text-slate-950 tracking-tight font-mono">
                {currentTime.toLocaleTimeString('en-GB', { hour12: false })}
              </div>
              <div className="text-sm font-bold text-slate-500 mt-2">
                {currentTime.toLocaleDateString('en-GB', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>

            {/* Geofence Perimeter Indicator */}
            {nearestBranch && (
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200 flex items-center justify-between mb-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-700">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Assigned Geofence Center</div>
                    <div className="text-sm font-black text-slate-950">{nearestBranch.branchName}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Distance to Center</div>
                  <div className="text-sm font-black text-slate-950">
                    {nearestBranch.distance}m <span className="text-slate-400 font-normal">/ {nearestBranch.radius}m max</span>
                  </div>
                </div>
              </div>
            )}

            {/* Geofence Perimeter Warning Banner if Outside */}
            {geofenceStatus === 'OUTSIDE' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-center gap-3 text-red-900 mb-4 shadow-sm">
                <AlertTriangle className="w-5 h-5 shrink-0 text-red-700 animate-pulse" />
                <div className="text-xs">
                  <span className="font-bold text-red-800">Punch Locked (Outside Geofence):</span> You cannot clock in or clock out while outside your assigned branch perimeter ({nearestBranch?.distance ?? 0}m away / max radius {nearestBranch?.radius ?? 50}m).
                </div>
              </div>
            )}

            {/* Big Action Button */}
            <div className="flex gap-4">
              {!todayRecord?.actualClockIn ? (
                <button
                  onClick={handleClockIn}
                  disabled={isPunching || isAcquiringGps || geofenceStatus === 'OUTSIDE'}
                  className={`flex-1 py-4 font-black text-lg rounded-2xl shadow-xl flex items-center justify-center gap-3 transition transform active:scale-98 ${
                    geofenceStatus === 'OUTSIDE'
                      ? 'bg-slate-100 text-red-700/80 border border-red-200 cursor-not-allowed shadow-none'
                      : 'bg-red-700 hover:bg-red-800 text-white shadow-red-700/20 disabled:opacity-50'
                  }`}
                >
                  {geofenceStatus === 'OUTSIDE' ? (
                    <>
                      <ShieldAlert className="w-6 h-6 text-red-700" />
                      Cannot Clock In (Outside Area)
                    </>
                  ) : (
                    <>
                      <Check className="w-6 h-6" />
                      {isPunching ? 'Verifying GPS...' : 'Punch Clock In'}
                    </>
                  )}
                </button>
              ) : !todayRecord?.actualClockOut ? (
                <button
                  onClick={handleClockOut}
                  disabled={isPunching || isAcquiringGps || geofenceStatus === 'OUTSIDE'}
                  className={`flex-1 py-4 font-black text-lg rounded-2xl shadow-xl flex items-center justify-center gap-3 transition transform active:scale-98 ${
                    geofenceStatus === 'OUTSIDE'
                      ? 'bg-slate-100 text-red-700/80 border border-red-200 cursor-not-allowed shadow-none'
                      : 'bg-slate-900 hover:bg-black text-white shadow-slate-900/20 disabled:opacity-50'
                  }`}
                >
                  {geofenceStatus === 'OUTSIDE' ? (
                    <>
                      <ShieldAlert className="w-6 h-6 text-red-700" />
                      Cannot Clock Out (Outside Area)
                    </>
                  ) : (
                    <>
                      <X className="w-6 h-6" />
                      {isPunching ? 'Verifying GPS...' : 'Punch Clock Out'}
                    </>
                  )}
                </button>
              ) : (
                <div className="flex-1 py-4 bg-slate-50 text-slate-500 font-bold text-center rounded-2xl border border-slate-200">
                  Daily Punches Completed for Today
                </div>
              )}

              <button
                onClick={acquireGpsPosition}
                disabled={isAcquiringGps}
                className="px-5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-2xl border border-slate-200 flex flex-col items-center justify-center gap-1 transition shadow-sm"
                title="Recalibrate GPS"
              >
                <Compass className={`w-5 h-5 text-red-700 ${isAcquiringGps ? 'animate-spin' : ''}`} />
                <span className="text-[10px] font-bold">Recalibrate</span>
              </button>
            </div>
          </div>

          {/* Right Column: Shift Details & Punches Timeline */}
          <div className="space-y-6">
            {/* Shift Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-black text-slate-950 mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-red-700" /> Scheduled Duty Shift
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-semibold">Shift Code</span>
                  <span className="font-black text-slate-900">{todayRecord?.scheduledShiftCode || 'REGULAR'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-semibold">Scheduled Hours</span>
                  <span className="font-mono font-bold text-slate-900">
                    {todayRecord?.scheduledStartTime || '08:00'} — {todayRecord?.scheduledEndTime || '16:00'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-semibold">Current Status</span>
                  <span className="font-black text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[11px]">
                    {todayRecord?.status || 'SCHEDULED'}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500 font-semibold">Late Minutes</span>
                  <span className="font-black text-amber-700 font-mono">{todayRecord?.lateMinutes || 0} mins</span>
                </div>
              </div>
            </div>

            {/* Today Punches Timeline */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-black text-slate-950 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-red-700" /> Today's GPS Punch Log
              </h3>
              {todayPunches.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs font-semibold">No punches recorded yet today.</div>
              ) : (
                <div className="space-y-3">
                  {todayPunches.map(p => (
                    <div
                      key={p.id}
                      className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs shadow-sm"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            p.punchType === 'CLOCK_IN' ? 'bg-emerald-600' : 'bg-slate-900'
                          }`}
                        />
                        <div>
                          <div className="font-black text-slate-900">{p.punchType.replace('_', ' ')}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {new Date(p.punchTime).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-black uppercase border ${
                            p.geofenceValidation === 'INSIDE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          {p.geofenceValidation}
                        </span>
                        {p.accuracy && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">±{Math.round(p.accuracy)}m</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TEAM DASHBOARD (MANAGER LIVE BOARD) */}
      {/* ========================================================================= */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-900 text-xs font-bold rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                />
              </div>
              <div>
                <select
                  value={teamBranchFilter}
                  onChange={e => setTeamBranchFilter(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-900 text-xs font-bold rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                >
                  <option value="ALL">All Branches</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={teamCategoryFilter}
                  onChange={e => setTeamCategoryFilter(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-900 text-xs font-bold rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                >
                  <option value="ALL">All Categories</option>
                  <option value="Pharmacist">Pharmacist</option>
                  <option value="Driver">Driver</option>
                  <option value="Worker">Worker</option>
                  <option value="Management">Management</option>
                </select>
              </div>
              <div>
                <select
                  value={teamFingerprintFilter}
                  onChange={e => setTeamFingerprintFilter(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-900 text-xs font-bold rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                >
                  <option value="ALL">All Fingerprints</option>
                  <option value="REGISTERED">Registered Only</option>
                  <option value="MISSING">Missing Fingerprint</option>
                </select>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search staff or token..."
                  value={teamSearchQuery}
                  onChange={e => setTeamSearchQuery(e.target.value)}
                  className="bg-white border border-slate-200 pl-9 pr-3 py-2 rounded-lg text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600 shadow-sm"
                />
              </div>
            </div>

            <div>
              <button
                onClick={() => setShowManualModal(true)}
                className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-lg shadow-red-700/20 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Manual Attendance Entry
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 uppercase tracking-wider text-[11px] text-slate-500 font-black border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Employee</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Branch</th>
                    <th className="py-3.5 px-4">Shift</th>
                    <th className="py-3.5 px-4">Clock In</th>
                    <th className="py-3.5 px-4">Clock Out</th>
                    <th className="py-3.5 px-4">Geofence</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Late Mins</th>
                    <th className="py-3.5 px-4 text-right">Net Hours</th>
                    <th className="py-3.5 px-4">Registered Fingerprint</th>
                    <th className="py-3.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredTeamRecords.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-slate-400 font-medium">
                        No attendance records found for this date and filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTeamRecords.map(rec => (
                      <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 font-black text-slate-950">
                          <div>{rec.employeeName || 'Staff'}</div>
                          <div className="text-[10px] text-slate-400 font-mono font-normal">{rec.employeeCode}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">
                            {rec.category || 'Staff'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">{rec.scheduledBranchName || '—'}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-700 font-bold">
                          {rec.scheduledStartTime || '—'} - {rec.scheduledEndTime || '—'}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                          {rec.actualClockIn ? new Date(rec.actualClockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {rec.actualClockOut ? new Date(rec.actualClockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-black border ${
                              rec.clockInGeofence === 'INSIDE'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : rec.clockInGeofence === 'OUTSIDE'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {rec.clockInGeofence}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase border ${
                              rec.status === 'PRESENT'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : rec.status === 'LATE'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : rec.status === 'ABSENT'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : rec.status === 'ON_LEAVE'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-purple-50 text-purple-700 border-purple-200'
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-black text-amber-700 font-mono">
                          {rec.lateMinutes > 0 ? `${rec.lateMinutes}m` : '—'}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-right text-slate-900 font-black">
                          {(rec.netWorkedMinutes / 60).toFixed(1)}h
                        </td>

                        {/* Registered Fingerprint */}
                        <td className="py-3.5 px-4">
                          {(() => {
                            const fp = registeredFingerprints[rec.employeeId] || rec.registeredFingerprint;
                            return fp ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-slate-50 text-slate-900 border border-slate-200 shadow-sm">
                                <Fingerprint className="w-3.5 h-3.5 text-red-700" />
                                {fp}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-slate-400 border border-dashed border-slate-300">
                                Not Registered
                              </span>
                            );
                          })()}
                        </td>

                        {/* Admin Edit / Delete Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleEditFingerprint(rec.employeeId, rec.employeeName || 'Staff')}
                              className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition shadow-sm"
                              title="Edit / Register Fingerprint"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-red-700" />
                            </button>
                            {(registeredFingerprints[rec.employeeId] || rec.registeredFingerprint) && (
                              <button
                                onClick={() => handleDeleteFingerprint(rec.employeeId, rec.employeeName || 'Staff')}
                                className="p-1.5 rounded-lg bg-white hover:bg-red-50 text-slate-600 hover:text-red-700 border border-slate-200 hover:border-red-200 transition shadow-sm"
                                title="Delete Registered Fingerprint"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MONTHLY REPORTS & EXCEL EXPORT */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600">Month:</label>
                <input
                  type="month"
                  value={reportMonth}
                  onChange={e => setReportMonth(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-900 text-xs font-bold rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600">Category:</label>
                <select
                  value={reportCategoryFilter}
                  onChange={e => setReportCategoryFilter(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-900 text-xs font-bold rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                >
                  <option value="ALL">All Categories</option>
                  <option value="Pharmacist">Pharmacist</option>
                  <option value="Driver">Driver</option>
                  <option value="Worker">Worker</option>
                  <option value="Management">Management</option>
                </select>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search staff..."
                  value={reportSearch}
                  onChange={e => setReportSearch(e.target.value)}
                  className="bg-white border border-slate-200 pl-9 pr-3 py-2 rounded-lg text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600 shadow-sm"
                />
              </div>
            </div>
            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="px-5 py-2.5 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-lg shadow-red-700/20 transition"
              title="Export official Excel workbook with dedicated tab for each role category"
            >
              {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export Official Excel Report
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 uppercase tracking-wider text-[11px] text-slate-500 font-black border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Staff Member</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4 text-center">Scheduled</th>
                    <th className="py-3.5 px-4 text-center">Present</th>
                    <th className="py-3.5 px-4 text-center">Late</th>
                    <th className="py-3.5 px-4 text-center">Absent</th>
                    <th className="py-3.5 px-4 text-center">Attendance %</th>
                    <th className="py-3.5 px-4 text-center">Punctuality Score</th>
                    <th className="py-3.5 px-4 text-right">Penalties (BHD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredMonthlyReports.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                        No monthly records found for the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredMonthlyReports.map(rep => (
                      <tr key={rep.employeeId} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 font-black text-slate-950">
                          <div>{rep.employeeName}</div>
                          <div className="text-[10px] text-slate-400 font-mono font-normal">{rep.employeeCode}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">
                            {rep.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-800">{rep.scheduledDays}</td>
                        <td className="py-3.5 px-4 text-center text-emerald-700 font-bold">{rep.presentDays}</td>
                        <td className="py-3.5 px-4 text-center text-amber-700 font-bold">{rep.lateDays}</td>
                        <td className="py-3.5 px-4 text-center text-red-700 font-bold">{rep.absentDays}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`font-black text-xs ${
                              rep.attendancePercentage >= 95
                                ? 'text-emerald-700'
                                : rep.attendancePercentage >= 85
                                ? 'text-amber-700'
                                : 'text-red-700'
                            }`}
                          >
                            {rep.attendancePercentage}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-black text-slate-900">{rep.punctualityScore}/100</span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-red-700 font-mono">
                          {rep.totalPenaltiesBhd.toFixed(3)} BHD
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PENALTY LEDGER & AUDIT TRAIL */}
      {/* ========================================================================= */}
      {activeTab === 'penalties' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 uppercase tracking-wider text-[11px] text-slate-500 font-black border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Employee</th>
                    <th className="py-3.5 px-4">Violation Rule</th>
                    <th className="py-3.5 px-4">Tier / Action</th>
                    <th className="py-3.5 px-4">Occurrence</th>
                    <th className="py-3.5 px-4 text-right">Deduction (BHD)</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {penalties.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                        No disciplinary violations recorded in the ledger.
                      </td>
                    </tr>
                  ) : (
                    penalties.map(pen => (
                      <tr key={pen.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 font-mono text-slate-500 font-medium">{pen.date}</td>
                        <td className="py-3.5 px-4 font-black text-slate-950">{pen.employeeName || pen.employeeId}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">{pen.ruleName}</td>
                        <td className="py-3.5 px-4">
                          <span className="text-slate-900 font-black">{pen.action.replace(/_/g, ' ')}</span>
                          <span className="text-[10px] text-slate-400 ml-1.5 font-bold">(Tier {pen.tier})</span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-bold">#{pen.occurrenceNumber}</td>
                        <td className="py-3.5 px-4 text-right font-black font-mono text-red-700">
                          {pen.calculatedDeductionBhd.toFixed(3)} BHD
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase border ${
                              pen.isWaived
                                ? 'bg-slate-100 text-slate-400 line-through border-slate-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            {pen.isWaived ? 'Waived' : 'Active'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {!pen.isWaived && (
                            <button
                              onClick={() => handleWaivePenalty(pen.id)}
                              className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-bold border border-slate-200 shadow-sm transition"
                            >
                              Waive
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: MANUAL ATTENDANCE OVERRIDE */}
      {/* ========================================================================= */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                <Plus className="w-5 h-5 text-red-700" /> Record Manual Attendance Punch
              </h3>
              <button
                onClick={() => setShowManualModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">Select Employee</label>
                <select
                  value={manualEmpId}
                  onChange={e => setManualEmpId(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-3 py-2 text-xs font-bold shadow-sm focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                >
                  <option value="">-- Choose Staff Member --</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.code} - {e.full_name} ({e.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">Date</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={e => setManualDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-3 py-2 text-xs font-bold shadow-sm focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Clock In Time</label>
                  <input
                    type="time"
                    value={manualClockIn}
                    onChange={e => setManualClockIn(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-3 py-2 text-xs font-bold shadow-sm focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-bold">Clock Out Time</label>
                  <input
                    type="time"
                    value={manualClockOut}
                    onChange={e => setManualClockOut(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-3 py-2 text-xs font-bold shadow-sm focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">
                  Manager Justification / Override Rationale <span className="text-red-700">*</span>
                </label>
                <textarea
                  rows={3}
                  value={manualReason}
                  onChange={e => setManualReason(e.target.value)}
                  placeholder="e.g. Employee forgot phone at home / System GPS outage reported"
                  className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-3 text-xs font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600 shadow-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowManualModal(false)}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-sm transition"
              >
                Cancel
              </button>
              <button
                onClick={handleManualSubmit}
                className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-black rounded-xl shadow-lg shadow-red-700/20 transition"
              >
                Record Manual Punch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DISCIPLINARY SETTINGS & RULES CONFIG (Fixed Wide Size) */}
      {/* ========================================================================= */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden">
          <div className="w-full max-w-[96vw] 2xl:max-w-[1550px] h-[88vh] min-h-[620px] max-h-[88vh] flex flex-col my-auto transition-all duration-200">
            <AttendancePenaltyConfigPanel onClose={() => setShowConfigModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
};
