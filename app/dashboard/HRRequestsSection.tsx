import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { HRRequest } from '../../types';
import {
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    Clock,
    Download,
    Eye,
    FileCheck,
    FileText as FileTextIcon,
    Filter,
    Loader2,
    Printer,
    RefreshCw,
    Search,
    ShieldCheck,
    XCircle,
    Award,
    ExternalLink,
    Sparkles
} from 'lucide-react';
import { generateDocumentBlob, getPharmacyLicense, getPharmacyCR } from '../lib/docGenerator';
import { generateCrStampSvg } from '../project-settings/RegisteredCrsSection';
import {
    generateHrLetterDocxBlob,
    HrLetterData,
    HrLetterType,
    resolveNationality,
    resolveJobTitle,
    cleanBilingualString
} from '../lib/hrLetterDocxGenerator';
import { getAdminRegisteredCrs, RegisteredCr } from '../lib/crEntities';
import { leaveSyncService } from '../../services/leaveSyncService';

export interface HRRequestsSectionProps {
    onOpenInLetterGenerator?: (request: HRRequest, lang?: 'ar' | 'en') => void;
}

export const mapRequestToHrLetterData = (
    request: HRRequest,
    registeredCrs: RegisteredCr[],
    lang: 'ar' | 'en' = 'ar'
): HrLetterData => {
    let letterType: HrLetterType = 'experience_certificate';
    const docTypesStr = (request.docTypes || []).join(' ').toLowerCase();
    if (docTypesStr.includes('experience')) letterType = 'experience_certificate';
    else if (docTypesStr.includes('employment')) letterType = 'active_employment';
    else if (docTypesStr.includes('salary')) letterType = 'bank_salary_iban';
    else if (docTypesStr.includes('noc')) letterType = 'noc_transfer';
    else if (docTypesStr.includes('bank')) letterType = 'bank_salary_undertaking';
    else if (docTypesStr.includes('embassy')) letterType = 'embassy_salary';

    const matchedCr = registeredCrs.find(c =>
        (request.sponsor && c.cr_name?.toLowerCase().includes(request.sponsor.toLowerCase())) ||
        (request.sponsor && c.cr_name_ar?.includes(request.sponsor)) ||
        (request.location && c.cr_name?.toLowerCase().includes(request.location.toLowerCase())) ||
        (request.location && c.cr_name_ar?.includes(request.location))
    ) || registeredCrs.find(c => c.is_master) || registeredCrs[0];

    const parsedSalary = request.salary ? parseFloat(request.salary) : 0;
    const basicSalary = parsedSalary > 0 ? Number((parsedSalary * 0.6).toFixed(3)) : 150.000;
    const housing = parsedSalary > 0 ? Number((parsedSalary * 0.15).toFixed(3)) : 30.000;
    const transport = 0.000;
    const incentive = parsedSalary > 0 ? Number((parsedSalary - basicSalary - housing).toFixed(3)) : 90.000;
    const totalSalary = parsedSalary > 0 ? parsedSalary : 270.000;

    const reqGenderRaw = (request as any).gender;
    const gender: 'male' | 'female' = (reqGenderRaw && String(reqGenderRaw).toLowerCase().includes('female')) ? 'female' : 'male';

    return {
        letterType,
        lang,
        gender,
        cr: matchedCr,
        refNo: request.refNum || `HR/LET/${new Date().getFullYear()}/${request.cpr?.slice(-4) || '1001'}`,
        issueDate: request.timestamp ? new Date(request.timestamp).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        withoutSealAndSignature: false,
        employeeName: (request.passportName || request.employeeName || '').toUpperCase(),
        cpr: request.cpr || '',
        passport: request.passport || 'N/A',
        nationality: resolveNationality((request as any).nationality || 'Egyptian', lang, gender),
        jobTitle: resolveJobTitle(request.jobTitle || 'Pharmacist', lang, undefined, gender),
        nhraLicense: request.license || '',
        joinDate: request.joinDate || '2021-03-15',
        basicSalary,
        housingAllowance: housing,
        transportationAllowance: transport,
        incentiveBonus: incentive,
        totalSalary,
        destinationName: cleanBilingualString(request.docReason, lang),
        signatoryName: 'Dr. Fathy Saad Amin',
        signatoryRole: lang === 'ar' ? 'المدير التنفيذي' : 'CEO'
    };
};

type FilterStatus = 'all' | 'Pending' | 'Approved' | 'Rejected' | 'Completed';
type FilterType = 'all' | 'Document' | 'Vacation Request';
type RequestActionStatus = 'Approved' | 'Rejected' | 'Completed';

const getNormalizedType = (request: HRRequest): Exclude<FilterType, 'all'> =>
    request.type === 'Vacation Request' ? 'Vacation Request' : 'Document';

const formatDate = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
};

const getRequestSummary = (request: HRRequest) => {
    if (getNormalizedType(request) === 'Vacation Request') {
        return `${formatDate(request.holidayFrom)} -> ${formatDate(request.holidayTo)}`;
    }

    const documentNames = (request.docTypes || [])
        .slice(0, 2)
        .map(type => (type === 'Others' && request.otherDocType ? request.otherDocType : type));

    return documentNames.length > 0 ? documentNames.join(', ') : 'Document request';
};

const statusStyles: Record<HRRequest['status'], { bg: string; text: string; border: string; dot: string; icon: React.ElementType }> = {
    Pending: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', dot: 'bg-amber-500', icon: Clock },
    Approved: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100', dot: 'bg-blue-500', icon: ShieldCheck },
    Rejected: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100', dot: 'bg-rose-500', icon: XCircle },
    Completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', dot: 'bg-emerald-500', icon: CheckCircle2 }
};

