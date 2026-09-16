import React, { useState, useEffect, useRef } from 'react';
import {
  Building2, Plus, Edit2, Trash2, CheckCircle2, ShieldCheck, MapPin, Search, Store, FileText,
  Calendar, Download, Upload, LayoutGrid, List, AlertTriangle, ExternalLink, Copy, Check, Filter, Crown, Award, Printer, RefreshCw, Sparkles,
  X, Clock, CalendarPlus, Zap
} from 'lucide-react';
import Swal from 'sweetalert2';
import { Branch } from '../../types';
import { crService, INITIAL_21_CRS, LOCAL_STORAGE_CR_KEY, CR_UPDATED_EVENT, RegisteredCr } from '../../services/crService';
import { RENEWALS_UPDATED_EVENT } from '../../services/operationalRenewalService';

export type RegisteredCR = RegisteredCr;

const DEFAULT_GROUP_LOGO = '/logo.jpg';
const DEFAULT_SUB_LOGO = '/logo.jpg';

const DEFAULT_SIGNATURE = '/sign.jpg';

export const generateCrStampSvg = (crNameAr?: string, crNameEn?: string, crNumber?: string): string => {
  const arName = (crNameAr || 'شركة صيدلية تبارك ذ.م.م').trim();
  const enName = (crNameEn || 'TABARAK PHARMACY CO W.L.L').trim().toUpperCase();
  const crNum = (crNumber || '127506-01').trim();

  const safeAr = arName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const safeEn = enName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const safeCr = crNum.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 240" fill="none">
    <rect x="6" y="6" width="488" height="228" rx="2" stroke="#1d2a6b" stroke-width="6" fill="none"/>
    <rect x="16" y="16" width="468" height="208" rx="1" stroke="#1d2a6b" stroke-width="3" fill="none"/>
    <text x="250" y="82" font-family="Arial, sans-serif" font-size="34" font-weight="bold" text-anchor="middle" fill="#1d2a6b">${safeAr}</text>
    <text x="250" y="142" font-family="Arial, sans-serif" font-size="25" font-weight="bold" text-anchor="middle" fill="#1d2a6b">${safeEn}</text>
    <text x="250" y="194" font-family="Arial, sans-serif" font-size="28" font-weight="bold" text-anchor="middle" fill="#1d2a6b">CR ${safeCr}</text>
  </svg>`;

  try {
    if (typeof btoa !== 'undefined') {
      const b64 = btoa(unescape(encodeURIComponent(svg)));
      return `data:image/svg+xml;base64,${b64}`;
    }
  } catch (e) {}

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const DEFAULT_STAMP = generateCrStampSvg('شركة صيدلية تبارك ذ.م.م', 'TABARAK PHARMACY CO W.L.L', '127506-01');

const INITIAL_CRS: RegisteredCR[] = INITIAL_21_CRS;

// Robust date parser supporting YYYY-MM-DD, YYYY/MM/DD, DD/MM/YYYY, MM/DD/YYYY, Excel serial numbers, and ISO strings
const parseAndFormatDateStr = (dateStr?: any): string | undefined => {
  if (!dateStr) return undefined;
  const str = String(dateStr).trim();
  if (!str) return undefined;

  // 1. Direct YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. Direct DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    const y = dmyMatch[3];
    let m = p2;
    let d = p1;
    // If month > 12, assume MM/DD/YYYY format
    if (p2 > 12 && p1 <= 12) {
      m = p1;
      d = p2;
    }
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // 3. Excel serial date (e.g. 45000 to 60000)
  if (/^\d{5}$/.test(str)) {
    const serial = parseInt(str, 10);
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    if (!isNaN(date_info.getTime())) {
      const y = date_info.getFullYear();
      const m = String(date_info.getMonth() + 1).padStart(2, '0');
      const d = String(date_info.getDate()).padStart(2, '0');
      if (y >= 2000 && y <= 2100) {
        return `${y}-${m}-${d}`;
      }
    }
  }

  // 4. Fallback JS Date parse
  const cleanStr = str.split('T')[0].split(' ')[0].trim();
  const parsed = new Date(cleanStr.includes('-') || cleanStr.includes('/') ? cleanStr : str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    if (y >= 2000 && y <= 2100) {
      return `${y}-${m}-${d}`;
    }
  }

  return undefined;
};

// Helper to format date string to YYYY-MM-DD for HTML <input type="date" />
const formatExpiryDateForInput = (dateStr?: string, crNum?: string, crId?: string): string => {
  const parsed = parseAndFormatDateStr(dateStr);
  if (parsed) {
    return parsed;
  }
  const matched = INITIAL_21_CRS.find(c => (crNum && c.cr_number === crNum) || (crId && c.id === crId));
  if (matched?.expiry_date) {
    const matchedParsed = parseAndFormatDateStr(matched.expiry_date);
    if (matchedParsed) return matchedParsed;
  }
  return '2026-12-31';
};

// Format date & time nicely for "Reference: Last Updated" display
const formatDateTime = (isoDate?: string): string => {
  if (!isoDate) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} 12:00`;
  }
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  } catch {
    return isoDate;
  }
};

