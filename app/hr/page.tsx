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
    UserCircle2,
    CalendarDays,
    FileText as FileTextIcon,
    Sparkles,
    Shield,
    ArrowLeft,
    Eye,
    EyeOff,
    BadgeCheck,
    Briefcase,
    Hash
} from 'lucide-react';
import { VacationRequestFlow } from './VacationRequestFlow';
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
        portal_name: "HR self-service",
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
        portal_name: "تبارك للموارد البشرية",
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
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 z-50">
                <div className="flex items-center gap-4">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                        >
                            {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                        </button>
                    )}
                    {employee.name ? (
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-gradient-to-br from-red-600 to-red-700 text-white rounded-xl flex items-center justify-center text-sm font-bold shadow-sm">
                                {employee.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-slate-900 leading-none">{employee.name}</h2>
                                <span className="text-[11px] text-slate-400 font-medium">CPR {employee.cpr}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-red-600" />
                            </div>
                            <span className="text-sm font-bold text-slate-900">{t.portal_name}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleLang}
                        className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                    >
                        <Globe className="w-3.5 h-3.5" />
                        {lang === 'en' ? 'عربي' : 'EN'}
                    </button>
                    {employee.name && onBack && (
                        <button
                            onClick={onBack}
                            className="h-8 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center gap-1.5 transition-all text-xs font-semibold"
                        >
                            <Power className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </header>

            <main className="flex-1 overflow-y-auto">
                {/* LOGIN SCREEN */}
                {!employee.name ? (
                    <div className="min-h-full flex items-center justify-center p-4 sm:p-6">
                        <div className="w-full max-w-sm">
                            {/* Login Card */}
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                {/* Card Header */}
                                <div className="bg-red-700 px-6 py-7 text-center">
                                    <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center mx-auto mb-4">
                                        <Shield className="w-6 h-6 text-white" />
                                    </div>
                                    <h2 className="text-xl font-bold text-white mb-1.5">{t.login_title}</h2>
                                    <p className="text-red-100 text-sm">{t.login_desc}</p>
                                </div>

                                {/* Card Body */}
                                <div className="p-5 sm:p-6 space-y-5">
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
                                                className={`block w-full h-12 ${isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'} bg-slate-50 border border-slate-200 rounded-xl text-base font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-all`}
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

                            <div className="mt-6 flex items-center justify-center gap-2 text-slate-400">
                                <Lock className="w-3 h-3" />
                                <span className="text-[11px] font-medium">Secure encrypted connection</span>
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
                    <div className="max-w-3xl mx-auto py-6 sm:py-8 px-4 sm:px-6">

                        {/* STEP 2: SERVICE SELECTION */}
                        {step === 2 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                {/* Greeting */}
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-1">
                                        {t.greeting}, {employee.name.split(' ')[0]} 👋
                                    </h2>
                                    <p className="text-slate-500 text-sm">{t.service_title}</p>
                                </div>

                                {/* Service Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <button
                                        onClick={() => { setSelectedService('documents'); setStep(3); }}
                                        className={`group relative p-5 bg-white rounded-xl border border-slate-200 hover:border-red-200 hover:bg-red-50/30 transition-all duration-200 ${isRtl ? 'text-right' : 'text-left'}`}
                                    >
                                        <div className="w-10 h-10 bg-red-50 text-red-700 rounded-lg flex items-center justify-center mb-4 group-hover:bg-red-700 group-hover:text-white transition-all duration-200">
                                            <FileTextIcon className="w-5 h-5" />
                                        </div>
                                        <h3 className="text-base font-bold text-slate-900 mb-1 group-hover:text-red-700 transition-colors">{t.doc_service_title}</h3>
                                        <p className="text-xs text-slate-500 leading-relaxed">{t.doc_service_desc}</p>
                                        <ArrowRight className={`absolute ${isRtl ? 'left-5' : 'right-5'} top-5 w-4 h-4 text-slate-300 group-hover:text-red-600 transition-all ${isRtl ? 'rotate-180' : ''}`} />
                                    </button>

                                    <button
                                        onClick={() => { setSelectedService('vacation'); }}
                                        className={`group relative p-5 bg-white rounded-xl border border-slate-200 hover:border-red-200 hover:bg-red-50/30 transition-all duration-200 ${isRtl ? 'text-right' : 'text-left'}`}
                                    >
                                        <div className="w-10 h-10 bg-red-50 text-red-700 rounded-lg flex items-center justify-center mb-4 group-hover:bg-red-700 group-hover:text-white transition-all duration-200">
                                            <CalendarDays className="w-5 h-5" />
                                        </div>
                                        <h3 className="text-base font-bold text-slate-900 mb-1 group-hover:text-red-700 transition-colors">{t.vac_service_title}</h3>
                                        <p className="text-xs text-slate-500 leading-relaxed">{t.vac_service_desc}</p>
                                        <ArrowRight className={`absolute ${isRtl ? 'left-5' : 'right-5'} top-5 w-4 h-4 text-slate-300 group-hover:text-red-600 transition-all ${isRtl ? 'rotate-180' : ''}`} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP INDICATOR (Documents flow) */}
                        {step > 2 && (
                            <div className="mb-6">
                                <div className="flex items-center gap-1 mb-6">
                                    <button
                                        onClick={() => { setSelectedService(null); setStep(2); }}
                                        className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors flex items-center gap-1"
                                    >
                                        {isRtl ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
                                        {isRtl ? 'القائمة' : 'Menu'}
                                    </button>
                                    <span className="text-slate-300 mx-1">/</span>
                                    <span className="text-xs text-slate-600 font-semibold">{t.doc_service_title}</span>
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
                                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                                        <h3 className="text-sm font-bold text-slate-900 mb-5 flex items-center gap-2">
                                            <UserCircle2 className="w-4 h-4 text-slate-400" />
                                            {t.step_label_1}
                                        </h3>
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
                                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                                        <h3 className="text-sm font-bold text-slate-900 mb-5 flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-slate-400" />
                                            {t.lbl_doc_type}
                                            <span className="text-red-500 text-[10px]">*</span>
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                            {['Experience Certificate', 'Employment Certificate', 'Salary Certificate', 'NOC', 'Bank Letter', 'Embassy Letter', 'Others'].map(doc => (
                                                <button
                                                    key={doc}
                                                    type="button"
                                                    onClick={() => {
                                                        const types = formData.docTypes.includes(doc)
                                                            ? formData.docTypes.filter(t => t !== doc)
                                                            : [...formData.docTypes, doc];
                                                        setFormData({ ...formData, docTypes: types });
                                                    }}
                                                    className={`px-3 py-2.5 rounded-lg border transition-all flex items-center gap-2.5 ${
                                                        formData.docTypes.includes(doc)
                                                            ? 'bg-red-50 border-red-200 text-red-700'
                                                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                                                    } ${isRtl ? 'text-right' : 'text-left'}`}
                                                >
                                                    <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                                                        formData.docTypes.includes(doc)
                                                            ? 'border-red-500 bg-red-500 text-white'
                                                            : 'border-slate-300'
                                                    }`}>
                                                        {formData.docTypes.includes(doc) && <CheckCircle2 className="w-3 h-3" />}
                                                    </div>
                                                    <span className="text-xs font-medium">{doc}</span>
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
                                    <div className="bg-white rounded-xl border border-slate-200 p-5">
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
                                    <div className="bg-white rounded-xl border border-slate-200 p-5">
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
                                    <div className="bg-white rounded-xl border border-slate-200 p-5">
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
                                    <div className="bg-white rounded-xl border border-slate-200 p-5">
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
                                                    <div key={i} className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between">
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
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900 mb-1">{t.review_title}</h2>
                                        <p className="text-sm text-slate-500">{t.review_desc}</p>
                                    </div>

                                    {/* Summary Card */}
                                    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
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
