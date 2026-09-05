import React from 'react';

export type EmployeeRoleCategory = 'all' | 'pharmacist' | 'driver' | 'worker' | 'management';

export interface EmployeeRoleAvatarProps {
  role?: EmployeeRoleCategory | string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBadge?: boolean;
}

const sizeClasses: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', { box: string; svg: string; text: string }> = {
  xs: { box: 'w-4 h-4', svg: 'w-3 h-3', text: 'text-[8px]' },
  sm: { box: 'w-5 h-5', svg: 'w-4 h-4', text: 'text-[9px]' },
  md: { box: 'w-7 h-7', svg: 'w-5 h-5', text: 'text-[11px]' },
  lg: { box: 'w-9 h-9', svg: 'w-7 h-7', text: 'text-xs' },
  xl: { box: 'w-12 h-12', svg: 'w-9 h-9', text: 'text-sm' }
};

/**
 * 1. ALL STAFF AVATAR (Vector Flat-2)
 * Clean team/multi-avatar vector illustration
 */
export const AllStaffAvatar: React.FC<{ className?: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' }> = ({
  className = '',
  size = 'md'
}) => {
  const s = sizeClasses[size];
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-slate-900 text-white shadow-2xs ${s.box} ${className}`}
      title="All Staff"
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${s.svg} overflow-visible`}
      >
        {/* Background team shadow */}
        <circle cx="10" cy="11" r="5" fill="#94A3B8" />
        <path
          d="M3 26C3 21.5 6.5 18 11 18C12.8 18 14.5 18.6 15.8 19.6C14.1 21.2 13 23.5 13 26H3Z"
          fill="#64748B"
        />

        {/* Third team shadow on right */}
        <circle cx="22" cy="11" r="5" fill="#94A3B8" />
        <path
          d="M29 26C29 21.5 25.5 18 21 18C19.2 18 17.5 18.6 16.2 19.6C17.9 21.2 19 23.5 19 26H29Z"
          fill="#64748B"
        />

        {/* Center Primary Member */}
        <circle cx="16" cy="10" r="6" fill="#F8FAFC" />
        <path
          d="M7 27C7 22.0294 11.0294 18 16 18C20.9706 18 25 22.0294 25 27H7Z"
          fill="#E2E8F0"
        />
        <path
          d="M16 18C13.5 18 11.3 19.5 10.3 21.7C11.9 22.5 13.9 23 16 23C18.1 23 20.1 22.5 21.7 21.7C20.7 19.5 18.5 18 16 18Z"
          fill="#CBD5E1"
        />
      </svg>
    </div>
  );
};

/**
 * 2. PHARMACIST AVATAR (E) (Vector Flat-2)
 * Pharmacist avatar with medical lab coat collar and emerald medical cross badge
 */
export const PharmacistAvatar: React.FC<{ className?: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' }> = ({
  className = '',
  size = 'md'
}) => {
  const s = sizeClasses[size];
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xs ${s.box} ${className}`}
      title="E - Pharmacist"
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${s.svg} overflow-visible`}
      >
        {/* Head & Hair */}
        <circle cx="16" cy="11" r="6" fill="#FED7AA" />
        <path
          d="M10 10.5C10 7 12.7 4.5 16 4.5C19.3 4.5 22 7 22 10.5C22 11.2 21.8 12 21.5 12.5C20.5 10 18.5 9 16 9C13.5 9 11.5 10 10.5 12.5C10.2 12 10 11.2 10 10.5Z"
          fill="#334155"
        />

        {/* Pharmacist White Lab Coat Body */}
        <path
          d="M6 28C6 22.4772 10.4772 18 16 18C21.5228 18 26 22.4772 26 28H6Z"
          fill="#F8FAFC"
        />
        {/* Inner scrub top */}
        <path
          d="M13 18L16 23L19 18H13Z"
          fill="#0D9488"
        />
        {/* Lab coat lapels */}
        <path
          d="M11 18L14 24L16 28H10C7.8 28 6 26.2 6 24V28H11V18Z"
          fill="#E2E8F0"
        />
        <path
          d="M21 18L18 24L16 28H22C24.2 28 26 26.2 26 24V28H21V18Z"
          fill="#E2E8F0"
        />

        {/* Stethoscope / Medical Cross Emblem */}
        <circle cx="23" cy="23" r="4.5" fill="#10B981" />
        <rect x="21.75" y="20.25" width="2.5" height="5.5" rx="0.8" fill="white" />
        <rect x="20.25" y="21.75" width="5.5" height="2.5" rx="0.8" fill="white" />
      </svg>
    </div>
  );
};

