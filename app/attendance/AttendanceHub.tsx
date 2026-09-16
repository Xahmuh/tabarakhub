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
          <div class="text-left text-xs space-y-2">
            <p class="text-sm font-semibold text-rose-400">Clock-in is strictly blocked outside your assigned branch perimeter.</p>
            <div class="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1">
              <div>• Assigned Branch: <b class="text-white">${nearestBranch?.branchName || 'Assigned Branch'}</b></div>
              <div>• Current Distance: <b class="text-rose-400">${nearestBranch?.distance ?? 0}m</b></div>
              <div>• Allowed Radius: <b class="text-emerald-400">${nearestBranch?.radius ?? 50}m</b></div>
            </div>
            <p class="text-slate-400 mt-2">You must be physically present inside the branch perimeter to record your attendance.</p>
          </div>
        `,
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
        showConfirmButton: false
      });
    } catch (e: any) {
      Swal.fire('Clock In Blocked', e.message || 'Could not record punch', 'error');
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
          <div class="text-left text-xs space-y-2">
            <p class="text-sm font-semibold text-rose-400">Clock-out is strictly blocked outside your assigned branch perimeter.</p>
            <div class="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1">
              <div>• Assigned Branch: <b class="text-white">${nearestBranch?.branchName || 'Assigned Branch'}</b></div>
              <div>• Current Distance: <b class="text-rose-400">${nearestBranch?.distance ?? 0}m</b></div>
              <div>• Allowed Radius: <b class="text-emerald-400">${nearestBranch?.radius ?? 50}m</b></div>
            </div>
            <p class="text-slate-400 mt-2">You must be physically present inside the branch perimeter to clock out.</p>
          </div>
        `,
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
        showConfirmButton: false
      });
    } catch (e: any) {
      Swal.fire('Clock Out Blocked', e.message || 'Could not record punch', 'error');
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
      confirmButtonColor: '#0284c7',
      confirmButtonText: 'Confirm Waiver',
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
        Swal.fire('Waived', 'The penalty has been waived and deducted amount nullified.', 'success');
      }
    });
  };

  // Edit or Register Fingerprint
  const handleEditFingerprint = async (empId: string, empName: string) => {
    const currentFp = registeredFingerprints[empId] || attendanceService.getRegisteredFingerprint(empId) || '';
    const suggestedToken = attendanceService.generateFingerprintToken();
    const browserFp = attendanceService.captureBrowserFingerprint();

    const { value: formValues } = await Swal.fire({
      title: `<div class="flex items-center justify-center gap-2 text-lg font-black text-white"><span class="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">⚡</span> Edit Registered Fingerprint</div>`,
      html: `
        <div class="text-left text-xs space-y-3 font-sans text-slate-300 mt-2">
          <div class="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
            <div class="text-slate-400 text-xs">Staff Member: <b class="text-white font-semibold text-sm">${empName}</b></div>
            <div class="text-slate-400 text-xs">Status: ${
              currentFp
                ? `<span class="inline-block px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-bold">${currentFp}</span>`
                : `<span class="inline-block px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">Not Registered</span>`
            }</div>
          </div>
          <div>
            <label class="block text-slate-300 font-bold mb-1 text-xs">Registered Biometric / Device Token:</label>
            <input id="swal-fp-input" class="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 font-mono text-sm uppercase focus:outline-none focus:border-sky-500" value="${currentFp || suggestedToken}" placeholder="e.g. FP-9A4B12 or BIO-001" />
          </div>
          <div class="flex gap-2">
            <button type="button" id="swal-fp-gen" class="flex-1 py-2 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-sky-400 rounded-lg font-bold transition flex items-center justify-center gap-1">
              ⚡ Generate Token
            </button>
            <button type="button" id="swal-fp-browser" class="flex-1 py-2 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-emerald-400 rounded-lg font-bold transition flex items-center justify-center gap-1">
              📱 Capture Device
            </button>
          </div>
          <p class="text-[11px] text-slate-500">Admins can bind an employee to a specific mobile device hash or biometric scanner token. Punches will be audited against this token.</p>
        </div>
      `,
      background: '#0f172a',
      color: '#ffffff',
      showCancelButton: true,
      confirmButtonText: 'Save Fingerprint',
      confirmButtonColor: '#0284c7',
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
        showConfirmButton: false
      });
    }
  };

  // Delete Registered Fingerprint
  const handleDeleteFingerprint = async (empId: string, empName: string) => {
    const currentFp = registeredFingerprints[empId] || attendanceService.getRegisteredFingerprint(empId);
    if (!currentFp) {
      Swal.fire('No Fingerprint', `${empName} does not have a registered fingerprint.`, 'info');
      return;
    }

    const res = await Swal.fire({
      title: 'Delete Registered Fingerprint?',
      html: `
        <div class="text-left text-xs space-y-2 text-slate-300">
          <p class="text-rose-400 font-bold text-sm">Are you sure you want to remove the registered biometric device token for ${empName}?</p>
          <div class="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1 my-2">
            <div class="text-slate-400">Employee: <b class="text-white">${empName}</b></div>
            <div class="text-slate-400">Current Token: <span class="font-mono text-amber-400 font-bold">${currentFp}</span></div>
          </div>
          <p class="text-slate-400">Once deleted, the employee will no longer have a trusted device/terminal bound to their profile until registered again.</p>
        </div>
      `,
      background: '#0f172a',
      color: '#ffffff',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete Fingerprint',
      confirmButtonColor: '#e11d48',
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
        showConfirmButton: false
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
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand to-red-800 flex items-center justify-center text-white shadow-lg shadow-brand/25">
            <Compass className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-white tracking-tight">
                Attendance &amp; Geofencing Engine
              </h1>
              <span className="text-[10px] bg-brand/20 text-red-300 px-2.5 py-0.5 rounded-full border border-brand/30 font-bold uppercase tracking-wider">
                Bahrain GCC v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              GPS Radius Validation • Disciplinary Escalation Engine • Supabase Authority
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConfigModal(true)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-2 border border-slate-700 transition shadow hover:border-brand/40"
          >
            <Sliders className="w-4 h-4 text-brand" /> Disciplinary Settings &amp; Rules
          </button>
          <button
            onClick={loadInitialData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex border border-slate-800 bg-slate-900/60 p-1.5 rounded-2xl gap-2 shadow-lg backdrop-blur-md">
        <button
          onClick={() => setActiveTab('self')}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
            activeTab === 'self'
              ? 'bg-brand text-white shadow-lg shadow-brand/25 border border-brand/40 ring-1 ring-white/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Navigation className={`w-4 h-4 ${activeTab === 'self' ? 'text-white' : 'text-slate-400'}`} /> Self-Service Clock In/Out
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
            activeTab === 'team'
              ? 'bg-brand text-white shadow-lg shadow-brand/25 border border-brand/40 ring-1 ring-white/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Users className={`w-4 h-4 ${activeTab === 'team' ? 'text-white' : 'text-slate-400'}`} />
          <span>Team Live Board</span>
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full font-bold transition-colors ${
              activeTab === 'team'
                ? 'bg-white/20 text-white'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {dailyRecords.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
            activeTab === 'reports'
              ? 'bg-brand text-white shadow-lg shadow-brand/25 border border-brand/40 ring-1 ring-white/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FileSpreadsheet className={`w-4 h-4 ${activeTab === 'reports' ? 'text-white' : 'text-slate-400'}`} /> Monthly Reports & Audit
        </button>
        <button
          onClick={() => setActiveTab('penalties')}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
            activeTab === 'penalties'
              ? 'bg-brand text-white shadow-lg shadow-brand/25 border border-brand/40 ring-1 ring-white/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <ShieldAlert className={`w-4 h-4 ${activeTab === 'penalties' ? 'text-white' : 'text-slate-400'}`} />
          <span>Penalty Ledger</span>
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full font-bold transition-colors ${
              activeTab === 'penalties'
                ? 'bg-white/20 text-white'
                : 'bg-slate-800 text-slate-400'
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
          <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                  Employee Self-Service Kiosk
                </span>
                <div className="mt-1">
                  <select
                    value={selectedEmployeeId}
                    onChange={e => setSelectedEmployeeId(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-white text-sm font-semibold rounded-lg px-3 py-2"
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border ${
                    geofenceStatus === 'INSIDE'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : geofenceStatus === 'OUTSIDE'
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
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
            <div className="my-8 text-center">
              <div className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-400 tracking-tight font-mono">
                {currentTime.toLocaleTimeString('en-GB', { hour12: false })}
              </div>
              <div className="text-sm font-medium text-slate-400 mt-2">
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
              <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-medium">Assigned Geofence Center</div>
                    <div className="text-sm font-bold text-white">{nearestBranch.branchName}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Distance to Center</div>
                  <div className="text-sm font-bold text-sky-300">
                    {nearestBranch.distance}m <span className="text-slate-500 font-normal">/ {nearestBranch.radius}m max</span>
                  </div>
                </div>
              </div>
            )}

            {/* Geofence Perimeter Warning Banner if Outside */}
            {geofenceStatus === 'OUTSIDE' && (
              <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-3.5 flex items-center gap-3 text-rose-300 mb-4">
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 animate-pulse" />
                <div className="text-xs">
                  <span className="font-bold">Punch Locked (Outside Geofence):</span> You cannot clock in or clock out while outside your assigned branch perimeter ({nearestBranch?.distance ?? 0}m away / max radius {nearestBranch?.radius ?? 50}m).
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
                      ? 'bg-slate-800/90 text-rose-400/80 border border-rose-800/50 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/25 disabled:opacity-50'
                  }`}
                >
                  {geofenceStatus === 'OUTSIDE' ? (
                    <>
                      <ShieldAlert className="w-6 h-6 text-rose-400" />
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
                      ? 'bg-slate-800/90 text-rose-400/80 border border-rose-800/50 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white shadow-rose-500/25 disabled:opacity-50'
                  }`}
                >
                  {geofenceStatus === 'OUTSIDE' ? (
                    <>
                      <ShieldAlert className="w-6 h-6 text-rose-400" />
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
                <div className="flex-1 py-4 bg-slate-800 text-slate-400 font-bold text-center rounded-2xl border border-slate-700">
                  Daily Punches Completed for Today
                </div>
              )}

              <button
                onClick={acquireGpsPosition}
                disabled={isAcquiringGps}
                className="px-5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-slate-700 flex flex-col items-center justify-center gap-1 transition"
                title="Recalibrate GPS"
              >
                <Compass className={`w-5 h-5 ${isAcquiringGps ? 'animate-spin' : ''}`} />
                <span className="text-[10px] font-semibold">Recalibrate</span>
              </button>
            </div>
          </div>

          {/* Right Column: Shift Details & Punches Timeline */}
          <div className="space-y-6">
            {/* Shift Card */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-400" /> Scheduled Duty Shift
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Shift Code</span>
                  <span className="font-bold text-white">{todayRecord?.scheduledShiftCode || 'REGULAR'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Scheduled Hours</span>
                  <span className="font-bold text-sky-400">
                    {todayRecord?.scheduledStartTime || '08:00'} — {todayRecord?.scheduledEndTime || '16:00'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Current Status</span>
                  <span className="font-bold text-emerald-400 uppercase">
                    {todayRecord?.status || 'SCHEDULED'}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-400">Late Minutes</span>
                  <span className="font-bold text-amber-400">{todayRecord?.lateMinutes || 0} mins</span>
                </div>
              </div>
            </div>

            {/* Today Punches Timeline */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-400" /> Today's GPS Punch Log
              </h3>
              {todayPunches.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">No punches recorded yet today.</div>
              ) : (
                <div className="space-y-3">
                  {todayPunches.map(p => (
                    <div
                      key={p.id}
                      className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            p.punchType === 'CLOCK_IN' ? 'bg-emerald-400' : 'bg-rose-400'
                          }`}
                        />
                        <div>
                          <div className="font-bold text-white">{p.punchType.replace('_', ' ')}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {new Date(p.punchTime).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            p.geofenceValidation === 'INSIDE'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {p.geofenceValidation}
                        </span>
                        {p.accuracy && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">±{Math.round(p.accuracy)}m</div>
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
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white text-xs font-semibold rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <select
                  value={teamBranchFilter}
                  onChange={e => setTeamBranchFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white text-xs font-semibold rounded-lg px-3 py-2"
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
                  className="bg-slate-800 border border-slate-700 text-white text-xs font-semibold rounded-lg px-3 py-2"
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
                  className="bg-slate-800 border border-slate-700 text-white text-xs font-semibold rounded-lg px-3 py-2"
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
                  className="bg-slate-800 border border-slate-700 pl-9 pr-3 py-2 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <button
                onClick={() => setShowManualModal(true)}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-sky-500/20"
              >
                <Plus className="w-3.5 h-3.5" /> Manual Attendance Entry
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 uppercase tracking-wider text-[11px] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Branch</th>
                    <th className="py-3 px-4">Shift</th>
                    <th className="py-3 px-4">Clock In</th>
                    <th className="py-3 px-4">Clock Out</th>
                    <th className="py-3 px-4">Geofence</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Late Mins</th>
                    <th className="py-3 px-4 text-right">Net Hours</th>
                    <th className="py-3 px-4">Registered Fingerprint</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTeamRecords.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-slate-500">
                        No attendance records found for this date and filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTeamRecords.map(rec => (
                      <tr key={rec.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-bold text-white">
                          <div>{rec.employeeName || 'Staff'}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{rec.employeeCode}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-700">
                            {rec.category || 'Staff'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">{rec.scheduledBranchName || '—'}</td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          {rec.scheduledStartTime || '—'} - {rec.scheduledEndTime || '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-emerald-400">
                          {rec.actualClockIn ? new Date(rec.actualClockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-rose-400">
                          {rec.actualClockOut ? new Date(rec.actualClockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              rec.clockInGeofence === 'INSIDE'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : rec.clockInGeofence === 'OUTSIDE'
                                ? 'bg-rose-500/20 text-rose-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {rec.clockInGeofence}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              rec.status === 'PRESENT'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : rec.status === 'LATE'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : rec.status === 'ABSENT'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : rec.status === 'ON_LEAVE'
                                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                                : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-amber-400">
                          {rec.lateMinutes > 0 ? `${rec.lateMinutes}m` : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-right text-slate-200 font-bold">
                          {(rec.netWorkedMinutes / 60).toFixed(1)}h
                        </td>

                        {/* Registered Fingerprint */}
                        <td className="py-3 px-4">
                          {(() => {
                            const fp = registeredFingerprints[rec.employeeId] || rec.registeredFingerprint;
                            return fp ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                <Fingerprint className="w-3.5 h-3.5 text-emerald-400" />
                                {fp}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-slate-500 border border-dashed border-slate-700">
                                Not Registered
                              </span>
                            );
                          })()}
                        </td>

                        {/* Admin Edit / Delete Actions */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleEditFingerprint(rec.employeeId, rec.employeeName || 'Staff')}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-sky-500/20 text-slate-400 hover:text-sky-300 border border-slate-700 hover:border-sky-500/30 transition shadow-sm"
                              title="Edit / Register Fingerprint"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {(registeredFingerprints[rec.employeeId] || rec.registeredFingerprint) && (
                              <button
                                onClick={() => handleDeleteFingerprint(rec.employeeId, rec.employeeName || 'Staff')}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 transition shadow-sm"
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
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-400">Month:</label>
                <input
                  type="month"
                  value={reportMonth}
                  onChange={e => setReportMonth(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white text-xs font-semibold rounded-lg px-3 py-2"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-400">Category:</label>
                <select
                  value={reportCategoryFilter}
                  onChange={e => setReportCategoryFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white text-xs font-semibold rounded-lg px-3 py-2"
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
                  className="bg-slate-800 border border-slate-700 pl-9 pr-3 py-2 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition"
              title="Export official Excel workbook with dedicated tab for each role category"
            >
              {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export Official Excel Report
            </button>
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 uppercase tracking-wider text-[11px] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-center">Scheduled</th>
                    <th className="py-3 px-4 text-center">Present</th>
                    <th className="py-3 px-4 text-center">Late</th>
                    <th className="py-3 px-4 text-center">Absent</th>
                    <th className="py-3 px-4 text-center">Attendance %</th>
                    <th className="py-3 px-4 text-center">Punctuality Score</th>
                    <th className="py-3 px-4 text-right">Penalties (BHD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredMonthlyReports.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500">
                        No monthly records found for the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredMonthlyReports.map(rep => (
                      <tr key={rep.employeeId} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-bold text-white">
                          <div>{rep.employeeName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{rep.employeeCode}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-700">
                            {rep.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold">{rep.scheduledDays}</td>
                        <td className="py-3 px-4 text-center text-emerald-400 font-bold">{rep.presentDays}</td>
                        <td className="py-3 px-4 text-center text-amber-400 font-bold">{rep.lateDays}</td>
                        <td className="py-3 px-4 text-center text-rose-400 font-bold">{rep.absentDays}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`font-black text-xs ${
                              rep.attendancePercentage >= 95
                                ? 'text-emerald-400'
                                : rep.attendancePercentage >= 85
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {rep.attendancePercentage}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-bold text-sky-300">{rep.punctualityScore}/100</span>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-amber-400 font-mono">
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
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 uppercase tracking-wider text-[11px] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Violation Rule</th>
                    <th className="py-3 px-4">Tier / Action</th>
                    <th className="py-3 px-4">Occurrence</th>
                    <th className="py-3 px-4 text-right">Deduction (BHD)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {penalties.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No disciplinary violations recorded in the ledger.
                      </td>
                    </tr>
                  ) : (
                    penalties.map(pen => (
                      <tr key={pen.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-mono text-slate-400">{pen.date}</td>
                        <td className="py-3 px-4 font-bold text-white">{pen.employeeName || pen.employeeId}</td>
                        <td className="py-3 px-4 font-semibold text-slate-200">{pen.ruleName}</td>
                        <td className="py-3 px-4">
                          <span className="text-amber-300 font-bold">{pen.action.replace(/_/g, ' ')}</span>
                          <span className="text-[10px] text-slate-500 ml-1.5">(Tier {pen.tier})</span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-semibold">#{pen.occurrenceNumber}</td>
                        <td className="py-3 px-4 text-right font-black font-mono text-amber-400">
                          {pen.calculatedDeductionBhd.toFixed(3)} BHD
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              pen.isWaived
                                ? 'bg-slate-800 text-slate-400 line-through'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {pen.isWaived ? 'Waived' : 'Active'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {!pen.isWaived && (
                            <button
                              onClick={() => handleWaivePenalty(pen.id)}
                              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition"
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-sky-400" /> Record Manual Attendance Punch
              </h3>
              <button
                onClick={() => setShowManualModal(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Select Employee</label>
                <select
                  value={manualEmpId}
                  onChange={e => setManualEmpId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs"
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
                <label className="block text-slate-400 mb-1 font-semibold">Date</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={e => setManualDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Clock In Time</label>
                  <input
                    type="time"
                    value={manualClockIn}
                    onChange={e => setManualClockIn(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Clock Out Time</label>
                  <input
                    type="time"
                    value={manualClockOut}
                    onChange={e => setManualClockOut(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Manager Justification / Override Rationale <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={manualReason}
                  onChange={e => setManualReason(e.target.value)}
                  placeholder="e.g. Employee forgot phone at home / System GPS outage reported"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-3 text-xs focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowManualModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleManualSubmit}
                className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold rounded-lg shadow-lg shadow-sky-500/20"
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
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-hidden">
          <div className="w-full max-w-[96vw] 2xl:max-w-[1550px] h-[88vh] min-h-[620px] max-h-[88vh] flex flex-col my-auto transition-all duration-200">
            <AttendancePenaltyConfigPanel onClose={() => setShowConfigModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
};