export const HRRequestsSection: React.FC<HRRequestsSectionProps> = ({ onOpenInLetterGenerator }) => {
    const [requests, setRequests] = useState<HRRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
    const [typeFilter, setTypeFilter] = useState<FilterType>('all');
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [isReconcilingLeaves, setIsReconcilingLeaves] = useState<boolean>(false);

    const registeredCrs = useMemo(() => getAdminRegisteredCrs(), []);

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        setIsLoading(true);
        const data = await supabase.hrRequests.list();
        setRequests(data);
        setIsLoading(false);
    };

    const updateStatus = async (id: string, status: RequestActionStatus) => {
        try {
            await supabase.hrRequests.updateStatus(id, status);
            const targetReq = requests.find(r => r.id === id || r.refNum === id);
            let extraSyncMsg = '';

            if (targetReq && (targetReq.type === 'Vacation Request' || targetReq.holidayFrom)) {
                if (status === 'Approved') {
                    const syncRes = await leaveSyncService.syncApprovedHrRequest(targetReq);
                    if (syncRes.success) {
                        extraSyncMsg = ` • ${syncRes.message}`;
                    }
                } else if (status === 'Rejected') {
                    await leaveSyncService.syncRejectedHrRequest(targetReq);
                    extraSyncMsg = ' • Synced with Leave Management & Duty Scheduler (Rejected).';
                }
            }

            setNotice({ type: 'success', message: `Request marked ${status}.${extraSyncMsg}` });
            await loadRequests();
        } catch (error) {
            console.error('HR status update failed:', error);
            setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Failed to update HR request status.' });
        }
    };

    const handleReconcileApprovedLeaves = async () => {
        setIsReconcilingLeaves(true);
        try {
            const res = await leaveSyncService.reconcileAllApprovedRequests();
            setNotice({
                type: 'success',
                message: `Leave reconciliation completed: ${res.synced} newly synced, ${res.skipped} already active out of ${res.total} approved vacation requests.`
            });
        } catch (e) {
            setNotice({ type: 'error', message: 'Failed to reconcile approved leaves with Duty Scheduler.' });
        } finally {
            setIsReconcilingLeaves(false);
        }
    };

    const handleDownloadOfficialLetterDocx = async (request: HRRequest, lang: 'ar' | 'en' = 'ar') => {
        try {
            const { saveAs } = await import('file-saver');
            const letterData = mapRequestToHrLetterData(request, registeredCrs, lang);
            const blob = await generateHrLetterDocxBlob(letterData);
            const fileName = `${request.refNum}_Official_${letterData.letterType}_${lang.toUpperCase()}.docx`;
            saveAs(blob, fileName);
            setNotice({ type: 'success', message: `Official HR letter downloaded: ${fileName}` });
        } catch (error) {
            console.error('Error generating official HR letter:', error);
            setNotice({ type: 'error', message: 'Failed to generate official letter DOCX. Please try again.' });
        }
    };

    const generateWordDocument = async (request: HRRequest) => {
        await handleDownloadOfficialLetterDocx(request, 'ar');
    };

    const generatePdfDocument = (request: HRRequest, lang: 'ar' | 'en' = 'ar') => {
        const isAr = lang === 'ar';
        let cr: any = null;
        if (typeof window !== 'undefined') {
            try {
                const raw = localStorage.getItem('tabarak_registered_crs');
                if (raw) {
                    const crs = JSON.parse(raw);
                    if (Array.isArray(crs) && crs.length > 0) {
                        cr = crs.find(c =>
                            (c.cr_name && request.sponsor && c.cr_name.toLowerCase().includes(request.sponsor.toLowerCase())) ||
                            (c.cr_name_ar && request.sponsor && c.cr_name_ar.includes(request.sponsor)) ||
                            (c.cr_name && request.location && c.cr_name.toLowerCase().includes(request.location.toLowerCase()))
                        ) || crs.find(c => c.is_master) || crs[0];
                    }
                }
            } catch (e) {
                console.error(e);
            }
        }

        const logo = cr?.logo_url || '/logo.jpg';
        const sig = cr?.signature_url || '/sign.jpg';
        const crEn = cr?.cr_name || 'TABARAK PHARMACY GROUP WLL';
        const crAr = cr?.cr_name_ar || 'مجموعة صيدليات تبارك ذ.م.م';
        const crNum = cr?.cr_number || '100234-1';
        const stamp = cr?.stamp_url || generateCrStampSvg(crAr, crEn, crNum);

        const employeeName = (request.passportName || request.employeeName).toUpperCase();
        const sponsorName = isAr ? crAr : crEn;
        const crNumber = getPharmacyCR(request.sponsor) || crNum;
        const licenseNo = request.license || (isAr ? '[رقم الترخيص]' : '[License No]');
        const pharmacyLicense = getPharmacyLicense(request.sponsor);
        const passportNo = request.passport || (isAr ? '[رقم الجواز]' : '[Passport No]');
        const joinDate = request.joinDate || (isAr ? '[تاريخ الالتحاق]' : '[Joining Date]');

        // Resolve pure nationality and job title strictly according to chosen language
        const resolvedNationality = resolveNationality(request.nationality || 'Egyptian', lang);
        const resolvedJobTitle = resolveJobTitle(request.jobTitle || 'Pharmacist', lang);

        const isVacation = getNormalizedType(request) === 'Vacation Request';
        let isExperienceCert = false;
        let isEmploymentCert = false;
        let isSalaryCert = false;

        if (request.docTypes && request.docTypes.length > 0) {
            isExperienceCert = request.docTypes.some(t => t.toLowerCase().includes('experience'));
            if (!isExperienceCert) isEmploymentCert = request.docTypes.some(t => t.toLowerCase().includes('employment'));
            if (!isExperienceCert && !isEmploymentCert) isSalaryCert = request.docTypes.some(t => t.toLowerCase().includes('salary'));
        }

        let certTitle = '';
        let bodyHtml = '';
        const b = (txt: string | number | undefined) => `<strong style="color: #0f172a; font-weight: 800;">${txt || ''}</strong>`;

        if (isAr) {
            if (isVacation) {
                certTitle = 'شهادة إجازة رسمية معتمدة';
                bodyHtml = `
                    <p style="font-size: 14px; margin-bottom: 22px;"><strong>إلى من يهمه الأمر،</strong></p>
                    <p style="line-height: 2.2; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 18px;">
                        تشهد إدارة شركة ${b(crAr)} (سجل تجاري رقم: ${b(crNum)}) بأن ${b(employeeName)}، ${b(resolvedNationality)} الجنسية، حامل بطاقة هوية رقم (${b(request.cpr)})، يعمل لدينا بوظيفة (${b(resolvedJobTitle)})، قد تم منحه إجازة رسمية معتمدة للفترة من ${b(formatDate(request.holidayFrom))} حتى ${b(formatDate(request.holidayTo))} (ومدتها ${b((request.daysCount || 0) + ' يوم')}).
                    </p>
                    <p style="line-height: 2.2; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 28px;">
                        تم إصدار هذه الشهادة بناءً على طلبه لتأكيد جدول الإجازة المعتمدة لدى الشركة.
                    </p>
                    <p style="font-size: 14px; color: #1e293b; font-weight: bold;">وتفضلوا بقبول فائق الاحترام والتقدير،</p>
                `;
            } else if (isExperienceCert) {
                certTitle = 'شهادة خبرة وخدمة وظيفية رسمية';
                bodyHtml = `
                    <p style="font-size: 14px; margin-bottom: 22px;"><strong>إلى من يهمه الأمر،</strong></p>
                    <p style="line-height: 2.2; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 18px;">
                        تشهد إدارة شركة ${b(crAr)} (سجل تجاري رقم: ${b(crNum)}) بأن ${b(employeeName)}، ${b(resolvedNationality)} الجنسية، حامل بطاقة هوية رقم (${b(request.cpr)}) وجواز سفر رقم (${b(passportNo)})${request.license ? `، وترخيص مزاولة المهنة من الهيئة الوطنية لتنظيم المهن والخدمات الصحية (نهرا) رقم: (${b(licenseNo)})` : ''}، يعمل لدينا بوظيفة (${b(resolvedJobTitle)}) اعتباراً من تاريخ ${b(joinDate)} وما زال على رأس عمله حتى تاريخه.
                    </p>
                    <p style="line-height: 2.2; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 18px;">
                        وخلال فترة عمله بالشركة أظهر كفاءة مهنية عالية والتزاماً تاماً بالمسؤوليات الموكلة إليه، وكان حسن السيرة والسلوك.
                    </p>
                    <p style="line-height: 2.2; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 28px;">
                        قُدمت له هذه الشهادة الرسمية بناءً على طلبه لتقديمها إلى الهيئة الوطنية لتنظيم المهن والخدمات الصحية (NHRA) دون أدنى مسؤولية مالية أو قانونية على الشركة تجاه الغير.
                    </p>
                    <p style="font-size: 14px; color: #1e293b; font-weight: bold;">وتفضلوا بقبول فائق الاحترام والتقدير،</p>
                `;
            } else if (isEmploymentCert) {
                certTitle = 'شهادة إثبات عمل';
                bodyHtml = `
                    <p style="font-size: 14px; margin-bottom: 22px;"><strong>إلى من يهمه الأمر،</strong></p>
                    <p style="line-height: 2.2; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 18px;">
                        تشهد إدارة شركة ${b(crAr)} (سجل تجاري رقم: ${b(crNum)}) بأن ${b(employeeName)}، ${b(resolvedNationality)} الجنسية، حامل بطاقة هوية رقم (${b(request.cpr)}) وجواز سفر رقم (${b(passportNo)})${request.license ? `، وترخيص مزاولة المهنة من الهيئة الوطنية لتنظيم المهن والخدمات الصحية (نهرا) رقم: (${b(licenseNo)})` : ''}، يعمل لدينا بوظيفة (${b(resolvedJobTitle)}) اعتباراً من تاريخ ${b(joinDate)} بموجب عقد عمل ساري المفعول وما زال على رأس عمله حتى تاريخه.
                    </p>
                    <p style="line-height: 2.2; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 28px;">
                        أعطيت له هذه الإفادة بناءً على طلبه لتقديمها لمن يهمه الأمر دون أدنى مسؤولية أو التزام على الشركة.
                    </p>
                    <p style="font-size: 14px; color: #1e293b; font-weight: bold;">وتفضلوا بقبول فائق الاحترام والتقدير،</p>
                `;
            } else if (isSalaryCert) {
                certTitle = 'شهادة تفاصيل وبيان الراتب الشهري';
                bodyHtml = `
                    <p style="font-size: 14px; margin-bottom: 22px;"><strong>إلى من يهمه الأمر،</strong></p>
                    <p style="line-height: 2.2; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 18px;">
                        تشهد شركة ${b(crAr)} (سجل تجاري رقم: ${b(crNum)}) بأن ${b(employeeName)}، ${b(resolvedNationality)} الجنسية، حامل بطاقة هوية رقم (${b(request.cpr)}) وجواز سفر رقم (${b(passportNo)})، يعمل لدينا بوظيفة (${b(resolvedJobTitle)}) منذ تاريخ ${b(joinDate)}.
                    </p>
                    <p style="line-height: 2.2; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 18px;">
                        ويتقاضى المذكور راتباً شهرياً إجمالياً قدره ${b((request.salary || '270.000') + ' دينار بحريني')} شاملاً البدلات المقررة وفقاً لعقد العمل الساري.
                    </p>
                    <p style="line-height: 2.2; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 28px;">
                        أُصدرت هذه الشهادة بناءً على طلب الموظف لتقديمها للجهات المعنية دون أي مسؤولية على الشركة تجاه الغير.
                    </p>
                    <p style="font-size: 14px; color: #1e293b; font-weight: bold;">وتفضلوا بقبول فائق الاحترام والتقدير،</p>
                `;
            } else {
                certTitle = 'شهادة رسمية - إلى من يهمه الأمر';
                bodyHtml = `
                    <p style="font-size: 14px; margin-bottom: 22px;"><strong>إلى من يهمه الأمر،</strong></p>
                    <p style="line-height: 2.2; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 18px;">
                        تشهد شركة ${b(crAr)} (سجل تجاري رقم: ${b(crNum)}) بأن ${b(employeeName)}، ${b(resolvedNationality)} الجنسية، حامل بطاقة هوية رقم (${b(request.cpr)}) وجواز سفر رقم (${b(passportNo)})، موظف لدينا بوظيفة (${b(resolvedJobTitle)}) وما زال على رأس عمله.
                    </p>
                    <p style="line-height: 2.2; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 18px;">
                        صدرت هذه الإفادة بناءً على طلبه لغرض: ${b(cleanBilingualString(request.docReason, 'ar') || 'أغراض إدارية رسمية')}.
                    </p>
                    <p style="line-height: 2.2; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 28px;">
                        <strong>نوع المستند المطلوب:</strong> ${b((request.docTypes || []).join(', ') || 'مستند رسمي')}
                    </p>
                    <p style="font-size: 14px; color: #1e293b; font-weight: bold;">وتفضلوا بقبول فائق الاحترام والتقدير،</p>
                `;
            }
        } else {
            // English Mode
            if (isVacation) {
                certTitle = 'VACATION REQUEST CERTIFICATE';
                bodyHtml = `
                    <p style="font-size: 14px; margin-bottom: 22px;"><strong>To Whom It May Concern,</strong></p>
                    <p style="line-height: 2.0; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 18px;">
                        This is to certify that ${b(employeeName)},  ${b(resolvedNationality)} national holding CPR No ${b(request.cpr)}, employed as ${b(resolvedJobTitle)} at ${b(crEn)}, has been officially granted leave for the period from ${b(formatDate(request.holidayFrom))} to ${b(formatDate(request.holidayTo))} (${b((request.daysCount || 0) + ' Days')}).
                    </p>
                    <p style="line-height: 2.0; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 28px;">
                        This document serves as an official confirmation of the approved vacation schedule.
                    </p>
                    <p style="font-size: 14px; color: #1e293b;">Sincerely,</p>
                `;
            } else if (isExperienceCert) {
                certTitle = 'OFFICIAL EXPERIENCE CERTIFICATE';
                bodyHtml = `
                    <p style="font-size: 14px; margin-bottom: 22px;"><strong>To Whom It May Concern,</strong></p>
                    <p style="line-height: 2.0; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 18px;">
                        This is to certify that ${b(employeeName)}, a ${b(resolvedNationality)} national with CPR No ( ${b(request.cpr)} ) and Passport No ( ${b(passportNo)} ), employed as ${b(resolvedJobTitle)}${request.license ? ` (NHRA License No.: ${b(licenseNo)})` : ''}, has been employed at ${b(crEn)}${pharmacyLicense ? `, Licensed Pharmacy (License No: ${b(pharmacyLicense)})` : ''}, with CR No ( ${b(crNumber)} ), since ${b(joinDate)} and is currently still in active service.
                    </p>
                    <p style="line-height: 2.0; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 28px;">
                        This certificate is issued upon the employee request for official submission to the National Health Regulatory Authority (NHRA), wishing them continued professional success.
                    </p>
                    <p style="font-size: 14px; color: #1e293b;">Sincerely,</p>
                `;
            } else if (isEmploymentCert) {
                certTitle = 'CERTIFICATE OF ACTIVE EMPLOYMENT';
                bodyHtml = `
                    <p style="font-size: 14px; margin-bottom: 22px;"><strong>To Whom It May Concern,</strong></p>
                    <p style="line-height: 2.0; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 18px;">
                        This is to certify that ${b(employeeName)}, a ${b(resolvedNationality)} national with CPR No ( ${b(request.cpr)} ) and Passport No ( ${b(passportNo)} ), employed as ${b(resolvedJobTitle)}${request.license ? ` (NHRA License No.: ${b(licenseNo)})` : ''}, has been employed at ${b(crEn)}, with CR No ( ${b(crNumber)} ), since ${b(joinDate)} and continues to be in active service under a valid employment contract.
                    </p>
                    <p style="line-height: 2.0; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 28px;">
                        This certificate is issued upon the employee's request and without liability on the company.
                    </p>
                    <p style="font-size: 14px; color: #1e293b;">Sincerely,</p>
                `;
            } else if (isSalaryCert) {
                certTitle = 'SALARY DETAILS CERTIFICATE';
                bodyHtml = `
                    <p style="font-size: 14px; margin-bottom: 22px;"><strong>To Whom It May Concern,</strong></p>
                    <p style="line-height: 2.0; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 18px;">
                        This is to certify that ${b(employeeName)}, a ${b(resolvedNationality)} national with CPR No ( ${b(request.cpr)} ) and Passport No ( ${b(passportNo)} ), is currently employed as ${b(resolvedJobTitle)} at ${b(crEn + ' - CR No. ' + crNumber)}.
                    </p>
                    <p style="line-height: 2.0; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 18px;">
                        The employee has been with us since ${b(joinDate)} and receives a total monthly salary of ${b((request.salary || '270.000') + ' BHD')}, inclusive of all allowances.
                    </p>
                    <p style="line-height: 2.0; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 28px;">
                        This certificate is issued upon the employee's request for official purposes without liability on the employer.
                    </p>
                    <p style="font-size: 14px; color: #1e293b;">Sincerely,</p>
                `;
            } else {
                certTitle = 'TO WHOM IT MAY CONCERN';
                bodyHtml = `
                    <p style="font-size: 14px; margin-bottom: 22px;"><strong>To Whom It May Concern,</strong></p>
                    <p style="line-height: 2.0; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 18px;">
                        This is to certify that ${b(employeeName)}, a ${b(resolvedNationality)} national holding CPR Number ${b(request.cpr)}, is an active employee at ${b(crEn)} serving as ${b(resolvedJobTitle)}.
                    </p>
                    <p style="line-height: 2.0; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 18px;">
                        This letter is issued upon the request of the employee for: <em>${cleanBilingualString(request.docReason, 'en') || 'General administrative purposes.'}</em>
                    </p>
                    <p style="line-height: 2.0; font-size: 14px; text-align: justify; color: #1e293b; margin-bottom: 28px;">
                        <strong>Requested Document Type:</strong> ${b((request.docTypes || []).join(', ') || 'Official Document')}
                    </p>
                    <p style="font-size: 14px; color: #1e293b;">Sincerely,</p>
                `;
            }
        }

        const printWindow = window.open('', '_blank', 'width=850,height=1100');
        if (!printWindow) return;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html dir="${isAr ? 'rtl' : 'ltr'}" lang="${lang}">
            <head>
              <title>HR Official Document - ${request.refNum}</title>
              <meta charset="utf-8" />
              <style>
                @page { size: A4 portrait; margin: 0; }
                @media print { body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                body {
                  font-family: ${isAr ? "'Cairo', 'Segoe UI', Tahoma, sans-serif" : "'Inter', Arial, sans-serif"};
                  margin: 0;
                  padding: 0;
                  background-color: #fff;
                  color: #0f172a;
                  direction: ${isAr ? 'rtl' : 'ltr'};
                  text-align: ${isAr ? 'right' : 'left'};
                }
                .a4-page {
                  width: 210mm;
                  min-height: 297mm;
                  padding: 22mm 20mm;
                  margin: 0 auto;
                  box-sizing: border-box;
                  background: #fff;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                }
                .header-table {
                  width: 100%;
                  border-bottom: 4px double #0f172a;
                  padding-bottom: 16px;
                  margin-bottom: 25px;
                  direction: ${isAr ? 'rtl' : 'ltr'};
                }
                .cr-logo { max-height: 75px; max-width: 130px; object-fit: contain; }
                .cr-title-en { font-size: 17.5px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -0.2px; font-family: Arial, sans-serif; }
                .cr-title-ar { font-size: 15.5px; font-weight: 800; color: #1e293b; margin-top: 4px; direction: rtl; }
                .cr-meta { font-size: 10.5px; font-family: monospace; font-weight: 600; color: #475569; margin-top: 6px; line-height: 1.45; }
                .doc-details { flex: 1; padding: 10px 0; }
                .doc-header {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  border-bottom: 1px solid #e2e8f0;
                  padding-bottom: 12px;
                  margin-bottom: 30px;
                  direction: ${isAr ? 'rtl' : 'ltr'};
                }
                .doc-ref {
                  font-family: monospace;
                  font-weight: bold;
                  color: #0284c7;
                  font-size: 13.5px;
                  background: #f0f9ff;
                  padding: 2px 8px;
                  borderRadius: 4px;
                  border: 1px solid #bae6fd;
                }
                .doc-title-container { text-align: center; margin: 30px 0; }
                .doc-title {
                  font-size: 18px;
                  font-weight: 900;
                  text-align: center;
                  color: #0f172a;
                  letter-spacing: 0.8px;
                  text-transform: uppercase;
                  border-bottom: 2px solid #0f172a;
                  display: inline-block;
                  padding-bottom: 4px;
                }
                .footer-section {
                  margin-top: 40px;
                  padding-top: 20px;
                  border-top: 1px solid #e2e8f0;
                  display: flex;
                  justify-content: space-between;
                  align-items: flex-end;
                  direction: ${isAr ? 'rtl' : 'ltr'};
                }
                .sig-box { text-align: center; width: 220px; }
                .sig-img { max-height: 80px; max-width: 200px; object-fit: contain; filter: contrast(1.2); }
                .sig-name { font-size: 13.5px; font-weight: 900; color: #0f172a; margin-top: 5px; }
                .sig-title { font-size: 11px; font-weight: 800; color: #0284c7; text-transform: uppercase; letter-spacing: 0.3px; }
                .seal-box {
                  width: 220px;
                  border: 1.5px solid #94a3b8;
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
                .seal-img { max-height: 90px; width: 100%; object-fit: contain; display: block; margin: 0 auto; }
              </style>
            </head>
            <body>
              <div class="a4-page">
                <div>
                  <table class="header-table">
                    <tr>
                      <td style="width: 120px; vertical-align: middle; text-align: ${isAr ? 'right' : 'left'};">
                        <img src="${logo}" class="cr-logo" alt="Logo" />
                      </td>
                      <td style="vertical-align: middle; padding-${isAr ? 'right' : 'left'}: 20px; text-align: ${isAr ? 'right' : 'left'};">
                        <div class="cr-title-en">${crEn}</div>
                        <div class="cr-title-ar">${crAr}</div>
                        <div class="cr-meta">
                          <div><strong>${isAr ? 'رقم السجل التجاري:' : 'CR NO:'}</strong> ${crNum} &nbsp;&bull;&nbsp; <strong>${isAr ? 'هاتف التواصل:' : 'Contact No:'}</strong> +973 33866650</div>
                          <div><strong>${isAr ? 'البريد الإلكتروني:' : 'Email Address:'}</strong> tabarakph.info@gmail.com &nbsp;&bull;&nbsp; ${isAr ? 'مملكة البحرين' : 'Kingdom of Bahrain'}</div>
                        </div>
                      </td>
                    </tr>
                  </table>

                  <div class="doc-details">
                    <div class="doc-header">
                      <div style="font-size: 13px;">${isAr ? 'التاريخ:' : 'Date:'} <strong>${formatDate(request.timestamp)}</strong></div>
                      <div style="font-size: 13px;">${isAr ? 'المرجع:' : 'Ref:'} <span class="doc-ref">${request.refNum}</span></div>
                    </div>

                    <div class="doc-title-container">
                      <span class="doc-title">${certTitle}</span>
                    </div>

                    <div>
                      ${bodyHtml}
                    </div>
                  </div>
                </div>

                <div class="footer-section">
                  <div class="sig-box">
                    <div>
                      <img src="${sig}" class="sig-img" alt="CEO Signature" />
                    </div>
                    <div class="sig-name">${isAr ? 'د. فتحي سعد أمين' : 'Dr. Fathy Saad Amin'}</div>
                    <div class="sig-title">${isAr ? 'المدير التنفيذي' : 'CEO'}</div>
                  </div>

                  <div class="seal-box">
                    <span class="seal-label">${isAr ? 'ختم الشركة المعتمد' : "Company's Seal"}</span>
                    <div style="height: 90px; display: flex; align-items: center; justify-content: center;">
                      <img src="${stamp}" class="seal-img" alt="Official Corporate Seal" />
                    </div>
                  </div>
                </div>
              </div>
              <script>
                window.onload = function() {
                  setTimeout(function() { window.print(); }, 300);
                };
              </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const filteredRequests = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();

        return requests.filter(request => {
            const normalizedType = getNormalizedType(request);
            const matchesSearch =
                !query ||
                request.employeeName.toLowerCase().includes(query) ||
                request.refNum.toLowerCase().includes(query) ||
                request.cpr.includes(query) ||
                (request.email || '').toLowerCase().includes(query);
            const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
            const matchesType = typeFilter === 'all' || normalizedType === typeFilter;
            return matchesSearch && matchesStatus && matchesType;
        });
    }, [requests, searchTerm, statusFilter, typeFilter]);

    const stats = useMemo(() => {
        const pending = requests.filter(request => request.status === 'Pending').length;
        const approved = requests.filter(request => request.status === 'Approved').length;
        const completed = requests.filter(request => request.status === 'Completed').length;
        const rejected = requests.filter(request => request.status === 'Rejected').length;
        const vacations = requests.filter(request => getNormalizedType(request) === 'Vacation Request').length;
        const documents = requests.filter(request => getNormalizedType(request) === 'Document').length;

        return {
            total: requests.length,
            pending,
            approved,
            completed,
            rejected,
            vacations,
            documents,
            open: pending + approved
        };
    }, [requests]);

    return (
        <div className="space-y-5 animate-in fade-in duration-500">
            {notice && (
                <div className={`flex items-start justify-between gap-4 rounded-lg border p-4 text-sm font-bold ${notice.type === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-red-100 bg-red-50 text-red-700'}`}>
                    <span>{notice.message}</span>
                    <button onClick={() => setNotice(null)} className="shrink-0 opacity-70 transition hover:opacity-100" aria-label="Dismiss notice">
                        <XCircle className="h-4 w-4" />
                    </button>
                </div>
            )}

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="p-5 sm:p-6">
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-700">
                                    <FileCheck className="h-3.5 w-3.5" />
                                    HR Admin Portal
                                </div>
                                <h2 className="text-2xl font-black tracking-tight text-slate-950">Request Operations</h2>
                                <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">
                                    Review employee documents and vacation requests, approve or reject pending work, and generate ready-to-share HR files.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={handleReconcileApprovedLeaves}
                                    disabled={isReconcilingLeaves}
                                    title="Synchronize all approved vacation requests into Leave Management and Duty Scheduler"
                                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 transition-all hover:bg-emerald-100 disabled:opacity-50"
                                >
                                    <CalendarDays className={`h-3.5 w-3.5 ${isReconcilingLeaves ? 'animate-spin' : ''}`} />
                                    <span>Sync Leaves with Scheduler</span>
                                </button>
                                <button
                                    onClick={loadRequests}
                                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-600 transition-all hover:border-brand/30 hover:bg-brand/5 hover:text-brand"
                                >
                                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                    Refresh
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 bg-slate-50/80 p-4 sm:p-5 lg:border-l lg:border-t-0">
                        <div className="grid grid-cols-2 gap-3">
                            <MetricTile label="Open Queue" value={stats.open} icon={Clock} tone="amber" />
                            <MetricTile label="Completed" value={stats.completed} icon={CheckCircle2} tone="emerald" />
                            <MetricTile label="Documents" value={stats.documents} icon={FileTextIcon} tone="blue" />
                            <MetricTile label="Vacation" value={stats.vacations} icon={CalendarDays} tone="red" />
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard label="Total Requests" value={stats.total} helper={`${filteredRequests.length} visible`} />
                <StatCard label="Pending Review" value={stats.pending} helper="Needs decision" tone="amber" />
                <StatCard label="Approved" value={stats.approved} helper="Ready to complete" tone="blue" />
                <StatCard label="Rejected" value={stats.rejected} helper="Declined requests" tone="rose" />
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="relative min-w-0 flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search employee, reference, CPR, or email..."
                            value={searchTerm}
                            onChange={event => setSearchTerm(event.target.value)}
                            className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 pl-10 text-sm font-bold text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                        <FilterSelect
                            icon={Filter}
                            value={statusFilter}
                            onChange={value => setStatusFilter(value as FilterStatus)}
                            label="Status"
                            options={[
                                ['all', 'All Status'],
                                ['Pending', 'Pending'],
                                ['Approved', 'Approved'],
                                ['Rejected', 'Rejected'],
                                ['Completed', 'Completed']
                            ]}
                        />
                        <FilterSelect
                            icon={FileTextIcon}
                            value={typeFilter}
                            onChange={value => setTypeFilter(value as FilterType)}
                            label="Type"
                            options={[
                                ['all', 'All Types'],
                                ['Document', 'Documents'],
                                ['Vacation Request', 'Vacation']
                            ]}
                        />
                    </div>
                </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Request Queue</h3>
                            <p className="mt-1 text-xs font-semibold text-slate-500">Sorted by newest request first.</p>
                        </div>
                        <span className="rounded-md bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 shadow-sm">
                            Showing {filteredRequests.length} / {requests.length}
                        </span>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex min-h-[360px] flex-col items-center justify-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-brand" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading HR requests</p>
                    </div>
                ) : filteredRequests.length === 0 ? (
                    <EmptyState />
                ) : (
                    <>
                        <div className="hidden overflow-x-auto lg:block">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-white text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        <th className="px-5 py-3.5">Request</th>
                                        <th className="px-5 py-3.5">Employee</th>
                                        <th className="px-5 py-3.5">Type</th>
                                        <th className="px-5 py-3.5">Timeline</th>
                                        <th className="px-5 py-3.5">Status</th>
                                        <th className="px-5 py-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredRequests.map(request => (
                                        <React.Fragment key={request.id}>
                                            <RequestRows
                                                request={request}
                                                expandedRow={expandedRow}
                                                setExpandedRow={setExpandedRow}
                                                onGenerateDocument={generateWordDocument}
                                                onGeneratePdf={generatePdfDocument}
                                                onUpdateStatus={updateStatus}
                                                onOpenInLetterGenerator={onOpenInLetterGenerator}
                                                onDownloadOfficialLetter={handleDownloadOfficialLetterDocx}
                                            />
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="divide-y divide-slate-100 lg:hidden">
                            {filteredRequests.map(request => (
                                <React.Fragment key={request.id}>
                                    <MobileRequestCard
                                        request={request}
                                        expandedRow={expandedRow}
                                        setExpandedRow={setExpandedRow}
                                        onGenerateDocument={generateWordDocument}
                                        onGeneratePdf={generatePdfDocument}
                                        onUpdateStatus={updateStatus}
                                        onOpenInLetterGenerator={onOpenInLetterGenerator}
                                        onDownloadOfficialLetter={handleDownloadOfficialLetterDocx}
                                    />
                                </React.Fragment>
                            ))}
                        </div>
                    </>
                )}
            </section>
        </div>
    );
};

const MetricTile = ({
    label,
    value,
    icon: Icon,
    tone
}: {
    label: string;
    value: number;
    icon: React.ElementType;
    tone: 'red' | 'emerald' | 'blue' | 'amber';
}) => {
    const tones = {
        red: 'border-red-100 bg-red-50 text-red-700',
        emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
        blue: 'border-blue-100 bg-blue-50 text-blue-700',
        amber: 'border-amber-100 bg-amber-50 text-amber-700'
    };

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg border ${tones[tone]}`}>
                <Icon className="h-4 w-4" />
            </div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-1 text-3xl font-black tabular-nums text-slate-950">{value}</p>
        </div>
    );
};

const StatCard = ({
    label,
    value,
    helper,
    tone = 'slate'
}: {
    label: string;
    value: number;
    helper: string;
    tone?: 'slate' | 'amber' | 'blue' | 'rose';
}) => {
    const tones = {
        slate: 'border-slate-200 bg-white text-slate-950',
        amber: 'border-amber-100 bg-amber-50 text-amber-800',
        blue: 'border-blue-100 bg-blue-50 text-blue-800',
        rose: 'border-rose-100 bg-rose-50 text-rose-800'
    };

    return (
        <div className={`rounded-lg border p-4 shadow-sm ${tones[tone]}`}>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</p>
            <p className="mt-2 text-3xl font-black tabular-nums">{value}</p>
            <p className="mt-1 text-xs font-bold opacity-60">{helper}</p>
        </div>
    );
};

const FilterSelect = ({
    icon: Icon,
    value,
    onChange,
    label,
    options
}: {
    icon: React.ElementType;
    value: string;
    onChange: (value: string) => void;
    label: string;
    options: Array<[string, string]>;
}) => (
    <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <select
            value={value}
            onChange={event => onChange(event.target.value)}
            className="h-11 w-full min-w-[150px] appearance-none rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-9 text-xs font-black uppercase tracking-widest text-slate-600 outline-none transition-all focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
            aria-label={`Filter by ${label}`}
        >
            {options.map(([optionValue, optionLabel]) => (
                <option key={optionValue} value={optionValue}>{optionLabel}</option>
            ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
    </div>
);

const StatusBadge = ({ status }: { status: HRRequest['status'] }) => {
    const style = statusStyles[status] || statusStyles.Pending;
    const StatusIcon = style.icon;

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${style.bg} ${style.text} ${style.border}`}>
            <StatusIcon className="h-3.5 w-3.5" />
            {status}
        </span>
    );
};

const TypeBadge = ({ request }: { request: HRRequest }) => (
    getNormalizedType(request) === 'Vacation Request' ? (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1 text-xs font-black text-red-700">
            <CalendarDays className="h-3.5 w-3.5" />
            {request.leaveType || 'Vacation'}
        </span>
    ) : (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">
            <FileTextIcon className="h-3.5 w-3.5" />
            Document
        </span>
    )
);

const RequestRows = ({
    request,
    expandedRow,
    setExpandedRow,
    onGenerateDocument,
    onGeneratePdf,
    onUpdateStatus,
    onOpenInLetterGenerator,
    onDownloadOfficialLetter
}: {
    request: HRRequest;
    expandedRow: string | null;
    setExpandedRow: (id: string | null) => void;
    onGenerateDocument: (request: HRRequest) => void | Promise<void>;
    onGeneratePdf: (request: HRRequest, lang?: 'ar' | 'en') => void;
    onUpdateStatus: (id: string, status: RequestActionStatus) => void | Promise<void>;
    onOpenInLetterGenerator?: (request: HRRequest, lang?: 'ar' | 'en') => void;
    onDownloadOfficialLetter?: (request: HRRequest, lang?: 'ar' | 'en') => void | Promise<void>;
}) => {
    const isExpanded = expandedRow === request.id;

    return (
        <React.Fragment>
            <tr className="group bg-white transition-colors hover:bg-slate-50/80">
                <td className="px-5 py-4">
                    <div className="space-y-1">
                        <code className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">{request.refNum}</code>
                        <p className="text-[11px] font-bold text-slate-400">{formatDate(request.timestamp)}</p>
                    </div>
                </td>
                <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-black text-slate-500">
                            {request.employeeName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-900">{request.employeeName}</p>
                            <p className="mt-0.5 text-[11px] font-bold text-slate-400">CPR {request.cpr}</p>
                        </div>
                    </div>
                </td>
                <td className="px-5 py-4">
                    <TypeBadge request={request} />
                </td>
                <td className="px-5 py-4">
                    <p className="max-w-[260px] truncate text-sm font-bold text-slate-700">{getRequestSummary(request)}</p>
                    <p className="mt-1 text-[11px] font-bold text-slate-400">
                        {getNormalizedType(request) === 'Vacation Request' ? `${request.daysCount || 0} days` : request.deliveryMethod || 'Delivery not set'}
                    </p>
                </td>
                <td className="px-5 py-4">
                    <StatusBadge status={request.status} />
                </td>
                <td className="px-5 py-4">
                    <RequestActions
                        request={request}
                        isExpanded={isExpanded}
                        onToggleDetails={() => setExpandedRow(isExpanded ? null : request.id)}
                        onGenerateDocument={onGenerateDocument}
                        onGeneratePdf={onGeneratePdf}
                        onUpdateStatus={onUpdateStatus}
                        onOpenInLetterGenerator={onOpenInLetterGenerator}
                        onDownloadOfficialLetter={onDownloadOfficialLetter}
                    />
                </td>
            </tr>
            {isExpanded && (
                <tr>
                    <td colSpan={6} className="border-t border-slate-100 bg-slate-50/80 px-5 py-5">
                        <DetailsGrid
                            request={request}
                            onGeneratePdf={onGeneratePdf}
                            onOpenInLetterGenerator={onOpenInLetterGenerator}
                            onDownloadOfficialLetter={onDownloadOfficialLetter}
                        />
                    </td>
                </tr>
            )}
        </React.Fragment>
    );
};

const MobileRequestCard = ({
    request,
    expandedRow,
    setExpandedRow,
    onGenerateDocument,
    onGeneratePdf,
    onUpdateStatus,
    onOpenInLetterGenerator,
    onDownloadOfficialLetter
}: {
    request: HRRequest;
    expandedRow: string | null;
    setExpandedRow: (id: string | null) => void;
    onGenerateDocument: (request: HRRequest) => void | Promise<void>;
    onGeneratePdf: (request: HRRequest, lang?: 'ar' | 'en') => void;
    onUpdateStatus: (id: string, status: RequestActionStatus) => void | Promise<void>;
    onOpenInLetterGenerator?: (request: HRRequest, lang?: 'ar' | 'en') => void;
    onDownloadOfficialLetter?: (request: HRRequest, lang?: 'ar' | 'en') => void | Promise<void>;
}) => {
    const isExpanded = expandedRow === request.id;

    return (
        <article className="bg-white p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <code className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">{request.refNum}</code>
                    <h4 className="mt-3 truncate text-base font-black text-slate-950">{request.employeeName}</h4>
                    <p className="mt-1 text-xs font-bold text-slate-400">CPR {request.cpr}</p>
                </div>
                <StatusBadge status={request.status} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Type</p>
                    <div className="mt-2"><TypeBadge request={request} /></div>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Submitted</p>
                    <p className="mt-2 text-xs font-black text-slate-700">{formatDate(request.timestamp)}</p>
                </div>
            </div>

            <p className="mt-4 text-sm font-bold text-slate-700">{getRequestSummary(request)}</p>

            <div className="mt-4">
                <RequestActions
                    request={request}
                    isExpanded={isExpanded}
                    onToggleDetails={() => setExpandedRow(isExpanded ? null : request.id)}
                    onGenerateDocument={onGenerateDocument}
                    onGeneratePdf={onGeneratePdf}
                    onUpdateStatus={onUpdateStatus}
                    onOpenInLetterGenerator={onOpenInLetterGenerator}
                    onDownloadOfficialLetter={onDownloadOfficialLetter}
                    mobile
                />
            </div>

            {isExpanded && (
                <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
                    <DetailsGrid
                        request={request}
                        onGeneratePdf={onGeneratePdf}
                        onOpenInLetterGenerator={onOpenInLetterGenerator}
                        onDownloadOfficialLetter={onDownloadOfficialLetter}
                    />
                </div>
            )}
        </article>
    );
};

const RequestActions = ({
    request,
    isExpanded,
    onToggleDetails,
    onGenerateDocument,
    onGeneratePdf,
    onUpdateStatus,
    onOpenInLetterGenerator,
    onDownloadOfficialLetter,
    mobile
}: {
    request: HRRequest;
    isExpanded: boolean;
    onToggleDetails: () => void;
    onGenerateDocument: (request: HRRequest) => void | Promise<void>;
    onGeneratePdf: (request: HRRequest, lang?: 'ar' | 'en') => void;
    onUpdateStatus: (id: string, status: RequestActionStatus) => void | Promise<void>;
    onOpenInLetterGenerator?: (request: HRRequest, lang?: 'ar' | 'en') => void;
    onDownloadOfficialLetter?: (request: HRRequest, lang?: 'ar' | 'en') => void | Promise<void>;
    mobile?: boolean;
}) => (
    <div className={`flex flex-wrap items-center ${mobile ? 'gap-2' : 'justify-end gap-1.5'}`}>
        <button
            onClick={onToggleDetails}
            className={`${mobile ? 'flex-1' : ''} inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-50 cursor-pointer`}
            title="View details"
        >
            <Eye className="h-3.5 w-3.5" />
            {isExpanded ? 'Hide' : 'Details'}
        </button>

        {getNormalizedType(request) === 'Document' && (
            <>
                <button
                    onClick={() => onDownloadOfficialLetter ? onDownloadOfficialLetter(request, 'ar') : onGenerateDocument(request)}
                    className={`${mobile ? 'flex-1' : ''} inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-2 text-xs font-black uppercase tracking-widest text-brand transition-all hover:bg-brand hover:text-white cursor-pointer shadow-xs`}
                    title="Download Autogenerated Official Letter (DOCX)"
                >
                    <Download className="h-3.5 w-3.5" />
                    Word
                </button>
                {onOpenInLetterGenerator && (
                    <>
                        <button
                            onClick={() => onOpenInLetterGenerator(request, 'ar')}
                            className={`${mobile ? 'flex-1' : ''} inline-flex items-center justify-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-[11px] font-black tracking-wider text-white transition-all hover:bg-brand cursor-pointer shadow-xs`}
                            title="Edit in Official Generator - Arabic (تعديل بالعربية)"
                        >
                            <Sparkles className="h-3.5 w-3.5 text-brand" />
                            تعديل (عربي)
                        </button>
                        <button
                            onClick={() => onOpenInLetterGenerator(request, 'en')}
                            className={`${mobile ? 'flex-1' : ''} inline-flex items-center justify-center gap-1 rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-2 text-[11px] font-black tracking-wider text-white transition-all hover:bg-brand cursor-pointer shadow-xs`}
                            title="Edit in Official Generator - English (Edit in English)"
                        >
                            <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                            Edit (EN)
                        </button>
                    </>
                )}
            </>
        )}

        {/* Dual PDF Buttons: Arabic & English */}
        <button
            onClick={() => onGeneratePdf(request, 'ar')}
            className={`${mobile ? 'flex-1' : ''} inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-600 text-red-700 hover:text-white px-2.5 py-2 text-[11px] font-black tracking-wider transition-all cursor-pointer shadow-2xs`}
            title="Letter Arabic version PDF (طباعة / حفظ PDF باللغة العربية)"
        >
            <Printer className="h-3.5 w-3.5" />
            PDF (عربي)
        </button>

        <button
            onClick={() => onGeneratePdf(request, 'en')}
            className={`${mobile ? 'flex-1' : ''} inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-900 text-slate-700 hover:text-white px-2.5 py-2 text-[11px] font-black tracking-wider transition-all cursor-pointer shadow-2xs`}
            title="Letter English version PDF (Print / Save PDF in English)"
        >
            <Printer className="h-3.5 w-3.5" />
            PDF (EN)
        </button>

        {request.status === 'Pending' && (
            <>
                <button
                    onClick={() => onUpdateStatus(request.id, 'Approved')}
                    className={`${mobile ? 'flex-1' : ''} inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-widest text-emerald-700 transition-all hover:bg-emerald-100 cursor-pointer`}
                    title="Approve"
                >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve
                </button>
                <button
                    onClick={() => onUpdateStatus(request.id, 'Rejected')}
                    className={`${mobile ? 'flex-1' : ''} inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-black uppercase tracking-widest text-rose-700 transition-all hover:bg-rose-100 cursor-pointer`}
                    title="Reject"
                >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                </button>
            </>
        )}

        {request.status === 'Approved' && (
            <button
                onClick={() => onUpdateStatus(request.id, 'Completed')}
                className={`${mobile ? 'flex-1' : ''} inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-brand cursor-pointer`}
                title="Mark completed"
            >
                <FileCheck className="h-3.5 w-3.5" />
                Complete
            </button>
        )}
    </div>
);

const DetailsGrid = ({
    request,
    onGeneratePdf,
    onOpenInLetterGenerator,
    onDownloadOfficialLetter
}: {
    request: HRRequest;
    onGeneratePdf?: (request: HRRequest, lang?: 'ar' | 'en') => void;
    onOpenInLetterGenerator?: (request: HRRequest, lang?: 'ar' | 'en') => void;
    onDownloadOfficialLetter?: (request: HRRequest, lang?: 'ar' | 'en') => void | Promise<void>;
}) => (
    <div className="space-y-4">
        {getNormalizedType(request) === 'Document' && (
            <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand shrink-0">
                            <Award className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h5 className="text-sm font-black text-slate-950 tracking-tight">
                                    الخطاب الرسمي المعتمد (Autogenerated Official HR Letter)
                                </h5>
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-brand/10 text-brand border border-brand/20">
                                    Corporate Identity
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium">
                                تم توليد الخطاب تلقائياً بالهوية المؤسسية والسجل التجاري والترخيص الطبي المعتمد
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {onDownloadOfficialLetter && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => onDownloadOfficialLetter(request, 'ar')}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand/40 bg-brand/10 hover:bg-brand text-brand hover:text-white transition-all text-xs font-black cursor-pointer shadow-2xs"
                                    title="Download Autogenerated Arabic Official DOCX"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>تحميل Word (عربي)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDownloadOfficialLetter(request, 'en')}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-900 text-slate-700 hover:text-white transition-all text-xs font-black cursor-pointer shadow-2xs"
                                    title="Download Autogenerated English Official DOCX"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download Word (EN)</span>
                                </button>
                            </>
                        )}
                        {onGeneratePdf && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => onGeneratePdf(request, 'ar')}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-600 text-red-700 hover:text-white transition-all text-xs font-black cursor-pointer shadow-2xs"
                                    title="Letter Arabic Version PDF"
                                >
                                    <Printer className="w-3.5 h-3.5 text-red-600" />
                                    <span>PDF (عربي)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onGeneratePdf(request, 'en')}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-900 text-slate-700 hover:text-white transition-all text-xs font-black cursor-pointer shadow-2xs"
                                    title="Letter English Version PDF"
                                >
                                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                                    <span>PDF (EN)</span>
                                </button>
                            </>
                        )}
                        {onOpenInLetterGenerator && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => onOpenInLetterGenerator(request, 'ar')}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-950 hover:bg-brand text-white transition-all text-xs font-black cursor-pointer shadow-sm"
                                    title="Open in Official HR Letter & Corporate Identity Generator in Arabic"
                                >
                                    <Sparkles className="w-3.5 h-3.5 text-brand" />
                                    <span>تعديل المولد (عربي)</span>
                                    <ExternalLink className="w-3 h-3 opacity-70" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onOpenInLetterGenerator(request, 'en')}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-brand text-white transition-all text-xs font-black cursor-pointer shadow-sm"
                                    title="Open in Official HR Letter & Corporate Identity Generator in English"
                                >
                                    <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                                    <span>Edit Generator (EN)</span>
                                    <ExternalLink className="w-3 h-3 opacity-70" />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">نوع المستند (Type)</span>
                        <span className="font-bold text-slate-900">{request.docTypes?.join(', ') || 'Official Certificate'}</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">السجل / الكفيل (CR Sponsor)</span>
                        <span className="font-bold text-slate-900">{request.sponsor || 'Tabarak Pharmacy Group'}</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">جواز السفر / CPR</span>
                        <span className="font-mono font-bold text-slate-900">{request.cpr} / {request.passport || '-'}</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">ترخيص نهرا / تاريخ الالتحاق</span>
                        <span className="font-mono font-bold text-slate-900">{request.license || '-'} • {request.joinDate || '-'}</span>
                    </div>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
            {getNormalizedType(request) === 'Vacation Request' ? (
                <>
                    <DetailItem label="Last Vacation" value={request.lastVacationDate} />
                    <DetailItem label="Job Title" value={request.jobTitle} />
                    <DetailItem label="Department" value={request.department} />
                    <DetailItem label="Location" value={request.location} />
                    <DetailItem label="Flight Out" value={request.flightOut} />
                    <DetailItem label="Flight Return" value={request.flightReturn} />
                    <DetailItem label="Mobile" value={request.mobile} />
                    <DetailItem label="Notes" value={request.notes} span />
                </>
            ) : (
                <>
                    <DetailItem label="Passport Name" value={request.passportName} />
                    <DetailItem label="Passport No" value={request.passport} />
                    <DetailItem label="NHRA License" value={request.license} />
                    <DetailItem label="Sponsor" value={request.sponsor} />
                    <DetailItem label="Join Date" value={request.joinDate} />
                    <DetailItem label="Delivery" value={request.deliveryMethod} />
                    <DetailItem label="Needed By" value={request.reqDate} />
                    <DetailItem label="Email" value={request.email} />
                    <DetailItem label="Salary" value={request.salary ? `${request.salary} BHD` : undefined} />
                    <DetailItem label="Purpose" value={request.docReason} span />
                </>
            )}
        </div>
    </div>
);

const DetailItem = ({ label, value, span }: { label: string; value?: string; span?: boolean }) => (
    <div className={span ? 'sm:col-span-2 xl:col-span-4' : ''}>
        <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
        <span className="font-bold text-slate-700">{value || '-'}</span>
    </div>
);

const EmptyState = () => (
    <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400">
            <Search className="h-6 w-6" />
        </div>
        <h4 className="mt-5 text-lg font-black tracking-tight text-slate-950">No HR requests found</h4>
        <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500">
            Try adjusting the search, status filter, or request type.
        </p>
    </div>
);
