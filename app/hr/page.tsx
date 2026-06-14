import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
    IdCard,
    ArrowRight,
    Power,
    Globe,
    FileText,
    Mail,
    Printer,
    UploadCloud,
    CheckCircle2,
    Loader2,
    Lock,
    Trash2,
    FileCheck,
    ChevronLeft,
    ChevronRight,
    Info,
    AlertCircle,
    Clock,
    ExternalLink,
    ShieldCheck,
    Building2,
    HelpCircle,
    ChevronDown,
    Bell,
    CalendarDays,
    FileText as FileTextIcon,
    Sparkles,
    Shield,
    Eye,
    EyeOff,
    BadgeCheck,
    Briefcase,
    Hash
} from 'lucide-react';
import { VacationRequestFlow } from './VacationRequestFlow';
import { BackToModulesButton } from '../shared';
import Swal from 'sweetalert2';
import confetti from 'canvas-confetti';

// --- CONFIGURATION ---
const HR_GOOGLE_SCRIPT_URL = (import.meta.env.VITE_HR_GOOGLE_SCRIPT_URL || '').trim();
const HR_CONFIG_ERROR_MESSAGE = 'HR Google Script URL is not configured for this dedicated-client deployment.';

const getHrGoogleScriptUrl = () => {
    if (!HR_GOOGLE_SCRIPT_URL) {
        throw new Error(HR_CONFIG_ERROR_MESSAGE);
    }
    return HR_GOOGLE_SCRIPT_URL;
};

const isHrConfigError = (error: unknown) => error instanceof Error && error.message === HR_CONFIG_ERROR_MESSAGE;

const translations = {
    en: {
        portal_name: "HR Self-Service",
        service_title: "How can we help you?",
        login_title: "Welcome Back",
        login_desc: "Enter your CPR to access HR self-service portal",
        cpr_label: "CPR Number",
        btn_continue: "Verify Identity",
        btn_logout: "Sign Out",
        btn_back: "Back",
        btn_next: "Continue",
        lbl_submit: "Review Request",
        btn_confirm: "Submit Request",
        lbl_passport: "Passport Number",
        lbl_passport_name: "Full Name (as in Passport)",
        lbl_license: "NHRA License",
        lbl_sponsor: "Sponsor / Company",
        lbl_join_date: "Joining Date",
        lbl_doc_type: "Document Type",
        lbl_others: "Please specify document",
        lbl_reason: "Purpose of Document",
        lbl_reason_placeholder: "Briefly explain what you need this document for...",
        lbl_req_date: "Needed By",
        lbl_email: "Email Address",
        lbl_delivery: "Delivery Method",
        lbl_files: "Attachments",
        card_email_title: "Digital Copy (PDF)",
        card_email_desc: "Delivered to your email within 24h",
        card_print_title: "Physical Copy",
        card_print_desc: "Collect from HR office",
        step_identity: "Access",
        step_details: "Details",
        step_delivery: "Delivery",
        step_review: "Review",
        track_status: "Track My Requests",
        new_request: "New Document",
        draft_saved: "Draft Saved",
        no_requests: "No requests found",
        reference_id: "Reference",
        submitted_on: "Date",
        status_pending: "Processing",
        status_completed: "Ready",
        review_title: "Review & Confirm",
        review_desc: "Please verify all information before submitting to HR.",
        declaration: "I confirm that all information provided is accurate and complete.",
        toast_cpr_missing: "CPR is required",
        toast_cpr_not_found: "Employee record not found",
        submission_success: "Request Submitted",
        cpr_placeholder: "000000000",
        upload_limits: "Max 5MB",
        click_upload: "Upload files",
        select_placeholder: "Select an option...",
        friday_warning: "Delivery is not available on Fridays. Please select another date.",
        btn_remove: "Remove",
        greeting: "Hello",
        doc_service_title: "Document Request",
        doc_service_desc: "Certificates, letters, and official HR documents",
        vac_service_title: "Vacation Request",
        vac_service_desc: "Submit leave requests and manage your schedule",
        step_label_1: "Employee Info",
        step_label_2: "Documents",
        step_label_3: "Delivery",
    },
    ar: {
        portal_name: "الخدمات الذاتية للموظفين",
        service_title: "كيف يمكننا مساعدتك؟",
        login_title: "مرحباً بعودتك",
        login_desc: "أدخل رقمك الشخصي للوصول إلى بوابة الموارد البشرية",
        cpr_label: "الرقم الشخصي",
        btn_continue: "توثيق الهوية",
        btn_logout: "خروج",
        btn_back: "رجوع",
        btn_next: "استمرار",
        btn_submit: "مراجعة الطلب",
        btn_confirm: "إرسال الطلب",
        lbl_passport: "رقم جواز السفر",
        lbl_passport_name: "الاسم الكامل (كما في الجواز)",
        lbl_license: "ترخيص الهيئة (NHRA)",
        lbl_sponsor: "الكفيل / الشركة",
        lbl_join_date: "تاريخ الالتحاق",
        lbl_doc_type: "نوع المستند",
        lbl_others: "يرجى تحديد الوثيقة",
        lbl_reason: "الغرض من الوثيقة",
        lbl_reason_placeholder: "اشرح باختصار الغرض من هذه الوثيقة...",
        lbl_req_date: "تاريخ الاستحقاق",
        lbl_email: "البريد الإلكتروني",
        lbl_delivery: "طريقة الاستلام",
        lbl_files: "المرفقات",
        card_email_title: "نسخة إلكترونية (PDF)",
        card_email_desc: "ترسل لبريدك خلال 24 ساعة",
        card_print_title: "نسخة ورقية",
        card_print_desc: "استلام من مكتب الموارد البشرية",
        step_identity: "الدخول",
        step_details: "التفاصيل",
        step_delivery: "الاستلام",
        step_review: "المراجعة",
        track_status: "طلباتي السابقة",
        new_request: "طلب جديد",
        draft_saved: "تم حفظ المسودة",
        no_requests: "لا توجد طلبات سابقة",
        reference_id: "رقم المرجع",
        submitted_on: "التاريخ",
        status_pending: "قيد المعالجة",
        status_completed: "جاهز",
        review_title: "مراجعة وتأكيد",
        review_desc: "تأكد من صحة البيانات قبل الإرسال إلى الموارد البشرية.",
        declaration: "أؤكد أن جميع البيانات المقدمة صحيحة وكاملة.",
        toast_cpr_missing: "الرقم الشخصي مطلوب",
        toast_cpr_not_found: "سجل الموظف غير موجود",
        submission_success: "تم إرسال الطلب بنجاح",
        cpr_placeholder: "000000000",
        upload_limits: "الحد الأقصى 5 ميجا",
        select_placeholder: "اختر من القائمة...",
        friday_warning: "التسليم غير متاح أيام الجمعة. يرجى اختيار تاريخ آخر.",
        btn_remove: "حذف",
        greeting: "مرحباً",
        doc_service_title: "طلب مستند",
        doc_service_desc: "الشهادات والخطابات والمستندات الرسمية",
        vac_service_title: "طلب إجازة",
        vac_service_desc: "تقديم طلبات الإجازة وإدارة جدولك",
        step_label_1: "بيانات الموظف",
        step_label_2: "المستندات",
        step_label_3: "الاستلام",
    }
};

