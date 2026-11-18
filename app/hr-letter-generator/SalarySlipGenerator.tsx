import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarPlus, Download, RotateCcw, User } from 'lucide-react';
import type { Employee } from '../../services/workforceService';
import type { RegisteredCr } from '../lib/crEntities';

type SalaryLine = { key: string; labelEn: string; labelAr: string; amount: number };

interface SalarySlipGeneratorProps {
  employee: Employee;
  employees: Employee[];
  cr: RegisteredCr;
  language: 'ar' | 'en';
  gender: 'male' | 'female';
  signatoryName: string;
  signatoryRole: string;
  onBack: () => void;
  onSelectEmployee: (employee: Employee) => void;
  onLanguageChange: (language: 'ar' | 'en') => void;
  onGenderChange: (gender: 'male' | 'female') => void;
}

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const makeSalaryLines = (employee: Employee, kind: 'earning' | 'deduction'): SalaryLine[] => {
  const matrix = employee.salary_matrix || {};
  if (kind === 'earning') {
    return [
      { key: 'basic', labelEn: 'Basic Salary', labelAr: 'الراتب الأساسي', amount: Number(matrix.basicSalary || 0) },
      { key: 'housing', labelEn: 'Housing Allowance', labelAr: 'بدل السكن', amount: Number(matrix.housing || 0) },
      { key: 'transportation', labelEn: 'Transportation Allowance', labelAr: 'بدل المواصلات', amount: Number(matrix.transportation || 0) },
      { key: 'responsibility', labelEn: 'Job Responsibility Bonus', labelAr: 'بدل المسؤولية الوظيفية', amount: Number(matrix.jobResponsibilityBonus || 0) },
      { key: 'long-shift', labelEn: 'Long Shift Incentive', labelAr: 'حافز الوردية الطويلة', amount: Number(matrix.longShiftIncentive || 0) }
    ];
  }
  return [
    { key: 'gosi', labelEn: 'GOSI / SIO', labelAr: 'التأمينات الاجتماعية', amount: Number(matrix.gosi1Pct || 0) },
    { key: 'ewa', labelEn: 'EWA Fees', labelAr: 'رسوم الكهرباء والماء', amount: Number(matrix.ewaFees || 0) },
    { key: 'other', labelEn: 'Other Deductions', labelAr: 'استقطاعات أخرى', amount: Number(matrix.othersDeduction || 0) },
    { key: 'loan', labelEn: 'Loan Deduction', labelAr: 'خصم القرض', amount: Number(matrix.payrollDedLoan || 0) }
  ];
};

const money = (amount: number) => `BHD ${Number(amount || 0).toFixed(3)}`;
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));

const monthLabel = (value: string, language: 'ar' | 'en') => {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-BH' : 'en-BH', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)));
};