/**
 * 3. DRIVER AVATAR (D) (Vector Flat-2 with HELMET ⛑️)
 * Explicit requirement: "keep the helmet in driver icon"
 * Clean flat-2 driver avatar with protective safety helmet & visor
 */
export const DriverAvatar: React.FC<{ className?: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' }> = ({
  className = '',
  size = 'md'
}) => {
  const s = sizeClasses[size];
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-brand text-white shadow-2xs ${s.box} ${className}`}
      title="D - Driver (Fleet Vehicle)"
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${s.svg} overflow-visible`}
      >
        {/* Driver Jacket / Torso */}
        <path
          d="M6 28C6 22.8 10.2 18.5 15.4 18.1L16 18.1L16.6 18.1C21.8 18.5 26 22.8 26 28H6Z"
          fill="#1E293B"
        />
        {/* Jacket Zipper & Collar */}
        <path d="M16 18.5V28" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M11.5 22L16 19L20.5 22" stroke="#CBD5E1" strokeWidth="1.2" strokeLinecap="round" />

        {/* Motorcycle / Safety Helmet Outer Shell */}
        <path
          d="M7 13.5C7 8.25329 11.0294 4 16 4C20.9706 4 25 8.25329 25 13.5C25 17.5 22.8 19.5 20 20C18.8 20.2 17.2 20.5 16 20.5C14.8 20.5 13.2 20.2 12 20C9.2 19.5 7 17.5 7 13.5Z"
          fill="#DC2626"
        />
        {/* Helmet Top Streamline Highlight */}
        <path
          d="M11 6.5C12.5 5.5 14.2 5 16 5C17.8 5 19.5 5.5 21 6.5"
          stroke="#FCA5A5"
          strokeWidth="1.2"
          strokeLinecap="round"
        />

        {/* Dark Aerodynamic Visor (Glass) */}
        <path
          d="M9 12C9 10.5 10.5 9.5 12.5 9.5H19.5C21.5 9.5 23 10.5 23 12C23 14.5 21 16 16 16C11 16 9 14.5 9 12Z"
          fill="#0F172A"
        />
        {/* Visor Glare / Reflection Accent */}
        <path
          d="M11 11.5C12.5 10.8 14.5 10.5 16.5 10.5"
          stroke="#38BDF8"
          strokeWidth="1"
          strokeLinecap="round"
        />

        {/* Helmet Chin Guard */}
        <path
          d="M11 16.5C12.5 17.2 14.2 17.5 16 17.5C17.8 17.5 19.5 17.2 21 16.5V19C21 19.8 19 20.2 16 20.2C13 20.2 11 19.8 11 19V16.5Z"
          fill="#991B1B"
        />
      </svg>
    </div>
  );
};

export const HelmetDriverAvatar = DriverAvatar;

/**
 * 4. WORKER AVATAR (W) (Vector Flat-2)
 * Worker avatar with workwear / support staff collar
 */
