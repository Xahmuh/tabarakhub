import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Swal from 'sweetalert2';
import {
  AlertTriangle, ShieldAlert, Clock, CheckCircle2, RefreshCw, Plus,
  Search, Filter, Calendar, FileText, Building2, ShieldCheck, UserCheck,
  Download, Printer, ChevronRight, X, ExternalLink, ChevronLeft,
  ChevronDown, Layers, ArrowUpDown, Truck, Banknote, Sliders,
  Activity, Database, AlertCircle, TrendingUp, Sparkles, Check, Edit3,
  Archive
} from 'lucide-react';
import {
  Branch,
  Role,
  OperationalRenewalRecord,
  OperationalRenewalFilters,
  OperationalRenewalType,
  AlertSeverity,
} from '../../types';
import { BackToModulesButton } from '../shared';
import { operationalRenewalService, getOperationalEntityDisplayName, RENEWALS_UPDATED_EVENT } from '../../services/operationalRenewalService';
import { RenewalDetailsDrawer } from './RenewalDetailsDrawer';
import { RenewalFormModal } from './RenewalFormModal';
import { MarkRenewedModal } from './MarkRenewedModal';
import { RenewalBudgetPlannerTab } from './RenewalBudgetPlannerTab';
import { RenewalTariffControlCenter } from './RenewalTariffControlCenter';
import { RenewalArchiveTab } from './RenewalArchiveTab';
import { RenewalReportPrintModal } from './RenewalReportPrintModal';
import { exportRenewalsToExcel, exportRenewalsToCsv } from './utils/exportRenewals';

interface OperationalRenewalsHubProps {
  user: Branch;
  checkPermission: (feature: string, minimum?: 'edit' | 'read') => boolean;
  onBack: () => void;
}