type Language = 'en' | 'ar';
type Step = 1 | 2 | 3 | 4 | 5;

interface HRPortalPageProps {
    onBack?: () => void;
}

// Reusable form field component
const FormField = ({ label, required, children, isRtl }: { label: string; required?: boolean; children: React.ReactNode; isRtl?: boolean }) => (
    <div className="space-y-1.5">
        <label className={`text-xs font-semibold text-slate-600 flex items-center gap-1 ${isRtl ? 'justify-end text-right' : ''}`}>
            {label}
            {required && <span className="text-red-500 text-[10px]">*</span>}
        </label>
        {children}
    </div>
);

const inputClass = "w-full h-11 bg-white border border-slate-200 focus:border-red-400 focus:ring-2 focus:ring-red-50 px-3.5 rounded-lg text-sm font-medium text-slate-900 placeholder-slate-400 outline-none transition-all";
const selectClass = "w-full h-11 bg-white border border-slate-200 focus:border-red-400 focus:ring-2 focus:ring-red-50 px-3.5 rounded-lg text-sm font-medium text-slate-900 outline-none transition-all appearance-none";

type HRIcon = React.ComponentType<{ className?: string }>;

const documentOptions: Array<{ label: string; icon: HRIcon; hint: string }> = [
    { label: 'Experience Certificate', icon: BadgeCheck, hint: 'History' },
    { label: 'Employment Certificate', icon: Briefcase, hint: 'Active job' },
    { label: 'Salary Certificate', icon: FileCheck, hint: 'Payroll' },
    { label: 'NOC', icon: ShieldCheck, hint: 'Approval' },
    { label: 'Bank Letter', icon: IdCard, hint: 'Banking' },
    { label: 'Embassy Letter', icon: Globe, hint: 'Travel' },
    { label: 'Others', icon: FileText, hint: 'Custom' },
];