export const WorkerAvatar: React.FC<{ className?: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' }> = ({
  className = '',
  size = 'md'
}) => {
  const s = sizeClasses[size];
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-blue-600 text-white shadow-2xs ${s.box} ${className}`}
      title="W - Worker"
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${s.svg} overflow-visible`}
      >
        {/* Head & Worker Cap */}
        <circle cx="16" cy="11" r="5.5" fill="#FED7AA" />
        {/* Work Cap / Beanie */}
        <path
          d="M9.5 11C9.5 7.4 12.4 4.5 16 4.5C19.6 4.5 22.5 7.4 22.5 11H24C24 11 23 12 21 12H11C9 12 8 11 8 11H9.5Z"
          fill="#1D4ED8"
        />
        <rect x="9" y="10" width="14" height="2" rx="1" fill="#3B82F6" />

        {/* Worker Uniform Body */}
        <path
          d="M6 28C6 22.5 10.5 18 16 18C21.5 18 26 22.5 26 28H6Z"
          fill="#2563EB"
        />
        {/* High-visibility reflective vest straps */}
        <path d="M11 18L10 28" stroke="#FDE047" strokeWidth="2" />
        <path d="M21 18L22 28" stroke="#FDE047" strokeWidth="2" />
        {/* Inner collar */}
        <path d="M13 18L16 22L19 18" fill="#1E40AF" />
      </svg>
    </div>
  );
};

/**
 * 5. MANAGEMENT AVATAR (M) (Vector Flat-2)
 * Executive / Management avatar with business suit & tie
 */
export const ManagementAvatar: React.FC<{ className?: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' }> = ({
  className = '',
  size = 'md'
}) => {
  const s = sizeClasses[size];
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-slate-950 text-white shadow-2xs ${s.box} ${className}`}
      title="M - Management"
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${s.svg} overflow-visible`}
      >
        {/* Head & Professional Hairstyle */}
        <circle cx="16" cy="11" r="5.5" fill="#FED7AA" />
        <path
          d="M10.5 10C10.5 6.5 13 4 16.5 4C20 4 22 6 22 9C22 10.5 21.5 11 20.5 11.5C19.5 9 17.5 8 15 8C12.5 8 11.5 9 10.5 10Z"
          fill="#1E293B"
        />

        {/* Business Suit Jacket */}
        <path
          d="M6 28C6 22.5 10.5 18 16 18C21.5 18 26 22.5 26 28H6Z"
          fill="#0F172A"
        />
        {/* White Shirt Collar */}
        <path d="M13 18L16 23L19 18H13Z" fill="#F8FAFC" />

        {/* Red / Crimson Executive Tie */}
        <path
          d="M15.2 20.5L16.8 20.5L17.2 26L16 28L14.8 26L15.2 20.5Z"
          fill="#DC2626"
        />
        {/* Tie Knot */}
        <polygon points="15,19 17,19 16.5,21 15.5,21" fill="#B91C1C" />
      </svg>
    </div>
  );
};

/**
 * Universal EmployeeRoleAvatar Selector
 */
export const EmployeeRoleAvatar: React.FC<EmployeeRoleAvatarProps> = ({
  role = 'all',
  size = 'md',
  className = '',
  showBadge = false
}) => {
  const norm = (role || '').toLowerCase().trim();

  let AvatarComp = AllStaffAvatar;
  let letter = 'A';
  let badgeTone = 'bg-slate-900 text-white';

  if (norm === 'pharmacist' || norm === 'e' || norm === 'pharma' || norm === 'doctor') {
    AvatarComp = PharmacistAvatar;
    letter = 'E';
    badgeTone = 'bg-emerald-600 text-white';
  } else if (norm === 'driver' || norm === 'd' || norm === 'delivery' || norm === 'fleet') {
    AvatarComp = DriverAvatar;
    letter = 'D';
    badgeTone = 'bg-brand text-white';
  } else if (norm === 'worker' || norm === 'w' || norm === 'staff' || norm === 'technician') {
    AvatarComp = WorkerAvatar;
    letter = 'W';
    badgeTone = 'bg-blue-600 text-white';
  } else if (
    norm === 'management' ||
    norm === 'm' ||
    norm === 'admin' ||
    norm === 'manager' ||
    norm === 'owner' ||
    norm === 'supervisor'
  ) {
    AvatarComp = ManagementAvatar;
    letter = 'M';
    badgeTone = 'bg-slate-950 text-white';
  }

  return (
    <div className="relative inline-flex items-center">
      <AvatarComp size={size} className={className} />
      {showBadge && (
        <span
          className={`absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-black shadow-xs ring-1 ring-white ${badgeTone}`}
        >
          {letter}
        </span>
      )}
    </div>
  );
};