export const RegisteredCrsSection: React.FC<{ branches: Branch[] }> = ({ branches }) => {
  const [crs, setCrs] = useState<RegisteredCR[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LOCAL_STORAGE_CR_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((item: RegisteredCR) => {
              const matched = INITIAL_21_CRS.find(c => c.cr_number === item.cr_number || c.id === item.id);
              const cleanExp = formatExpiryDateForInput(item.expiry_date || matched?.expiry_date, item.cr_number, item.id);
              const cleanNhraExp = formatExpiryDateForInput(item.nhra_expiry_date || matched?.nhra_expiry_date, item.cr_number, item.id);
              return {
                ...item,
                expiry_date: cleanExp,
                nhra_expiry_date: cleanNhraExp,
                nhra_license_no: item.nhra_license_no || matched?.nhra_license_no,
                tax_number: item.tax_number || matched?.tax_number || '3000987654321',
                signature_url: item.signature_url || DEFAULT_SIGNATURE,
                stamp_url: item.stamp_url || generateCrStampSvg(item.cr_name_ar, item.cr_name, item.cr_number)
              };
            });
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    return INITIAL_21_CRS.map(c => ({
      ...c,
      expiry_date: formatExpiryDateForInput(c.expiry_date, c.cr_number, c.id),
      nhra_expiry_date: formatExpiryDateForInput(c.nhra_expiry_date, c.cr_number, c.id)
    }));
  });

  const [isCloudLoading, setIsCloudLoading] = useState<boolean>(false);

  useEffect(() => {
    crService.list().then(remoteData => {
      if (remoteData && remoteData.length > 0) {
        setCrs(prevCrs => {
          return remoteData.map(c => {
            const localCr = prevCrs.find(p => p.cr_number === c.cr_number || p.id === c.id);
            const matched = INITIAL_21_CRS.find(m => m.cr_number === c.cr_number || m.id === c.id);

            // Prioritize user's saved local dates over remote default list
            const expVal = localCr?.expiry_date || c.expiry_date || matched?.expiry_date;
            const nhraExpVal = localCr?.nhra_expiry_date || c.nhra_expiry_date || matched?.nhra_expiry_date;
            const nhraLicVal = localCr?.nhra_license_no || c.nhra_license_no || matched?.nhra_license_no;

            return {
              ...c,
              expiry_date: formatExpiryDateForInput(expVal, c.cr_number, c.id),
              nhra_expiry_date: formatExpiryDateForInput(nhraExpVal, c.cr_number, c.id),
              nhra_license_no: nhraLicVal || c.nhra_license_no,
              tax_number: localCr?.tax_number || c.tax_number || matched?.tax_number || '3000987654321'
            };
          });
        });
      }
    }).catch(err => {
      console.warn('Initial cloud CR fetch failed, using local cache:', err);
    });

    const handleUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setCrs(e.detail);
      }
    };
    window.addEventListener(CR_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(CR_UPDATED_EVENT, handleUpdate);
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'master' | 'sub' | 'linked' | 'unlinked' | 'alerts'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [copiedCrId, setCopiedCrId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCr, setEditingCr] = useState<RegisteredCR | null>(null);

  // Quick Compliance & Expiry Editor Modal State
  const [quickExpiryCr, setQuickExpiryCr] = useState<RegisteredCR | null>(null);
  const [quickExpiryDate, setQuickExpiryDate] = useState<string>('');
  const [quickTaxNumber, setQuickTaxNumber] = useState<string>('');
  const [quickNhraLicenseNo, setQuickNhraLicenseNo] = useState<string>('');
  const [quickNhraExpiryDate, setQuickNhraExpiryDate] = useState<string>('');
  const [quickRenewalLoading, setQuickRenewalLoading] = useState<boolean>(false);

  // Form State
  const [crName, setCrName] = useState('');
  const [crNameAr, setCrNameAr] = useState('');
  const [crNumber, setCrNumber] = useState('');
  const [isMaster, setIsMaster] = useState(false);
  const [parentCrNumber, setParentCrNumber] = useState('');
  const [linkedBranchId, setLinkedBranchId] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [nhraLicenseNo, setNhraLicenseNo] = useState('');
  const [nhraExpiryDate, setNhraExpiryDate] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [signatureUrl, setSignatureUrl] = useState('');
  const [stampUrl, setStampUrl] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const sanitizedCrs = crs.map(c => {
        const item = { ...c };
        if (!item.signature_url || item.signature_url === DEFAULT_SIGNATURE || item.signature_url === '/sign.jpg' || item.signature_url === '/signature.png' || item.signature_url === '/signature.svg') {
          delete item.signature_url;
        }
        if (item.stamp_url && item.stamp_url.startsWith('data:image/svg+xml')) {
          delete item.stamp_url;
        }
        return item;
      });
      localStorage.setItem(LOCAL_STORAGE_CR_KEY, JSON.stringify(sanitizedCrs));
    } catch (e) {
      console.warn('LocalStorage quota limit reached, keeping data safely in React state.', e);
    }
  }, [crs]);

  useEffect(() => {
    fetch('/api/init-signature').catch(() => {});
  }, []);

  const handleDownloadPdf = () => {
    const printWindow = window.open('', '_blank', 'width=850,height=1100');
    if (!printWindow) return;

    const currentLogo = logoUrl || DEFAULT_GROUP_LOGO;
    const currentSig = signatureUrl || DEFAULT_SIGNATURE;
    const currentStamp = stampUrl || generateCrStampSvg(crNameAr, crName, crNumber);
    const crEn = crName || 'TABARAK PHARMACY GROUP WLL';
    const crAr = crNameAr || 'مجموعة صيدليات تبارك ذ.م.م';
    const crNum = crNumber || '100234-1';
    const taxNum = taxNumber || '3000987654321';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="ltr" lang="en">
      <head>
        <title>HR Official Letter A4 Preview - ${crEn}</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4 portrait;
            margin: 0;
          }
          @media print {
            body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body {
            font-family: Arial, 'Cairo', 'Segoe UI', sans-serif;
            margin: 0;
            padding: 0;
            background-color: #ffffff;
            color: #0f172a;
            direction: ltr;
          }
          .a4-page {
            width: 210mm;
            min-height: 297mm;
            padding: 20mm 18mm;
            margin: 0 auto;
            box-sizing: border-box;
            background: #fff;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .header-table {
            width: 100%;
            border-bottom: 3px solid #0f172a;
            padding-bottom: 15px;
            margin-bottom: 30px;
            direction: ltr;
          }
          .cr-logo {
            max-height: 75px;
            max-width: 130px;
            object-fit: contain;
          }
          .cr-title-en {
            font-size: 17px;
            font-weight: 900;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: -0.2px;
            font-family: Arial, sans-serif;
          }
          .cr-title-ar {
            font-size: 15px;
            font-weight: 800;
            color: #1e293b;
            margin-top: 4px;
            direction: rtl;
            text-align: left;
          }
          .cr-meta {
            font-size: 11px;
            font-weight: 700;
            color: #475569;
            font-family: monospace;
            margin-top: 4px;
          }
          .letter-body {
            flex: 1;
            padding: 20px 0;
            direction: rtl;
            text-align: right;
          }
          .letter-subject {
            font-size: 16px;
            font-weight: 900;
            text-decoration: underline;
            text-align: center;
            margin-bottom: 25px;
            color: #0f172a;
          }
          .letter-text {
            font-size: 13.5px;
            line-height: 1.85;
            color: #334155;
            text-align: justify;
          }
          .footer-section {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            direction: ltr;
          }
          .sig-box {
            text-align: center;
            width: 220px;
          }
          .sig-img {
            max-height: 80px;
            max-width: 200px;
            object-fit: contain;
            filter: contrast(1.2);
          }
          .sig-name {
            font-size: 13px;
            font-weight: 900;
            color: #0f172a;
            margin-top: 5px;
          }
          .sig-title {
            font-size: 11px;
            font-weight: 800;
            color: #0284c7;
            text-transform: uppercase;
          }
          .seal-box {
            width: 220px;
            border: 1.5px stroke #94a3b8;
            border-radius: 10px;
            padding: 10px;
            text-align: center;
            background: #f8fafc;
          }
          .seal-label {
            font-size: 9px;
            font-weight: 900;
            text-transform: uppercase;
            color: #475569;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 4px;
            margin-bottom: 8px;
            display: block;
            letter-spacing: 0.5px;
          }
          .seal-img {
            max-height: 90px;
            width: 100%;
            object-fit: contain;
            display: block;
            margin: 0 auto;
          }
        </style>
      </head>
      <body>
        <div class="a4-page">
          <div>
            <table class="header-table">
              <tr>
                <td style="width: 120px; vertical-align: middle; text-align: left;">
                  <img src="${currentLogo}" class="cr-logo" alt="Logo" />
                </td>
                <td style="vertical-align: middle; padding-left: 20px; text-align: left;">
                  <div class="cr-title-en">${crEn}</div>
                  <div class="cr-title-ar">${crAr}</div>
                  <div class="cr-meta" style="margin-top: 6px; font-size: 10.5px; line-height: 1.4;">
                    <div><strong>CR NO:</strong> ${crNum} &nbsp;&bull;&nbsp; <strong>Contact No:</strong> +973 33866650</div>
                    <div><strong>Email Address:</strong> tabarakph.info@gmail.com &nbsp;&bull;&nbsp; Kingdom of Bahrain</div>
                  </div>
                </td>
              </tr>
            </table>

            <div class="letter-body">
              <div class="letter-subject">شهادة إثبات عمل واكتساب خبرة مهنية</div>
              <div class="letter-text">
                تشهد إدارة مجموعة صيدليات تبارك ذ.م.م بأن الموظف المذكور أدناه يعمل لدينا وتحت كفالتنا بالسجل التجاري رقم (<strong>${crNum}</strong>)، وذلك اعتباراً من تاريخ التحاقه بالعمل. وقد أُعطيت له هذه الشهادة بناءً على طلبه لتقديمها إلى الجهات المختصة دون أدنى مسؤولية على المجموعة.
              </div>
            </div>
          </div>

          <div class="footer-section">
            <div class="sig-box">
              <div>
                <img src="${currentSig}" class="sig-img" alt="CEO Signature" />
              </div>
              <div class="sig-name">Dr. Fathy Saad Amin</div>
              <div class="sig-title">CEO - المدير التنفيذي</div>
            </div>

            <div class="seal-box">
              <span class="seal-label">Company's Seal</span>
              <div style="height: 90px; display: flex; align-items: center; justify-content: center;">
                <img src="${currentStamp}" class="seal-img" alt="Official Corporate Seal" />
              </div>
            </div>
          </div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Executive KPI Computations
  const totalCrs = crs.length;
  const masterCount = crs.filter(c => c.is_master).length;
  const subCount = crs.filter(c => !c.is_master).length;
  const linkedCount = crs.filter(c => c.linked_branch_id).length;
  const linkagePercentage = totalCrs > 0 ? Math.round((linkedCount / totalCrs) * 100) : 0;

  // Expiry Alert logic (less than 90 days or expired)
  const expiringSoonCount = crs.filter(c => {
    if (!c.expiry_date) return false;
    const diffDays = Math.ceil((new Date(c.expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    return diffDays <= 90;
  }).length;

  // Fast 1-Click Renewal (+1 Year)
  const handleQuickAddOneYear = async (e: React.MouseEvent, cr: RegisteredCR) => {
    e.stopPropagation();
    let base = new Date();
    if (cr.expiry_date) {
      const parsed = new Date(cr.expiry_date);
      if (!isNaN(parsed.getTime()) && parsed > base) {
        base = parsed;
      }
    }
    base.setFullYear(base.getFullYear() + 1);
    const newExpiry = base.toISOString().split('T')[0];

    const updated = {
      ...cr,
      expiry_date: newExpiry,
      updated_at: new Date().toISOString()
    };
    setCrs(prev => prev.map(c => c.id === cr.id ? updated : c));
    await crService.save(updated);

    Swal.fire({
      icon: 'success',
      title: 'تم التجديد السريع بنجاح (+1 سنة)!',
      html: `تم تمديد صلاحية السجل التجاري <strong>${cr.cr_number}</strong><br/><span class="text-xs text-slate-600">${cr.cr_name_ar || cr.cr_name}</span><br/><div class="mt-2 text-sm font-bold text-emerald-600 font-mono bg-emerald-50 py-1.5 px-3 rounded-lg border border-emerald-200">تاريخ الانتهاء الجديد: ${newExpiry}</div>`,
      timer: 2200,
      showConfirmButton: false
    });
  };

  // Fast 1-Click NHRA Renewal (+3 Years)
  const handleQuickAddThreeYearsNhra = async (e: React.MouseEvent, cr: RegisteredCR) => {
    e.stopPropagation();
    let base = new Date();
    const matched = INITIAL_21_CRS.find(c => c.cr_number === cr.cr_number || c.id === cr.id);
    const existingNhraExp = cr.nhra_expiry_date || matched?.nhra_expiry_date;
    if (existingNhraExp) {
      const parsed = new Date(existingNhraExp);
      if (!isNaN(parsed.getTime()) && parsed > base) {
        base = parsed;
      }
    }
    base.setFullYear(base.getFullYear() + 3);
    const newExpiry = base.toISOString().split('T')[0];

    const updated: RegisteredCR = {
      ...cr,
      nhra_license_no: cr.nhra_license_no || matched?.nhra_license_no || 'NHRA/PH/2022/1001',
      nhra_expiry_date: newExpiry,
      updated_at: new Date().toISOString()
    };
    setCrs(prev => prev.map(c => c.id === cr.id ? updated : c));
    await crService.save(updated);

    Swal.fire({
      icon: 'success',
      title: 'تم التجديد السريع لترخيص NHRA بنجاح (+3 سنوات)!',
      html: `تم تمديد صلاحية ترخيص NHRA لفرع/سجل <strong>${cr.cr_number}</strong><br/><span class="text-xs text-slate-600">${cr.cr_name_ar || cr.cr_name}</span><br/><div class="mt-2 text-sm font-bold text-purple-700 font-mono bg-purple-50 py-1.5 px-3 rounded-lg border border-purple-200">تاريخ انتهاء NHRA الجديد: ${newExpiry}</div>`,
      timer: 2200,
      showConfirmButton: false
    });
  };

  // Open Quick Compliance & Expiry Editor Modal
  const openQuickExpiryModal = (cr: RegisteredCR, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const matched = INITIAL_21_CRS.find(c => c.cr_number === cr.cr_number || c.id === cr.id);
    setQuickExpiryCr(cr);
    setQuickExpiryDate(formatExpiryDateForInput(cr.expiry_date, cr.cr_number, cr.id));
    setQuickTaxNumber(cr.tax_number || '3000987654321');
    setQuickNhraLicenseNo(cr.nhra_license_no || matched?.nhra_license_no || '');
    setQuickNhraExpiryDate(formatExpiryDateForInput(cr.nhra_expiry_date || matched?.nhra_expiry_date, cr.cr_number, cr.id));
  };

  // Preset shortcut helper for Quick Editor
  const applyExpiryPreset = (months: number = 0, years: number = 0, fromTodayOnly: boolean = false) => {
    let base = new Date();
    if (!fromTodayOnly && quickExpiryDate) {
      const parsed = new Date(quickExpiryDate);
      if (!isNaN(parsed.getTime()) && parsed > base) {
        base = parsed;
      }
    }
    if (years > 0) base.setFullYear(base.getFullYear() + years);
    if (months > 0) base.setMonth(base.getMonth() + months);
    setQuickExpiryDate(base.toISOString().split('T')[0]);
  };

  // Preset shortcut helper for NHRA in Quick Editor
  const applyNhraExpiryPreset = (years: number = 3, fromTodayOnly: boolean = false) => {
    let base = new Date();
    if (!fromTodayOnly && quickNhraExpiryDate) {
      const parsed = new Date(quickNhraExpiryDate);
      if (!isNaN(parsed.getTime()) && parsed > base) {
        base = parsed;
      }
    }
    if (years > 0) base.setFullYear(base.getFullYear() + years);
    setQuickNhraExpiryDate(base.toISOString().split('T')[0]);
  };

  // Save Quick Expiry & Compliance
  const handleSaveQuickExpiry = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickExpiryCr) return;
    setQuickRenewalLoading(true);
    try {
      const updated: RegisteredCR = {
        ...quickExpiryCr,
        expiry_date: quickExpiryDate.trim() || undefined,
        tax_number: quickTaxNumber.trim() || undefined,
        nhra_license_no: quickNhraLicenseNo.trim() || undefined,
        nhra_expiry_date: quickNhraExpiryDate.trim() || undefined,
        updated_at: new Date().toISOString()
      };
      setCrs(prev => prev.map(c => c.id === quickExpiryCr.id ? updated : c));
      await crService.save(updated);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(RENEWALS_UPDATED_EVENT));
      }
      setQuickExpiryCr(null);
      Swal.fire({
        icon: 'success',
        title: 'تم تحديث الصلاحية والترخيص بنجاح',
        text: `تم حفظ بيانات السجل ${updated.cr_number} وترخيص NHRA بنجاح.`,
        timer: 1800,
        showConfirmButton: false
      });
    } catch (err: any) {
      console.error(err);
      Swal.fire('Error', err.message || 'Failed to save renewal', 'error');
    } finally {
      setQuickRenewalLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingCr(null);
    setCrName('');
    setCrNameAr('');
    setCrNumber('');
    setIsMaster(false);
    setParentCrNumber(crs.find(c => c.is_master)?.cr_number || '');
    setLinkedBranchId('');
    setTaxNumber('3000987654321');
    setExpiryDate('2026-12-31');
    setNhraLicenseNo('');
    setNhraExpiryDate('2027-12-31');
    setLogoUrl(DEFAULT_GROUP_LOGO);
    setSignatureUrl(DEFAULT_SIGNATURE);
    setStampUrl(generateCrStampSvg('', '', ''));
    setIsModalOpen(true);
  };

  const openEditModal = (cr: RegisteredCR) => {
    const matched = INITIAL_21_CRS.find(c => c.cr_number === cr.cr_number || c.id === cr.id);
    setEditingCr(cr);
    setCrName(cr.cr_name);
    setCrNameAr(cr.cr_name_ar || '');
    setCrNumber(cr.cr_number);
    setIsMaster(cr.is_master);
    setParentCrNumber(cr.parent_cr_number || '');
    setLinkedBranchId(cr.linked_branch_id || '');
    setTaxNumber(cr.tax_number || '3000987654321');
    setExpiryDate(formatExpiryDateForInput(cr.expiry_date, cr.cr_number, cr.id));
    setNhraLicenseNo(cr.nhra_license_no || matched?.nhra_license_no || '');
    setNhraExpiryDate(formatExpiryDateForInput(cr.nhra_expiry_date || matched?.nhra_expiry_date, cr.cr_number, cr.id));
    setLogoUrl(cr.logo_url || (cr.is_master ? DEFAULT_GROUP_LOGO : DEFAULT_SUB_LOGO));
    setSignatureUrl(cr.signature_url || DEFAULT_SIGNATURE);
    setStampUrl(cr.stamp_url || generateCrStampSvg(cr.cr_name_ar, cr.cr_name, cr.cr_number));
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    Swal.fire({
      title: 'Remove Registered CR?',
      text: 'This will delete the CR record from the admin database.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444'
    }).then(result => {
      if (result.isConfirmed) {
        setCrs(prev => prev.filter(c => c.id !== id));
        crService.delete(id).catch(console.error);
        Swal.fire({
          title: 'Deleted!',
          text: 'Registered CR removed from system.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
      }
    });
  };

  const handleSyncCloud = async () => {
    setIsCloudLoading(true);
    try {
      const data = await crService.list();
      setCrs(data);
      Swal.fire({
        icon: 'success',
        title: 'Cloud Sync Successful (مزامنة سحابية ناجحة)',
        text: `Loaded and verified ${data.length} registered commercial registrations.`,
        timer: 1800,
        showConfirmButton: false
      });
    } catch (err: any) {
      Swal.fire('Sync Error', err.message || 'Failed to sync with cloud', 'error');
    } finally {
      setIsCloudLoading(false);
    }
  };

  const handleCopyCr = (crNumber: string, id: string) => {
    navigator.clipboard.writeText(crNumber);
    setCopiedCrId(id);
    setTimeout(() => setCopiedCrId(null), 2000);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setLogoUrl(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setSignatureUrl(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setStampUrl(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!crName.trim() || !crNumber.trim()) {
      Swal.fire('Error', 'CR Name and CR Number are required fields', 'error');
      return;
    }

    const linkedBranch = branches.find(b => b.id === linkedBranchId);
    const branchName = linkedBranch ? `${linkedBranch.name} (${linkedBranch.code})` : undefined;

    const payload: RegisteredCR = {
      id: editingCr?.id || `cr-${Date.now()}`,
      cr_name: crName.trim(),
      cr_name_ar: crNameAr.trim() || undefined,
      cr_number: crNumber.trim(),
      is_master: isMaster,
      parent_cr_number: isMaster ? undefined : (parentCrNumber.trim() || undefined),
      linked_branch_id: linkedBranchId || undefined,
      linked_branch_name: branchName,
      tax_number: taxNumber.trim() || undefined,
      expiry_date: expiryDate.trim() || undefined,
      nhra_license_no: nhraLicenseNo.trim() || undefined,
      nhra_expiry_date: nhraExpiryDate.trim() || undefined,
      logo_url: logoUrl || (isMaster ? DEFAULT_GROUP_LOGO : DEFAULT_SUB_LOGO),
      signature_url: signatureUrl || DEFAULT_SIGNATURE,
      stamp_url: stampUrl || generateCrStampSvg(crNameAr, crName, crNumber),
      created_at: editingCr?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Auto-propagate CEO signature to all registered CRs if master CR signature is uploaded/saved
    const currentSig = signatureUrl || DEFAULT_SIGNATURE;
    
    if (editingCr) {
      setCrs(prev => prev.map(c => {
        if (c.id === editingCr.id) return payload;
        // If master CR signature was updated or is master, sync to all sub CRs
        if (isMaster || (signatureUrl && signatureUrl !== editingCr.signature_url)) {
          return { ...c, signature_url: currentSig };
        }
        return c;
      }));
      crService.save(payload).catch(console.error);
      Swal.fire({
        title: 'Updated!',
        text: isMaster ? 'Master CR and universal signature propagated to all CRs.' : 'Commercial Registration details saved to cloud database.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
    } else {
      if (isMaster && signatureUrl) {
        const updated = crs.map(c => ({ ...c, signature_url: currentSig })).concat(payload);
        setCrs(updated);
        crService.saveAll(updated).catch(console.error);
      } else {
        setCrs(prev => [...prev, payload]);
        crService.save(payload).catch(console.error);
      }
      Swal.fire({
        title: 'Registered!',
        text: 'New Commercial Registration added and saved to cloud database.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
    }
    setIsModalOpen(false);
  };

  const handleExportExcel = () => {
    if (crs.length === 0) {
      Swal.fire('Warning', 'No commercial registrations available to export.', 'warning');
      return;
    }

    const headers = [
      'CR ID',
      'CR Name (EN) - اسم السجل بالإنجليزي',
      'CR Name (AR) - اسم السجل بالعربي',
      'CR Number - رقم السجل',
      'Type - نوع السجل',
      'Parent CR Number - السجل الرئيسي',
      'Linked Branch Name - الفرع المربوط',
      'Linked Branch ID',
      'VAT Tax Number - الرقم الضريبي',
      'CR Expiry Date - تاريخ انتهاء السجل',
      'NHRA License No - ترخيص الهيئة',
      'NHRA Expiry Date - تاريخ انتهاء الهيئة',
      'Phone - الهاتف',
      'Email - البريد الإلكتروني',
      'Address (EN) - العنوان بالإنجليزي',
      'Address (AR) - العنوان بالعربي',
      'Last Updated - تاريخ آخر تحديث'
    ];

    const rows = crs.map(cr => {
      const matched = INITIAL_21_CRS.find(m => m.cr_number === cr.cr_number || m.id === cr.id);
      return [
        cr.id || '',
        cr.cr_name || '',
        cr.cr_name_ar || matched?.cr_name_ar || '',
        cr.cr_number || '',
        cr.is_master ? 'Main Master Group CR' : 'Sub-CR',
        cr.parent_cr_number || '',
        cr.linked_branch_name || matched?.linked_branch_name || '',
        cr.linked_branch_id || '',
        cr.tax_number || matched?.tax_number || '3000987654321',
        cr.expiry_date || matched?.expiry_date || '',
        cr.nhra_license_no || matched?.nhra_license_no || '',
        cr.nhra_expiry_date || matched?.nhra_expiry_date || '',
        cr.phone || matched?.phone || '',
        cr.email || matched?.email || '',
        cr.address_en || matched?.address_en || '',
        cr.address_ar || matched?.address_ar || '',
        cr.updated_at ? formatDateTime(cr.updated_at) : (cr.created_at ? formatDateTime(cr.created_at) : '')
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Registered_CRs_Full_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        if (!text) {
          Swal.fire('Error', 'No content found in uploaded file', 'error');
          return;
        }

        const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);
        if (lines.length <= 1) {
          Swal.fire('Error', 'No data rows found in uploaded file', 'error');
          return;
        }

        // Auto-detect CSV delimiter (comma or semicolon)
        const firstLine = lines[0];
        const delimiter = (firstLine.includes(';') && firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';

        const parseCsvLine = (line: string): string[] => {
          const result: string[] = [];
          let cur = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === delimiter && !inQuotes) {
              result.push(cur.trim());
              cur = '';
            } else {
              cur += char;
            }
          }
          result.push(cur.trim());
          return result;
        };

        const headers = parseCsvLine(lines[0]).map(h => h.replace(/^"|"$/g, '').toLowerCase().trim());

        const getColIdx = (names: string[]): number => {
          return headers.findIndex(h => names.some(n => h.includes(n.toLowerCase())));
        };

        const idxId = getColIdx(['cr id', 'id', 'معرف']);
        const idxCrNameEn = getColIdx(['cr name (en)', 'cr name', 'اسم السجل بالإنجليزي', 'اسم السجل', 'english name', 'name']);
        const idxCrNameAr = getColIdx(['cr name (ar)', 'اسم السجل بالعربي', 'arabic name']);
        const idxCrNum = getColIdx(['cr number', 'رقم السجل', 'cr_number', 'number', 'cr#']);
        const idxType = getColIdx(['type', 'نوع السجل', 'is_master']);
        const idxParent = getColIdx(['parent cr', 'السجل الرئيسي', 'parent']);
        const idxBranchName = getColIdx(['linked branch name', 'الفرع المربوط', 'الفرع', 'branch']);
        const idxBranchId = getColIdx(['linked branch id', 'branch_id', 'branch id']);
        const idxTax = getColIdx(['vat tax number', 'tax number', 'الرقم الضريبي', 'vat', 'tax']);
        const idxExpiry = getColIdx(['cr expiry date', 'cr expiry', 'expiry date', 'expiry', 'تاريخ انتهاء السجل', 'تاريخ الانتهاء', 'تاريخ انتهاء', 'انتهاء السجل', 'صلاحية السجل', 'exp date', 'exp_date']);
        const idxNhraLic = getColIdx(['nhra license no', 'nhra no', 'ترخيص الهيئة', 'ترخيص nhra', 'nhra']);
        const idxNhraExp = getColIdx(['nhra expiry date', 'nhra expiry', 'تاريخ انتهاء الهيئة', 'تاريخ انتهاء ترخيص nhra', 'انتهاء الهيئة', 'انتهاء nhra', 'nhra exp', 'nhra_expiry']);
        const idxPhone = getColIdx(['phone', 'الهاتف', 'رقم التواصل', 'رقم الهاتف', 'mobile']);
        const idxEmail = getColIdx(['email', 'البريد الإلكتروني', 'البريد']);
        const idxAddressEn = getColIdx(['address (en)', 'address en', 'العنوان بالإنجليزي', 'address']);
        const idxAddressAr = getColIdx(['address (ar)', 'address ar', 'العنوان بالعربي']);

        interface CrUpdateOperation {
          cr_number: string;
          cr_name: string;
          cr_name_ar?: string;
          changes: string[];
        }
        interface CrCreateOperation {
          cr_number: string;
          cr_name: string;
          cr_name_ar?: string;
        }

        const updatedOperations: CrUpdateOperation[] = [];
        const createdOperations: CrCreateOperation[] = [];
        let totalFieldsChangedCount = 0;
        let expiryDatesUpdatedCount = 0;
        let nhraExpiriesUpdatedCount = 0;
        let nhraLicensesUpdatedCount = 0;
        let taxNumbersUpdatedCount = 0;
        let branchesUpdatedCount = 0;
        let namesUpdatedCount = 0;

        const cleanKey = (val?: string) => (val ? String(val).trim().toLowerCase().replace(/\s+/g, '') : '');

        // Map existing CRs by clean CR Number and ID
        const crMap = new Map<string, RegisteredCR>();
        crs.forEach(item => {
          if (item.cr_number) {
            crMap.set(cleanKey(item.cr_number), { ...item });
          }
          if (item.id) {
            crMap.set(cleanKey(item.id), { ...item });
          }
        });

        // Process data rows synchronously
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCsvLine(lines[i]).map(c => c.replace(/^"|"$/g, '').trim());
          const rawCrNum = idxCrNum !== -1 ? cols[idxCrNum] : (cols[3] || cols[2] || cols[0]);
          const rawId = idxId !== -1 ? cols[idxId] : '';

          if (!rawCrNum && !rawId) continue;

          const keyByNum = cleanKey(rawCrNum);
          const keyById = cleanKey(rawId);
          const existing = (keyByNum && crMap.get(keyByNum)) || (keyById && crMap.get(keyById));

          const rawExpiry = idxExpiry !== -1 ? cols[idxExpiry] : undefined;
          const parsedExpiry = parseAndFormatDateStr(rawExpiry);
          const normNewExpiry = parsedExpiry || (rawExpiry ? formatExpiryDateForInput(rawExpiry) : undefined);

          const rawNhraExp = idxNhraExp !== -1 ? cols[idxNhraExp] : undefined;
          const parsedNhraExp = parseAndFormatDateStr(rawNhraExp);
          const normNewNhraExp = parsedNhraExp || (rawNhraExp ? formatExpiryDateForInput(rawNhraExp) : undefined);

          const rawBranchName = idxBranchName !== -1 ? cols[idxBranchName] : undefined;
          const rawBranchId = idxBranchId !== -1 ? cols[idxBranchId] : undefined;
          let matchedBranch = branches.find(b => rawBranchId && b.id === rawBranchId.trim());
          if (!matchedBranch && rawBranchName) {
            matchedBranch = branches.find(b => b.name.toLowerCase().includes(rawBranchName.trim().toLowerCase()) || rawBranchName.toLowerCase().includes(b.code.toLowerCase()));
          }

          if (existing) {
            const recordChanges: string[] = [];

            // 1. CR Expiry Date comparison
            const normOldExpiry = parseAndFormatDateStr(existing.expiry_date) || existing.expiry_date;
            let finalExpiry = existing.expiry_date;
            if (normNewExpiry && normNewExpiry !== normOldExpiry) {
              recordChanges.push(`تاريخ انتهاء السجل (CR Expiry): تم التعديل من <span class="line-through text-slate-400 font-mono">${normOldExpiry || 'غير محدد'}</span> ⬅ إلى <strong class="text-emerald-700 font-mono bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">${normNewExpiry}</strong>`);
              finalExpiry = normNewExpiry;
              expiryDatesUpdatedCount++;
            }

            // 2. NHRA Expiry Date comparison
            const normOldNhraExp = parseAndFormatDateStr(existing.nhra_expiry_date) || existing.nhra_expiry_date;
            let finalNhraExpiry = existing.nhra_expiry_date;
            if (normNewNhraExp && normNewNhraExp !== normOldNhraExp) {
              recordChanges.push(`تاريخ انتهاء ترخيص الهيئة (NHRA Expiry): تم التعديل من <span class="line-through text-slate-400 font-mono">${normOldNhraExp || 'غير محدد'}</span> ⬅ إلى <strong class="text-purple-700 font-mono bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">${normNewNhraExp}</strong>`);
              finalNhraExpiry = normNewNhraExp;
              nhraExpiriesUpdatedCount++;
            }

            // 3. NHRA License No
            const rawNhraLic = idxNhraLic !== -1 ? cols[idxNhraLic] : undefined;
            let finalNhraLic = existing.nhra_license_no;
            if (rawNhraLic && rawNhraLic.trim() && rawNhraLic.trim() !== (existing.nhra_license_no || '').trim()) {
              recordChanges.push(`رقم ترخيص الهيئة (NHRA No): تم التعديل من <span class="line-through text-slate-400 font-mono">${existing.nhra_license_no || 'غير محدد'}</span> ⬅ إلى <strong class="text-slate-900 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">${rawNhraLic.trim()}</strong>`);
              finalNhraLic = rawNhraLic.trim();
              nhraLicensesUpdatedCount++;
            }

            // 4. VAT Tax Number
            const rawTax = idxTax !== -1 ? cols[idxTax] : undefined;
            let finalTax = existing.tax_number;
            if (rawTax && rawTax.trim() && rawTax.trim() !== (existing.tax_number || '').trim()) {
              recordChanges.push(`الرقم الضريبي (VAT ID): تم التعديل من <span class="line-through text-slate-400 font-mono">${existing.tax_number || 'غير محدد'}</span> ⬅ إلى <strong class="text-slate-900 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">${rawTax.trim()}</strong>`);
              finalTax = rawTax.trim();
              taxNumbersUpdatedCount++;
            }

            // 5. CR Names
            const rawNameEn = idxCrNameEn !== -1 ? cols[idxCrNameEn] : undefined;
            let finalNameEn = existing.cr_name;
            if (rawNameEn && rawNameEn.trim() && rawNameEn.trim() !== existing.cr_name.trim()) {
              recordChanges.push(`اسم السجل بالإنجليزي: تم التعديل إلى <strong class="text-slate-900">${rawNameEn.trim()}</strong>`);
              finalNameEn = rawNameEn.trim();
              namesUpdatedCount++;
            }

            const rawNameAr = idxCrNameAr !== -1 ? cols[idxCrNameAr] : undefined;
            let finalNameAr = existing.cr_name_ar;
            if (rawNameAr && rawNameAr.trim() && rawNameAr.trim() !== (existing.cr_name_ar || '').trim()) {
              recordChanges.push(`اسم السجل بالعربي: تم التعديل إلى <strong class="text-slate-900">${rawNameAr.trim()}</strong>`);
              finalNameAr = rawNameAr.trim();
            }

            // 6. Linked Branch
            let finalBranchId = existing.linked_branch_id;
            let finalBranchName = existing.linked_branch_name;
            if (matchedBranch && matchedBranch.id !== existing.linked_branch_id) {
              recordChanges.push(`الفرع المربوط: تم الربط بـ <strong class="text-brand bg-brand/10 px-1.5 py-0.5 rounded border border-brand/20">${matchedBranch.name} (${matchedBranch.code})</strong>`);
              finalBranchId = matchedBranch.id;
              finalBranchName = `${matchedBranch.name} (${matchedBranch.code})`;
              branchesUpdatedCount++;
            }

            // 7. Phone, Email, Address
            const rawPhone = idxPhone !== -1 ? cols[idxPhone] : undefined;
            const rawEmail = idxEmail !== -1 ? cols[idxEmail] : undefined;
            const rawAddressEn = idxAddressEn !== -1 ? cols[idxAddressEn] : undefined;
            const rawAddressAr = idxAddressAr !== -1 ? cols[idxAddressAr] : undefined;
            let finalPhone = existing.phone;
            let finalEmail = existing.email;
            let finalAddressEn = existing.address_en;
            let finalAddressAr = existing.address_ar;
            if (rawPhone && rawPhone.trim() && rawPhone.trim() !== (existing.phone || '').trim()) {
              recordChanges.push(`الهاتف: تم التعديل إلى <strong class="text-slate-800">${rawPhone.trim()}</strong>`);
              finalPhone = rawPhone.trim();
            }
            if (rawEmail && rawEmail.trim() && rawEmail.trim() !== (existing.email || '').trim()) {
              recordChanges.push(`البريد: تم التعديل إلى <strong class="text-slate-800">${rawEmail.trim()}</strong>`);
              finalEmail = rawEmail.trim();
            }
            if (rawAddressEn && rawAddressEn.trim() && rawAddressEn.trim() !== (existing.address_en || '').trim()) {
              recordChanges.push(`العنوان بالإنجليزي: تم التعديل`);
              finalAddressEn = rawAddressEn.trim();
            }
            if (rawAddressAr && rawAddressAr.trim() && rawAddressAr.trim() !== (existing.address_ar || '').trim()) {
              recordChanges.push(`العنوان بالعربي: تم التعديل`);
              finalAddressAr = rawAddressAr.trim();
            }

            // 8. Type & Parent
            const rawType = idxType !== -1 ? cols[idxType] : undefined;
            const isMasterVal = rawType ? (rawType.toLowerCase().includes('main') || rawType.toLowerCase().includes('master') || rawType.toLowerCase().includes('رئيسي')) : existing.is_master;
            const rawParent = idxParent !== -1 ? cols[idxParent] : undefined;
            let finalParent = existing.parent_cr_number;
            if (rawParent && rawParent.trim() && rawParent.trim() !== (existing.parent_cr_number || '').trim()) {
              recordChanges.push(`السجل الرئيسي: تم التعديل إلى <strong class="text-slate-800 font-mono">${rawParent.trim()}</strong>`);
              finalParent = rawParent.trim();
            }

            if (recordChanges.length > 0) {
              updatedOperations.push({
                cr_number: existing.cr_number,
                cr_name: finalNameEn,
                cr_name_ar: finalNameAr,
                changes: recordChanges
              });
              totalFieldsChangedCount += recordChanges.length;

              const updatedCr: RegisteredCR = {
                ...existing,
                cr_name: finalNameEn,
                cr_name_ar: finalNameAr,
                is_master: isMasterVal,
                parent_cr_number: finalParent,
                linked_branch_id: finalBranchId,
                linked_branch_name: finalBranchName,
                tax_number: finalTax,
                expiry_date: finalExpiry,
                nhra_license_no: finalNhraLic,
                nhra_expiry_date: finalNhraExpiry,
                phone: finalPhone,
                email: finalEmail,
                address_en: finalAddressEn,
                address_ar: finalAddressAr,
                updated_at: new Date().toISOString()
              };

              crMap.set(cleanKey(existing.cr_number), updatedCr);
              if (existing.id) crMap.set(cleanKey(existing.id), updatedCr);
            }
          } else {
            // New CR record
            const newCr: RegisteredCR = {
              id: (idxId !== -1 && cols[idxId]) ? cols[idxId].trim() : `cr-imp-${Date.now()}-${i}`,
              cr_name: (idxCrNameEn !== -1 && cols[idxCrNameEn]) ? cols[idxCrNameEn].trim() : `CR ${rawCrNum}`,
              cr_name_ar: (idxCrNameAr !== -1 && cols[idxCrNameAr]) ? cols[idxCrNameAr].trim() : undefined,
              cr_number: rawCrNum.trim(),
              is_master: idxType !== -1 ? (cols[idxType].toLowerCase().includes('master') || cols[idxType].toLowerCase().includes('main') || cols[idxType].includes('رئيسي')) : false,
              parent_cr_number: idxParent !== -1 ? cols[idxParent].trim() : undefined,
              linked_branch_id: matchedBranch ? matchedBranch.id : (idxBranchId !== -1 ? cols[idxBranchId].trim() : undefined),
              linked_branch_name: matchedBranch ? `${matchedBranch.name} (${matchedBranch.code})` : (idxBranchName !== -1 ? cols[idxBranchName].trim() : undefined),
              tax_number: (idxTax !== -1 && cols[idxTax]) ? cols[idxTax].trim() : '3000987654321',
              expiry_date: normNewExpiry || '2026-12-31',
              nhra_license_no: (idxNhraLic !== -1 && cols[idxNhraLic]) ? cols[idxNhraLic].trim() : undefined,
              nhra_expiry_date: normNewNhraExp || '2027-12-31',
              phone: idxPhone !== -1 ? cols[idxPhone].trim() : undefined,
              email: idxEmail !== -1 ? cols[idxEmail].trim() : undefined,
              address_en: idxAddressEn !== -1 ? cols[idxAddressEn].trim() : undefined,
              address_ar: idxAddressAr !== -1 ? cols[idxAddressAr].trim() : undefined,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            crMap.set(cleanKey(newCr.cr_number), newCr);
            crMap.set(cleanKey(newCr.id), newCr);
            createdOperations.push({
              cr_number: newCr.cr_number,
              cr_name: newCr.cr_name,
              cr_name_ar: newCr.cr_name_ar
            });
          }
        }

        // Deduplicate unique records by ID
        const uniqueCrMap = new Map<string, RegisteredCR>();
        Array.from(crMap.values()).forEach(c => {
          if (c.id) {
            uniqueCrMap.set(c.id, c);
          } else if (c.cr_number) {
            uniqueCrMap.set(c.cr_number, c);
          }
        });
        const nextCrs = Array.from(uniqueCrMap.values());

        // Update state and cloud database
        setCrs(nextCrs);
        crService.saveAll(nextCrs).catch(console.warn);

        // Display comprehensive modal reporting exact operations modified
        Swal.fire({
          icon: updatedOperations.length > 0 ? 'success' : (createdOperations.length > 0 ? 'info' : 'question'),
          title: 'تقرير استيراد وتحديث البيانات (Bulk Upload Report)',
          width: '660px',
          html: `
            <div class="text-right font-sans text-xs space-y-3 pt-1 dir-rtl" dir="rtl">
              <!-- Top Summary Banner -->
              <div class="p-3.5 bg-slate-900 text-white rounded-2xl space-y-2.5 shadow-md">
                <div class="flex items-center justify-between font-black text-sm">
                  <span class="flex items-center gap-1.5">
                    <span class="w-2.5 h-2.5 rounded-full ${updatedOperations.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}"></span>
                    <span>نتيجة معالجة الملف ومطابقة السجلات:</span>
                  </span>
                  <span class="bg-emerald-500 text-slate-950 font-mono font-black px-2.5 py-0.5 rounded-full text-xs">
                    ${updatedOperations.length} عمليات تم تعديلها
                  </span>
                </div>
                
                <div class="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                  <div class="bg-slate-800/80 p-2 rounded-xl border border-slate-700/60">
                    <span class="text-slate-400 block text-[10px] font-bold">سجلات تم تعديلها</span>
                    <strong class="text-emerald-400 text-sm font-black font-mono">${updatedOperations.length}</strong>
                  </div>
                  <div class="bg-slate-800/80 p-2 rounded-xl border border-slate-700/60">
                    <span class="text-slate-400 block text-[10px] font-bold">سجلات جديدة مضافة</span>
                    <strong class="text-sky-400 text-sm font-black font-mono">${createdOperations.length}</strong>
                  </div>
                  <div class="bg-slate-800/80 p-2 rounded-xl border border-slate-700/60">
                    <span class="text-slate-400 block text-[10px] font-bold">إجمالي الحقول المعدلة</span>
                    <strong class="text-amber-400 text-sm font-black font-mono">${totalFieldsChangedCount}</strong>
                  </div>
                </div>
              </div>

              <!-- Detailed Modified Operations List -->
              ${updatedOperations.length > 0 ? `
                <div class="space-y-1.5 pt-1">
                  <div class="flex items-center justify-between text-xs font-black text-slate-800 px-1">
                    <span>العمليات والسجلات التي تم تعديلها بالتفصيل (${updatedOperations.length}):</span>
                    <span class="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      تم التحديث والتخزين السحابي
                    </span>
                  </div>
                  <div class="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar text-right">
                    ${updatedOperations.map((op) => `
                      <div class="p-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-emerald-300 transition-colors">
                        <div class="flex items-center justify-between border-b border-slate-100 pb-1 mb-1.5">
                          <span class="font-black text-slate-900 text-xs flex items-center gap-1.5">
                            <span class="bg-slate-100 text-slate-700 font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-200 font-bold">${op.cr_number}</span>
                            <span>${op.cr_name_ar || op.cr_name}</span>
                          </span>
                          <span class="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                            ${op.changes.length} تعديل
                          </span>
                        </div>
                        <ul class="space-y-1 text-[11px] text-slate-700 pr-2 list-disc font-medium">
                          ${op.changes.map(ch => `<li>${ch}</li>`).join('')}
                        </ul>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : `
                <div class="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-center text-xs font-bold">
                  ${createdOperations.length > 0
                    ? 'تمت إضافة سجلات جديدة دون وجود تعديلات على السجلات الحالية.'
                    : 'تمت مطابقة البيانات بالكامل، ولم يتم العثور على أي قيم أو تواريخ مختلفة عن السجلات الحالية.'}
                </div>
              `}

              <!-- Newly Added Records (if any) -->
              ${createdOperations.length > 0 ? `
                <div class="p-2.5 bg-sky-50 border border-sky-200 rounded-xl space-y-1">
                  <div class="text-xs font-black text-sky-900">سجلات جديدة تمت إضافتها (${createdOperations.length}):</div>
                  <div class="text-[11px] text-sky-800 flex flex-wrap gap-1 font-mono">
                    ${createdOperations.map(c => `<span class="bg-white px-2 py-0.5 rounded border border-sky-200 font-bold">${c.cr_number} (${c.cr_name})</span>`).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          `,
          confirmButtonText: 'تم واعتماد التعديلات',
          confirmButtonColor: '#059669',
          customClass: {
            popup: 'rounded-3xl shadow-2xl border border-slate-200'
          }
        });
      } catch (err: any) {
        console.error(err);
        Swal.fire('Import Failed', err.message || 'Failed to parse file', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filtered CRs
  const filteredCrs = crs.filter(c => {
    const matchesSearch =
      c.cr_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cr_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.parent_cr_number && c.parent_cr_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.tax_number && c.tax_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.linked_branch_name && c.linked_branch_name.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterType === 'master') return c.is_master;
    if (filterType === 'sub') return !c.is_master;
    if (filterType === 'linked') return Boolean(c.linked_branch_id);
    if (filterType === 'unlinked') return !c.linked_branch_id;
    if (filterType === 'alerts') {
      if (!c.expiry_date) return false;
      const diffDays = Math.ceil((new Date(c.expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
      return diffDays <= 90;
    }

    return true;
  });

  const getExpiryStatus = (expiryDateStr?: string) => {
    if (!expiryDateStr) return { label: 'غير محدد (No Expiry)', tone: 'slate' };
    const diffDays = Math.ceil((new Date(expiryDateStr).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    if (diffDays < 0) return { label: `منتهي: ${expiryDateStr}`, tone: 'red' };
    if (diffDays <= 90) return { label: `ينتهي: ${expiryDateStr} (${diffDays}d)`, tone: 'amber' };
    return { label: `تاريخ الانتهاء: ${expiryDateStr}`, tone: 'emerald' };
  };

  return (
    <div className="space-y-6">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportExcel}
        accept=".xlsx, .xls, .csv"
        className="hidden"
      />

      {/* 1. Clickable KPI Executive Summary Cards (Click to Filter) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Card 1: Total Registered CRs */}
        <button
          type="button"
          onClick={() => setFilterType('all')}
          title="عرض جميع السجلات المسجلة (Show All CRs)"
          className={`p-4 rounded-2xl text-left transition-all duration-200 cursor-pointer shadow-sm relative overflow-hidden group ${
            filterType === 'all'
              ? 'bg-gradient-to-br from-slate-900 to-slate-800 text-white ring-2 ring-brand ring-offset-2 shadow-lg scale-[1.02]'
              : 'bg-gradient-to-br from-slate-900 to-slate-800 text-white hover:shadow-md'
          }`}
        >
          {filterType === 'all' && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-brand text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-xs">
              <Check className="w-2.5 h-2.5" />
              <span>الكل</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Total Registered CRs</span>
              <div className="text-2xl font-black">{totalCrs}</div>
              <span className="text-[10px] text-slate-400 font-semibold">إجمالي السجلات المسجلة</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
        </button>

        {/* Card 2: Master Group CRs */}
        <button
          type="button"
          onClick={() => setFilterType(prev => prev === 'master' ? 'all' : 'master')}
          title="تصفية السجلات الرئيسية للمجموعة (Filter Master Group CRs)"
          className={`p-4 rounded-2xl text-left transition-all duration-200 cursor-pointer shadow-sm relative overflow-hidden group border ${
            filterType === 'master'
              ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-500 ring-offset-2 shadow-lg scale-[1.02]'
              : 'bg-white border-slate-200 hover:border-amber-300 hover:shadow-md'
          }`}
        >
          {filterType === 'master' && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-xs">
              <Check className="w-2.5 h-2.5" />
              <span>مُحدد</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 block mb-0.5">Master Group CRs</span>
              <div className="text-2xl font-black text-slate-900">{masterCount}</div>
              <span className="text-[10px] text-slate-500 font-semibold">السجلات الرئيسية للمجموعة</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Crown className="w-5 h-5" />
            </div>
          </div>
        </button>

        {/* Card 3: Sub-Branch CRs */}
        <button
          type="button"
          onClick={() => setFilterType(prev => prev === 'sub' ? 'all' : 'sub')}
          title="تصفية السجلات الفرعية للفروع (Filter Sub-Branch CRs)"
          className={`p-4 rounded-2xl text-left transition-all duration-200 cursor-pointer shadow-sm relative overflow-hidden group border ${
            filterType === 'sub'
              ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-500 ring-offset-2 shadow-lg scale-[1.02]'
              : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-md'
          }`}
        >
          {filterType === 'sub' && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-xs">
              <Check className="w-2.5 h-2.5" />
              <span>مُحدد</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block mb-0.5">Sub-Branch CRs</span>
              <div className="text-2xl font-black text-slate-900">{subCount}</div>
              <span className="text-[10px] text-slate-500 font-semibold">السجلات الفرعية للفروع</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Store className="w-5 h-5" />
            </div>
          </div>
        </button>

        {/* Card 4: Branch Linkage */}
        <button
          type="button"
          onClick={() => setFilterType(prev => prev === 'linked' ? 'all' : 'linked')}
          title="تصفية السجلات المرتبطة بفروع تشغيلية (Filter Linked CRs)"
          className={`p-4 rounded-2xl text-left transition-all duration-200 cursor-pointer shadow-sm relative overflow-hidden group border ${
            filterType === 'linked'
              ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-500 ring-offset-2 shadow-lg scale-[1.02]'
              : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'
          }`}
        >
          {filterType === 'linked' && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-xs">
              <Check className="w-2.5 h-2.5" />
              <span>مُحدد</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 block mb-0.5">Branch Linkage</span>
              <div className="text-2xl font-black text-slate-900">{linkagePercentage}%</div>
              <span className="text-[10px] text-slate-500 font-semibold">{linkedCount} of {totalCrs} Linked</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
        </button>

        {/* Card 5: Expiry Alerts */}
        <button
          type="button"
          onClick={() => setFilterType(prev => prev === 'alerts' ? 'all' : 'alerts')}
          title="تصفية السجلات المنتهية أو القريبة من الانتهاء (Filter Expiry Alerts)"
          className={`p-4 rounded-2xl text-left transition-all duration-200 cursor-pointer shadow-sm relative overflow-hidden group border col-span-2 md:col-span-1 ${
            filterType === 'alerts'
              ? 'bg-rose-50/90 border-rose-400 ring-2 ring-rose-500 ring-offset-2 shadow-lg scale-[1.02]'
              : 'bg-white border-slate-200 hover:border-rose-300 hover:shadow-md'
          }`}
        >
          {filterType === 'alerts' && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-xs">
              <Check className="w-2.5 h-2.5" />
              <span>مُحدد</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 block mb-0.5">Expiry Alerts</span>
              <div className="text-2xl font-black text-slate-900">{expiringSoonCount}</div>
              <span className="text-[10px] text-slate-500 font-semibold">تنتهي خلال 90 يوم أو منتهية</span>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${
              expiringSoonCount > 0 ? 'bg-rose-50 text-rose-600 animate-pulse' : 'bg-slate-100 text-slate-400'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </button>
      </div>

      {/* 2. Top Control & Action Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Left Title */}
        <div>
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand" />
            <span>Registered Commercial Registrations </span>
          </h3>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Manage legal group CRs, child branches mapping, tax ID numbers, and expiry compliance tracking.
          </p>
        </div>

        {/* Right Action Tools */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search CR name, code or branch..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand/40 focus:bg-white w-52 sm:w-64 transition-all"
            />
          </div>

          {/* Filter Toolbar Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${filterType === 'all' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('master')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${filterType === 'master' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Master
            </button>
            <button
              onClick={() => setFilterType('sub')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${filterType === 'sub' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Sub-CRs
            </button>
            <button
              onClick={() => setFilterType('linked')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${filterType === 'linked' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Linked
            </button>
            <button
              onClick={() => setFilterType(prev => prev === 'alerts' ? 'all' : 'alerts')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${filterType === 'alerts' ? 'bg-rose-50 text-rose-600 border border-rose-200 shadow-sm font-black' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Alerts ({expiringSoonCount})
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 border border-slate-200 rounded-xl p-1 bg-slate-50">
            <button
              onClick={() => setViewMode('grid')}
              title="Cards Grid View"
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-brand text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="Table Grid View"
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-brand text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Cloud Sync Button */}
          <button
            onClick={handleSyncCloud}
            disabled={isCloudLoading}
            title="Sync with Supabase Cloud Database (مزامنة السجلات)"
            className="flex items-center gap-2 px-3.5 py-2 bg-sky-50 hover:bg-sky-100/80 text-sky-700 border border-sky-200/80 text-xs font-bold rounded-xl transition-all shadow-2xs active:scale-98 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-sky-600 ${isCloudLoading ? 'animate-spin' : ''}`} />
            <span>{isCloudLoading ? 'Syncing...' : 'Sync CRs'}</span>
          </button>

          {/* Excel Export */}
          <button
            onClick={handleExportExcel}
            title="Download Excel Report (تصدير إكسيل)"
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 border border-emerald-200/80 text-xs font-bold rounded-xl transition-all shadow-2xs active:scale-98 cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Excel Export</span>
          </button>

          {/* Excel Upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload Bulk Excel/CSV (رفع جماعي)"
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 border border-indigo-200/80 text-xs font-bold rounded-xl transition-all shadow-2xs active:scale-98 cursor-pointer"
          >
            <Upload className="w-4 h-4 text-indigo-600" />
            <span>Upload Bulk</span>
          </button>

          {/* Add CR Button */}
          <button
            onClick={openAddModal}
            title="Register New Commercial Registration"
            className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-dark text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-brand/20 hover:shadow-lg hover:shadow-brand/30 active:scale-98 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register CR</span>
          </button>
        </div>
      </div>

      {/* 3. View Mode Rendering */}
      {filteredCrs.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <h4 className="text-base font-black text-slate-900">No Commercial Registrations Found</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No records matching "{searchTerm}". Click below to add a new CR or upload bulk excel records.
          </p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-brand-dark transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add First CR</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCrs.map(cr => {
            const expStatus = getExpiryStatus(cr.expiry_date);
            return (
              <div
                key={cr.id}
                className="bg-white rounded-3xl border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md transition-all duration-200 p-5 flex flex-col justify-between group relative"
              >
                <div>
                  {/* Top Row: Badges & Utilities Menu */}
                  <div className="flex items-center justify-between gap-2 mb-3.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        cr.is_master
                          ? 'bg-brand text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {cr.is_master ? <Crown className="w-3 h-3 text-amber-300" /> : <Store className="w-3 h-3 text-slate-500" />}
                        <span>{cr.is_master ? 'المقر الرئيسي (Master)' : 'سجل فرعي (Sub-CR)'}</span>
                      </span>

                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                        expStatus.tone === 'red'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : expStatus.tone === 'amber'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        <Calendar className="w-3 h-3" />
                        <span>{expStatus.label}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => openQuickExpiryModal(cr, e)}
                        title="Quick Compliance & Expiry Editor (محرر الصلاحية والامتثال السريع)"
                        className="w-7 h-7 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-xs transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0"
                      >
                        <CalendarPlus className="w-3.5 h-3.5 text-white" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyCr(cr.cr_number, cr.id)}
                        title="نسخ رقم السجل"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        {copiedCrId === cr.id ? <Check className="w-4 h-4 text-brand" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(cr)}
                        title="تعديل كامل بيانات السجل"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cr.id)}
                        title="حذف السجل"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Identity Block: Logo & Corporate Names */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 p-1 flex items-center justify-center shrink-0 shadow-2xs">
                      <img
                        src={cr.logo_url || (cr.is_master ? DEFAULT_GROUP_LOGO : DEFAULT_SUB_LOGO)}
                        alt={cr.cr_name}
                        className="w-full h-full object-contain rounded-xl"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-black text-slate-900 truncate leading-snug dir-rtl text-right" dir="rtl">
                        {cr.cr_name_ar || 'اسم السجل الرسمي بالعربية'}
                      </div>
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-tight truncate font-sans">
                        {cr.cr_name}
                      </div>
                      <div className="mt-1 flex items-center gap-2 font-mono text-[11px]">
                        <span className="text-slate-500 font-medium">CR No:</span>
                        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
                          {cr.cr_number}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Specs Box (Tax ID & NHRA License No) */}
                  {(() => {
                    const matched = INITIAL_21_CRS.find(m => m.cr_number === cr.cr_number || m.id === cr.id);
                    const licNo = cr.nhra_license_no || matched?.nhra_license_no || 'NHRA/PH/2022/1001';

                    return (
                      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-2.5 text-xs mb-4">
                        <div className="flex items-center justify-between text-slate-600 font-medium">
                          <span className="text-[11px]">الرقم الضريبي (VAT Tax ID):</span>
                          <span className="font-mono font-bold text-slate-900">{cr.tax_number || '3000987654321'}</span>
                        </div>

                        <div className="flex items-center justify-between text-slate-600 font-medium pt-2 border-t border-slate-200/80">
                          <span className="text-[11px]">ترخيص الهيئة (NHRA No):</span>
                          <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200 text-[11px]">
                            {licNo}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Expiry Dates Summary */}
                  {(() => {
                    const matched = INITIAL_21_CRS.find(m => m.cr_number === cr.cr_number || m.id === cr.id);
                    const crExpDate = cr.expiry_date || matched?.expiry_date || '2026-12-31';
                    const nhraExpDate = cr.nhra_expiry_date || matched?.nhra_expiry_date || '2027-12-31';

                    return (
                      <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                        <div className="bg-brand/5 border border-brand/15 rounded-2xl p-2.5">
                          <span className="text-[10px] font-bold text-brand block mb-1">
                            انتهاء السجل (CR Expiry):
                          </span>
                          <div className="font-mono font-black text-slate-900 text-xs truncate">
                            {crExpDate}
                          </div>
                        </div>

                        <div className="bg-slate-100/80 border border-slate-200 rounded-2xl p-2.5">
                          <span className="text-[10px] font-bold text-slate-700 block mb-1">
                            انتهاء الهيئة (NHRA Expiry):
                          </span>
                          <div className="font-mono font-black text-slate-900 text-xs truncate">
                            {nhraExpDate}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Executive Quick Renewal Action Bar (Bottom of Card) */}
                <div className="space-y-2.5 pt-3 border-t border-slate-100">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleQuickAddOneYear(e, cr)}
                      title="Renew CR Expiry by +1 Year"
                      className="w-full py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5 active:scale-98"
                    >
                      <Zap className="w-3.5 h-3.5 text-white fill-white" />
                      <span>Renew CR (+1Y)</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleQuickAddThreeYearsNhra(e, cr)}
                      title="Renew NHRA License by +3 Years"
                      className="w-full py-2 px-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-[11px] transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5 active:scale-98"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-white" />
                      <span>Renew NHRA (+3Y)</span>
                    </button>
                  </div>

                  <div className="pt-2 flex items-center justify-center text-[11px]">
                    {cr.linked_branch_name ? (
                      <span className="text-slate-700 font-bold flex items-center gap-1 truncate max-w-[220px]">
                        <Store className="w-3.5 h-3.5 text-brand shrink-0" />
                        <span className="truncate">{cr.linked_branch_name}</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => openEditModal(cr)}
                        className="text-slate-400 hover:text-brand font-bold text-[10px]"
                      >
                        + ربط بفرع
                      </button>
                    )}
                  </div>

                  {/* Reference & Last Updated Timestamp */}
                  <div className="pt-2 mt-1 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-400 font-medium truncate max-w-[130px]" title={`Ref: ${cr.cr_number}`}>
                      Ref: <span className="text-slate-600 font-bold">{cr.cr_number}</span>
                    </span>
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-md text-[10px] text-slate-600 font-medium" title="Last update timestamp">
                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="text-slate-400">Last Update:</span>
                      <span className="font-bold text-slate-800">{formatDateTime(cr.updated_at || cr.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* STRUCTURED TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">CR Legal & Official Name (اسم السجل الرسمي)</th>
                  <th className="py-3.5 px-4">CR Number (رقم السجل)</th>
                  <th className="py-3.5 px-4">Type (النوع)</th>
                  <th className="py-3.5 px-4">Linked Branch / Operational (الفرع )</th>
                  <th className="py-3.5 px-4">VAT Tax No (الرقم الضريبي)</th>
                  <th className="py-3.5 px-4">Expiry Date (تاريخ الانتهاء)</th>
                  <th className="py-3.5 px-4">NHRA License & Expiry (ترخيص وتاريخ NHRA)</th>
                  <th className="py-3.5 px-4">Ref & Last Update (آخر تحديث)</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                {filteredCrs.map(cr => {
                  const expStatus = getExpiryStatus(cr.expiry_date);
                  const matched = INITIAL_21_CRS.find(m => m.cr_number === cr.cr_number || m.id === cr.id);
                  const licNo = cr.nhra_license_no || matched?.nhra_license_no || 'NHRA/PH/2022/1001';
                  const expDate = cr.nhra_expiry_date || matched?.nhra_expiry_date || '2027-12-31';
                  return (
                    <tr key={cr.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-black text-slate-950 uppercase">{cr.cr_name}</div>
                        {cr.cr_name_ar && (
                          <div className="text-xs font-bold text-slate-700 text-right dir-rtl">{cr.cr_name_ar}</div>
                        )}
                        {cr.parent_cr_number && (
                          <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                            Parent CR: <span className="font-mono font-bold text-slate-600">{cr.parent_cr_number}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{cr.cr_number}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase ${
                          cr.is_master ? 'bg-slate-900 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {cr.is_master ? 'Main Master' : 'Sub-CR'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {cr.linked_branch_name ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand bg-brand/5 px-2.5 py-1 rounded-lg">
                            <Store className="w-3.5 h-3.5" />
                            <span>{cr.linked_branch_name}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not Linked</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{cr.tax_number || '-'}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {cr.expiry_date ? (
                            <button
                              type="button"
                              onClick={(e) => openQuickExpiryModal(cr, e)}
                              title="انقر لفتح محرر التاريخ السريع (Quick Compliance & Expiry Editor)"
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold cursor-pointer hover:opacity-85 transition-opacity ${
                                expStatus.tone === 'red'
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : expStatus.tone === 'amber'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'text-brand bg-brand/5 border border-brand/20'
                              }`}
                            >
                              <Calendar className="w-3 h-3 text-brand" />
                              <span>{cr.expiry_date}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => openQuickExpiryModal(cr, e)}
                              className="text-slate-400 hover:text-brand text-[11px] font-semibold underline cursor-pointer"
                            >
                              + تعيين تاريخ
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleQuickAddOneYear(e, cr)}
                            title="Renew CR Expiry by +1 Year"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                          >
                            <Zap className="w-2.5 h-2.5 text-white fill-white" />
                            <span>Renew CR (+1Y)</span>
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="font-mono font-bold text-slate-900 text-xs flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                            <span>{licNo}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-700 font-medium">
                            <button
                              type="button"
                              onClick={(e) => openQuickExpiryModal(cr, e)}
                              title="Edit NHRA Expiry Date manually"
                              className="hover:underline cursor-pointer bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
                            >
                              Exp: {expDate}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleQuickAddThreeYearsNhra(e, cr)}
                              title="Renew NHRA License by +3 Years"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[9px] font-mono font-black transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                            >
                              <ShieldCheck className="w-2.5 h-2.5 text-white" />
                              <span>Renew NHRA (+3Y)</span>
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-500 font-bold">Ref: {cr.cr_number}</span>
                          <span className="text-slate-700 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{formatDateTime(cr.updated_at || cr.created_at)}</span>
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => openQuickExpiryModal(cr, e)}
                            title="Quick Compliance & Expiry Editor (محرر الصلاحية السريع)"
                            className="p-1.5 rounded-lg text-brand hover:bg-brand/10 transition-colors cursor-pointer"
                          >
                            <CalendarPlus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(cr)}
                            title="Edit Full CR Details"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(cr.id)}
                            title="Delete CR"
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Quick Compliance & Expiry Editor Modal (Wide-Width max-w-3xl Layout) */}
      {quickExpiryCr && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-fadeIn overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Executive Unified Premium Modal Header */}
            <div className="p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white relative overflow-hidden shrink-0 border-b border-emerald-900/30 shadow-md">
              {/* Ambient decoration glow */}
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

              {/* Top Row: Title & Close Button */}
              <div className="flex items-center justify-between relative z-10 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-md shadow-emerald-950/50 shrink-0">
                    <ShieldCheck className="w-5.5 h-5.5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black tracking-tight text-white">
                        Quick Compliance &amp; Expiry Editor
                      </h3>
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Executive Suite
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium mt-0.5">
                      
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickExpiryCr(null)}
                  className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Integrated CR Hero Info Card */}
              <div className="relative z-10 bg-white/10 border border-white/15 backdrop-blur-md rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-inner">
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-14 h-14 rounded-2xl bg-white border-2 border-white/20 p-1.5 flex items-center justify-center shrink-0 shadow-lg ring-2 ring-emerald-500/20">
                    <img
                      src={quickExpiryCr.logo_url || (quickExpiryCr.is_master ? DEFAULT_GROUP_LOGO : DEFAULT_SUB_LOGO)}
                      alt={quickExpiryCr.cr_name}
                      className="w-full h-full object-contain rounded-xl"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="font-black text-sm text-white truncate uppercase tracking-tight">
                      {quickExpiryCr.cr_name}
                    </div>
                    {quickExpiryCr.cr_name_ar && (
                      <div className="text-xs font-bold text-emerald-300 truncate dir-rtl text-right">
                        {quickExpiryCr.cr_name_ar}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                      <span className="bg-white/10 text-slate-200 border border-white/15 px-2.5 py-0.5 rounded-lg font-mono font-bold">
                        CR: <strong className="text-white">{quickExpiryCr.cr_number}</strong>
                      </span>
                      {quickExpiryCr.linked_branch_name && (
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg font-bold flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="truncate max-w-[200px]">{quickExpiryCr.linked_branch_name}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 shadow-md ${
                  quickExpiryCr.is_master 
                    ? 'bg-amber-400 text-slate-950 font-extrabold border border-amber-300' 
                    : 'bg-emerald-500 text-slate-950 font-extrabold border border-emerald-400'
                }`}>
                  {quickExpiryCr.is_master ? 'Master CR' : 'Sub-CR'}
                </span>
              </div>
            </div>

            {/* Form Body - Wide 2 Columns Grid */}
            <form onSubmit={handleSaveQuickExpiry} className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* LEFT COLUMN: CR Expiry Date & 1-Year Shortcut */}
                <div className="space-y-4">
                  <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-emerald-600" />
                        <span>تاريخ انتهاء السجل (CR Expiry Date):</span>
                      </label>
                      {(() => {
                        const st = getExpiryStatus(quickExpiryDate);
                        return (
                          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black ${
                            st.tone === 'red'
                              ? 'bg-red-50 text-red-600 border border-red-200'
                              : st.tone === 'amber'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {st.label}
                          </span>
                        );
                      })()}
                    </div>

                    <input
                      type="date"
                      required
                      value={quickExpiryDate}
                      onChange={e => setQuickExpiryDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/10 transition-all cursor-pointer shadow-2xs"
                    />

                    {/* Quick 1-Year Renewal Preset Card */}
                    <div className="space-y-2.5 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                          <span>التجديد السريع للسجل (CR Renewal):</span>
                        </span>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/60 px-2 py-0.5 rounded-md">
                          +1 سنة تجديد
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => applyExpiryPreset(0, 1, false)}
                          className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5 active:scale-98"
                        >
                          <Zap className="w-3.5 h-3.5 text-white fill-white" />
                          <span>Renew CR (+1Y)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => applyExpiryPreset(0, 1, true)}
                          title="Set expiry date to 1 year from today"
                          className="py-2.5 px-3 rounded-xl bg-white hover:bg-emerald-50 text-slate-800 text-xs font-bold border border-slate-300 transition-all cursor-pointer shadow-2xs flex items-center justify-center"
                        >
                          From Today +1Y
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* VAT Tax Registration No */}
                  <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-2">
                    <label className="text-xs font-black text-slate-800 block">
                      الرقم الضريبي (VAT Tax Registration No):
                    </label>
                    <input
                      type="text"
                      value={quickTaxNumber}
                      onChange={e => setQuickTaxNumber(e.target.value)}
                      placeholder="3000987654321"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-mono font-bold text-slate-900 outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/10 transition-all"
                    />
                  </div>
                </div>

                {/* RIGHT COLUMN: NHRA Health License & +3 Years Shortcut */}
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50/90 border border-slate-200/90 rounded-2xl space-y-3.5 h-full flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200/80">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-700" />
                          <span>ترخيص الهيئة الوطنية (NHRA Health License):</span>
                        </span>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                          NHRA Bahrain
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            NHRA No (رقم ترخيص NHRA):
                          </label>
                          <input
                            type="text"
                            value={quickNhraLicenseNo}
                            onChange={e => setQuickNhraLicenseNo(e.target.value)}
                            placeholder="e.g. NHRA/PH/2022/1024"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono font-bold text-slate-900 outline-none focus:border-emerald-600 transition-all shadow-2xs"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            NHRA Expiry Date (تاريخ انتهاء ترخيص NHRA):
                          </label>
                          <input
                            type="date"
                            value={quickNhraExpiryDate}
                            onChange={e => setQuickNhraExpiryDate(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600 transition-all cursor-pointer shadow-2xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* NHRA Quick Renewal Shortcuts (+3 Years) */}
                    <div className="pt-3 border-t border-slate-200/80 space-y-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                          <span>تجديد ترخيص NHRA السريع:</span>
                        </span>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                          +3 سنوات تجديد
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => applyNhraExpiryPreset(3, false)}
                          className="py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5 active:scale-98"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-white" />
                          <span>Renew NHRA (+3Y)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => applyNhraExpiryPreset(3, true)}
                          title="Set expiry date to 3 years from today"
                          className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold border border-slate-300 transition-all cursor-pointer shadow-2xs flex items-center justify-center"
                        >
                          From Today +3Y
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 flex items-center justify-between border-t border-slate-200/80 shrink-0">
                <span className="text-[11px] text-slate-500 font-medium hidden sm:inline-block">
                  يتم تطبيق جميع التعديلات فوراً وتوثيقها ببيانات الامتثال الرسمية.
                </span>
                <div className="flex items-center gap-2.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => setQuickExpiryCr(null)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-all cursor-pointer"
                  >
                    إلغاء (Cancel)
                  </button>
                  <button
                    type="submit"
                    disabled={quickRenewalLoading}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 flex items-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    {quickRenewalLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>جاري الحفظ...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>حفظ التجديد والامتثال</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Enhanced Add / Edit Modal Window (Wide-Width max-w-5xl Layout) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center text-white shadow-md">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">
                    {editingCr ? 'تعديل السجل التجاري والاسم الرسمي للترويسة' : 'إضافة وتوثيق سجل تجاري جديد'}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    تعديل الاسم الرسمي بالعربية والإنجليزية ليظهر فوراً في ترويسة الخطابات ومستندات Word
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Hidden File Inputs for Logo, Signature, and Seal Stamp */}
              <input
                type="file"
                ref={logoInputRef}
                onChange={handleLogoUpload}
                accept="image/*"
                className="hidden"
              />
              <input
                type="file"
                ref={signatureInputRef}
                onChange={handleSignatureUpload}
                accept="image/*"
                className="hidden"
              />
              <input
                type="file"
                ref={stampInputRef}
                onChange={handleStampUpload}
                accept="image/*"
                className="hidden"
              />

              {/* Wide 2-Column Grid Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Column 1: Legal Details & Branch Mapping (5 Cols) */}
                <div className="lg:col-span-5 space-y-5">
                  {/* Section 1: Basic Legal Information */}
                  <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block border-b pb-1">
                      1. Official Legal Name for Header (الاسم الرسمي للترويسة)
                    </span>

                    <div className="p-2.5 bg-blue-50/90 border border-blue-200 rounded-xl text-[11px] text-blue-900 leading-relaxed font-medium">
                      💡 <strong>الاسم الرسمي للترويسة:</strong> اكتب هنا الاسم التجاري المعتمد الذي ترغب بظهوره في ترويسة الخطابات الرسمية ومستندات Word (بالعربية والإنجليزية)، مع ربطه بالفرع (الاسم الحركي) بالأسفل.
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Commercial Registration Name - English (الاسم الرسمي بالإنجليزية للترويسة) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={crName}
                        onChange={e => {
                          const val = e.target.value;
                          setCrName(val);
                          if (!editingCr || stampUrl.includes('data:image/svg+xml')) {
                            setStampUrl(generateCrStampSvg(crNameAr, val, crNumber));
                          }
                        }}
                        placeholder="e.g. SANAD 2 PHARMACY WLL"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand transition-all uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Commercial Registration Name - Arabic (الاسم الرسمي بالعربية للترويسة) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={crNameAr}
                        onChange={e => {
                          const val = e.target.value;
                          setCrNameAr(val);
                          if (!editingCr || stampUrl.includes('data:image/svg+xml')) {
                            setStampUrl(generateCrStampSvg(val, crName, crNumber));
                          }
                        }}
                        placeholder="مثال: شركة صيدلية سند 2 ذ.م.م"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand transition-all text-right font-sans"
                        dir="rtl"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        CR Number (رقم السجل التجاري) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={crNumber}
                        onChange={e => {
                          const val = e.target.value;
                          setCrNumber(val);
                          if (!editingCr || stampUrl.includes('data:image/svg+xml')) {
                            setStampUrl(generateCrStampSvg(crNameAr, crName, val));
                          }
                        }}
                        placeholder="145842- 04"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-brand transition-all"
                      />
                    </div>
                  </div>

                  {/* Section 2: Hierarchy & Branch Linkage */}
                  <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block border-b pb-1">
                      2. Entity Type & Branch Linkage (الربط بالفرع والاسم الحركي)
                    </span>

                    <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                      <input
                        type="checkbox"
                        id="isMasterModal"
                        checked={isMaster}
                        onChange={e => setIsMaster(e.target.checked)}
                        className="w-4 h-4 accent-brand rounded cursor-pointer"
                      />
                      <label htmlFor="isMasterModal" className="text-xs font-bold text-slate-800 cursor-pointer">
                        Is Main Corporate Group CR (سجل رئيسي للمجموعة)
                      </label>
                    </div>

                    {!isMaster && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Parent Main CR Number (السجل الرئيسي التابع له)
                        </label>
                        <input
                          type="text"
                          value={parentCrNumber}
                          onChange={e => setParentCrNumber(e.target.value)}
                          placeholder="100234-1"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-brand transition-all"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Link to Pharmacy Branch / Operational Name 
                      </label>
                      <select
                        value={linkedBranchId}
                        onChange={e => setLinkedBranchId(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand transition-all"
                      >
                        <option value="">-- Select Branch (Corporate HQs or Branch) --</option>
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.code})
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-500 mt-1">
                        هذا الاسم الحركي والتشغيلي للفرع داخل النظام لربط الموظفين والعمليات بالسجل القانوني.
                      </p>
                    </div>
                  </div>

                  {/* Section 3: Legal & NHRA Health Compliance */}
                  <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block border-b pb-1">
                      3. Expiry &amp; NHRA Health Compliance (تاريخ الانتهاء وتراخيص NHRA)
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          VAT Tax Registration No (الرقم الضريبي)
                        </label>
                        <input
                          type="text"
                          value={taxNumber}
                          onChange={e => setTaxNumber(e.target.value)}
                          placeholder="3000987654321"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-brand transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          CR Expiry Date (تاريخ انتهاء السجل التجاري)
                        </label>
                        <input
                          type="date"
                          value={expiryDate || '2026-12-31'}
                          onChange={e => setExpiryDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                      <div>
                        <label className="text-xs font-bold text-purple-900 mb-1 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                          <span>NHRA No: (رقم ترخيص الهيئة الوطنية)</span>
                        </label>
                        <input
                          type="text"
                          value={nhraLicenseNo}
                          onChange={e => setNhraLicenseNo(e.target.value)}
                          placeholder="e.g. NHRA/PH/2022/1024"
                          className="w-full px-3.5 py-2.5 bg-white border border-purple-200 rounded-xl text-xs font-mono font-bold text-purple-950 outline-none focus:border-purple-500 transition-all"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-purple-900 mb-1 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-purple-600" />
                          <span>NHRA Expiry Date: (تاريخ انتهاء ترخيص NHRA)</span>
                        </label>
                        <input
                          type="date"
                          value={nhraExpiryDate || '2027-12-31'}
                          onChange={e => setNhraExpiryDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-purple-200 rounded-xl text-xs font-bold text-purple-950 outline-none focus:border-purple-500 transition-all cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 2: Brand Identity, Logo, Signature & Stamp (7 Cols) */}
                <div className="lg:col-span-7 space-y-5">
                  <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block border-b pb-1">
                      4. CR Brand Identity, Signature & Stamp for HR Letters (الهوية والتوقيع والختم الرسمي)
                    </span>

                    {/* CR Logo Upload */}
                    <div className="space-y-2 bg-white p-3.5 border border-slate-200 rounded-xl">
                      <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-brand" />
                        <span>1️⃣ CR Logo (شعار السجل في هيدر الخطاب):</span>
                      </label>

                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="w-16 h-16 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center p-1 relative overflow-hidden shrink-0">
                          {logoUrl ? (
                            <img src={logoUrl} alt="CR Logo" className="w-full h-full object-contain" />
                          ) : (
                            <Building2 className="w-8 h-8 text-slate-300" />
                          )}
                        </div>

                        <div className="space-y-2 flex-1 w-full">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => logoInputRef.current?.click()}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-brand text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Upload Logo Image</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setLogoUrl(DEFAULT_GROUP_LOGO)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                            >
                              Pharmacy Logo (/logo.jpg)
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-500">Supported formats: PNG, JPG, SVG.</p>
                        </div>
                      </div>
                    </div>

                    {/* Official Signature & Official Seal Stamp Side-By-Side */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Official Signature */}
                      <div className="space-y-2 bg-white p-3.5 border border-slate-200 rounded-xl">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-brand" />
                          <span>2️⃣ CEO Signature - Dr. Fathy Saad Amin (التوقيع):</span>
                        </label>

                        <div className="h-24 bg-slate-50 border border-slate-200 rounded-xl p-1.5 flex items-center justify-center overflow-hidden">
                          <img
                            src={signatureUrl || DEFAULT_SIGNATURE}
                            alt="Signature Preview"
                            className="max-h-full object-contain"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => signatureInputRef.current?.click()}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-brand text-white text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Upload className="w-3 h-3" />
                            <span>Upload Signature</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSignatureUrl(DEFAULT_SIGNATURE)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                          >
                            Default HD
                          </button>
                        </div>
                      </div>

                      {/* Official Corporate Stamp */}
                      <div className="space-y-2 bg-white p-3.5 border border-slate-200 rounded-xl">
                        <label className="text-xs font-bold text-slate-900 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-700" />
                            <span>3️⃣ Official CR Seal Stamp (الختم الرسمي):</span>
                          </span>
                          <span className="text-[9px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-mono font-bold">Auto Stamp</span>
                        </label>

                        <div className="h-24 bg-white border border-slate-200 rounded-xl p-1.5 flex items-center justify-center overflow-hidden shadow-2xs">
                          <img
                            src={stampUrl || generateCrStampSvg(crNameAr, crName, crNumber)}
                            alt="Stamp Preview"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setStampUrl(generateCrStampSvg(crNameAr, crName, crNumber))}
                            className="px-2.5 py-1 bg-indigo-700 hover:bg-indigo-800 text-white text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                          >
                            <span>Regenerate Stamp</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => stampInputRef.current?.click()}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-brand text-white text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Upload className="w-3 h-3" />
                            <span>Upload File</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Live HR Header & Footer Signature Preview Box */}
                    <div className="p-4 bg-white border border-slate-300 rounded-xl space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">
                          Live HR Official Letter Document Identity &amp; Seals Preview (معاينة الترويسة والختم والتوقيع):
                        </span>
                        <button
                          type="button"
                          onClick={handleDownloadPdf}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-brand text-white text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Printer className="w-3.5 h-3.5 text-amber-400" />
                          <span>Download A4 PDF Preview</span>
                        </button>
                      </div>
                      
                      {/* Header preview */}
                      <div className="flex items-center gap-4 border-b-2 border-slate-900 pb-3">
                        <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-xl p-1 shrink-0 flex items-center justify-center">
                          <img
                            src={logoUrl || DEFAULT_GROUP_LOGO}
                            alt="CR Logo"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="space-y-0.5 flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                            <h2 className="text-sm font-black text-slate-950 uppercase tracking-tight">
                              {crName || 'TABARAK PHARMACY GROUP WLL'}
                            </h2>
                            {crNameAr && (
                              <p className="text-xs font-bold text-slate-800 text-right dir-rtl">
                                {crNameAr}
                              </p>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-600 space-y-0.5 pt-0.5">
                            <p>CR NO: <span className="text-brand font-bold">{crNumber || '100234-1'}</span> &bull; Contact No: <span className="font-bold text-slate-900">+973 33866650</span></p>
                            <p>Email Address: <span className="font-bold text-slate-900">tabarakph.info@gmail.com</span> &bull; Kingdom of Bahrain</p>
                          </div>
                        </div>
                      </div>

                      {/* Signature & Stamp Bottom Row Preview */}
                      <div className="flex items-end justify-between pt-2">
                        <div className="text-center space-y-0.5">
                          <div className="h-12 w-32 mx-auto flex items-center justify-center">
                            <img src={signatureUrl || DEFAULT_SIGNATURE} alt="Signature" className="max-h-full object-contain mix-blend-multiply contrast-125" />
                          </div>
                          <p className="text-[10px] font-black text-slate-950">Dr. Fathy Saad Amin</p>
                          <p className="text-[9px] font-bold text-brand uppercase">المدير التنفيذي</p>
                        </div>

                        <div className="w-36 border border-slate-300 rounded-xl p-1.5 bg-slate-50 flex flex-col items-center justify-center text-center space-y-1">
                          <span className="text-[8px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-0.5 w-full text-center">Company's Seal</span>
                          <div className="w-32 h-14 flex items-center justify-center p-0.5">
                            <img src={stampUrl || generateCrStampSvg(crNameAr, crName, crNumber)} alt="Official Corporate Seal" className="max-w-full max-h-full object-contain" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Control Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-brand text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-brand-dark transition-all shadow-md shadow-brand/20 cursor-pointer"
                >
                  {editingCr ? 'Save Changes' : 'Create Registered CR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