const PortalMetric = ({ icon: Icon, label, value, tone = 'slate' }: { icon: HRIcon; label: string; value: string; tone?: 'red' | 'emerald' | 'sky' | 'slate' }) => {
    const toneClass = tone === 'red'
        ? 'bg-red-50 text-red-700 border-red-100'
        : tone === 'emerald'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
            : tone === 'sky'
                ? 'bg-sky-50 text-sky-700 border-sky-100'
                : 'bg-slate-50 text-slate-700 border-slate-200';

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg border ${toneClass}`}>
                <Icon className="h-4 w-4" />
            </div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div>
            <div className="mt-1 text-sm font-bold text-slate-900">{value}</div>
        </div>
    );
};

const ServiceLauncherCard = ({
    icon: Icon,
    title,
    description,
    badge,
    meta,
    tone,
    isRtl,
    onClick
}: {
    icon: HRIcon;
    title: string;
    description: string;
    badge: string;
    meta: string;
    tone: 'red' | 'sky';
    isRtl: boolean;
    onClick: () => void;
}) => {
    const accent = tone === 'red'
        ? 'bg-red-50 text-red-700 border-red-100 group-hover:bg-red-700 group-hover:text-white group-hover:border-red-700'
        : 'bg-sky-50 text-sky-700 border-sky-100 group-hover:bg-sky-700 group-hover:text-white group-hover:border-sky-700';
    const badgeClass = tone === 'red'
        ? 'bg-red-50 text-red-700 border-red-100'
        : 'bg-sky-50 text-sky-700 border-sky-100';

    return (
        <button
            type="button"
            onClick={onClick}
            className={`group relative overflow-hidden rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg ${isRtl ? 'text-right' : 'text-left'}`}
        >
            <div className="flex items-start justify-between gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border transition-all ${accent}`}>
                    <Icon className="h-5 w-5" />
                </div>
                <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${badgeClass}`}>{badge}</span>
            </div>
            <div className="mt-5">
                <h3 className="text-lg font-bold text-slate-950">{title}</h3>
                <p className="mt-1.5 min-h-[36px] text-sm leading-6 text-slate-500">{description}</p>
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-xs font-semibold text-slate-400">{meta}</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400 transition-all group-hover:bg-slate-900 group-hover:text-white">
                    <ArrowRight className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
                </span>
            </div>
        </button>
    );
};

const ModulePageTitle = ({
    eyebrow,
    title,
    description,
    isRtl,
    children
}: {
    eyebrow: string;
    title: string;
    description: string;
    isRtl: boolean;
    children?: React.ReactNode;
}) => (
    <div className={`flex flex-col gap-4 md:flex-row md:items-center md:justify-between ${isRtl ? 'text-right' : 'text-left'}`}>
        <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">{eyebrow}</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{title}</h2>
            <p className="mt-1 text-sm font-medium leading-6 text-slate-500">{description}</p>
        </div>
        {children}
    </div>
);

export const HRPortalPage: React.FC<HRPortalPageProps> = ({ onBack }) => {
    const [lang, setLang] = useState<Language>('en');
    const [step, setStep] = useState<Step>(1);
    const [selectedService, setSelectedService] = useState<'documents' | 'vacation' | null>(null);
    const [cpr, setCpr] = useState('');
    const [employee, setEmployee] = useState({ name: '', cpr: '', role: 'Employee' });
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [declared, setDeclared] = useState(false);

    const [formData, setFormData] = useState({
        passport: '',
        passportName: '',
        license: '',
        sponsor: '',
        joinDate: '',
        salary: '',
        docTypes: [] as string[],
        otherDocType: '',
        docReason: '',
        reason: '',
        reqDate: '',
        email: '',
        delivery: ''
    });
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

    const t = translations[lang];
    const isRtl = lang === 'ar';
    const firstName = employee.name.split(/\s+/).filter(Boolean)[0] || employee.name;
    const documentProgress = step <= 2 ? 0 : step === 3 ? 34 : step === 4 ? 67 : 100;
    const selectedDocumentText = isRtl
        ? formData.docTypes.length === 1
            ? 'مستند واحد'
            : `${formData.docTypes.length} مستندات`
        : formData.docTypes.length === 1
            ? '1 selected'
            : `${formData.docTypes.length} selected`;

    useEffect(() => {
        const saved = localStorage.getItem('hr_doc_draft');
        if (saved) {
            try { setFormData(JSON.parse(saved)); } catch (e) { }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('hr_doc_draft', JSON.stringify(formData));
    }, [formData]);

    const toggleLang = () => setLang(l => l === 'en' ? 'ar' : 'en');
    const showToast = (msg: string, icon: 'success' | 'error' | 'warning') => {
        Swal.fire({ toast: true, position: 'top-end', icon, title: msg, showConfirmButton: false, timer: 3000 });
    };

    const handleLogin = async () => {
        if (!cpr.trim()) {
            showToast(t.toast_cpr_missing, 'warning');
            return;
        }
        setIsAuthenticating(true);
        try {
            const response = await fetch(getHrGoogleScriptUrl(), {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: "login", cpr: cpr.trim() })
            });
            const result = await response.json();
            if (result.result === "success") {
                setEmployee({ name: result.name, cpr: cpr.trim(), role: 'Employee' });
                setStep(2);
            } else {
                throw new Error("No record");
            }
        } catch (error) {
            showToast(isHrConfigError(error) ? HR_CONFIG_ERROR_MESSAGE : t.toast_cpr_not_found, 'error');
        } finally {
            setIsAuthenticating(false);
        }
    };

    const isFriday = (dateStr: string) => {
        if (!dateStr) return false;
        const date = new Date(dateStr);
        return date.getDay() === 5;
    };

    const finalSubmit = async () => {
        if (!declared) {
            showToast(isRtl ? "يرجى تأكيد الإقرار" : "Please confirm declaration", 'warning');
            return;
        }
        if (isFriday(formData.reqDate)) {
            showToast(t.friday_warning, 'error');
            return;
        }

        setIsSubmitting(true);
        const refNum = 'DOC-' + Math.floor(100000 + Math.random() * 900000);
        try {
            const attachments = await Promise.all(uploadedFiles.map(async (file) => {
                const base64 = await toBase64(file);
                return { filename: file.name, content: base64.split(",")[1], mimeType: file.type };
            }));

            const finalDocTypes = formData.docTypes.map(d => d === 'Others' ? `Other: ${formData.otherDocType}` : d);

            const payload = {
                action: "submit",
                "Name of Employee": employee.name,
                "CPR Number": employee.cpr,
                "Passport Number": formData.passport,
                "Passport Name": formData.passportName,
                "NHRA License Number": formData.license,
                "Name of Sponsor": formData.sponsor,
                "Joining Date": formData.joinDate,
                "Type of Document": finalDocTypes.join(", "),
                "Salary": formData.salary,
                "Purpose of Document": formData.docReason,
                "Internal Reason": formData.reason,
                "Desired Date": formData.reqDate,
                "Employee Email": formData.email,
                "Preferred Delivery Method": formData.delivery,
                referenceNumber: refNum,
                attachments
            };
            const response = await fetch(getHrGoogleScriptUrl(), {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.result === "success") {
                await supabase.hrRequests.create({
                    refNum,
                    employeeName: employee.name,
                    cpr: employee.cpr,
                    passport: formData.passport,
                    passportName: formData.passportName,
                    license: formData.license,
                    sponsor: formData.sponsor,
                    joinDate: formData.joinDate,
                    salary: formData.salary,
                    docTypes: formData.docTypes,
                    docReason: formData.docReason,
                    reqDate: formData.reqDate,
                    email: formData.email,
                    deliveryMethod: formData.delivery,
                    otherDocType: formData.otherDocType
                });
                localStorage.removeItem('hr_doc_draft');
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#b91c1c', '#ffffff'] });
                Swal.fire({
                    icon: 'success',
                    title: t.submission_success,
                    html: `<div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl mt-4"><p class="text-[10px] font-semibold uppercase text-slate-400 mb-1">${t.reference_id}</p><h2 class="text-2xl font-bold text-slate-900 font-mono">${refNum}</h2></div>`,
                    confirmButtonColor: '#b91c1c',
                    confirmButtonText: isRtl ? 'تم' : 'Done'
                }).then(() => {
                    if (onBack) onBack(); else window.location.reload();
                });
            } else { throw new Error("Failed"); }
        } catch (error) {
            showToast(isHrConfigError(error) ? HR_CONFIG_ERROR_MESSAGE : "Submission Failed", 'error');
        }
        finally { setIsSubmitting(false); }
    };

    const toBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const stepLabels = [
        { num: 1, label: t.step_label_1 },
        { num: 2, label: t.step_label_2 },
        { num: 3, label: t.step_label_3 },
    ];

    return (
        <div className={`flex flex-col h-full bg-slate-50 overflow-hidden ${isRtl ? 'font-arabic' : 'font-sans'}`} dir={isRtl ? 'rtl' : 'ltr'}>

            {/* HEADER */}
            <header className="h-[68px] shrink-0 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8 z-50">
                <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                    {onBack && <BackToModulesButton onClick={onBack} />}
                    {employee.name ? (
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-sm font-bold text-white shadow-sm">
                                {employee.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h2 className="truncate text-sm font-bold leading-none text-slate-900">{employee.name}</h2>
                                    <span className="hidden rounded-md border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-700 sm:inline-flex">Verified</span>
                                </div>
                                <span className="text-[11px] font-medium text-slate-400">CPR {employee.cpr}</span>
                            </div>
                        </div>
                    ) : null}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleLang}
                        className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900"
                    >
                        <Globe className="w-3.5 h-3.5" />
                        {lang === 'en' ? 'عربي' : 'EN'}
                    </button>
                    {employee.name && onBack && (
                        <button
                            onClick={onBack}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600 transition-all hover:bg-red-100"
                            aria-label={t.btn_logout}
                            title={t.btn_logout}
                        >
                            <Power className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto">
                {/* LOGIN SCREEN */}
                {!employee.name ? (
                    <div className="flex min-h-full items-center justify-center px-4 py-8 sm:px-6">
                        <div className="grid w-full max-w-5xl gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                            <section className="hidden rounded-lg border border-slate-800 bg-slate-950 p-8 text-white shadow-xl shadow-slate-200/70 lg:flex lg:flex-col lg:justify-between">
                                <div>
                                    <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-lg bg-white text-red-700">
                                        <Building2 className="h-6 w-6" />
                                    </div>
                                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/45">{isRtl ? 'وحدة الموارد البشرية' : 'People module'}</p>
                                    <h1 className="mt-3 max-w-md text-3xl font-black leading-tight text-white">{t.portal_name}</h1>
                                    <p className="mt-4 max-w-md text-sm leading-6 text-white/60">{isRtl ? 'ادخل بالرقم الشخصي لطلب مستندات الموارد البشرية أو تقديم طلب إجازة من نفس المكان.' : 'Use your CPR to request HR documents or submit vacation requests from one focused workspace.'}</p>
                                </div>
                                <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-6">
                                    <div>
                                        <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white">
                                            <FileTextIcon className="h-4 w-4" />
                                        </div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Documents</p>
                                    </div>
                                    <div>
                                        <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white">
                                            <CalendarDays className="h-4 w-4" />
                                        </div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Vacation</p>
                                    </div>
                                    <div>
                                        <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white">
                                            <ShieldCheck className="h-4 w-4" />
                                        </div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Verified</p>
                                    </div>
                                </div>
                            </section>

                            <div className="mx-auto w-full max-w-md lg:max-w-none">
                                <div className="mb-4 lg:hidden">
                                    <ModulePageTitle
                                        eyebrow={isRtl ? 'وحدة الموارد البشرية' : 'People module'}
                                        title={t.portal_name}
                                        description={isRtl ? 'بوابة الموظفين للخدمات اليومية.' : 'One desk for employee requests.'}
                                        isRtl={isRtl}
                                    />
                                </div>
                                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                                    <div className="border-b border-slate-100 p-6 text-center">
                                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-red-50 text-red-700">
                                            <Shield className="h-6 w-6" />
                                        </div>
                                        <h2 className="text-xl font-bold text-slate-950">{t.login_title}</h2>
                                        <p className="mt-1.5 text-sm leading-6 text-slate-500">{t.login_desc}</p>
                                    </div>

                                    <div className="space-y-5 p-5 sm:p-6">
                                    <div className="space-y-2">
                                        <label htmlFor="cpr-input" className={`text-xs font-semibold text-slate-600 block ${isRtl ? 'text-right' : ''}`}>{t.cpr_label}</label>
                                        <div className="relative">
                                            <div className={`absolute inset-y-0 ${isRtl ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center pointer-events-none`}>
                                                <Hash className="h-4 w-4 text-slate-400" />
                                            </div>
                                            <input
                                                id="cpr-input"
                                                type="text"
                                                value={cpr}
                                                onChange={(e) => setCpr(e.target.value.replace(/\D/g, '').slice(0, 9))}
                                                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                                                className={`block w-full h-12 ${isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'} bg-slate-50 border border-slate-200 rounded-lg text-base font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-all`}
                                                placeholder="901234567"
                                                title={t.cpr_label}
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleLogin}
                                        disabled={isAuthenticating || !cpr.trim()}
                                        className="w-full h-11 bg-red-700 text-white rounded-lg font-semibold text-sm hover:bg-red-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {isAuthenticating ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                            <>
                                                <span>{t.btn_continue}</span>
                                                <ArrowRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                                <div className="mt-5 flex items-center justify-center gap-2 text-slate-400">
                                    <Lock className="w-3 h-3" />
                                    <span className="text-[11px] font-medium">Secure encrypted connection</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : selectedService === 'vacation' ? (
                    <div className="h-full overflow-y-auto">
                        <VacationRequestFlow
                            employee={employee}
                            lang={lang}
                            onBack={() => { setSelectedService(null); setStep(2); }}
                            onComplete={() => window.location.reload()}
                        />
                    </div>
                ) : (
                    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">

                        {/* STEP 2: SERVICE SELECTION */}
                        {step === 2 && (
                            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <ModulePageTitle
                                    eyebrow={isRtl ? 'وحدة الموارد البشرية' : 'People module'}
                                    title={t.portal_name}
                                    description={`${t.greeting}, ${firstName}. ${t.service_title}`}
                                    isRtl={isRtl}
                                />

                                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                        <div>
                                            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                                                <ShieldCheck className="h-3.5 w-3.5" />
                                                {isRtl ? 'تم التحقق' : 'Verified access'}
                                            </div>
                                            <h3 className="text-lg font-black text-slate-950">{isRtl ? 'مساحة الموظف جاهزة' : 'Employee workspace is ready'}</h3>
                                            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{isRtl ? 'اختر نوع الطلب وسيتم حفظه بنفس مسار الموافقات الحالي.' : 'Choose the request type and continue through the existing HR approval flow.'}</p>
                                        </div>
                                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                                            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">CPR</div>
                                            <div className="mt-1 font-mono text-sm font-bold text-slate-900">{employee.cpr}</div>
                                        </div>
                                    </div>
                                </section>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <PortalMetric icon={BadgeCheck} label={isRtl ? 'الهوية' : 'Identity'} value={isRtl ? 'جاهزة' : 'Ready'} tone="emerald" />
                                    <PortalMetric icon={Clock} label={isRtl ? 'المستندات' : 'Documents'} value={isRtl ? 'خلال 24 ساعة' : 'Within 24h'} tone="red" />
                                    <PortalMetric icon={Bell} label={isRtl ? 'الحالة' : 'Status'} value={isRtl ? 'تحديثات مباشرة' : 'Live updates'} tone="sky" />
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <ServiceLauncherCard
                                        icon={FileTextIcon}
                                        title={t.doc_service_title}
                                        description={t.doc_service_desc}
                                        badge={isRtl ? 'مستندات' : 'Docs'}
                                        meta={isRtl ? 'اختيار المستند ثم طريقة الاستلام' : 'Choose documents, delivery, review'}
                                        tone="red"
                                        isRtl={isRtl}
                                        onClick={() => { setSelectedService('documents'); setStep(3); }}
                                    />
                                    <ServiceLauncherCard
                                        icon={CalendarDays}
                                        title={t.vac_service_title}
                                        description={t.vac_service_desc}
                                        badge={isRtl ? 'إجازات' : 'Leave'}
                                        meta={isRtl ? 'السياسة ثم الطلب والتوقيع' : 'Policy, request, signature'}
                                        tone="sky"
                                        isRtl={isRtl}
                                        onClick={() => { setSelectedService('vacation'); }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* STEP INDICATOR (Documents flow) */}
                        {step > 2 && (
                            <div className="mb-6">
                                <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{t.doc_service_title}</div>
                                            <h2 className="mt-1 text-lg font-black text-slate-950">{step === 3 ? t.step_label_1 : step === 4 ? t.step_label_3 : t.review_title}</h2>
                                        </div>
                                        <span className="inline-flex w-fit items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                            <FileTextIcon className="h-3.5 w-3.5" />
                                            {selectedDocumentText}
                                        </span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                        <div className="h-full rounded-full bg-red-700 transition-all duration-500" style={{ width: `${documentProgress}%` }} />
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 mb-6">
                                    <button
                                        onClick={() => { setSelectedService(null); setStep(2); }}
                                        className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors flex items-center gap-1"
                                    >
                                        {isRtl ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
                                        {isRtl ? 'القائمة' : 'Menu'}
                                    </button>
                                </div>

                                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                                    {stepLabels.map((s, idx) => (
                                        <React.Fragment key={s.num}>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                                                    step >= s.num + 2
                                                        ? step > s.num + 2
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-red-600 text-white'
                                                        : 'bg-slate-100 text-slate-400'
                                                }`}>
                                                    {step > s.num + 2 ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                                                </div>
                                                <span className={`text-xs font-medium hidden sm:block ${step >= s.num + 2 ? 'text-slate-700' : 'text-slate-400'}`}>{s.label}</span>
                                            </div>
                                            {idx < stepLabels.length - 1 && <div className={`flex-1 h-px ${step > s.num + 2 ? 'bg-emerald-300' : 'bg-slate-200'}`}></div>}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        )}

                        <form className="space-y-5">
                            {/* STEP 3: EMPLOYEE INFO & DOCUMENTS */}
                            {step === 3 && (
                                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    {/* Employee Info Section */}
                                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <FormField label={t.lbl_passport_name} required isRtl={isRtl}>
                                                <input
                                                    value={formData.passportName}
                                                    onChange={e => setFormData({ ...formData, passportName: e.target.value })}
                                                    className={inputClass}
                                                    placeholder="MOHAMED AHMED"
                                                />
                                            </FormField>
                                            <FormField label={t.lbl_passport} required isRtl={isRtl}>
                                                <input
                                                    value={formData.passport}
                                                    onChange={e => setFormData({ ...formData, passport: e.target.value })}
                                                    className={inputClass}
                                                />
                                            </FormField>
                                            <FormField label={t.lbl_license} required isRtl={isRtl}>
                                                <input
                                                    value={formData.license}
                                                    onChange={e => setFormData({ ...formData, license: e.target.value })}
                                                    className={inputClass}
                                                />
                                            </FormField>
                                            <FormField label={t.lbl_sponsor} required isRtl={isRtl}>
                                                <div className="relative">
                                                    <select
                                                        value={formData.sponsor}
                                                        onChange={e => setFormData({ ...formData, sponsor: e.target.value })}
                                                        className={selectClass}
                                                    >
                                                        <option value="">{t.select_placeholder}</option>
                                                        <option value="TABARAK PHARMACY WLL">TABARAK PHARMACY WLL</option>
                                                        <option value="ALHODA PHARMACY WLL">ALHODA PHARMACY WLL</option>
                                                        <option value="SANAD PHARMACY WLL">SANAD PHARMACY WLL</option>
                                                        <option value="DISTRICT PHARMACY WLL">DISTRICT PHARMACY WLL</option>
                                                        <option value="ALNAHAR PHARMACY WLL">ALNAHAR PHARMACY WLL</option>
                                                        <option value="DAMISTAN PHARMACY WLL">DAMISTAN PHARMACY WLL</option>
                                                        <option value="JANABIYA SQUARE PHARMACY WLL">JANABIYA SQUARE PHARMACY WLL</option>
                                                        <option value="JAMILA PHARMACY WLL">JAMILA PHARMACY WLL</option>
                                                        <option value="SANAD 2 PHARMACY WLL">SANAD 2 PHARMACY WLL</option>
                                                    </select>
                                                    <ChevronDown className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none`} />
                                                </div>
                                            </FormField>
                                            <FormField label={t.lbl_join_date} required isRtl={isRtl}>
                                                <input
                                                    type="date"
                                                    value={formData.joinDate}
                                                    onChange={e => setFormData({ ...formData, joinDate: e.target.value })}
                                                    className={inputClass}
                                                />
                                            </FormField>
                                        </div>
                                    </div>

                                    {/* Document Selection Section */}
                                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                        <h3 className="text-sm font-bold text-slate-900 mb-5 flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-slate-400" />
                                            {t.lbl_doc_type}
                                            <span className="text-red-500 text-[10px]">*</span>
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                            {documentOptions.map(({ label: doc, icon: DocIcon, hint }) => (
                                                <button
                                                    key={doc}
                                                    type="button"
                                                    onClick={() => {
                                                        const types = formData.docTypes.includes(doc)
                                                            ? formData.docTypes.filter(t => t !== doc)
                                                            : [...formData.docTypes, doc];
                                                        setFormData({ ...formData, docTypes: types });
                                                    }}
                                                    className={`min-h-[76px] rounded-lg border p-3 transition-all flex items-start gap-3 ${
                                                        formData.docTypes.includes(doc)
                                                            ? 'bg-red-50 border-red-200 text-red-700 shadow-sm'
                                                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                                    } ${isRtl ? 'text-right' : 'text-left'}`}
                                                >
                                                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all ${
                                                        formData.docTypes.includes(doc)
                                                            ? 'border-red-600 bg-red-600 text-white'
                                                            : 'border-slate-200 bg-slate-50 text-slate-400'
                                                    }`}>
                                                        {formData.docTypes.includes(doc) ? <CheckCircle2 className="w-4 h-4" /> : <DocIcon className="w-4 h-4" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="block text-xs font-bold leading-5">{doc}</span>
                                                        <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{hint}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>

                                        {formData.docTypes.includes('Salary Certificate') && (
                                            <div className="mt-5 animate-in fade-in duration-300">
                                                <FormField label={isRtl ? "الراتب الشهري (د.ب)" : "Monthly Salary (BHD)"} required isRtl={isRtl}>
                                                    <input
                                                        type="number"
                                                        value={formData.salary}
                                                        onChange={e => setFormData({ ...formData, salary: e.target.value })}
                                                        className={inputClass}
                                                        placeholder="500"
                                                    />
                                                </FormField>
                                            </div>
                                        )}

                                        {formData.docTypes.includes('Others') && (
                                            <div className="mt-5 animate-in fade-in duration-300">
                                                <FormField label={t.lbl_others} required isRtl={isRtl}>
                                                    <input
                                                        value={formData.otherDocType}
                                                        onChange={e => setFormData({ ...formData, otherDocType: e.target.value })}
                                                        className={inputClass}
                                                        placeholder="..."
                                                    />
                                                </FormField>
                                            </div>
                                        )}
                                    </div>

                                    {/* Purpose */}
                                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                        <FormField label={t.lbl_reason} isRtl={isRtl}>
                                            <textarea
                                                value={formData.docReason}
                                                onChange={e => setFormData({ ...formData, docReason: e.target.value })}
                                                className="w-full h-24 bg-white border border-slate-200 focus:border-red-400 focus:ring-2 focus:ring-red-50 p-3.5 rounded-lg text-sm font-medium text-slate-900 placeholder-slate-400 outline-none transition-all resize-none"
                                                placeholder={t.lbl_reason_placeholder}
                                            />
                                        </FormField>
                                    </div>

                                    {/* Navigation */}
                                    <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => { setSelectedService(null); setStep(2); }}
                                            className="h-11 px-6 rounded-lg font-semibold text-sm text-slate-600 hover:bg-white hover:text-slate-700 border border-slate-200 sm:border-transparent sm:hover:border-slate-200 transition-all"
                                        >
                                            {t.btn_back}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!formData.passportName || !formData.passport || !formData.license || !formData.sponsor || !formData.joinDate || formData.docTypes.length === 0) {
                                                    showToast(isRtl ? "يرجى تعبئة جميع الحقول المطلوبة" : "Please fill all required fields", 'warning');
                                                    return;
                                                }
                                                if (formData.docTypes.includes('Others') && !formData.otherDocType) {
                                                    showToast(isRtl ? "يرجى تحديد نوع الوثيقة" : "Please specify document type", 'warning');
                                                    return;
                                                }
                                                if (formData.docTypes.includes('Salary Certificate') && !formData.salary) {
                                                    showToast(isRtl ? "يرجى إدخال الراتب" : "Please enter salary", 'warning');
                                                    return;
                                                }
                                                setStep(4);
                                            }}
                                            className="h-11 px-8 bg-red-700 text-white rounded-lg font-semibold text-sm hover:bg-red-800 transition-all flex items-center justify-center gap-2"
                                        >
                                            <span>{t.btn_next}</span>
                                            <ChevronRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* STEP 4: DELIVERY DETAILS */}
                            {step === 4 && (
                                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    {/* Date & Email */}
                                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <FormField label={t.lbl_req_date} required isRtl={isRtl}>
                                                <input
                                                    type="date"
                                                    min={new Date().toISOString().split('T')[0]}
                                                    value={formData.reqDate}
                                                    onChange={e => {
                                                        if (isFriday(e.target.value)) showToast(t.friday_warning, 'warning');
                                                        setFormData({ ...formData, reqDate: e.target.value });
                                                    }}
                                                    className={`${inputClass} ${isFriday(formData.reqDate) ? '!border-rose-400 !ring-2 !ring-rose-50' : ''}`}
                                                />
                                            </FormField>
                                            <FormField label={t.lbl_email} required isRtl={isRtl}>
                                                <input
                                                    type="email"
                                                    value={formData.email}
                                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                    className={inputClass}
                                                    placeholder="name@company.com"
                                                />
                                            </FormField>
                                        </div>
                                    </div>

                                    {/* Delivery Method */}
                                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                        <h3 className="text-sm font-bold text-slate-900 mb-4">{t.lbl_delivery} <span className="text-red-500 text-[10px]">*</span></h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, delivery: 'PDF by Email' })}
                                                className={`p-4 rounded-lg border transition-all flex items-center gap-4 ${
                                                    formData.delivery === 'PDF by Email'
                                                        ? 'border-red-300 bg-red-50/50'
                                                        : 'border-slate-200 hover:border-slate-300'
                                                } ${isRtl ? 'text-right' : 'text-left'}`}
                                            >
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                                                    formData.delivery === 'PDF by Email' ? 'bg-red-700 text-white' : 'bg-slate-100 text-slate-400'
                                                }`}>
                                                    <Mail className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-slate-900 text-sm">{t.card_email_title}</h4>
                                                    <p className="text-xs text-slate-500">{t.card_email_desc}</p>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, delivery: 'Printed Copy' })}
                                                className={`p-4 rounded-lg border transition-all flex items-center gap-4 ${
                                                    formData.delivery === 'Printed Copy'
                                                        ? 'border-red-300 bg-red-50/50'
                                                        : 'border-slate-200 hover:border-slate-300'
                                                } ${isRtl ? 'text-right' : 'text-left'}`}
                                            >
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                                                    formData.delivery === 'Printed Copy' ? 'bg-red-700 text-white' : 'bg-slate-100 text-slate-400'
                                                }`}>
                                                    <Printer className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-slate-900 text-sm">{t.card_print_title}</h4>
                                                    <p className="text-xs text-slate-500">{t.card_print_desc}</p>
                                                </div>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Attachments */}
                                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                        <h3 className="text-sm font-bold text-slate-900 mb-4">{t.lbl_files} <span className="text-xs text-slate-400 font-normal">({isRtl ? 'اختياري' : 'Optional'})</span></h3>
                                        <div
                                            onClick={() => document.getElementById('final-files-refined')?.click()}
                                            className="border border-dashed border-slate-300 rounded-lg py-6 flex flex-col items-center justify-center bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400 transition-all cursor-pointer group"
                                        >
                                            <UploadCloud className="w-8 h-8 text-slate-300 group-hover:text-slate-400 mb-2 transition-colors" />
                                            <p className="text-sm font-medium text-slate-500">{t.click_upload}</p>
                                            <p className="text-[10px] text-slate-400 mt-1">PDF, PNG, JPG ({t.upload_limits})</p>
                                            <input id="final-files-refined" type="file" multiple className="hidden" onChange={e => { if (e.target.files) setUploadedFiles([...uploadedFiles, ...Array.from(e.target.files)]); }} />
                                        </div>
                                        {uploadedFiles.length > 0 && (
                                            <div className="space-y-2 mt-3">
                                                {uploadedFiles.map((f, i) => (
                                                    <div key={i} className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex items-center justify-between">
                                                        <div className="flex items-center gap-3 truncate">
                                                            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                                                            <span className="text-xs font-medium text-slate-700 truncate">{f.name}</span>
                                                            <span className="text-[10px] text-slate-400 shrink-0">{(f.size / 1024).toFixed(0)}KB</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setUploadedFiles(uploadedFiles.filter((_, idx) => idx !== i))}
                                                            className="text-slate-400 hover:text-rose-500 p-1 rounded-lg transition-all"
                                                            aria-label={t.btn_remove}
                                                            title={t.btn_remove}
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Navigation */}
                                    <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setStep(3)}
                                            className="h-11 px-6 rounded-lg font-semibold text-sm text-slate-600 hover:bg-white hover:text-slate-700 border border-slate-200 sm:border-transparent sm:hover:border-slate-200 transition-all"
                                        >
                                            {t.btn_back}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!formData.reqDate || !formData.email || !formData.delivery) {
                                                    showToast(isRtl ? "يرجى تعبئة جميع الحقول المطلوبة" : "Please fill all required fields", 'warning');
                                                    return;
                                                }
                                                setStep(5);
                                            }}
                                            className="h-11 px-8 bg-red-700 text-white rounded-lg font-semibold text-sm hover:bg-red-800 transition-all flex items-center justify-center gap-2"
                                        >
                                            <span>{t.step_review}</span>
                                            <ChevronRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* STEP 5: REVIEW & CONFIRM */}
                            {step === 5 && (
                                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <p className="text-sm text-slate-500">{t.review_desc}</p>

                                    {/* Summary Card */}
                                    <div className="rounded-lg border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
                                        {/* Employee Info */}
                                        <div className="p-6">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">{t.step_label_1}</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <ReviewItem label={t.lbl_passport_name} value={formData.passportName} />
                                                <ReviewItem label={t.lbl_passport} value={formData.passport} />
                                                <ReviewItem label={t.lbl_license} value={formData.license} />
                                                <ReviewItem label={t.lbl_sponsor} value={formData.sponsor} />
                                                <ReviewItem label={t.lbl_join_date} value={formData.joinDate} />
                                            </div>
                                        </div>

                                        {/* Documents */}
                                        <div className="p-6">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">{t.lbl_doc_type}</h4>
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                {formData.docTypes.map(d => (
                                                    <span key={d} className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-semibold border border-red-100">
                                                        {d === 'Others' ? formData.otherDocType : d}
                                                    </span>
                                                ))}
                                            </div>
                                            {formData.docReason && (
                                                <p className="text-sm text-slate-600 italic">"{formData.docReason}"</p>
                                            )}
                                            {formData.salary && (
                                                <div className="mt-2">
                                                    <ReviewItem label={isRtl ? "الراتب" : "Salary"} value={`${formData.salary} BHD`} />
                                                </div>
                                            )}
                                        </div>

                                        {/* Delivery */}
                                        <div className="p-6">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">{t.step_delivery}</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <ReviewItem label={t.lbl_delivery} value={formData.delivery} />
                                                <ReviewItem label={t.lbl_req_date} value={formData.reqDate} />
                                                <ReviewItem label={t.lbl_email} value={formData.email} />
                                            </div>
                                            {uploadedFiles.length > 0 && (
                                                <div className="mt-3">
                                                    <span className="text-[10px] font-semibold text-slate-400">{t.lbl_files}: {uploadedFiles.length} file(s)</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Declaration */}
                                    <div
                                        className={`p-4 rounded-lg border transition-all flex items-start gap-4 cursor-pointer ${
                                            declared ? 'bg-emerald-50/50 border-emerald-300' : 'bg-white border-slate-200 hover:border-slate-300'
                                        }`}
                                        onClick={() => setDeclared(!declared)}
                                    >
                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                                            declared ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-300'
                                        }`}>
                                            <CheckCircle2 className="w-4 h-4" />
                                        </div>
                                        <p className={`text-sm font-medium ${declared ? 'text-emerald-800' : 'text-slate-600'}`}>{t.declaration}</p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setStep(4)}
                                            className="h-11 px-6 rounded-lg font-semibold text-sm text-slate-600 hover:bg-white hover:text-slate-700 border border-slate-200 sm:border-transparent sm:hover:border-slate-200 transition-all"
                                        >
                                            {t.btn_back}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={finalSubmit}
                                            disabled={isSubmitting || !declared || isFriday(formData.reqDate)}
                                            className="h-11 px-8 bg-red-700 text-white rounded-lg font-bold text-sm hover:bg-red-800 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                                            <span>{t.btn_confirm}</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </form>
                    </div>
                )}
            </main>
        </div>
    );
};

// Review helper
const ReviewItem = ({ label, value }: { label: string; value: string }) => (
    <div>
        <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">{label}</span>
        <span className="text-sm font-semibold text-slate-900">{value || '—'}</span>
    </div>
);