/**
 * Role metadata configuration for filters and badges
 */
export const EMPLOYEE_ROLE_DEFINITIONS = [
  {
    key: 'all' as EmployeeRoleCategory,
    letter: 'ALL',
    label: 'All',
    labelAr: 'الكل',
    description: 'All pharmacy personnel & fleet',
    Avatar: AllStaffAvatar,
    accent: 'slate'
  },
  {
    key: 'pharmacist' as EmployeeRoleCategory,
    letter: 'E',
    label: 'Pharmacist',
    labelAr: 'صيدلي',
    description: 'Licensed pharmacists and clinical duty staff',
    Avatar: PharmacistAvatar,
    accent: 'emerald'
  },
  {
    key: 'driver' as EmployeeRoleCategory,
    letter: 'D',
    label: 'Driver',
    labelAr: 'سائق',
    description: 'Delivery fleet and vehicle dispatchers (with helmet)',
    Avatar: DriverAvatar,
    accent: 'brand'
  },
  {
    key: 'worker' as EmployeeRoleCategory,
    letter: 'W',
    label: 'Worker',
    labelAr: 'عامل',
    description: 'Branch assistants, warehouse, and service workers',
    Avatar: WorkerAvatar,
    accent: 'blue'
  },
  {
    key: 'management' as EmployeeRoleCategory,
    letter: 'M',
    label: 'Management',
    labelAr: 'إدارة',
    description: 'Branch managers, supervisors, and administrative executive team',
    Avatar: ManagementAvatar,
    accent: 'dark'
  }
] as const;

/**
 * Filter Bar component for Employee Cards / User Lists
 */
export interface EmployeeRoleFilterBarProps {
  activeRole: EmployeeRoleCategory;
  onSelectRole: (role: EmployeeRoleCategory) => void;
  counts?: Partial<Record<EmployeeRoleCategory, number>>;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'pills' | 'deck' | 'cards';
}