export const SalarySlipGenerator: React.FC<SalarySlipGeneratorProps> = ({
  employee,
  employees,
  cr,
  language,
  gender,
  signatoryName,
  signatoryRole,
  onBack,
  onSelectEmployee,
  onLanguageChange,
  onGenderChange
}) => {
  const isAr = language === 'ar';
  const createdDateLabel = new Intl.DateTimeFormat(isAr ? 'ar-BH' : 'en-BH', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Bahrain'
  }).format(new Date());
  const [months, setMonths] = useState<string[]>([currentMonth()]);
  const [earnings, setEarnings] = useState<SalaryLine[]>(() => makeSalaryLines(employee, 'earning'));
  const [deductions, setDeductions] = useState<SalaryLine[]>(() => makeSalaryLines(employee, 'deduction'));
  const [printError, setPrintError] = useState<string | null>(null);

  useEffect(() => {
    setEarnings(makeSalaryLines(employee, 'earning'));
    setDeductions(makeSalaryLines(employee, 'deduction'));
  }, [employee.id]);

  const sortedMonths = useMemo(() => [...new Set(months.filter(value => /^\d{4}-\d{2}$/.test(value)))].sort(), [months]);
  const totalEarnings = useMemo(() => earnings.reduce((sum, line) => sum + (Number(line.amount) || 0), 0), [earnings]);
  const totalDeductions = useMemo(() => deductions.reduce((sum, line) => sum + (Number(line.amount) || 0), 0), [deductions]);
  const netSalary = totalEarnings - totalDeductions;
  const designation = employee.category || (isAr ? 'موظف' : 'Employee');

  const resetAmounts = () => {
    setEarnings(makeSalaryLines(employee, 'earning'));
    setDeductions(makeSalaryLines(employee, 'deduction'));
  };

  const handlePrintPdf = () => {
    if (!sortedMonths.length) {
      setPrintError(isAr ? 'اختر شهرًا واحدًا على الأقل.' : 'Select at least one month.');
      return;
    }
    setPrintError(null);

    const earningRows = earnings.map(line => `<div class="row"><span>${escapeHtml(isAr ? line.labelAr : line.labelEn)}</span><strong>${escapeHtml(money(Number(line.amount) || 0))}</strong></div>`).join('');
    const deductionRows = deductions.map(line => `<div class="row"><span>${escapeHtml(isAr ? line.labelAr : line.labelEn)}</span><strong class="deduction">− ${escapeHtml(money(Number(line.amount) || 0))}</strong></div>`).join('');
    const pages = sortedMonths.map(month => {
      const title = `Salary Slip ${monthLabel(month, language)}`;
      const confirmation = isAr
        ? (gender === 'female'
          ? `تؤكد هذه القسيمة تفاصيل راتب الموظفة ${employee.full_name} عن شهر ${monthLabel(month, 'ar')}.`
          : `تؤكد هذه القسيمة تفاصيل راتب الموظف ${employee.full_name} عن شهر ${monthLabel(month, 'ar')}.`)
        : `This slip records ${gender === 'female' ? 'her' : 'his'} salary details for ${monthLabel(month, 'en')}.`;

      return `<article class="page" dir="${isAr ? 'rtl' : 'ltr'}">
        <header class="company-header">
          <img class="logo" src="${escapeHtml(cr.logo_url || '')}" alt="">
          <div class="company-copy">
            <div class="company-en">${escapeHtml(cr.cr_name || 'Tabarak Pharmacy CO W.L.L')}</div>
            <div class="company-ar">${escapeHtml(cr.cr_name_ar || 'شركة صيدلية تبارك ذ.م.م')}</div>
            <div class="company-meta">CR NO: ${escapeHtml(cr.cr_number || '')} &nbsp; · &nbsp; ${escapeHtml(cr.phone || '')}</div>
            <div class="company-meta">${escapeHtml(cr.email || '')} &nbsp; · &nbsp; ${isAr ? 'مملكة البحرين' : 'Kingdom of Bahrain'}</div>
          </div>
        </header>
        <div class="period-row"><div class="period-field"><small>${isAr ? 'الفترة' : 'PAY PERIOD'}</small><strong>${escapeHtml(monthLabel(month, language))}</strong></div><div class="period-field issued-date"><small>${isAr ? 'تاريخ إنشاء المستند' : 'DOCUMENT DATE'}</small><strong>${escapeHtml(createdDateLabel)}</strong></div></div>
        <h1>${escapeHtml(title)}</h1>
        <p class="confirmation">${escapeHtml(confirmation)}</p>
        <section class="employee-grid">
          <div><small>${isAr ? 'اسم الموظف' : 'EMPLOYEE NAME'}</small><strong>${escapeHtml(employee.full_name)}</strong></div>
          <div><small>${isAr ? 'الرقم الوظيفي' : 'EMPLOYEE CODE'}</small><strong>${escapeHtml(employee.code || '—')}</strong></div>
          <div><small>${isAr ? 'المسمى الوظيفي' : 'DESIGNATION'}</small><strong>${escapeHtml(designation)}</strong></div>
          <div><small>${isAr ? 'الرقم الشخصي' : 'CPR / ID'}</small><strong>${escapeHtml(employee.cpr_number || employee.salary_matrix?.expatCpr || '—')}</strong></div>
        </section>
        <section class="amount-columns">
          <div class="amount-card"><h2>${isAr ? 'الاستحقاقات' : 'EARNINGS'}</h2>${earningRows}<div class="total-row"><span>${isAr ? 'إجمالي الاستحقاقات' : 'Total Earnings'}</span><strong>${escapeHtml(money(totalEarnings))}</strong></div></div>
          <div class="amount-card"><h2>${isAr ? 'الاستقطاعات' : 'DEDUCTIONS'}</h2>${deductionRows}<div class="total-row deduction-total"><span>${isAr ? 'إجمالي الاستقطاعات' : 'Total Deductions'}</span><strong>− ${escapeHtml(money(totalDeductions))}</strong></div></div>
        </section>
        <section class="net-row"><span>${isAr ? 'صافي الراتب' : 'NET SALARY'}</span><strong>${escapeHtml(money(netSalary))}</strong></section>
        ${employee.salary_matrix?.iban ? `<p class="iban"><strong>${isAr ? 'الآيبان:' : 'IBAN:'}</strong> ${escapeHtml(employee.salary_matrix.iban)}</p>` : ''}
        <footer class="footer">
          <div class="signatory"><img src="${escapeHtml(cr.signature_url || '')}" alt=""><strong>${escapeHtml(signatoryName)}</strong><span>${escapeHtml(signatoryRole)}</span></div>
          <div class="stamp"><small>${isAr ? 'ختم المنشأة الرسمي' : "COMPANY'S SEAL"}</small><div class="stamp-image-wrap"><img src="${escapeHtml(cr.stamp_url || '')}" alt=""></div></div>
        </footer>
      </article>`;
    }).join('');

    const fileStart = sortedMonths[0];
    const fileEnd = sortedMonths[sortedMonths.length - 1];
    const fileName = `Salary_Slip_${employee.full_name.replace(/[^a-zA-Z0-9]+/g, '_')}_${fileStart}${fileStart === fileEnd ? '' : `_to_${fileEnd}`}`;
    const printWindow = window.open('', '_blank', 'width=950,height=1100');
    if (!printWindow) {
      setPrintError(isAr ? 'اسمح بفتح النافذة المنبثقة لطباعة PDF.' : 'Allow pop-ups to print the PDF.');
      return;
    }
    printWindow.document.write(`<!doctype html><html lang="${language}" dir="${isAr ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${escapeHtml(fileName)}</title><style>
      @page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;color:#111;background:#fff;font-family:Arial,'Noto Sans Arabic',sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{width:210mm;height:297mm;padding:15mm 16mm 13mm;overflow:hidden;display:flex;flex-direction:column;page-break-after:always;break-after:page;position:relative}.page:last-child{page-break-after:auto;break-after:auto}.company-header{display:flex;align-items:center;gap:10px;border-bottom:1px solid #333;padding-bottom:8px}.logo{width:24mm;height:18mm;object-fit:contain}.company-copy{flex:1}.company-en{font-weight:700;font-size:14px}.company-ar{font-size:13px;font-weight:700;margin-top:3px}.company-meta{font-family:Arial,sans-serif;font-size:8px;color:#555;margin-top:3px}.period-row{display:flex;justify-content:space-between;align-items:center;margin-top:9mm;padding:7px 0;border-bottom:1px solid #bbb;font-size:10px;font-weight:700}.period-row strong{font-size:11px;color:#111}.page h1{text-align:center;margin:7mm 0 2mm;font-size:17px;font-weight:700;color:#111}.confirmation{text-align:center;color:#333;font-size:10px;line-height:1.5;margin:0 0 6mm}.employee-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #999;border-radius:0;overflow:hidden;margin-bottom:7mm}.employee-grid>div{padding:8px 10px;border-bottom:1px solid #ddd}.employee-grid>div:nth-child(odd){border-inline-end:1px solid #ddd}.employee-grid>div:nth-last-child(-n+2){border-bottom:0}.employee-grid small{display:block;font-size:8px;color:#555;font-weight:600;margin-bottom:3px}.employee-grid strong{font-size:10px}.amount-columns{display:grid;grid-template-columns:1fr 1fr;gap:10px}.amount-card{border:1px solid #999;border-radius:0;padding:10px}.amount-card h2{font-size:10px;font-weight:700;margin:0 0 6px;padding-bottom:5px;border-bottom:1px solid #555}.row,.total-row{display:flex;justify-content:space-between;gap:6px;align-items:center;padding:6px 0;border-bottom:1px solid #e3e3e3;font-size:9px}.row strong,.total-row strong{white-space:nowrap;font-size:9px}.deduction{color:#111}.total-row{font-weight:700;border-bottom:0;border-top:1px solid #777;margin-top:4px;padding-top:8px}.deduction-total{color:#111}.net-row{display:flex;justify-content:space-between;align-items:center;margin-top:7mm;padding:10px 12px;background:#fff;color:#111;border:1px solid #555;border-radius:0}.net-row span{font-size:10px;font-weight:700}.net-row strong{font-size:15px}.iban{font-size:9px;color:#333;margin-top:5mm}.footer{margin-top:auto;padding-top:6mm;padding-bottom:6mm;border-top:1px solid #999;display:flex;justify-content:space-between;align-items:flex-end;break-inside:avoid;page-break-inside:avoid;min-height:40mm}.signatory,.stamp{display:flex;flex-direction:column;align-items:center;text-align:center;font-size:9px}.signatory{width:45%}.signatory img{max-width:50mm;height:16mm;object-fit:contain;margin-bottom:2mm}.signatory strong{font-size:10px}.signatory span{color:#333;margin-top:2px}.stamp{width:58mm;border:1.5px solid #94a3b8;border-radius:10px;padding:10px;background:#f8fafc}.stamp small{font-size:8px;font-weight:700;color:#475569;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:8px;display:block;letter-spacing:.4px}.stamp-image-wrap{height:90px;width:100%;display:flex;align-items:center;justify-content:center}.stamp img{max-height:90px;width:100%;object-fit:contain;display:block;margin:0 auto} @media print{.page{margin:0;box-shadow:none}}
      </style><style>.page{padding-bottom:0}.footer{padding-bottom:0;margin-bottom:15mm}.period-field{display:flex;flex-direction:column;gap:3px}.period-field small{font-size:8px;font-weight:600;color:#555}</style></head><body>${pages}<script>window.onload=function(){setTimeout(function(){window.print()},600)};</script></body></html>`);
    printWindow.document.close();
  };

  const updateLine = (setter: React.Dispatch<React.SetStateAction<SalaryLine[]>>, key: string, amount: number) => {
    setter(lines => lines.map(line => line.key === key ? { ...line, amount } : line));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onBack} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label={isAr ? 'عودة' : 'Back'}><ArrowLeft className="h-4 w-4" /></button>
            <div><h1 className="font-black text-slate-900">Salary Slip</h1><p className="text-xs text-slate-500">Official HR Letter &amp; Corporate Identity Generator</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onLanguageChange('en')} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${!isAr ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>English</button>
            <button type="button" onClick={() => onLanguageChange('ar')} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${isAr ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>عربي</button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-5 p-4 lg:grid-cols-[380px_minmax(0,1fr)] lg:p-6">
        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-black">{isAr ? 'الموظف والصيغة' : 'Employee & wording'}</h2>
            <label className="mb-1 block text-xs font-bold text-slate-600">{isAr ? 'الموظف' : 'Employee'}</label>
            <select value={employee.id} onChange={event => { const next = employees.find(item => item.id === event.target.value); if (next) onSelectEmployee(next); }} className="mb-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold">
              {employees.map(item => <option key={item.id} value={item.id}>{item.full_name} · {item.code}</option>)}
            </select>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600"><User className="h-4 w-4" />{isAr ? 'الصيغة' : 'Wording'}</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(['male', 'female'] as const).map(value => <button key={value} type="button" onClick={() => onGenderChange(value)} className={`rounded-lg border px-3 py-2 text-xs font-bold ${gender === value ? 'border-brand bg-brand/5 text-brand' : 'border-slate-200 text-slate-600'}`}>{value === 'male' ? (isAr ? 'مذكر' : 'Male') : (isAr ? 'مؤنث' : 'Female')}</button>)}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black">{isAr ? 'الشهور' : 'Selected months'}</h2><button type="button" onClick={() => setMonths(values => [...values, ''])} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700"><CalendarPlus className="h-3.5 w-3.5" />{isAr ? 'إضافة شهر' : 'Add month'}</button></div>
            <div className="space-y-2">{months.map((month, index) => <div key={index} className="flex items-center gap-2"><input aria-label={isAr ? `الشهر ${index + 1}` : `Month ${index + 1}`} type="month" value={month} onChange={event => setMonths(values => values.map((value, row) => row === index ? event.target.value : value))} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />{months.length > 1 && <button type="button" onClick={() => setMonths(values => values.filter((_, row) => row !== index))} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={isAr ? 'حذف الشهر' : 'Remove month'}>×</button>}</div>)}</div>
            <p className="mt-2 text-[11px] text-slate-500">{isAr ? 'كل شهر مختار سيظهر في صفحة مستقلة داخل ملف PDF واحد.' : 'Each selected month becomes one page in a single PDF.'}</p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black">{isAr ? 'الاستحقاقات' : 'Earnings'} · BHD</h2><button type="button" onClick={resetAmounts} className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-brand"><RotateCcw className="h-3 w-3" />{isAr ? 'إعادة من الملف' : 'Reset from profile'}</button></div>
            <div className="space-y-2">{earnings.map(line => <label key={line.key} className="grid grid-cols-[1fr_112px] items-center gap-2 text-xs font-semibold text-slate-600"><span>{isAr ? line.labelAr : line.labelEn}</span><input type="number" min="0" step="0.001" value={line.amount} onChange={event => updateLine(setEarnings, line.key, Number(event.target.value))} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-right font-mono text-slate-900" /></label>)}</div>
            <div className="mt-4 mb-3 border-t border-slate-100 pt-3 text-sm font-black">{isAr ? 'الاستقطاعات' : 'Deductions'} · BHD</div>
            <div className="space-y-2">{deductions.map(line => <label key={line.key} className="grid grid-cols-[1fr_112px] items-center gap-2 text-xs font-semibold text-slate-600"><span>{isAr ? line.labelAr : line.labelEn}</span><input type="number" min="0" step="0.001" value={line.amount} onChange={event => updateLine(setDeductions, line.key, Number(event.target.value))} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-right font-mono text-slate-900" /></label>)}</div>
          </section>

          <button type="button" onClick={handlePrintPdf} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-800"><Download className="h-4 w-4" />{isAr ? 'طباعة / حفظ PDF موحد' : 'Print / Save Combined PDF'}</button>
          {printError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{printError}</p>}
        </aside>

        <section className="space-y-5 overflow-x-auto rounded-2xl bg-slate-200/70 p-4">
          {sortedMonths.map(month => <article key={month} className="mx-auto flex min-h-[1120px] w-[794px] max-w-full flex-col border border-slate-300 bg-white px-12 pb-0 pt-12" dir={isAr ? 'rtl' : 'ltr'}>
            <header className="flex items-center gap-4 border-b border-slate-700 pb-4">
              <img src={cr.logo_url} alt="" className="h-16 w-24 object-contain" />
              <div className="min-w-0 flex-1"><h2 className="text-base font-black uppercase">{cr.cr_name}</h2><p className="mt-1 text-sm font-bold">{cr.cr_name_ar}</p><p className="mt-1 text-[10px] text-slate-500">CR NO: {cr.cr_number} · {cr.phone} · {cr.email}</p></div>
            </header>
            <div className="mt-8 flex items-center justify-between border-b border-slate-300 py-2 text-xs font-bold"><div><small className="block text-[9px] font-semibold text-slate-500">{isAr ? 'الفترة' : 'Pay period'}</small><strong>{monthLabel(month, language)}</strong></div><div className="text-end"><small className="block text-[9px] font-semibold text-slate-500">{isAr ? 'تاريخ إنشاء المستند' : 'Document date'}</small><strong>{createdDateLabel}</strong></div></div>
            <h1 className="mt-7 text-center text-xl font-bold text-slate-900">Salary Slip — {monthLabel(month, language)}</h1>
            <p className="mt-3 text-center text-xs leading-6 text-slate-500">{isAr ? `تؤكد هذه القسيمة تفاصيل راتب ${gender === 'female' ? 'الموظفة' : 'الموظف'} ${employee.full_name} عن شهر ${monthLabel(month, 'ar')}.` : `This slip records ${gender === 'female' ? 'her' : 'his'} salary details for ${monthLabel(month, 'en')}.`}</p>
            <div className="mt-7 grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 text-xs">
              {[ [isAr ? 'اسم الموظف' : 'Employee Name', employee.full_name], [isAr ? 'الرقم الوظيفي' : 'Employee Code', employee.code], [isAr ? 'المسمى الوظيفي' : 'Designation', designation], [isAr ? 'الرقم الشخصي' : 'CPR / ID', employee.cpr_number || employee.salary_matrix?.expatCpr || '—'] ].map(([label, value], index) => <div key={String(label)} className={`p-3 ${index % 2 === 0 ? 'border-e border-slate-200' : ''} ${index < 2 ? 'border-b border-slate-200' : ''}`}><small className="block text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</small><strong className="mt-1 block text-sm text-slate-900">{value}</strong></div>)}
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3 text-[11px]">
              <div className="border border-slate-400 p-3"><h3 className="mb-2 border-b border-slate-600 pb-2 text-[11px] font-bold">{isAr ? 'الاستحقاقات' : 'Earnings'}</h3>{earnings.map(line => <div key={line.key} className="flex justify-between gap-3 border-b border-slate-100 py-2"><span>{isAr ? line.labelAr : line.labelEn}</span><strong className="whitespace-nowrap">{money(Number(line.amount) || 0)}</strong></div>)}<div className="mt-2 flex justify-between border-t border-slate-400 pt-2 font-bold"><span>{isAr ? 'إجمالي الاستحقاقات' : 'Total Earnings'}</span><strong>{money(totalEarnings)}</strong></div></div>
              <div className="border border-slate-400 p-3"><h3 className="mb-2 border-b border-slate-600 pb-2 text-[11px] font-bold">{isAr ? 'الاستقطاعات' : 'Deductions'}</h3>{deductions.map(line => <div key={line.key} className="flex justify-between gap-3 border-b border-slate-100 py-2"><span>{isAr ? line.labelAr : line.labelEn}</span><strong className="whitespace-nowrap">− {money(Number(line.amount) || 0)}</strong></div>)}<div className="mt-2 flex justify-between border-t border-slate-400 pt-2 font-bold"><span>{isAr ? 'إجمالي الاستقطاعات' : 'Total Deductions'}</span><strong>− {money(totalDeductions)}</strong></div></div>
            </div>
            <div className="mt-7 flex items-center justify-between border border-slate-600 px-5 py-3 text-slate-900"><strong className="text-xs font-bold">{isAr ? 'صافي الراتب' : 'Net Salary'}</strong><strong className="text-lg font-bold">{money(netSalary)}</strong></div>
            {employee.salary_matrix?.iban && <p className="mt-4 text-[10px] text-slate-500"><strong>IBAN:</strong> {employee.salary_matrix.iban}</p>}
            <footer className="mb-12 mt-auto flex min-h-36 items-end justify-between border-t border-slate-400 px-2 pb-0 pt-6">
              <div className="flex w-[45%] flex-col items-center text-center"><img src={cr.signature_url} alt="" className="mb-2 h-16 max-w-full object-contain" /><strong className="text-xs">{signatoryName}</strong><span className="mt-1 text-[10px] text-slate-500">{signatoryRole}</span></div>
              <div className="flex w-[220px] flex-col items-center rounded-[10px] border border-slate-400 bg-slate-50 p-2.5 text-center"><small className="mb-2 block w-full border-b border-slate-300 pb-1 text-[9px] font-bold text-slate-600">{isAr ? 'ختم المنشأة الرسمي' : "Company's Seal"}</small><div className="flex h-[90px] w-full items-center justify-center"><img src={cr.stamp_url} alt="" className="block max-h-[90px] w-full object-contain" /></div></div>
            </footer>
          </article>)}
        </section>
      </main>
    </div>
  );
};