export const OperationalRenewalsHub: React.FC<OperationalRenewalsHubProps> = ({
  user,
  checkPermission,
  onBack
}) => {
  const role: Role = user.role;
  const isPrivileged = ['owner', 'admin', 'manager', 'accounts'].includes(role);
  const canEdit = isPrivileged || checkPermission('operational_renewals', 'edit') || checkPermission('operational_renewals:edit', 'edit');
  const canCreate = canEdit || checkPermission('operational_renewals:create', 'edit');
  const canManage = canEdit || checkPermission('operational_renewals:manage', 'edit');
  const canDelete = isPrivileged || checkPermission('operational_renewals:delete', 'edit');

  const [records, setRecords] = useState<OperationalRenewalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab switcher: renewals, budget, tariffs, archive
  const [activeMainTab, setActiveMainTab] = useState<'renewals' | 'budget' | 'tariffs' | 'archive'>('renewals');

  // Filters State
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<OperationalRenewalType | 'ALL'>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<AlertSeverity | 'ALL'>('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState<OperationalRenewalFilters['expiryPeriod']>('ALL');
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'CRITICAL' | 'EXPIRED' | 'NEXT_7_DAYS' | 'NEXT_30_DAYS' | 'NEXT_90_DAYS'>('ALL');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Sorting
  const [sortField, setSortField] = useState<'severity' | 'expiryDate' | 'daysRemaining' | 'entityName' | 'renewalType' | 'estimatedCost'>('severity');
  const [sortAsc, setSortAsc] = useState(true);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Drawer & Modals
  const [selectedRecord, setSelectedRecord] = useState<OperationalRenewalRecord | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editRecord, setEditRecord] = useState<OperationalRenewalRecord | null>(null);
  const [showRenewModalRecord, setShowRenewModalRecord] = useState<OperationalRenewalRecord | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const currentUser = useMemo(() => {
    let rolePrefix = 'User';
    if (['owner', 'admin'].includes(user.role)) {
      rolePrefix = 'Admin';
    } else if (user.role === 'accounts') {
      rolePrefix = 'Accounts';
    } else if (user.role === 'manager') {
      rolePrefix = 'Manager';
    } else if (user.role === 'supervisor') {
      rolePrefix = 'Supervisor';
    }

    return {
      id: user.userId || user.id,
      name: `${rolePrefix} (${user.name || user.code || 'User'})`,
      code: user.code,
      role: user.role
    };
  }, [user]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await operationalRenewalService.list();
      setRecords(list);
    } catch (err) {
      console.error('Failed to load operational renewals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const [syncing, setSyncing] = useState(false);

  const handleSyncMasterData = useCallback(async () => {
    setSyncing(true);
    try {
      await operationalRenewalService.syncMasterData();
      await fetchData();
    } catch (err) {
      console.error('Failed to sync master data:', err);
    } finally {
      setSyncing(false);
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData();
    const handleUpdate = () => {
      fetchData();
    };
    window.addEventListener(RENEWALS_UPDATED_EVENT, handleUpdate);
    return () => {
      window.removeEventListener(RENEWALS_UPDATED_EVENT, handleUpdate);
    };
  }, [fetchData]);

  // Overall counts for KPI Cards
  const kpiStats = useMemo(() => {
    const totalActive = records.length;
    const criticalCount = records.filter(r => r.severity === 'CRITICAL').length;
    const expiredCount = records.filter(r => r.severity === 'EXPIRED').length;
    const urgentCount = records.filter(r => r.severity === 'URGENT').length;
    const warningCount = records.filter(r => r.severity === 'WARNING').length;
    const upcomingCount = records.filter(r => r.severity === 'UPCOMING').length;
    const expiringSoonCount = records.filter(r => r.daysRemaining >= 0 && r.daysRemaining <= 30).length;

    const distribution = {
      EXPIRED: expiredCount,
      CRITICAL: criticalCount,
      URGENT: urgentCount,
      WARNING: warningCount,
      UPCOMING: upcomingCount,
      NORMAL: records.filter(r => r.severity === 'NORMAL').length
    };

    return {
      totalActive,
      criticalCount,
      expiredCount,
      urgentCount,
      warningCount,
      upcomingCount,
      expiringSoonCount,
      distribution
    };
  }, [records]);

  // Overall Estimated Financial Renewal Liability across all active records
  const totalEstimatedLiability = useMemo(() => {
    return records.reduce((sum, r) => {
      if (r.estimatedCost !== undefined && r.estimatedCost !== null) {
        return sum + Number(r.estimatedCost);
      }
      const tariff = operationalRenewalService.lookupTariff({
        renewalType: r.renewalType,
        entityName: r.entityName,
        documentNumber: r.documentNumber,
        branchCode: r.costCenterCode,
        branchName: r.branchName,
        documentType: r.documentType
      });
      return sum + (Number(tariff?.cost) || 0);
    }, 0);
  }, [records]);

  // Executive Group Compliance Health Score
  const complianceScore = useMemo(() => {
    if (!records.length) return 100;
    const safeCount = records.filter(r => r.severity === 'NORMAL' || r.severity === 'UPCOMING').length;
    return Math.round((safeCount / records.length) * 100);
  }, [records]);

  // Live Registry Feed Breakdown for quick navigation chips
  const feedStats = useMemo(() => {
    const isCr = (r: OperationalRenewalRecord) => r.renewalType === 'CR' || r.renewalType === 'CHAMBER_OF_COMMERCE';
    const isNhraPharm = (r: OperationalRenewalRecord) =>
      r.renewalType === 'NHRA_PHARMACY' ||
      (r.renewalType === 'NHRA' &&
        !r.entityName.toLowerCase().includes('pharmacist') &&
        !r.documentType.toLowerCase().includes('pharmacist') &&
        r.entityType !== 'EMPLOYEE');
    const isNhraStaff = (r: OperationalRenewalRecord) =>
      r.renewalType === 'NHRA_PHARMACIST' ||
      (r.renewalType === 'NHRA' &&
        (r.entityName.toLowerCase().includes('pharmacist') ||
          r.documentType.toLowerCase().includes('pharmacist') ||
          r.entityType === 'EMPLOYEE'));
    const isWp = (r: OperationalRenewalRecord) => r.renewalType === 'WORK_PERMIT';
    const isFleet = (r: OperationalRenewalRecord) => r.renewalType === 'FLEET_VEHICLE';

    return {
      cr: {
        count: records.filter(isCr).length,
        urgent: records.filter(r => isCr(r) && (r.severity === 'CRITICAL' || r.severity === 'EXPIRED')).length
      },
      nhraPharm: {
        count: records.filter(isNhraPharm).length,
        urgent: records.filter(r => isNhraPharm(r) && (r.severity === 'CRITICAL' || r.severity === 'EXPIRED')).length
      },
      nhraStaff: {
        count: records.filter(isNhraStaff).length,
        urgent: records.filter(r => isNhraStaff(r) && (r.severity === 'CRITICAL' || r.severity === 'EXPIRED')).length
      },
      wp: {
        count: records.filter(isWp).length,
        urgent: records.filter(r => isWp(r) && (r.severity === 'CRITICAL' || r.severity === 'EXPIRED')).length
      },
      fleet: {
        count: records.filter(isFleet).length,
        urgent: records.filter(r => isFleet(r) && (r.severity === 'CRITICAL' || r.severity === 'EXPIRED')).length
      }
    };
  }, [records]);

  // Toggle feed filter
  const handleToggleFeedFilter = (type: OperationalRenewalType) => {
    if (selectedType === type) {
      setSelectedType('ALL');
    } else {
      setSelectedType(type);
    }
    setPage(1);
  };

  // Toggle KPI card filter
  const handleToggleKpiFilter = (target: 'ALL' | 'CRITICAL' | 'EXPIRED' | 'NEXT_30_DAYS' | 'WARNING' | 'UPCOMING') => {
    setPage(1);
    if (target === 'ALL') {
      applyQuickFilter('ALL');
      return;
    }
    if (target === 'CRITICAL') {
      if (selectedSeverity === 'CRITICAL' || quickFilter === 'CRITICAL') {
        applyQuickFilter('ALL');
      } else {
        applyQuickFilter('CRITICAL');
      }
      return;
    }
    if (target === 'EXPIRED') {
      if (selectedSeverity === 'EXPIRED' || quickFilter === 'EXPIRED') {
        applyQuickFilter('ALL');
      } else {
        applyQuickFilter('EXPIRED');
      }
      return;
    }
    if (target === 'NEXT_30_DAYS') {
      if (selectedPeriod === 'NEXT_30_DAYS' || quickFilter === 'NEXT_30_DAYS') {
        applyQuickFilter('ALL');
      } else {
        applyQuickFilter('NEXT_30_DAYS');
      }
      return;
    }
    if (target === 'WARNING') {
      if (selectedSeverity === 'WARNING') {
        setSelectedSeverity('ALL');
        setQuickFilter('ALL');
        setSelectedPeriod('ALL');
      } else {
        setSelectedSeverity('WARNING');
        setQuickFilter('ALL');
        setSelectedPeriod('ALL');
      }
      return;
    }
    if (target === 'UPCOMING') {
      if (selectedSeverity === 'UPCOMING') {
        setSelectedSeverity('ALL');
        setQuickFilter('ALL');
        setSelectedPeriod('ALL');
      } else {
        setSelectedSeverity('UPCOMING');
        setQuickFilter('ALL');
        setSelectedPeriod('ALL');
      }
      return;
    }
  };

  // Quick filter clicks
  const applyQuickFilter = (q: 'ALL' | 'CRITICAL' | 'EXPIRED' | 'NEXT_7_DAYS' | 'NEXT_30_DAYS' | 'NEXT_90_DAYS') => {
    setQuickFilter(q);
    setPage(1);

    if (q === 'ALL') {
      setSelectedSeverity('ALL');
      setSelectedPeriod('ALL');
    } else if (q === 'CRITICAL') {
      setSelectedSeverity('CRITICAL');
      setSelectedPeriod('ALL');
    } else if (q === 'EXPIRED') {
      setSelectedSeverity('EXPIRED');
      setSelectedPeriod('ALL');
    } else if (q === 'NEXT_7_DAYS') {
      setSelectedSeverity('ALL');
      setSelectedPeriod('NEXT_7_DAYS');
    } else if (q === 'NEXT_30_DAYS') {
      setSelectedSeverity('ALL');
      setSelectedPeriod('NEXT_30_DAYS');
    } else if (q === 'NEXT_90_DAYS') {
      setSelectedSeverity('ALL');
      setSelectedPeriod('NEXT_90_DAYS');
    }
  };

  // Filtered List
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // Type
      if (selectedType !== 'ALL') {
        if (selectedType === 'NHRA_PHARMACY') {
          const isPharmacy =
            r.renewalType === 'NHRA_PHARMACY' ||
            (r.renewalType === 'NHRA' &&
              !r.entityName.toLowerCase().includes('pharmacist') &&
              !r.documentType.toLowerCase().includes('pharmacist') &&
              r.entityType !== 'EMPLOYEE');
          if (!isPharmacy) return false;
        } else if (selectedType === 'NHRA_PHARMACIST') {
          const isPharmacist =
            r.renewalType === 'NHRA_PHARMACIST' ||
            (r.renewalType === 'NHRA' &&
              (r.entityName.toLowerCase().includes('pharmacist') ||
                r.documentType.toLowerCase().includes('pharmacist') ||
                r.entityType === 'EMPLOYEE'));
          if (!isPharmacist) return false;
        } else if (selectedType === 'CR') {
          if (r.renewalType !== 'CR' && r.renewalType !== 'CHAMBER_OF_COMMERCE') return false;
        } else if (r.renewalType !== selectedType) {
          return false;
        }
      }

      // Severity
      if (selectedSeverity !== 'ALL' && r.severity !== selectedSeverity) return false;

      // Period
      if (selectedPeriod !== 'ALL') {
        if (selectedPeriod === 'EXPIRED' && r.daysRemaining >= 0) return false;
        if (selectedPeriod === 'TODAY' && r.daysRemaining !== 0) return false;
        if (selectedPeriod === 'NEXT_7_DAYS' && (r.daysRemaining < 0 || r.daysRemaining > 7)) return false;
        if (selectedPeriod === 'NEXT_30_DAYS' && (r.daysRemaining < 0 || r.daysRemaining > 30)) return false;
        if (selectedPeriod === 'NEXT_60_DAYS' && (r.daysRemaining < 0 || r.daysRemaining > 60)) return false;
        if (selectedPeriod === 'NEXT_90_DAYS' && (r.daysRemaining < 0 || r.daysRemaining > 90)) return false;
      }

      // Search
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const operationalName = getOperationalEntityDisplayName(r).toLowerCase();
        const matches =
          r.entityName.toLowerCase().includes(q) ||
          operationalName.includes(q) ||
          (r.branchName && r.branchName.toLowerCase().includes(q)) ||
          r.documentNumber.toLowerCase().includes(q) ||
          r.documentType.toLowerCase().includes(q) ||
          (r.metadata?.crName && String(r.metadata.crName).toLowerCase().includes(q)) ||
          (r.notes && r.notes.toLowerCase().includes(q));
        if (!matches) return false;
      }

      // Month
      if (selectedMonthKey && (!r.expiryDate || !r.expiryDate.startsWith(selectedMonthKey))) {
        return false;
      }

      return true;
    });
  }, [
    records,
    selectedType,
    selectedSeverity,
    selectedPeriod,
    selectedMonthKey,
    search
  ]);

  // Sorted List
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'severity') {
        const SEV_ORDER: Record<AlertSeverity, number> = {
          EXPIRED: 1,
          CRITICAL: 2,
          URGENT: 3,
          WARNING: 4,
          UPCOMING: 5,
          NORMAL: 6
        };
        cmp = (SEV_ORDER[a.severity] || 99) - (SEV_ORDER[b.severity] || 99);
        if (cmp === 0) cmp = a.daysRemaining - b.daysRemaining;
      } else if (sortField === 'expiryDate') {
        cmp = a.expiryDate.localeCompare(b.expiryDate);
      } else if (sortField === 'daysRemaining') {
        cmp = a.daysRemaining - b.daysRemaining;
      } else if (sortField === 'entityName') {
        const nameA = getOperationalEntityDisplayName(a);
        const nameB = getOperationalEntityDisplayName(b);
        cmp = nameA.localeCompare(nameB);
      } else if (sortField === 'renewalType') {
        const typeA = a.documentType || a.renewalType;
        const typeB = b.documentType || b.renewalType;
        cmp = typeA.localeCompare(typeB);
      } else if (sortField === 'estimatedCost') {
        const costA = a.estimatedCost ?? 0;
        const costB = b.estimatedCost ?? 0;
        cmp = costA - costB;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [filteredRecords, sortField, sortAsc]);

  // Paginated View
  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, page]);

  const totalPages = Math.ceil(sortedRecords.length / pageSize) || 1;

  // Available years for Monthly Breakdown
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearsSet = new Set<number>([currentYear, currentYear + 1]);
    records.forEach(r => {
      if (r.expiryDate) {
        const y = parseInt(r.expiryDate.substring(0, 4), 10);
        if (!isNaN(y) && y >= 2020 && y <= 2035) {
          yearsSet.add(y);
        }
      }
    });
    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [records]);

  // Monthly breakdown calculation
  const monthlyBreakdown = useMemo(() => {
    const months = [
      { key: '01', nameEn: 'Jan', fullName: 'January' },
      { key: '02', nameEn: 'Feb', fullName: 'February' },
      { key: '03', nameEn: 'Mar', fullName: 'March' },
      { key: '04', nameEn: 'Apr', fullName: 'April' },
      { key: '05', nameEn: 'May', fullName: 'May' },
      { key: '06', nameEn: 'Jun', fullName: 'June' },
      { key: '07', nameEn: 'Jul', fullName: 'July' },
      { key: '08', nameEn: 'Aug', fullName: 'August' },
      { key: '09', nameEn: 'Sep', fullName: 'September' },
      { key: '10', nameEn: 'Oct', fullName: 'October' },
      { key: '11', nameEn: 'Nov', fullName: 'November' },
      { key: '12', nameEn: 'Dec', fullName: 'December' }
    ];

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');
    const isCurrentCalendarYear = currentYear === selectedYear;

    return months.map(m => {
      const monthKey = `${selectedYear}-${m.key}`;
      const matched = records.filter(r => r.expiryDate && r.expiryDate.startsWith(monthKey));

      const typeCounts = {
        CR: matched.filter(r => r.renewalType === 'CR').length,
        NHRA_PHARMACY: matched.filter(r => r.renewalType === 'NHRA_PHARMACY' || (r.renewalType === 'NHRA' && r.entityType !== 'EMPLOYEE')).length,
        NHRA_PHARMACIST: matched.filter(r => r.renewalType === 'NHRA_PHARMACIST' || (r.renewalType === 'NHRA' && r.entityType === 'EMPLOYEE')).length,
        WORK_PERMIT: matched.filter(r => r.renewalType === 'WORK_PERMIT').length,
        FLEET_VEHICLE: matched.filter(r => r.renewalType === 'FLEET_VEHICLE').length,
        OTHER: matched.filter(r => r.renewalType === 'OTHER').length,
      };

      const isCurrentMonth = isCurrentCalendarYear && m.key === currentMonthStr;
      const isPastMonth = isCurrentCalendarYear && parseInt(m.key, 10) < parseInt(currentMonthStr, 10);

      return {
        ...m,
        monthKey,
        count: matched.length,
        typeCounts,
        isCurrentMonth,
        isPastMonth
      };
    });
  }, [records, selectedYear]);

  // Toggle sort column
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Record update callback from drawer / modal
  const handleRecordUpdated = (updated: OperationalRenewalRecord) => {
    setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
    if (selectedRecord?.id === updated.id) {
      setSelectedRecord(updated);
    }
  };

  const handleArchiveRecord = async (id: string) => {
    try {
      await operationalRenewalService.archive(id, currentUser);
      setRecords(prev => prev.filter(r => r.id !== id));
      if (selectedRecord?.id === id) setSelectedRecord(null);
    } catch (e) {
      console.error('Failed to archive record:', e);
    }
  };

  // Alert Center Highlights
  const expiredWpCount = records.filter(r => r.renewalType === 'WORK_PERMIT' && r.severity === 'EXPIRED').length;
  const criticalNhraPharmacyCount = records.filter(r =>
    (r.renewalType === 'NHRA_PHARMACY' || (r.renewalType === 'NHRA' && r.entityType !== 'EMPLOYEE' && !r.entityName.toLowerCase().includes('pharmacist'))) &&
    (r.severity === 'CRITICAL' || r.severity === 'EXPIRED')
  ).length;
  const criticalNhraPharmacistCount = records.filter(r =>
    (r.renewalType === 'NHRA_PHARMACIST' || (r.renewalType === 'NHRA' && (r.entityType === 'EMPLOYEE' || r.entityName.toLowerCase().includes('pharmacist')))) &&
    (r.severity === 'CRITICAL' || r.severity === 'EXPIRED')
  ).length;
  const criticalVehicleCount = records.filter(r => r.renewalType === 'FLEET_VEHICLE' && (r.severity === 'CRITICAL' || r.severity === 'EXPIRED')).length;
  const urgent30DayCount = records.filter(r => r.daysRemaining >= 0 && r.daysRemaining <= 30).length;

  // Quick switch duration directly from table
  const handleQuickSwitchDuration = async (e: React.MouseEvent, rec: OperationalRenewalRecord, dur: 6 | 12 | 24) => {
    e.stopPropagation();
    if (rec.renewalDurationMonths === dur && !rec.metadata?.manualCostOverride) return;
    try {
      const durTariff = operationalRenewalService.lookupTariff({
        renewalType: 'WORK_PERMIT',
        durationMonths: dur,
        entityName: rec.entityName,
        documentNumber: rec.documentNumber
      });
      const updated = await operationalRenewalService.update(rec.id, {
        renewalDurationMonths: dur,
        estimatedCost: durTariff.cost,
        metadata: {
          ...(rec.metadata || {}),
          manualCostOverride: false
        }
      }, currentUser);
      setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
    } catch (err) {
      console.error('Failed to update duration:', err);
    }
  };

  // Quick set custom fee directly from table
  const handleQuickSetCustomCost = async (e: React.MouseEvent, rec: OperationalRenewalRecord) => {
    e.stopPropagation();
    const current = rec.estimatedCost !== undefined ? rec.estimatedCost : 0;
    const { value: newCostStr } = await Swal.fire({
      title: 'Set Work Permit Fee',
      html: `
        <div style="font-size: 13px; text-align: left; color: #475569; margin-bottom: 8px;">
          Set renewal fee for <b>${rec.entityName}</b> in <b>Bahrain Dinar (BHD)</b>:
        </div>
      `,
      input: 'number',
      inputValue: current > 0 ? current.toFixed(3) : '',
      inputPlaceholder: 'e.g. 172.000',
      inputAttributes: {
        step: '0.001',
        min: '0'
      },
      showCancelButton: true,
      confirmButtonText: 'Save Fee',
      confirmButtonColor: '#059669',
      cancelButtonText: 'Cancel'
    });

    if (newCostStr !== undefined) {
      const parsed = parseFloat(newCostStr);
      if (isNaN(parsed) || parsed < 0) {
        Swal.fire({ icon: 'error', title: 'Invalid Amount', text: 'Please enter a valid positive number.' });
        return;
      }
      try {
        const updated = await operationalRenewalService.update(rec.id, {
          estimatedCost: parsed,
          metadata: {
            ...(rec.metadata || {}),
            manualCostOverride: true
          }
        }, currentUser);
        setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
        Swal.fire({
          icon: 'success',
          title: 'Fee Updated',
          text: `Fee set to ${parsed.toFixed(3)} BHD.`,
          timer: 1500,
          showConfirmButton: false
        });
      } catch (err) {
        console.error('Failed to set custom cost:', err);
      }
    }
  };

  // Render Rich Cost Breakdown Cell
  const renderCostCell = (record: OperationalRenewalRecord) => {
    // 1. Work Permit (LMRA) - User specifies duration tier (6M / 1Y / 2Y) or custom fee
    if (record.renewalType === 'WORK_PERMIT') {
      const wp6 = operationalRenewalService.lookupTariff({ renewalType: 'WORK_PERMIT', durationMonths: 6, entityName: record.entityName });
      const wp12 = operationalRenewalService.lookupTariff({ renewalType: 'WORK_PERMIT', durationMonths: 12, entityName: record.entityName });
      const wp24 = operationalRenewalService.lookupTariff({ renewalType: 'WORK_PERMIT', durationMonths: 24, entityName: record.entityName });

      const isManualOverride = Boolean(record.metadata?.manualCostOverride);
      const activeDur = record.renewalDurationMonths;
      const hasSelection = isManualOverride || Boolean(activeDur);

      const activeCost = isManualOverride && record.estimatedCost !== undefined
        ? record.estimatedCost
        : (activeDur === 6 ? wp6.cost : activeDur === 24 ? wp24.cost : activeDur === 12 ? wp12.cost : (record.estimatedCost || 0));

      return (
        <div className="py-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={(e) => handleQuickSwitchDuration(e, record, 6)}
              title="Click to select 6-Month Work Permit Fee"
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] border transition-all cursor-pointer ${
                !isManualOverride && activeDur === 6
                  ? 'bg-amber-100 text-amber-950 border-amber-400 ring-1 ring-amber-400/50 font-black shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <span className="text-[9px] text-slate-500 font-black">6M:</span>
              <span className="font-mono font-bold">{wp6.cost.toFixed(1)}</span>
            </button>

            <button
              type="button"
              onClick={(e) => handleQuickSwitchDuration(e, record, 12)}
              title="Click to select 1-Year (12 Months) Work Permit Fee"
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] border transition-all cursor-pointer ${
                !isManualOverride && activeDur === 12
                  ? 'bg-amber-100 text-amber-950 border-amber-400 ring-1 ring-amber-400/50 font-black shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <span className="text-[9px] text-slate-500 font-black">1Y:</span>
              <span className="font-mono font-bold">{wp12.cost.toFixed(0)}</span>
            </button>

            <button
              type="button"
              onClick={(e) => handleQuickSwitchDuration(e, record, 24)}
              title="Click to select 2-Year (24 Months) Work Permit Fee"
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] border transition-all cursor-pointer ${
                !isManualOverride && activeDur === 24
                  ? 'bg-amber-100 text-amber-950 border-amber-400 ring-1 ring-amber-400/50 font-black shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <span className="text-[9px] text-slate-500 font-black">2Y:</span>
              <span className="font-mono font-bold">{wp24.cost.toFixed(0)}</span>
            </button>

            <button
              type="button"
              onClick={(e) => handleQuickSetCustomCost(e, record)}
              title="Set custom fee specified for this employee"
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] border transition-all cursor-pointer ${
                isManualOverride
                  ? 'bg-indigo-600 text-white border-indigo-700 font-black shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              <Edit3 className="w-2.5 h-2.5" />
              <span>{isManualOverride ? `${Number(activeCost).toFixed(1)} BD` : 'Custom'}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 mt-1 text-[10px]">
            {record.paymentStatus === 'PAID' ? (
              <span className="text-emerald-700 font-black flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Paid: {Number(record.actualCost !== undefined ? record.actualCost : activeCost).toFixed(3)} BD</span>
              </span>
            ) : !hasSelection ? (
              <span className="text-amber-600 font-bold flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-500" />
                <span>Select Duration Tier or Set Custom Fee</span>
              </span>
            ) : isManualOverride ? (
              <span className="text-indigo-700 font-bold text-[10px]">
                Custom Specified Fee: <strong>{Number(activeCost).toFixed(3)} BD</strong>
              </span>
            ) : (
              <span className="text-slate-500 font-medium text-[10px]">
                Selected Tier: <strong className="text-slate-700 font-bold">{activeDur === 6 ? '6 Months' : activeDur === 24 ? '2 Years' : '1 Year'}</strong> ({Number(activeCost).toFixed(1)} BD)
              </span>
            )}
          </div>
        </div>
      );
    }

    // Dynamic tariff lookup for all other categories (CR, Chamber of Commerce, NHRA, Fleet, etc.)
    const tariff = operationalRenewalService.lookupTariff({
      renewalType: record.renewalType,
      entityName: record.entityName,
      documentNumber: record.documentNumber,
      branchCode: record.costCenterCode,
      branchName: record.branchName,
      documentType: record.documentType
    });

    const cost = record.estimatedCost !== undefined ? record.estimatedCost : tariff.cost;
    const isCustom = Boolean(tariff.isCustomOverride);
    const ruleTag = tariff.matchedRule?.branchCode || (isCustom ? 'Custom' : 'Standard');
    const displayLabel = tariff.matchedRule?.label || tariff.ruleLabel;

    let badgeClass = isCustom ? 'bg-purple-50 text-purple-900 border-purple-300 shadow-2xs' : 'bg-slate-100 text-slate-900 border-slate-200';
    let tagClass = isCustom ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-slate-100 text-slate-600';

    if (record.renewalType === 'CHAMBER_OF_COMMERCE') {
      badgeClass = isCustom ? 'bg-blue-100 text-blue-950 border-blue-300 shadow-2xs' : 'bg-blue-50 text-blue-900 border-blue-200';
      tagClass = isCustom ? 'bg-blue-200 text-blue-900 border border-blue-300' : 'bg-blue-100 text-blue-800';
    } else if (record.renewalType === 'NHRA_PHARMACY' || (record.renewalType === 'NHRA' && record.entityType !== 'EMPLOYEE' && !record.entityName.toLowerCase().includes('pharmacist'))) {
      badgeClass = isCustom ? 'bg-emerald-100 text-emerald-950 border-emerald-300 shadow-2xs' : 'bg-emerald-50 text-emerald-900 border-emerald-200';
      tagClass = isCustom ? 'bg-emerald-200 text-emerald-900 border border-emerald-300' : 'bg-emerald-100 text-emerald-800';
    } else if (record.renewalType === 'NHRA_PHARMACIST' || (record.renewalType === 'NHRA' && (record.entityType === 'EMPLOYEE' || record.entityName.toLowerCase().includes('pharmacist')))) {
      badgeClass = isCustom ? 'bg-teal-100 text-teal-950 border-teal-300 shadow-2xs' : 'bg-teal-50 text-teal-900 border-teal-200';
      tagClass = isCustom ? 'bg-teal-200 text-teal-900 border border-teal-300' : 'bg-teal-100 text-teal-800';
    } else if (record.renewalType === 'FLEET_VEHICLE') {
      badgeClass = isCustom ? 'bg-indigo-100 text-indigo-950 border-indigo-300 shadow-2xs' : 'bg-indigo-50 text-indigo-900 border-indigo-200';
      tagClass = isCustom ? 'bg-indigo-200 text-indigo-900 border border-indigo-300' : 'bg-indigo-100 text-indigo-800';
    }

    return (
      <div className="py-1">
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-black font-mono border ${badgeClass}`}>
            <span>{cost.toFixed(3)}</span>
            <span className="text-[10px] font-bold">BD</span>
          </span>

          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${tagClass}`}>
            {ruleTag}
          </span>
        </div>
        <div className="text-[10px] text-slate-500 font-medium mt-0.5 truncate max-w-[220px]" title={displayLabel}>
          {displayLabel}
        </div>
      </div>
    );
  };

  const isCriticalActive = selectedSeverity === 'CRITICAL' || quickFilter === 'CRITICAL';
  const isExpiredActive = selectedSeverity === 'EXPIRED' || quickFilter === 'EXPIRED';
  const isExpiringSoonActive = selectedPeriod === 'NEXT_30_DAYS' || quickFilter === 'NEXT_30_DAYS';
  const isWarningActive = selectedSeverity === 'WARNING';
  const isUpcomingActive = selectedSeverity === 'UPCOMING';
  const isAllActive = !isCriticalActive && !isExpiredActive && !isExpiringSoonActive && !isWarningActive && !isUpcomingActive && selectedType === 'ALL';

  return (
    <div className="space-y-6 page-enter pb-16">
      {/* Top Header & Navigation */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">Operations & Compliance</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950 flex items-center gap-2.5">
            Operational Alert & Renewals
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Monitor critical licenses, registrations, permits, and operational expiries across the pharmacy group.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-black shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live System Automation</span>
          </div>
          <BackToModulesButton onClick={onBack} />
        </div>
      </div>

      {/* Hero Banner with Summary, Live Feeds, Telemetry, and Executive KPI Deck */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-700/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 sm:p-7 lg:p-8 text-white shadow-2xl backdrop-blur-2xl ring-1 ring-white/10 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-emerald-400/40 before:to-transparent">
        {/* Ambient Decorative Lighting */}
        <div className="absolute -top-24 -left-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-24 -right-20 w-96 h-96 bg-brand/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 left-1/3 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        {/* High-tech micro-grid texture */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.035)_1px,transparent_0)] bg-[size:24px_24px] pointer-events-none" />

        {/* Top Section: Header, Telemetry Badges, Title & Command Buttons */}
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
          <div className="space-y-3 max-w-4xl">
            {/* Status Telemetry Badges Row */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Live Registry Telemetry Beacon */}
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
                <span>Live Registry Telemetry</span>
              </span>

              {/* Group Compliance Health Rating */}
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-xs transition-colors ${
                complianceScore >= 90
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : complianceScore >= 75
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
              }`}>
                <Activity className="h-3 w-3" />
                <span>{complianceScore}% Group Compliance Standing</span>
              </span>

              {/* Action Required Banner (Clickable) */}
              {(kpiStats.criticalCount + kpiStats.expiredCount) > 0 ? (
                <button
                  type="button"
                  onClick={() => handleToggleKpiFilter('CRITICAL')}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white shadow-md shadow-rose-600/30 hover:shadow-rose-600/50 hover:scale-105 transition-all cursor-pointer animate-pulse"
                  title="Click to instantly filter Critical & Expired records"
                >
                  <AlertTriangle className="h-3 w-3 text-white" />
                  <span>{kpiStats.criticalCount + kpiStats.expiredCount} Action Required</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>No Critical Expiries</span>
                </span>
              )}
            </div>

            {/* Title & Description with glowing icon emblem */}
            <div className="flex items-start sm:items-center gap-3.5 pt-1">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 via-rose-500/15 to-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10 shrink-0 ring-1 ring-white/10">
                <ShieldAlert className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
                  Expiries & Compliance Control                </h3>
                <p className="text-xs sm:text-sm font-medium text-slate-300 mt-1 leading-relaxed">
                  Real-time automated monitoring and compliance tracking for all corporate licenses, statutory registrations, and staff permits across Bahrain operations.
                </p>
              </div>
            </div>

            {/* Live Data Feeds Indicators (Interactive One-Click Category Filter) */}
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                  <Database className="h-3 w-3 text-slate-400" />
                  Live Registry Feeds:
                </span>
                {selectedType !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => { setSelectedType('ALL'); setPage(1); }}
                    className="text-[10px] font-bold text-amber-300 hover:text-amber-200 underline cursor-pointer ml-1"
                  >
                    Reset Feed Filter
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                {/* CR Feed */}
                <button
                  type="button"
                  onClick={() => handleToggleFeedFilter('CR')}
                  title="Filter by Commercial Registrations (CR & Chamber of Commerce)"
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                    selectedType === 'CR'
                      ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/60 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400/50'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
                  }`}
                >
                  <Building2 className={`h-3.5 w-3.5 ${selectedType === 'CR' ? 'text-emerald-300' : 'text-emerald-400'}`} />
                  <span>Commercial Reg (CR)</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] font-mono font-bold">
                    {feedStats.cr.count}
                  </span>
                  {feedStats.cr.urgent > 0 && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title={`${feedStats.cr.urgent} critical/expired`} />
                  )}
                </button>

                {/* NHRA Pharmacy Facilities */}
                <button
                  type="button"
                  onClick={() => handleToggleFeedFilter('NHRA_PHARMACY')}
                  title="Filter by NHRA Pharmacy Facility Licenses"
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                    selectedType === 'NHRA_PHARMACY'
                      ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/60 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400/50'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
                  }`}
                >
                  <ShieldCheck className={`h-3.5 w-3.5 ${selectedType === 'NHRA_PHARMACY' ? 'text-emerald-300' : 'text-emerald-400'}`} />
                  <span>NHRA Pharmacy Facilities</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] font-mono font-bold">
                    {feedStats.nhraPharm.count}
                  </span>
                  {feedStats.nhraPharm.urgent > 0 && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title={`${feedStats.nhraPharm.urgent} critical/expired`} />
                  )}
                </button>

                {/* NHRA Pharmacist Staff */}
                <button
                  type="button"
                  onClick={() => handleToggleFeedFilter('NHRA_PHARMACIST')}
                  title="Filter by NHRA Pharmacist Staff Practice Licenses"
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                    selectedType === 'NHRA_PHARMACIST'
                      ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/60 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400/50'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
                  }`}
                >
                  <UserCheck className={`h-3.5 w-3.5 ${selectedType === 'NHRA_PHARMACIST' ? 'text-emerald-300' : 'text-emerald-400'}`} />
                  <span>NHRA Pharmacist Staff</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] font-mono font-bold">
                    {feedStats.nhraStaff.count}
                  </span>
                  {feedStats.nhraStaff.urgent > 0 && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title={`${feedStats.nhraStaff.urgent} critical/expired`} />
                  )}
                </button>

                {/* LMRA Work Permits */}
                <button
                  type="button"
                  onClick={() => handleToggleFeedFilter('WORK_PERMIT')}
                  title="Filter by LMRA Employee Work Permits"
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                    selectedType === 'WORK_PERMIT'
                      ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/60 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400/50'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
                  }`}
                >
                  <FileText className={`h-3.5 w-3.5 ${selectedType === 'WORK_PERMIT' ? 'text-emerald-300' : 'text-emerald-400'}`} />
                  <span>LMRA Work Permits</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] font-mono font-bold">
                    {feedStats.wp.count}
                  </span>
                  {feedStats.wp.urgent > 0 && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title={`${feedStats.wp.urgent} critical/expired`} />
                  )}
                </button>

                {/* Fleet Vehicles */}
                <button
                  type="button"
                  onClick={() => handleToggleFeedFilter('FLEET_VEHICLE')}
                  title="Filter by Fleet Vehicle Registrations & Insurance"
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                    selectedType === 'FLEET_VEHICLE'
                      ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/60 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400/50'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
                  }`}
                >
                  <Truck className={`h-3.5 w-3.5 ${selectedType === 'FLEET_VEHICLE' ? 'text-emerald-300' : 'text-emerald-400'}`} />
                  <span>Fleet Vehicles</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] font-mono font-bold">
                    {feedStats.fleet.count}
                  </span>
                  {feedStats.fleet.urgent > 0 && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title={`${feedStats.fleet.urgent} critical/expired`} />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap self-start xl:self-center">
            {/* Sync Master Registries */}
            <button
              type="button"
              onClick={handleSyncMasterData}
              disabled={loading || syncing}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl text-xs font-bold transition-all border border-white/10 shadow-xs cursor-pointer disabled:opacity-50"
              title="Sync latest master records from company databases (CRs, NHRA, LMRA, Fleet)"
            >
              <Database className={`h-3.5 w-3.5 ${syncing ? 'animate-spin text-emerald-400' : 'text-slate-300'}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Master Data'}</span>
            </button>

            {/* Live Refresh */}
            <button
              type="button"
              onClick={fetchData}
              disabled={loading || syncing}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl text-xs font-bold transition-all border border-white/10 shadow-xs cursor-pointer disabled:opacity-50"
              title="Refresh data from live registries"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading || syncing ? 'animate-spin text-emerald-400' : 'text-slate-300'}`} />
              <span>{loading || syncing ? 'Refreshing...' : 'Live Refresh'}</span>
            </button>

            {/* Print Report */}
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl text-xs font-bold transition-all border border-white/10 shadow-xs cursor-pointer"
              title="Print Compliance Report"
            >
              <Printer className="h-3.5 w-3.5 text-slate-300" />
              <span>Print</span>
            </button>

            {/* Add Custom Alert */}
            {canCreate && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                title="Add custom external agreement or document (lease, civil defence, municipal license)"
              >
                <Plus className="h-4 w-4 stroke-[3]" />
                <span>+ Custom Alert</span>
              </button>
            )}
          </div>
        </div>

        {/* Module View Mode Switcher (Segmented Control Bar) */}
        <div className="mt-7 pt-6 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-4 relative z-10">
          <div className="bg-slate-950/80 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md inline-flex flex-wrap items-center gap-1.5 shadow-inner">
            {/* Tab 1: Renewals & Compliance */}
            <button
              type="button"
              onClick={() => {
                setActiveMainTab('renewals');
                fetchData();
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeMainTab === 'renewals'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md shadow-emerald-500/25 font-black'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <ShieldAlert className="h-4 w-4" />
              <span>Operational Renewals & Compliance</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-black ${
                activeMainTab === 'renewals' ? 'bg-slate-950 text-emerald-400' : 'bg-white/10 text-slate-300'
              }`}>
                {records.length}
              </span>
            </button>

            {/* Tab 2: Budget Planner */}
            <button
              type="button"
              onClick={() => {
                setActiveMainTab('budget');
                fetchData();
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeMainTab === 'budget'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md shadow-emerald-500/25 font-black'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Banknote className="h-4 w-4" />
              <span>Payment Plan & Budget Planner</span>
              <span className={`text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded ${
                activeMainTab === 'budget'
                  ? 'bg-slate-950 text-amber-300'
                  : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
              }`}>
                ERP Cost Center
              </span>
            </button>

            {/* Tab 3: Tariff Control Center */}
            <button
              type="button"
              onClick={() => setActiveMainTab('tariffs')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeMainTab === 'tariffs'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md shadow-emerald-500/25 font-black'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Sliders className="h-4 w-4" />
              <span>Tariff Control Center</span>
              <span className={`text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded ${
                activeMainTab === 'tariffs'
                  ? 'bg-slate-950 text-emerald-400'
                  : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
              }`}>
                Pricing Engine
              </span>
            </button>

            {/* Tab 4: Archive & Renewal Ledger */}
            <button
              type="button"
              onClick={() => {
                setActiveMainTab('archive');
                fetchData();
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeMainTab === 'archive'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md shadow-emerald-500/25 font-black'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Archive className="h-4 w-4" />
              <span>Archive & Renewal Ledger</span>
              <span className={`text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded ${
                activeMainTab === 'archive'
                  ? 'bg-slate-950 text-emerald-400'
                  : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
              }`}>
                Audit & Payments
              </span>
            </button>
          </div>

          {/* Quick Indicator of Monitored Scope */}
          <div className="hidden lg:flex items-center gap-3 text-xs text-slate-400 font-semibold">
            <span className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              <span>Branches: <strong>All</strong></span>
            </span>
            <span className="text-slate-600">|</span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>Auto-cycle: <strong>24/7 Monitored</strong></span>
            </span>
          </div>
        </div>

        {/* Top KPI Cards Grid (Interactive Command Metrics) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mt-6 relative z-10">
          {/* Card 1: Total Active */}
          <div
            onClick={() => handleToggleKpiFilter('ALL')}
            className={`group rounded-2xl p-4 transition-all duration-200 cursor-pointer border relative overflow-hidden backdrop-blur-md hover:-translate-y-1 ${
              isAllActive
                ? 'bg-sky-500/20 border-sky-400/60 shadow-lg shadow-sky-500/20 ring-2 ring-sky-400/60'
                : 'bg-slate-900/60 hover:bg-slate-850 border-slate-700/60 hover:border-slate-600 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/20">
                <Layers className="h-4 w-4" />
              </div>
              {isAllActive && (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-sky-400 text-slate-950 font-mono">
                  Active
                </span>
              )}
            </div>
            <div className="mt-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-slate-300">
                Total Monitored
              </p>
              <p className="text-2xl sm:text-3xl font-black text-white mt-1 font-mono tracking-tight">
                {kpiStats.totalActive}
              </p>
              <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                <span>Active records</span>
                <span className="font-bold text-sky-400">100%</span>
              </div>
            </div>
          </div>

          {/* Card 2: Critical (≤ 7d) */}
          <div
            onClick={() => handleToggleKpiFilter('CRITICAL')}
            className={`group rounded-2xl p-4 transition-all duration-200 cursor-pointer border relative overflow-hidden backdrop-blur-md hover:-translate-y-1 ${
              isCriticalActive
                ? 'bg-rose-500/25 border-rose-400 shadow-lg shadow-rose-500/25 ring-2 ring-rose-500'
                : 'bg-slate-900/60 hover:bg-rose-950/30 border-slate-700/60 hover:border-rose-700/50 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <AlertTriangle className="h-4 w-4" />
              </div>
              {kpiStats.criticalCount > 0 ? (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
              ) : isCriticalActive ? (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-400 text-slate-950 font-mono">
                  Active
                </span>
              ) : null}
            </div>
            <div className="mt-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-rose-300">
                Critical (≤ 7d)
              </p>
              <p className="text-2xl sm:text-3xl font-black text-rose-400 mt-1 font-mono tracking-tight">
                {kpiStats.criticalCount}
              </p>
              <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                <span>Urgent renewal</span>
                <span className="font-bold text-rose-400">
                  {kpiStats.totalActive > 0 ? `${Math.round((kpiStats.criticalCount / kpiStats.totalActive) * 100)}%` : '0%'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Expired */}
          <div
            onClick={() => handleToggleKpiFilter('EXPIRED')}
            className={`group rounded-2xl p-4 transition-all duration-200 cursor-pointer border relative overflow-hidden backdrop-blur-md hover:-translate-y-1 ${
              isExpiredActive
                ? 'bg-rose-600/25 border-rose-500 shadow-lg shadow-rose-600/25 ring-2 ring-rose-600'
                : 'bg-slate-900/60 hover:bg-rose-950/40 border-slate-700/60 hover:border-rose-800/60 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-600/30">
                <AlertCircle className="h-4 w-4" />
              </div>
              {isExpiredActive && (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500 text-white font-mono">
                  Active
                </span>
              )}
            </div>
            <div className="mt-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-rose-400">
                Expired
              </p>
              <p className="text-2xl sm:text-3xl font-black text-rose-400 mt-1 font-mono tracking-tight">
                {kpiStats.expiredCount}
              </p>
              <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                <span>Overdue permits</span>
                <span className="font-bold text-rose-400">
                  {kpiStats.totalActive > 0 ? `${Math.round((kpiStats.expiredCount / kpiStats.totalActive) * 100)}%` : '0%'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Expiring Soon (≤ 30d) */}
          <div
            onClick={() => handleToggleKpiFilter('NEXT_30_DAYS')}
            className={`group rounded-2xl p-4 transition-all duration-200 cursor-pointer border relative overflow-hidden backdrop-blur-md hover:-translate-y-1 ${
              isExpiringSoonActive
                ? 'bg-amber-500/20 border-amber-400/70 shadow-lg shadow-amber-500/20 ring-2 ring-amber-400/60'
                : 'bg-slate-900/60 hover:bg-amber-950/30 border-slate-700/60 hover:border-amber-700/50 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Clock className="h-4 w-4" />
              </div>
              {isExpiringSoonActive && (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono">
                  Active
                </span>
              )}
            </div>
            <div className="mt-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                Expiring Soon
              </p>
              <p className="text-2xl sm:text-3xl font-black text-amber-400 mt-1 font-mono tracking-tight">
                {kpiStats.expiringSoonCount}
              </p>
              <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                <span>Within 30 days</span>
                <span className="font-bold text-amber-400">
                  {kpiStats.totalActive > 0 ? `${Math.round((kpiStats.expiringSoonCount / kpiStats.totalActive) * 100)}%` : '0%'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 5: Warning (31–60d) */}
          <div
            onClick={() => handleToggleKpiFilter('WARNING')}
            className={`group rounded-2xl p-4 transition-all duration-200 cursor-pointer border relative overflow-hidden backdrop-blur-md hover:-translate-y-1 ${
              isWarningActive
                ? 'bg-yellow-500/20 border-yellow-400/70 shadow-lg shadow-yellow-500/20 ring-2 ring-yellow-400/60'
                : 'bg-slate-900/60 hover:bg-yellow-950/30 border-slate-700/60 hover:border-yellow-700/50 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                <Calendar className="h-4 w-4" />
              </div>
              {isWarningActive && (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-yellow-400 text-slate-950 font-mono">
                  Active
                </span>
              )}
            </div>
            <div className="mt-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-yellow-300">
                Warning Window
              </p>
              <p className="text-2xl sm:text-3xl font-black text-yellow-400 mt-1 font-mono tracking-tight">
                {kpiStats.warningCount}
              </p>
              <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                <span>31 to 60 days</span>
                <span className="font-bold text-yellow-400">
                  {kpiStats.totalActive > 0 ? `${Math.round((kpiStats.warningCount / kpiStats.totalActive) * 100)}%` : '0%'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 6: Upcoming Horizon (61–90d) */}
          <div
            onClick={() => handleToggleKpiFilter('UPCOMING')}
            className={`group rounded-2xl p-4 transition-all duration-200 cursor-pointer border relative overflow-hidden backdrop-blur-md hover:-translate-y-1 ${
              isUpcomingActive
                ? 'bg-teal-500/20 border-teal-400/70 shadow-lg shadow-teal-500/20 ring-2 ring-teal-400/60'
                : 'bg-slate-900/60 hover:bg-teal-950/30 border-slate-700/60 hover:border-teal-700/50 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              {isUpcomingActive && (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-teal-400 text-slate-950 font-mono">
                  Active
                </span>
              )}
            </div>
            <div className="mt-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-sky-300">
                Upcoming Horizon
              </p>
              <p className="text-2xl sm:text-3xl font-black text-sky-400 mt-1 font-mono tracking-tight">
                {kpiStats.upcomingCount}
              </p>
              <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                <span>61 to 90 days</span>
                <span className="font-bold text-sky-400">
                  {kpiStats.totalActive > 0 ? `${Math.round((kpiStats.upcomingCount / kpiStats.totalActive) * 100)}%` : '0%'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Expiry Urgency Distribution Visual Bar & Financial Telemetry */}
        <div className="mt-7 pt-6 border-t border-slate-800/80 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs mb-3 font-bold">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-200 font-black flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                Expiry Urgency Distribution & Health Index
              </span>
              <span className="text-slate-400 text-[11px] font-normal">
                (Click any segment or chip to filter)
              </span>
            </div>

            {/* Financial Liability Snapshot */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">Est. Renewal Liability:</span>
              <span className="font-mono font-black text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-lg">
                {totalEstimatedLiability.toFixed(3)} BD
              </span>
            </div>
          </div>

          {/* Segmented Distribution Progress Bar */}
          <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex border border-white/10 p-0.5 gap-0.5 shadow-inner">
            {kpiStats.totalActive > 0 ? (
              <>
                {kpiStats.distribution.EXPIRED > 0 && (
                  <div
                    onClick={() => handleToggleKpiFilter('EXPIRED')}
                    style={{ width: `${(kpiStats.distribution.EXPIRED / kpiStats.totalActive) * 100}%` }}
                    className="bg-rose-600 h-full rounded-sm hover:brightness-125 transition-all cursor-pointer"
                    title={`Expired: ${kpiStats.distribution.EXPIRED} (${Math.round((kpiStats.distribution.EXPIRED / kpiStats.totalActive) * 100)}%) - Click to filter`}
                  />
                )}
                {kpiStats.distribution.CRITICAL > 0 && (
                  <div
                    onClick={() => handleToggleKpiFilter('CRITICAL')}
                    style={{ width: `${(kpiStats.distribution.CRITICAL / kpiStats.totalActive) * 100}%` }}
                    className="bg-rose-500 h-full rounded-sm hover:brightness-125 transition-all cursor-pointer"
                    title={`Critical (≤ 7d): ${kpiStats.distribution.CRITICAL} (${Math.round((kpiStats.distribution.CRITICAL / kpiStats.totalActive) * 100)}%) - Click to filter`}
                  />
                )}
                {kpiStats.distribution.URGENT > 0 && (
                  <div
                    onClick={() => { setSelectedSeverity('URGENT'); setPage(1); }}
                    style={{ width: `${(kpiStats.distribution.URGENT / kpiStats.totalActive) * 100}%` }}
                    className="bg-amber-500 h-full rounded-sm hover:brightness-125 transition-all cursor-pointer"
                    title={`Urgent (8-30d): ${kpiStats.distribution.URGENT} (${Math.round((kpiStats.distribution.URGENT / kpiStats.totalActive) * 100)}%) - Click to filter`}
                  />
                )}
                {kpiStats.distribution.WARNING > 0 && (
                  <div
                    onClick={() => handleToggleKpiFilter('WARNING')}
                    style={{ width: `${(kpiStats.distribution.WARNING / kpiStats.totalActive) * 100}%` }}
                    className="bg-yellow-400 h-full rounded-sm hover:brightness-125 transition-all cursor-pointer"
                    title={`Warning (31-60d): ${kpiStats.distribution.WARNING} (${Math.round((kpiStats.distribution.WARNING / kpiStats.totalActive) * 100)}%) - Click to filter`}
                  />
                )}
                {kpiStats.distribution.UPCOMING > 0 && (
                  <div
                    onClick={() => handleToggleKpiFilter('UPCOMING')}
                    style={{ width: `${(kpiStats.distribution.UPCOMING / kpiStats.totalActive) * 100}%` }}
                    className="bg-sky-400 h-full rounded-sm hover:brightness-125 transition-all cursor-pointer"
                    title={`Upcoming (61-90d): ${kpiStats.distribution.UPCOMING} (${Math.round((kpiStats.distribution.UPCOMING / kpiStats.totalActive) * 100)}%) - Click to filter`}
                  />
                )}
                {kpiStats.distribution.NORMAL > 0 && (
                  <div
                    onClick={() => { setSelectedSeverity('NORMAL'); setPage(1); }}
                    style={{ width: `${(kpiStats.distribution.NORMAL / kpiStats.totalActive) * 100}%` }}
                    className="bg-emerald-500 h-full rounded-sm hover:brightness-125 transition-all cursor-pointer"
                    title={`Normal (>90d): ${kpiStats.distribution.NORMAL} (${Math.round((kpiStats.distribution.NORMAL / kpiStats.totalActive) * 100)}%) - Click to filter`}
                  />
                )}
              </>
            ) : (
              <div className="w-full bg-slate-800 rounded-full" />
            )}
          </div>

          {/* Interactive Legend Chips */}
          <div className="flex items-center justify-between gap-2 mt-3 text-[11px] font-bold text-slate-300 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => { setSelectedSeverity(selectedSeverity === 'EXPIRED' ? 'ALL' : 'EXPIRED'); setPage(1); }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer border ${
                  selectedSeverity === 'EXPIRED'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 border-transparent hover:border-white/10'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-600" />
                <span>Expired ({kpiStats.distribution.EXPIRED})</span>
              </button>

              <button
                type="button"
                onClick={() => { setSelectedSeverity(selectedSeverity === 'CRITICAL' ? 'ALL' : 'CRITICAL'); setPage(1); }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer border ${
                  selectedSeverity === 'CRITICAL'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 border-transparent hover:border-white/10'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Critical ({kpiStats.distribution.CRITICAL})</span>
              </button>

              <button
                type="button"
                onClick={() => { setSelectedSeverity(selectedSeverity === 'URGENT' ? 'ALL' : 'URGENT'); setPage(1); }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer border ${
                  selectedSeverity === 'URGENT'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 border-transparent hover:border-white/10'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Urgent ({kpiStats.distribution.URGENT})</span>
              </button>

              <button
                type="button"
                onClick={() => { setSelectedSeverity(selectedSeverity === 'WARNING' ? 'ALL' : 'WARNING'); setPage(1); }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer border ${
                  selectedSeverity === 'WARNING'
                    ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 border-transparent hover:border-white/10'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                <span>Warning ({kpiStats.distribution.WARNING})</span>
              </button>

              <button
                type="button"
                onClick={() => { setSelectedSeverity(selectedSeverity === 'UPCOMING' ? 'ALL' : 'UPCOMING'); setPage(1); }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer border ${
                  selectedSeverity === 'UPCOMING'
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 border-transparent hover:border-white/10'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                <span>Upcoming ({kpiStats.distribution.UPCOMING})</span>
              </button>

              <button
                type="button"
                onClick={() => { setSelectedSeverity(selectedSeverity === 'NORMAL' ? 'ALL' : 'NORMAL'); setPage(1); }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer border ${
                  selectedSeverity === 'NORMAL'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 border-transparent hover:border-white/10'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Normal ({kpiStats.distribution.NORMAL})</span>
              </button>
            </div>

            {selectedSeverity !== 'ALL' && (
              <button
                type="button"
                onClick={() => { setSelectedSeverity('ALL'); setPage(1); }}
                className="text-[10px] text-amber-300 hover:text-amber-200 underline font-black cursor-pointer"
              >
                Clear Urgency Filter ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Budget Planner Tab */}
      {activeMainTab === 'budget' && (
        <RenewalBudgetPlannerTab
          records={records}
          canEdit={canEdit}
          canManage={canManage}
          onViewDetails={(rec) => setSelectedRecord(rec)}
          onRefresh={fetchData}
          onOpenTariffs={() => setActiveMainTab('tariffs')}
        />
      )}

      {/* Tariff Control Center Tab */}
      {activeMainTab === 'tariffs' && (
        <RenewalTariffControlCenter
          canManage={canManage}
          onRefreshHub={fetchData}
        />
      )}

      {/* Archive & Renewal Ledger Tab */}
      {activeMainTab === 'archive' && (
        <RenewalArchiveTab
          user={user}
          currentUser={currentUser}
          allRecords={records}
          canEdit={canEdit}
          canManage={canManage}
          canDelete={canDelete}
          onViewDetails={(rec) => setSelectedRecord(rec)}
          onRecordRestored={async () => {
            await fetchData();
          }}
        />
      )}

      {/* Renewals Tab Content */}
      {activeMainTab === 'renewals' && (
        <>

      {/* Operational Alerts Center (STEP 22) */}
      {(expiredWpCount > 0 || criticalNhraPharmacyCount > 0 || criticalNhraPharmacistCount > 0 || criticalVehicleCount > 0 || urgent30DayCount > 0) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-rose-600" />
              Operational Alert Center
            </h4>
            <span className="text-[10px] text-slate-400 font-semibold">Click an alert to filter records</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {expiredWpCount > 0 && (
              <div
                onClick={() => {
                  setSelectedType('WORK_PERMIT');
                  setSelectedSeverity('EXPIRED');
                  setPage(1);
                }}
                className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between cursor-pointer hover:bg-rose-100/70 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-500 text-white flex items-center justify-center font-black text-sm">
                    {expiredWpCount}
                  </div>
                  <div>
                    <p className="text-xs font-black text-rose-900">Work Permits Expired</p>
                    <p className="text-[10px] text-rose-600 font-semibold">LMRA renewals urgently required</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-rose-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            )}

            {criticalNhraPharmacyCount > 0 && (
              <div
                onClick={() => {
                  setSelectedType('NHRA_PHARMACY');
                  setSelectedSeverity('ALL');
                  setPage(1);
                }}
                className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between cursor-pointer hover:bg-amber-100/70 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-black text-sm">
                    {criticalNhraPharmacyCount}
                  </div>
                  <div>
                    <p className="text-xs font-black text-amber-900">Nhra Pharmacy Expiring</p>
                    <p className="text-[10px] text-amber-700 font-semibold">NHRA pharmacy facility licenses</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            )}

            {criticalNhraPharmacistCount > 0 && (
              <div
                onClick={() => {
                  setSelectedType('NHRA_PHARMACIST');
                  setSelectedSeverity('ALL');
                  setPage(1);
                }}
                className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between cursor-pointer hover:bg-emerald-100/70 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-sm">
                    {criticalNhraPharmacistCount}
                  </div>
                  <div>
                    <p className="text-xs font-black text-emerald-950">Nhra Pharmacist Expiring</p>
                    <p className="text-[10px] text-emerald-700 font-semibold">Pharmacist practice licenses</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            )}

            {criticalVehicleCount > 0 && (
              <div
                onClick={() => {
                  setSelectedType('FLEET_VEHICLE');
                  setSelectedSeverity('ALL');
                  setPage(1);
                }}
                className="p-3 bg-cyan-50 border border-cyan-200 rounded-xl flex items-center justify-between cursor-pointer hover:bg-cyan-100/70 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-600 text-white flex items-center justify-center font-black text-sm">
                    {criticalVehicleCount}
                  </div>
                  <div>
                    <p className="text-xs font-black text-cyan-950">Fleet Vehicles Expiring</p>
                    <p className="text-[10px] text-cyan-700 font-semibold">Registration renewal required</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            )}

            {urgent30DayCount > 0 && (
              <div
                onClick={() => {
                  setSelectedPeriod('NEXT_30_DAYS');
                  setSelectedSeverity('ALL');
                  setPage(1);
                }}
                className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-between cursor-pointer hover:bg-sky-100/70 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-black text-sm">
                    {urgent30DayCount}
                  </div>
                  <div>
                    <p className="text-xs font-black text-sky-900">Upcoming Expiries</p>
                    <p className="text-[10px] text-sky-700 font-semibold">Expiring in next 30 days</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-sky-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Monthly Renewal Breakdown Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-brand" />
                Monthly Renewal Breakdown
              </h3>
              {selectedMonthKey && (
                <span className="bg-brand/10 text-brand border border-brand/20 text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <span>Filtered: {selectedMonthKey}</span>
                  <button
                    onClick={() => { setSelectedMonthKey(null); setPage(1); }}
                    className="hover:text-brand-dark cursor-pointer ml-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Chronological schedule of expiring licenses, CRs, and work permits throughout the year. Click any month to filter records immediately in the table below.
            </p>
          </div>

          {/* Year Selector & Reset */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {selectedMonthKey && (
              <button
                onClick={() => { setSelectedMonthKey(null); setPage(1); }}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1"
              >
                <X className="h-3.5 w-3.5" /> Show All Months
              </button>
            )}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {availableYears.map(yr => (
                <button
                  key={yr}
                  onClick={() => { setSelectedYear(yr); setSelectedMonthKey(null); setPage(1); }}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                    selectedYear === yr ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 12-Month Interactive Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-2.5">
          {monthlyBreakdown.map(m => {
            const isSelected = selectedMonthKey === m.monthKey;
            const hasRenewals = m.count > 0;

            return (
              <button
                key={m.monthKey}
                onClick={() => {
                  if (isSelected) {
                    setSelectedMonthKey(null);
                  } else {
                    setSelectedMonthKey(m.monthKey);
                  }
                  setPage(1);
                }}
                className={`relative p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-between min-h-[105px] cursor-pointer group ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900/30 shadow-md scale-102 z-10'
                    : hasRenewals
                    ? m.isPastMonth
                    ? 'bg-rose-50/70 border-rose-200 text-slate-900 hover:border-rose-400 hover:bg-rose-100/70 shadow-2xs'
                    : m.isCurrentMonth
                    ? 'bg-amber-50/80 border-amber-300 text-slate-900 hover:border-amber-400 shadow-2xs'
                    : 'bg-slate-50 border-slate-200/90 text-slate-900 hover:border-brand/40 hover:bg-brand/5'
                    : 'bg-white border-slate-150 text-slate-400 hover:bg-slate-50 hover:border-slate-200 opacity-60 hover:opacity-100'
                }`}
              >
                {m.isCurrentMonth && (
                  <span className={`absolute -top-2 px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase tracking-wider ${
                    isSelected ? 'bg-white text-slate-900' : 'bg-amber-500 text-white shadow-2xs'
                  }`}>
                    Current
                  </span>
                )}

                <div className="mt-1">
                  <span className={`block text-xs font-black uppercase ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                    {m.nameEn}
                  </span>
                  <span className={`block text-[10px] font-bold ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                    {m.fullName}
                  </span>
                </div>

                {/* Badge Count */}
                <div className="my-1.5">
                  <span
                    className={`inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full text-xs font-black transition-transform group-hover:scale-110 ${
                      isSelected
                        ? 'bg-white text-slate-900 shadow-xs'
                        : hasRenewals
                        ? m.isPastMonth
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : m.isCurrentMonth
                          ? 'bg-amber-500 text-white shadow-2xs'
                          : 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-150 text-slate-400'
                    }`}
                  >
                    {m.count}
                  </span>
                </div>

                {/* Mini Dots / Category breakdown hint */}
                {hasRenewals && (
                  <div className="flex items-center justify-center gap-1 text-[9px] font-black opacity-80 flex-wrap">
                    {m.typeCounts.CR > 0 && <span title={`CR: ${m.typeCounts.CR}`} className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                    {m.typeCounts.NHRA_PHARMACY > 0 && <span title={`NHRA Pharmacy: ${m.typeCounts.NHRA_PHARMACY}`} className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                    {m.typeCounts.NHRA_PHARMACIST > 0 && <span title={`NHRA Pharmacist: ${m.typeCounts.NHRA_PHARMACIST}`} className="w-1.5 h-1.5 rounded-full bg-teal-500" />}
                    {m.typeCounts.WORK_PERMIT > 0 && <span title={`Work Permits: ${m.typeCounts.WORK_PERMIT}`} className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                    {m.typeCounts.FLEET_VEHICLE > 0 && <span title={`Fleet Vehicles: ${m.typeCounts.FLEET_VEHICLE}`} className="w-1.5 h-1.5 rounded-full bg-cyan-500" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
        {/* Quick Filter Pill Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1 shrink-0">
              Quick Filter:
            </span>
            {selectedMonthKey && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand text-white rounded-lg text-xs font-black shadow-xs whitespace-nowrap mr-1">
                <Calendar className="h-3 w-3" />
                <span>Month: {selectedMonthKey}</span>
                <button
                  onClick={() => { setSelectedMonthKey(null); setPage(1); }}
                  className="hover:bg-white/20 rounded p-0.5"
                  title="Clear Month Filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            <button
              onClick={() => applyQuickFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                quickFilter === 'ALL' && !selectedMonthKey ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({kpiStats.totalActive})
            </button>
            <button
              onClick={() => applyQuickFilter('CRITICAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                quickFilter === 'CRITICAL' ? 'bg-rose-500 text-white shadow-sm' : 'text-rose-600 hover:bg-rose-50'
              }`}
            >
              Critical ({kpiStats.criticalCount})
            </button>
            <button
              onClick={() => applyQuickFilter('EXPIRED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                quickFilter === 'EXPIRED' ? 'bg-rose-600 text-white shadow-sm' : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              Expired ({kpiStats.expiredCount})
            </button>
            <button
              onClick={() => applyQuickFilter('NEXT_7_DAYS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                quickFilter === 'NEXT_7_DAYS' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Next 7 Days
            </button>
            <button
              onClick={() => applyQuickFilter('NEXT_30_DAYS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                quickFilter === 'NEXT_30_DAYS' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Next 30 Days ({kpiStats.expiringSoonCount})
            </button>
            <button
              onClick={() => applyQuickFilter('NEXT_90_DAYS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                quickFilter === 'NEXT_90_DAYS' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Next 90 Days
            </button>
          </div>

          {/* Export Dropdown */}
          <div className="relative shrink-0 flex items-center gap-2">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export</span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-100 p-1 z-30 space-y-1">
                <button
                  onClick={() => {
                    exportRenewalsToExcel(sortedRecords, 'Operational_Renewals_Export');
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2"
                >
                  <FileText className="h-3.5 w-3.5 text-emerald-600" />
                  Excel (.xlsx)
                </button>
                <button
                  onClick={() => {
                    exportRenewalsToCsv(sortedRecords, 'Operational_Renewals_Export');
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2"
                >
                  <FileText className="h-3.5 w-3.5 text-slate-500" />
                  CSV (.csv)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 border-b border-slate-100">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search entity, document #, CR, license, or branch..."
              className="w-full pl-9 pr-3 py-2 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={selectedType}
              onChange={e => { setSelectedType(e.target.value as any); setPage(1); }}
              className="w-full py-2 px-3 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              <option value="ALL">All Document Types</option>
              <option value="NHRA_PHARMACY">NHRA Pharmacy Facilities</option>
              <option value="NHRA_PHARMACIST">NHRA Pharmacist Staff</option>
              <option value="CR">Commercial Reg (CR)</option>
              <option value="WORK_PERMIT">Work Permits (LMRA)</option>
              <option value="FLEET_VEHICLE">Fleet Vehicles</option>
              <option value="OTHER">Other Documents</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div>
            <select
              value={selectedSeverity}
              onChange={e => { setSelectedSeverity(e.target.value as any); setPage(1); }}
              className="w-full py-2 px-3 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              <option value="ALL">All Alert Urgencies</option>
              <option value="EXPIRED">🔴 Expired (&lt; 0 days)</option>
              <option value="CRITICAL">🔴 Critical (0–7 days)</option>
              <option value="URGENT">🟠 Urgent (8–30 days)</option>
              <option value="WARNING">🟡 Warning (31–60 days)</option>
              <option value="UPCOMING">🔵 Upcoming (61–90 days)</option>
              <option value="NORMAL">🟢 Normal (&gt; 90 days)</option>
            </select>
          </div>

          {/* Period Filter */}
          <div>
            <select
              value={selectedPeriod || 'ALL'}
              onChange={e => { setSelectedPeriod(e.target.value as any); setPage(1); }}
              className="w-full py-2 px-3 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              <option value="ALL">All Expiry Periods</option>
              <option value="EXPIRED">Expired Already (&lt; 0d)</option>
              <option value="TODAY">Expiring Today (0d)</option>
              <option value="NEXT_7_DAYS">Next 7 Days (&le; 7d)</option>
              <option value="NEXT_30_DAYS">Next 30 Days (&le; 30d)</option>
              <option value="NEXT_60_DAYS">Next 60 Days (&le; 60d)</option>
              <option value="NEXT_90_DAYS">Next 90 Days (&le; 90d)</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="h-8 w-8 text-brand animate-spin mb-3" />
            <p className="text-sm font-bold text-slate-600">Analyzing operational compliance & licenses...</p>
          </div>
        ) : sortedRecords.length === 0 ? (
          <div className="text-center py-16 px-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
            <h4 className="text-base font-black text-slate-900">No Operational Alert Records Found</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Everything in this view is up to date, or no records matched the selected filter criteria.
            </p>
            <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
              <button
                onClick={handleSyncMasterData}
                disabled={syncing}
                className="px-4 py-2 bg-brand text-white text-xs font-bold rounded-xl flex items-center gap-2 hover:bg-brand-hover shadow-sm"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Syncing...' : 'Sync From Master Data'}</span>
              </button>
              {(search || selectedType !== 'ALL' || selectedSeverity !== 'ALL' || selectedMonthKey || (selectedPeriod && selectedPeriod !== 'ALL')) && (
                <button
                  onClick={() => {
                    setSearch('');
                    setSelectedType('ALL');
                    setSelectedSeverity('ALL');
                    setSelectedPeriod('ALL');
                    setSelectedMonthKey(null);
                    setQuickFilter('ALL');
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Operational Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-y border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4 w-28 cursor-pointer hover:text-slate-800" onClick={() => handleSort('severity')}>
                      <div className="flex items-center gap-1">
                        Priority
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4 cursor-pointer hover:text-slate-800" onClick={() => handleSort('entityName')}>
                      <div className="flex items-center gap-1">
                        Entity / Document
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4 cursor-pointer hover:text-slate-800" onClick={() => handleSort('renewalType')}>
                      <div className="flex items-center gap-1">
                        Renewal Type
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4 w-64 min-w-[240px] cursor-pointer hover:text-slate-800" onClick={() => handleSort('estimatedCost')}>
                      <div className="flex items-center gap-1">
                        <span>Renewal Cost</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4 cursor-pointer hover:text-slate-800" onClick={() => handleSort('expiryDate')}>
                      <div className="flex items-center gap-1">
                        Expiry Date
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-center cursor-pointer hover:text-slate-800" onClick={() => handleSort('daysRemaining')}>
                      <div className="flex items-center justify-center gap-1">
                        Days Remaining
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {paginatedRecords.map(record => {
                    const isExpired = record.severity === 'EXPIRED';
                    const isCritical = record.severity === 'CRITICAL';
                    const isUrgent = record.severity === 'URGENT';
                    const isWarning = record.severity === 'WARNING';

                    return (
                      <tr
                        key={record.id}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        {/* Priority Badge */}
                        <td className="py-3.5 px-4 font-bold">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              isExpired
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : isCritical
                                ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse'
                                : isUrgent
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : isWarning
                                ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              isExpired ? 'bg-rose-600' : isCritical ? 'bg-rose-600' : isUrgent ? 'bg-amber-600' : isWarning ? 'bg-yellow-600' : 'bg-emerald-600'
                            }`} />
                            {record.severity}
                          </span>
                        </td>

                        {/* Entity & Document */}
                        <td className="py-3.5 px-4">
                          <div className="min-w-0">
                            <span className="font-black text-slate-900 group-hover:text-brand transition-colors block text-xs">
                              {getOperationalEntityDisplayName(record)}
                            </span>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                              <span className="text-slate-400 font-semibold text-[10px]">Doc #:</span>
                              <code className="font-mono text-slate-700 font-bold bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">{record.documentNumber}</code>
                              {/* Display legal CR name as secondary hint if distinct from operational branch name */}
                              {record.renewalType === 'CR' && record.metadata?.crName && record.metadata.crName !== getOperationalEntityDisplayName(record) && (
                                <span className="text-[10px] text-slate-400 truncate max-w-[180px]" title={record.metadata.crName}>
                                  ({record.metadata.crName})
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Renewal Type */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                              record.renewalType === 'NHRA_PHARMACY'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : record.renewalType === 'NHRA_PHARMACIST'
                                ? 'bg-teal-50 text-teal-800 border-teal-200'
                                : record.renewalType === 'CR'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : record.renewalType === 'WORK_PERMIT'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : record.renewalType === 'FLEET_VEHICLE'
                                ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                : 'bg-slate-100 text-slate-800 border-slate-200'
                            }`}
                          >
                            {record.renewalType === 'NHRA_PHARMACY' && <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                            {record.renewalType === 'NHRA_PHARMACIST' && <UserCheck className="h-3.5 w-3.5 text-teal-600 shrink-0" />}
                            {record.renewalType === 'CR' && <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
                            {record.renewalType === 'WORK_PERMIT' && <FileText className="h-3.5 w-3.5 text-amber-600 shrink-0" />}
                            {record.renewalType === 'FLEET_VEHICLE' && <Truck className="h-3.5 w-3.5 text-indigo-600 shrink-0" />}
                            {record.renewalType !== 'NHRA_PHARMACY' &&
                             record.renewalType !== 'NHRA_PHARMACIST' &&
                             record.renewalType !== 'CR' &&
                             record.renewalType !== 'WORK_PERMIT' &&
                             record.renewalType !== 'FLEET_VEHICLE' && (
                              <FileText className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                            )}
                            <span>{record.documentType}</span>
                          </span>
                        </td>

                        {/* Cost Column (Wide & Informative) */}
                        <td className="py-3.5 px-4 w-64 min-w-[240px]">
                          {renderCostCell(record)}
                        </td>

                        {/* Expiry Date */}
                        <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                          {record.expiryDate}
                        </td>

                        {/* Days Remaining */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md font-black text-xs ${
                              isExpired
                                ? 'bg-rose-50 text-rose-700'
                                : isCritical
                                ? 'bg-rose-50 text-rose-700'
                                : isUrgent
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {record.daysRemaining < 0 ? (
                              <span>Expired ({Math.abs(record.daysRemaining)}d ago)</span>
                            ) : (
                              <span>{record.daysRemaining} days</span>
                            )}
                          </span>
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3.5 px-4 text-right shrink-0">
                          <div className="flex items-center justify-end gap-1.5">
                            {canManage && (
                              <button
                                onClick={() => setShowRenewModalRecord(record)}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all shadow-xs flex items-center gap-1.5"
                                title="Mark as Renewed"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Renew</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (STEP 15/31) */}
            <div className="block md:hidden p-4 space-y-3">
              {paginatedRecords.map(record => {
                const isExpired = record.severity === 'EXPIRED';
                const isCritical = record.severity === 'CRITICAL';
                const isUrgent = record.severity === 'URGENT';

                return (
                  <div
                    key={record.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-2.5 hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                            record.renewalType === 'NHRA_PHARMACY'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : record.renewalType === 'NHRA_PHARMACIST'
                              ? 'bg-teal-50 text-teal-800 border-teal-200'
                              : record.renewalType === 'CR'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : record.renewalType === 'WORK_PERMIT'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : record.renewalType === 'FLEET_VEHICLE'
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              : 'bg-slate-100 text-slate-800 border-slate-200'
                          }`}
                        >
                          {record.documentType}
                        </span>
                        <h4 className="text-sm font-black text-slate-950">{getOperationalEntityDisplayName(record)}</h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <span className="text-slate-400 font-semibold text-[10px]">Doc #:</span>
                          <code className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">{record.documentNumber}</code>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase shrink-0 ${
                          isExpired || isCritical
                            ? 'bg-rose-100 text-rose-700'
                            : isUrgent
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {record.severity}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Expires:</span>
                        <span className="font-black text-slate-900">{record.expiryDate}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-semibold">Remaining:</span>
                        <span className={`font-black ${isExpired || isCritical ? 'text-rose-600' : 'text-slate-800'}`}>
                          {record.daysRemaining < 0 ? `Expired (${Math.abs(record.daysRemaining)}d)` : `${record.daysRemaining} days`}
                        </span>
                      </div>
                    </div>

                    {/* Mobile Cost Breakdown */}
                    <div className="pt-2 border-t border-slate-100">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                        Renewal Cost:
                      </div>
                      {renderCostCell(record)}
                    </div>

                    {canManage && (
                      <div className="flex items-center justify-end pt-2 border-t border-slate-100 text-xs">
                        <button
                          onClick={() => setShowRenewModalRecord(record)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all shadow-xs flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Renew</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <span className="text-xs text-slate-500 font-medium">
                Showing {Math.min((page - 1) * pageSize + 1, sortedRecords.length)} to {Math.min(page * pageSize, sortedRecords.length)} of {sortedRecords.length} records
              </span>

              <div className="flex items-center gap-1 self-end sm:self-auto">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-3 py-1 text-xs font-bold text-slate-700">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

        </>
      )}



      {/* Record Details Drawer */}
      {selectedRecord && (
        <RenewalDetailsDrawer
          record={selectedRecord}
          currentUser={currentUser}
          canEdit={canEdit}
          canManage={canManage}
          canDelete={canDelete}
          onClose={() => setSelectedRecord(null)}
          onEdit={(rec) => {
            setEditRecord(rec);
            setShowAddModal(true);
          }}
          onRecordUpdated={handleRecordUpdated}
          onArchive={handleArchiveRecord}
        />
      )}

      {/* Add / Edit Form Modal */}
      {showAddModal && (
        <RenewalFormModal
          editRecord={editRecord}
          currentUser={currentUser}
          onClose={() => {
            setShowAddModal(false);
            setEditRecord(null);
          }}
          onSaved={(saved) => {
            setShowAddModal(false);
            setEditRecord(null);
            fetchData();
          }}
        />
      )}

      {/* Mark Renewed Modal */}
      {showRenewModalRecord && (
        <MarkRenewedModal
          record={showRenewModalRecord}
          currentUser={currentUser}
          onClose={() => setShowRenewModalRecord(null)}
          onSuccess={async (updated) => {
            setShowRenewModalRecord(null);
            handleRecordUpdated(updated);
            await fetchData();
          }}
        />
      )}

      {/* Print Report Modal */}
      {showPrintModal && (
        <RenewalReportPrintModal
          records={sortedRecords}
          activeFilterLabel={`${selectedType !== 'ALL' ? selectedType : 'All Types'} · ${selectedSeverity !== 'ALL' ? selectedSeverity : 'All Urgencies'}`}
          onClose={() => setShowPrintModal(false)}
        />
      )}


    </div>
  );
};
