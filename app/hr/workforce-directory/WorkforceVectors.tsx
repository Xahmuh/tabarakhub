import React from 'react';

export const VectorPharmacist: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M10.5 4.5h3v6h6v3h-6v6h-3v-6h-6v-3h6v-6z" />
  </svg>
);

export const VectorDriver: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M20 52C20 28 35 14 62 14C80 14 86 28 86 42C86 44 83 46 76 46H52C44 46 40 50 40 58C40 65 46 68 55 68H88C88 80 75 90 58 90C36 90 20 75 20 52Z"
      fill="currentColor"
    />
    <path
      d="M22 42C26 26 38 18 58 15C74 15 82 22 84 30C78 26 66 22 55 24C41 26 29 32 22 42Z"
      fill="white"
      fillOpacity="0.25"
    />
    <path
      d="M44 42C44 37 48 34 56 34H83C85 34 86 36 86 39V60C86 63 84 64 81 64H56C48 64 44 58 44 50V42Z"
      fill="#1A1D20"
    />
    <circle cx="50" cy="48" r="4" fill="#64748B" />
    <circle cx="50" cy="48" r="1.8" fill="#0F172A" />
    <rect x="68" y="38" width="3.5" height="23" rx="1.5" fill="#FFFFFF" fillOpacity="0.9" />
    <rect x="75" y="38" width="3.5" height="23" rx="1.5" fill="#FFFFFF" fillOpacity="0.9" />
  </svg>
);

export const VectorMotorcycle: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 120 75" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="28" cy="48" r="18" fill="#292D32" />
    <circle cx="28" cy="48" r="11" fill="#94A3B8" />
    <circle cx="28" cy="48" r="4" fill="#1E293B" />
    <path d="M28 37V59M17 48H39M20 40L36 56M20 56L36 40" stroke="#CBD5E1" strokeWidth="1.5" />

    <circle cx="92" cy="48" r="18" fill="#292D32" />
    <circle cx="92" cy="48" r="11" fill="#94A3B8" />
    <circle cx="92" cy="48" r="4" fill="#1E293B" />
    <path d="M92 37V59M81 48H103M84 40L100 56M84 56L100 40" stroke="#CBD5E1" strokeWidth="1.5" />

    <path d="M42 40H66L60 58H40Z" fill="#1E293B" />
    <circle cx="53" cy="48" r="4" fill="#E2E8F0" />
    <line x1="45" y1="44" x2="60" y2="44" stroke="#64748B" strokeWidth="1.5" />
    <line x1="45" y1="48" x2="58" y2="48" stroke="#64748B" strokeWidth="1.5" />
    <line x1="45" y1="52" x2="55" y2="52" stroke="#64748B" strokeWidth="1.5" />

    <rect x="28" y="45" width="22" height="6" rx="2" fill="#94A3B8" />
    <path d="M25 36L45 36L64 26L48 24Z" fill="#64748B" />
    
    <path
      d="M16 22C24 22 35 28 48 26C58 24 72 16 80 20C82 22 84 28 84 32H74L60 36C46 44 28 38 16 22Z"
      fill="currentColor"
    />
    <path d="M16 22C22 22 32 26 42 26C35 30 25 30 16 22Z" fill="#1E293B" />
    <path d="M52 20C58 18 64 17 68 19C63 21 55 22 50 21Z" fill="#FFFFFF" fillOpacity="0.5" />

    <path d="M78 18L84 20L84 32L76 32Z" fill="currentColor" />
    <path d="M80 22H84V28H80Z" fill="#38BDF8" />
    <path d="M70 10L78 18H74Z" fill="#E2E8F0" fillOpacity="0.8" />
    <path d="M76 26L92 48" stroke="#94A3B8" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M72 16L76 12M76 12H80" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="72" cy="12" r="2.5" fill="#475569" />
  </svg>
);

export const VectorDeliveryVan: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 120 70" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M14 22C14 17 18 14 23 14H66C78 14 86 21 92 28L101 36C104 39 105 42 105 46V54C105 56 103 58 101 58H14C12 58 10 56 10 54V25C10 23 12 22 14 22Z"
      fill="currentColor"
    />
    <rect x="10" y="52" width="95" height="6" fill="#1E293B" />

    <rect x="15" y="18" width="13" height="15" rx="2" fill="white" fillOpacity="0.08" />
    <rect x="30" y="18" width="24" height="24" rx="3" fill="white" fillOpacity="0.08" />
    <rect x="51" y="30" width="1.5" height="5" rx="0.5" fill="#1E293B" />

    <path d="M68 18H72C79 18 85 24 88 30L90 35H68V18Z" fill="#E2E8F0" />
    <path d="M70 20H72C77 20 83 25 86 30L88 33H70V20Z" fill="#38BDF8" fillOpacity="0.6" />
    <rect x="68" y="32" width="4" height="1.5" fill="#1E293B" />

    <path d="M96 40C101 40 103 42 103 45C103 48 100 50 96 50V40Z" fill="#FEF08A" />

    <circle cx="28" cy="54" r="10" fill="#1E293B" />
    <circle cx="28" cy="54" r="6" fill="#94A3B8" />
    <circle cx="28" cy="54" r="2" fill="#1E293B" />

    <circle cx="84" cy="54" r="10" fill="#1E293B" />
    <circle cx="84" cy="54" r="6" fill="#94A3B8" />
    <circle cx="84" cy="54" r="2" fill="#1E293B" />
  </svg>
);

export const VectorAllStaff: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
);

export const VectorWorker: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

export const VectorManagement: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
  </svg>
);

export const VectorMale: React.FC<{ className?: string }> = ({ className = "w-3 h-3" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M9.5 11c-2.48 0-4.5 2.02-4.5 4.5S7.02 20 9.5 20s4.5-2.02 4.5-4.5S11.98 11 9.5 11zm0 7c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zm10.5-14h-6v2h2.59l-3.95 3.95c.87.7 1.58 1.58 2.07 2.59L18 8.41V11h2V4z" />
  </svg>
);

export const VectorFemale: React.FC<{ className?: string }> = ({ className = "w-3 h-3" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 4c-2.76 0-5 2.24-5 5 0 2.37 1.65 4.35 3.88 4.88V16H9v2h1.88v2.5h2.24V18H15v-2h-1.88v-2.12C15.35 13.35 17 11.37 17 9c0-2.76-2.24-5-5-5zm0 8c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3z" />
  </svg>
);

export const VectorVisaInternal: React.FC<{ className?: string }> = ({ className = "w-3 h-3" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L4 6v6c0 5.25 3.4 10.15 8 11.5 4.6-1.35 8-6.25 8-11.5V6l-8-4zm-1 14.5l-3.5-3.5 1.41-1.41L11 13.67l5.09-5.09 1.41 1.41L11 16.5z" />
  </svg>
);

export const VectorVisaFlexi: React.FC<{ className?: string }> = ({ className = "w-3 h-3" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
  </svg>
);
