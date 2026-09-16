import { 
  DutySchedule, 
  DutyScheduleAssignment, 
  PharmacistSchedulingProfile, 
  DutySchedulerLeaveRecord,
  BranchShiftType 
} from '../types';
import { getCalendarDatesInRange, getSafeDateDetails } from './schedulingEngine';

export interface DutyScheduleExportParams {
  schedule: DutySchedule;
  assignments: DutyScheduleAssignment[];
  profiles: PharmacistSchedulingProfile[];
  employees: any[];
  branches: any[];
  leaves?: DutySchedulerLeaveRecord[];
  branchShiftTypes?: BranchShiftType[];
  regionName?: string;
}

export const dutyScheduleExportService = {
  exportScheduleToExcel: async ({
    schedule,
    assignments,
    profiles,
    employees,
    branches,
    leaves = [],
    branchShiftTypes = [],
    regionName = 'All Regions'
  }: DutyScheduleExportParams): Promise<void> => {
    // Dynamic import for performance and chunking (vendor-excel)
    const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
      import('exceljs'),
      import('file-saver')
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Tabarak Hub Automated Duty Scheduler';
    workbook.created = new Date();

    const getEmployee = (empId: string) => {
      return employees.find(e => e.id === empId);
    };

    const getEmployeeName = (empId: string) => {
      const emp = getEmployee(empId);
      if (!emp) return 'Unknown Pharmacist';
      return emp.full_name;
    };

    const getFormattedDoctorName = (empId: string) => {
      const name = getEmployeeName(empId);
      const clean = name.replace(/^dr[\.\s]+/i, '').trim().toUpperCase();
      return `DR. ${clean}`;
    };

    const getBranch = (bId?: string) => {
      if (!bId) return null;
      return branches.find(b => b.id === bId);
    };

    const getBranchName = (bId?: string) => {
      const b = getBranch(bId);
      return b ? b.name : (bId || 'Unknown Branch');
    };

    const getBranchCode = (bId?: string) => {
      const b = getBranch(bId);
      return b ? b.code : (bId?.slice(0, 4) || '');
    };

    // Calculate dates array
    const dateList: string[] = getCalendarDatesInRange(schedule.periodStart, schedule.periodEnd);

    // 1. Identify Target Pharmacists (from schedule profiles or with assignments)
    let targetPharmacists = employees.filter(emp => {
      const hasAssignment = assignments.some(a => a.employeeId === emp.id);
      const hasProfile = profiles.some(p => p.employeeId === emp.id && (!schedule.zoneId || p.zoneId === schedule.zoneId || p.secondaryZoneId === schedule.zoneId));
      return hasAssignment || hasProfile;
    });

    if (targetPharmacists.length === 0) {
      targetPharmacists = employees.slice(0, 15);
    }
    // Sort by name
    targetPharmacists.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

    // 2. Identify Target Branches (from zone or with assignments)
    let targetBranches = branches.filter(b => {
      const hasAssignment = assignments.some(a => a.branchId === b.id);
      return hasAssignment;
    });

    if (targetBranches.length === 0) {
      targetBranches = branches.slice(0, 5);
    }
    // Sort by branch code / name
    targetBranches.sort((a, b) => (a.code || a.name || '').localeCompare(b.code || b.name || ''));

    // Map assignments: [employeeId][date] -> assignment
    const empDateAssignmentMap = new Map<string, Map<string, DutyScheduleAssignment>>();
    // Map assignments: [branchId][date][shiftCode] -> DutyScheduleAssignment[]
    const branchDateShiftMap = new Map<string, Map<string, Map<string, DutyScheduleAssignment[]>>>();

    for (const a of assignments) {
      // By emp + date
      if (!empDateAssignmentMap.has(a.employeeId)) {
        empDateAssignmentMap.set(a.employeeId, new Map());
      }
      empDateAssignmentMap.get(a.employeeId)!.set(a.date, a);

      // By branch + date + shift
      if (!branchDateShiftMap.has(a.branchId)) {
        branchDateShiftMap.set(a.branchId, new Map());
      }
      const bMap = branchDateShiftMap.get(a.branchId)!;
      if (!bMap.has(a.date)) {
        bMap.set(a.date, new Map());
      }
      const dMap = bMap.get(a.date)!;
      const sCode = a.shiftCode || 'AM';
      if (!dMap.has(sCode)) {
        dMap.set(sCode, []);
      }
      dMap.get(sCode)!.push(a);
    }

    // Map leaves: [employeeId][date] -> leave
    const leaveMap = new Map<string, Map<string, DutySchedulerLeaveRecord>>();
    for (const l of leaves) {
      if (!leaveMap.has(l.employeeId)) {
        leaveMap.set(l.employeeId, new Map());
      }
      const sDate = String(l.startDate || '').split('T')[0].trim();
      const eDate = String(l.endDate || '').split('T')[0].trim();
      if (!sDate || !eDate) continue;
      for (const dStr of getCalendarDatesInRange(sDate, eDate)) {
        leaveMap.get(l.employeeId)!.set(dStr, l);
      }
    }

    // =========================================================================
    // SHEET 1: Operational Schedule (Exact Format matching "schedule demo.xlsx")
    // =========================================================================
    const sheetName = 'Operational Schedule';
    const mainSheet = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', xSplit: 2, ySplit: 2 }]
    });

    // Determine Branch Shifts layout
    // For each branch, get configured shifts (e.g. AM, PM, NIGHT) or default ['AM', 'PM'] + VACATION
    interface BranchShiftColDef {
      branchId: string;
      branchName: string;
      shiftCode: string;
      headerLabel: string;
      isVacationCol?: boolean;
      isAnnualCol?: boolean;
    }

    const branchColDefs: BranchShiftColDef[] = [];
    const branchRanges: { branchId: string; branchName: string; startCol: number; endCol: number }[] = [];

    let currentBranchCol = 3 + (targetPharmacists.length * 2); // after DATE, DAY, and Pharmacist cols

    for (const branch of targetBranches) {
      const bShifts = branchShiftTypes.filter(s => s.branchId === branch.id && s.isActive !== false);
      let shiftCodes = bShifts.map(s => s.code);
      if (shiftCodes.length === 0) {
        // Inspect assignments for this branch to see what shifts are used
        const usedShifts = Array.from(new Set(
          assignments.filter(a => a.branchId === branch.id).map(a => a.shiftCode).filter(Boolean)
        ));
        shiftCodes = usedShifts.length > 0 ? usedShifts : ['AM', 'PM'];
      }
      // Ensure AM comes before PM
      shiftCodes.sort((a, b) => {
        if (a === 'AM') return -1;
        if (b === 'AM') return 1;
        return a.localeCompare(b);
      });

      const startCol = currentBranchCol;

      for (const sc of shiftCodes) {
        const shiftCfg = bShifts.find(s => s.code === sc);
        let timingLabel = sc;
        if (shiftCfg?.startTime && shiftCfg?.endTime) {
          const sFormatted = shiftCfg.startTime.slice(0, 5).replace(/^0/, '');
          const eFormatted = shiftCfg.endTime.slice(0, 5).replace(/^0/, '');
          timingLabel = `${sc} ( ${sFormatted} - ${eFormatted} )`;
        }
        branchColDefs.push({
          branchId: branch.id,
          branchName: branch.name,
          shiftCode: sc,
          headerLabel: timingLabel
        });
        currentBranchCol++;
      }

      // Add VACATION column for this branch
      branchColDefs.push({
        branchId: branch.id,
        branchName: branch.name,
        shiftCode: 'VACATION',
        headerLabel: 'VACATION',
        isVacationCol: true
      });
      currentBranchCol++;

      branchRanges.push({
        branchId: branch.id,
        branchName: branch.name,
        startCol,
        endCol: currentBranchCol - 1
      });
    }

    // --- Build Row 1 (Group Header) ---
    // Col 1 & 2: DATE & DAY
    mainSheet.getCell(1, 1).value = 'DATE';
    mainSheet.getCell(2, 1).value = '';
    mainSheet.mergeCells(1, 1, 2, 1);

    mainSheet.getCell(1, 2).value = 'DAY';
    mainSheet.getCell(2, 2).value = '';
    mainSheet.mergeCells(1, 2, 2, 2);

    for (let c = 1; c <= 2; c++) {
      const cell = mainSheet.getCell(1, c);
      cell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF000000' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } }
      };
    }

    // Pharmacists Group Header in Row 1 & Sub-headers in Row 2
    let pharmColIdx = 3;
    for (const pharm of targetPharmacists) {
      const c1 = pharmColIdx;
      const c2 = pharmColIdx + 1;

      // Row 1: Merged Doctor Name
      mainSheet.mergeCells(1, c1, 1, c2);
      const pharmCell = mainSheet.getCell(1, c1);
      pharmCell.value = getFormattedDoctorName(pharm.id);
      pharmCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF000000' } };
      pharmCell.alignment = { vertical: 'middle', horizontal: 'center' };
      pharmCell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } }
      };

      // Row 2: LOCATION & TIME
      const locCell = mainSheet.getCell(2, c1);
      locCell.value = 'LOCATION';
      locCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      locCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      locCell.alignment = { vertical: 'middle', horizontal: 'center' };
      locCell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } }
      };

      const timeCell = mainSheet.getCell(2, c2);
      timeCell.value = 'TIME';
      timeCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      timeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      timeCell.alignment = { vertical: 'middle', horizontal: 'center' };
      timeCell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } }
      };

      pharmColIdx += 2;
    }

    // Branches Group Header in Row 1 & Sub-headers in Row 2
    for (const bRange of branchRanges) {
      mainSheet.mergeCells(1, bRange.startCol, 1, bRange.endCol);
      const bHeaderCell = mainSheet.getCell(1, bRange.startCol);
      bHeaderCell.value = bRange.branchName.toUpperCase();
      bHeaderCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
      // Theme 2: 44546A (Dark slate / Navy gray) matching schedule demo.xlsx
      bHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF44546A' } };
      bHeaderCell.alignment = { vertical: 'middle', horizontal: 'center' };
      bHeaderCell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } }
      };
    }

    // Row 2: Sub-headers for Branch Shifts
    let bColIdx = 3 + (targetPharmacists.length * 2);
    for (const def of branchColDefs) {
      const cell = mainSheet.getCell(2, bColIdx);
      cell.value = def.headerLabel;
      cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF0F172A' } };
      // Theme 3: E7E6E6 (Light silver gray) matching schedule demo.xlsx
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } }
      };
      bColIdx++;
    }

    mainSheet.getRow(1).height = 26;
    mainSheet.getRow(2).height = 22;

    // --- Build Daily Data Rows ---
    dateList.forEach((dateStr, dIdx) => {
      const rowNum = 3 + dIdx;
      const row = mainSheet.getRow(rowNum);
      row.height = 20;

      const details = getSafeDateDetails(dateStr);
      const dayName = details.dayNameLong;
      const isWeekend = details.isWeekend;

      // Col 1: DATE
      const dateCell = row.getCell(1);
      dateCell.value = dateStr;
      dateCell.font = { name: 'Calibri', size: 9, color: { argb: 'FF1E293B' } };
      dateCell.alignment = { vertical: 'middle', horizontal: 'center' };
      dateCell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      // Col 2: DAY
      const dayCell = row.getCell(2);
      dayCell.value = dayName;
      dayCell.font = { name: 'Calibri', size: 9, bold: isWeekend, color: { argb: 'FF1E293B' } };
      dayCell.alignment = { vertical: 'middle', horizontal: 'center' };
      if (isWeekend) {
        // Yellow highlight matching demo
        dayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
      }
      dayCell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      // Section 1: Pharmacist columns (LOCATION, TIME)
      let pCol = 3;
      for (const pharm of targetPharmacists) {
        const locCell = row.getCell(pCol);
        const timeCell = row.getCell(pCol + 1);

        const assignment = empDateAssignmentMap.get(pharm.id)?.get(dateStr);
        const leave = leaveMap.get(pharm.id)?.get(dateStr);

        const hasLeave = Boolean(leave);
        const isOffDay = !assignment && !leave;

        locCell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        timeCell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        if (hasLeave && leave) {
          mainSheet.mergeCells(rowNum, pCol, rowNum, pCol + 1);
          locCell.value = leave.leaveType === 'ANNUAL' ? 'Annual Leave' : (leave.leaveType || 'Leave');
          locCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF991B1B' } };
          locCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
          locCell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (isOffDay) {
          mainSheet.mergeCells(rowNum, pCol, rowNum, pCol + 1);
          locCell.value = 'Off Day';
          locCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
          locCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
          locCell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          locCell.value = getBranchName(assignment.branchId);
          locCell.font = { name: 'Calibri', size: 9, color: { argb: 'FF0F172A' } };
          locCell.alignment = { vertical: 'middle', horizontal: 'left' };
          timeCell.value = assignment.shiftCode;
          timeCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: assignment.shiftCode === 'AM' ? 'FF0F766E' : 'FF1E40AF' } };
          timeCell.alignment = { vertical: 'middle', horizontal: 'center' };
        }

        pCol += 2;
      }

      // Section 2: Branch Shift columns
      let bCol = 3 + (targetPharmacists.length * 2);
      for (const def of branchColDefs) {
        const cell = row.getCell(bCol);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };

        if (def.isVacationCol) {
          // Check if any pharmacist whose primary branch is this branch has a leave or is off today
          const branchLeaves = targetPharmacists.filter(p => {
            const pProfile = profiles.find(pr => pr.employeeId === p.id);
            const isPrimary = pProfile?.primaryBranchId === def.branchId;
            const hasAssignment = empDateAssignmentMap.get(p.id)?.get(dateStr);
            // If pharmacist is working today, they are NOT on vacation
            if (hasAssignment) return false;
            const hasLeave = leaveMap.get(p.id)?.get(dateStr);
            return isPrimary && (hasLeave || !hasAssignment);
          });

          if (branchLeaves.length > 0) {
            cell.value = branchLeaves.map(p => getFormattedDoctorName(p.id)).join(' & ');
            cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF991B1B' } };
          } else {
            cell.value = '-';
            cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF94A3B8' } };
          }
        } else {
          // Check assignment for this branch + date + shiftCode
          const assignedList = branchDateShiftMap.get(def.branchId)?.get(dateStr)?.get(def.shiftCode) || [];

          if (assignedList.length > 0) {
            cell.value = assignedList.map(a => getFormattedDoctorName(a.employeeId)).join(' & ');
            cell.font = { name: 'Calibri', size: 9, bold: false, color: { argb: 'FF0F172A' } };
          } else {
            // Uncovered required shift (if any)
            cell.value = 'UNASSIGNED';
            cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF94A3B8' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
          }
        }

        bCol++;
      }
    });

    // =========================================================================
    // SHEET 1 (Bottom): Attendance & KPIs Summary Table
    // =========================================================================
    const kpiStartRow = 3 + dateList.length + 3; // Leave 2 blank rows after the schedule

    // Title Row
    mainSheet.mergeCells(kpiStartRow, 1, kpiStartRow, 8);
    const kpiTitleCell = mainSheet.getCell(kpiStartRow, 1);
    kpiTitleCell.value = 'PHARMACIST ATTENDANCE & KPI SUMMARY';
    kpiTitleCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    kpiTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF44546A' } };
    kpiTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    mainSheet.getRow(kpiStartRow).height = 25;

    // Header Row
    const kpiHeaders = [
      '#',
      'PHARMACIST NAME',
      'ROLE',
      'PRIMARY BRANCH',
      'DAYS WORKED',
      'OFF DAYS',
      'ANNUAL LEAVE',
      'TOTAL DAYS'
    ];

    const kpiHeaderRow = mainSheet.getRow(kpiStartRow + 1);
    kpiHeaderRow.height = 22;
    kpiHeaders.forEach((h, idx) => {
      const cell = kpiHeaderRow.getCell(idx + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } }
      };
    });

    let totalWorkSum = 0;
    let totalOffSum = 0;
    let totalAnnualSum = 0;
    let totalDaysSum = 0;

    targetPharmacists.forEach((pharm, pIdx) => {
      const profile = profiles.find(p => p.employeeId === pharm.id);
      const rowIdx = kpiStartRow + 2 + pIdx;
      const kRow = mainSheet.getRow(rowIdx);
      kRow.height = 20;

      let workDays = 0;
      let annualDays = 0;
      let offDays = 0;

      dateList.forEach(dStr => {
        const ass = empDateAssignmentMap.get(pharm.id)?.get(dStr);
        const l = leaveMap.get(pharm.id)?.get(dStr);
        if (l) {
          annualDays++;
        } else if (ass) {
          workDays++;
        } else {
          offDays++;
        }
      });

      const totalEmpDays = workDays + offDays + annualDays;

      totalWorkSum += workDays;
      totalOffSum += offDays;
      totalAnnualSum += annualDays;
      totalDaysSum += totalEmpDays;

      const rowValues = [
        pIdx + 1,
        getFormattedDoctorName(pharm.id),
        profile?.roleType || 'FIXED',
        getBranchName(profile?.primaryBranchId) || '-',
        workDays,
        offDays,
        annualDays,
        totalEmpDays
      ];

      rowValues.forEach((val, cIdx) => {
        const cell = kRow.getCell(cIdx + 1);
        cell.value = val;
        cell.font = { name: 'Calibri', size: 9, bold: cIdx === 1 || cIdx >= 4 };
        cell.alignment = { 
          vertical: 'middle', 
          horizontal: cIdx === 1 ? 'left' : 'center' 
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        // Highlight annual in soft rose
        if (cIdx === 6 && Number(val) > 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        }
      });
    });

    // Total / Summary Row at the bottom of KPI table
    const kpiSummaryRowIdx = kpiStartRow + 2 + targetPharmacists.length;
    const kpiSummaryRow = mainSheet.getRow(kpiSummaryRowIdx);
    kpiSummaryRow.height = 22;

    mainSheet.mergeCells(kpiSummaryRowIdx, 1, kpiSummaryRowIdx, 4);
    const sumLabelCell = kpiSummaryRow.getCell(1);
    sumLabelCell.value = 'TOTAL';
    sumLabelCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    sumLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    sumLabelCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sumLabelCell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'double', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } }
    };

    [totalWorkSum, totalOffSum, totalAnnualSum, totalDaysSum].forEach((sumVal, sIdx) => {
      const cell = kpiSummaryRow.getCell(5 + sIdx);
      cell.value = sumVal;
      cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF475569' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } }
      };
    });

    // Set Column Widths for Sheet 1
    mainSheet.getColumn(1).width = 12; // DATE
    mainSheet.getColumn(2).width = 14; // DAY

    let setColIdx = 3;
    for (let i = 0; i < targetPharmacists.length; i++) {
      mainSheet.getColumn(setColIdx).width = 24;     // LOCATION
      mainSheet.getColumn(setColIdx + 1).width = 8;  // TIME
      setColIdx += 2;
    }

    for (const def of branchColDefs) {
      mainSheet.getColumn(setColIdx).width = def.isVacationCol ? 14 : 18;
      setColIdx++;
    }

    // =========================================================================
    // SHEET 2: Pharmacist Workload View (Spec §28.5)
    // =========================================================================
    const workloadSheet = workbook.addWorksheet('Pharmacist Workload');
    workloadSheet.views = [{ state: 'frozen', ySplit: 1 }];

    const workloadHeaders = [
      'Pharmacist',
      'Role',
      'Primary Branch',
      'Work Days',
      'Total Shifts',
      'AM Shifts',
      'PM Shifts',
      'Night Shifts',
      'Friday Shifts',
      'Saturday Shifts',
      'Off Days',
      'Annual Leave Days',
      'Workload Score'
    ];
    workloadSheet.addRow(workloadHeaders);
    const wlHeaderRow = workloadSheet.getRow(1);
    wlHeaderRow.height = 24;
    wlHeaderRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF44546A' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    targetPharmacists.forEach((pharm) => {
      const profile = profiles.find(p => p.employeeId === pharm.id);
      const empAssignments = assignments.filter(a => a.employeeId === pharm.id);
      const workDays = new Set(empAssignments.map(a => a.date)).size;
      const totalShifts = empAssignments.length;
      const amShifts = empAssignments.filter(a => a.shiftCode === 'AM' || a.shiftCode === 'M').length;
      const pmShifts = empAssignments.filter(a => a.shiftCode === 'PM' || a.shiftCode === 'E').length;
      const nightShifts = empAssignments.filter(a => a.shiftCode === 'NIGHT').length;
      
      const friShifts = empAssignments.filter(a => new Date(a.date + 'T00:00:00').getDay() === 5).length;
      const satShifts = empAssignments.filter(a => new Date(a.date + 'T00:00:00').getDay() === 6).length;

      const totalPeriodDays = dateList.length;
      const empLeaves = leaves.filter(l => l.employeeId === pharm.id);
      const annualLeaveDays = empLeaves.length;
      const offDays = Math.max(0, totalPeriodDays - workDays - annualLeaveDays);

      const workloadScore = (amShifts * 1.0) + (pmShifts * 1.0) + (nightShifts * 1.25) + (friShifts * 0.25);

      const r = workloadSheet.addRow([
        getFormattedDoctorName(pharm.id),
        profile?.roleType || 'FIXED',
        getBranchCode(profile?.primaryBranchId),
        workDays,
        totalShifts,
        amShifts,
        pmShifts,
        nightShifts,
        friShifts,
        satShifts,
        offDays,
        annualLeaveDays,
        Number(workloadScore.toFixed(2))
      ]);
      r.height = 20;
      r.eachCell((cell, cNum) => {
        cell.font = { name: 'Calibri', size: 9 };
        cell.alignment = { vertical: 'middle', horizontal: cNum <= 3 ? 'left' : 'center' };
      });
    });

    workloadSheet.columns.forEach((col) => {
      col.width = 16;
    });
    workloadSheet.getColumn(1).width = 25;

    // Trigger save download
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `Duty_Schedule_${schedule.name ? schedule.name.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_') : 'Export'}_${schedule.periodStart}_to_${schedule.periodEnd}.xlsx`
    );
  }
};