export const EmployeeRoleFilterBar: React.FC<EmployeeRoleFilterBarProps> = ({
  activeRole,
  onSelectRole,
  counts,
  className = '',
  size = 'md',
  variant = 'pills'
}) => {
  // Deck / Cards layout for high-end executive workforce directory
  if (variant === 'deck' || variant === 'cards') {
    return (
      <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 w-full ${className}`}>
        {EMPLOYEE_ROLE_DEFINITIONS.map(def => {
          const isActive = activeRole === def.key;
          const count = counts?.[def.key];
          const AvatarComponent = def.Avatar;

          const letterBadgeTone = {
            all: isActive ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-800',
            pharmacist: isActive ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-800',
            driver: isActive ? 'bg-brand text-white' : 'bg-red-100 text-red-800',
            worker: isActive ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800',
            management: isActive ? 'bg-slate-950 text-white' : 'bg-slate-200 text-slate-800'
          }[def.key];

          const activeCardTone = {
            all: 'border-slate-900 bg-white ring-2 ring-slate-900/10 shadow-md',
            pharmacist: 'border-emerald-600 bg-emerald-50/20 ring-2 ring-emerald-600/15 shadow-md',
            driver: 'border-brand bg-red-50/20 ring-2 ring-brand/15 shadow-md',
            worker: 'border-blue-600 bg-blue-50/20 ring-2 ring-blue-600/15 shadow-md',
            management: 'border-slate-900 bg-slate-50/40 ring-2 ring-slate-900/15 shadow-md'
          }[def.key];

          return (
            <button
              key={def.key}
              type="button"
              onClick={() => onSelectRole(def.key)}
              className={`group relative flex flex-col justify-between rounded-2xl border p-4 text-center transition-all duration-200 ${
                isActive
                  ? activeCardTone
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 hover:shadow-xs'
              }`}
            >
              {/* Card Top Row: Letter Tag + Headcount Badge */}
              <div className="flex w-full items-center justify-between gap-2">
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-black uppercase tracking-wider ${letterBadgeTone}`}>
                  {def.letter}
                </span>
                {count !== undefined && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums ${
                      isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </div>

              {/* Card Center: Flat-2 Vector Avatar */}
              <div className="my-3 flex flex-col items-center justify-center">
                <AvatarComponent size="lg" className="transition-transform duration-200 group-hover:scale-105 shadow-2xs" />
              </div>

              {/* Card Bottom: Role Name & Subtitle */}
              <div className="w-full">
                <p className="text-sm font-black tracking-tight text-slate-950">{def.label}</p>
                <p className="mt-0.5 text-[11px] font-bold text-slate-400">{def.labelAr}</p>

                {/* Active Indicator */}
                <div className="mt-2.5 flex items-center justify-center min-h-[18px]">
                  {isActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-900">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Active
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                      Filter
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // Pills variant for tables, headers, and compact filters
  return (
    <div
      className={`inline-flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-1.5 shadow-2xs ${className}`}
    >
      {EMPLOYEE_ROLE_DEFINITIONS.map(def => {
        const isActive = activeRole === def.key;
        const count = counts?.[def.key];
        const AvatarComponent = def.Avatar;

        return (
          <button
            key={def.key}
            type="button"
            onClick={() => onSelectRole(def.key)}
            className={`group flex items-center gap-2 rounded-lg font-black transition-all ${
              size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs'
            } ${
              isActive
                ? 'border border-slate-900 bg-white text-slate-950 shadow-xs ring-1 ring-slate-900/5'
                : 'border border-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900'
            }`}
          >
            <AvatarComponent size="sm" className="shrink-0 transition-transform group-hover:scale-105" />

            <div className="flex items-center gap-1.5">
              {def.letter !== 'ALL' && (
                <span
                  className={`rounded px-1 py-0.2 text-[9px] font-black uppercase ${
                    isActive ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {def.letter}
                </span>
              )}
              <span>{def.label}</span>
            </div>

            {count !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums ${
                  isActive ? 'bg-slate-100 text-slate-800' : 'bg-slate-200/70 text-slate-500'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

/**
 * Chip/Badge displaying an individual role with avatar + letter + label
 */
export const EmployeeRoleBadge: React.FC<{
  role: EmployeeRoleCategory | string;
  size?: 'xs' | 'sm' | 'md';
  customLabel?: string;
  className?: string;
}> = ({ role, size = 'sm', customLabel, className = '' }) => {
  const norm = (role || '').toLowerCase().trim();
  const def =
    EMPLOYEE_ROLE_DEFINITIONS.find(d => d.key === norm) ||
    (norm.includes('driver')
      ? EMPLOYEE_ROLE_DEFINITIONS[2]
      : norm.includes('pharma')
      ? EMPLOYEE_ROLE_DEFINITIONS[1]
      : norm.includes('work')
      ? EMPLOYEE_ROLE_DEFINITIONS[3]
      : norm.includes('manag') || norm.includes('admin') || norm.includes('supervisor')
      ? EMPLOYEE_ROLE_DEFINITIONS[4]
      : EMPLOYEE_ROLE_DEFINITIONS[0]);

  const label = customLabel || def.label;
  const Avatar = def.Avatar;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-800 shadow-2xs ${className}`}
    >
      <Avatar size="xs" />
      {def.letter !== 'ALL' && (
        <span className="rounded bg-slate-100 px-1 text-[9px] font-black text-slate-700">
          {def.letter}
        </span>
      )}
      <span>{label}</span>
    </div>
  );
};
