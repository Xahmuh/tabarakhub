/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
    readonly VITE_APP_NAME?: string
    readonly VITE_CLIENT_NAME?: string
    readonly VITE_CLIENT_LOGO_URL?: string
    readonly VITE_PRIMARY_COLOR?: string
    readonly VITE_PRIMARY_HOVER_COLOR?: string
    readonly VITE_PRIMARY_DARK_COLOR?: string
    readonly VITE_PRIMARY_MUTED_COLOR?: string
    readonly VITE_ACCENT_COLOR?: string
    readonly VITE_SUPPORT_EMAIL?: string
    readonly VITE_DEFAULT_LOCALE?: string
    readonly VITE_CURRENCY?: string
    readonly VITE_COUNTRY?: string
    readonly VITE_ENVIRONMENT_LABEL?: string
    readonly VITE_DEMO_MODE?: string
    readonly VITE_HR_GOOGLE_SCRIPT_URL?: string
    readonly VITE_MODULE_HR?: string
    readonly VITE_MODULE_QUALITY_FEEDBACK?: string
    readonly VITE_MODULE_AI_INSIGHTS?: string
    readonly VITE_MODULE_REPORTS?: string
    readonly VITE_MODULE_EXCEL_EXPORT?: string
    readonly VITE_MODULE_BRANCH_DASHBOARD?: string
    readonly VITE_MODULE_MANAGER_DASHBOARD?: string
    readonly VITE_MODULE_ADMIN_DASHBOARD?: string
    readonly VITE_MODULE_PRODUCTS?: string
    readonly VITE_MODULE_SALES?: string
    readonly VITE_MODULE_SPIN_WIN?: string
    readonly VITE_MODULE_CASH_FLOW?: string
    readonly VITE_MODULE_CASH_TRACKER?: string
    readonly VITE_MODULE_CORPORATE_CODEX?: string
    readonly VITE_MODULE_EMPLOYEE_CONTRIBUTIONS?: string
    readonly VITE_MODULE_SETTINGS?: string
    readonly VITE_MODULE_WORKFORCE?: string
    readonly VITE_MODULE_DELIVERY?: string
    readonly [key: string]: string | undefined
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
