import React from 'react';

interface TimeInput24Props {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  variant?: 'default' | 'blue';
  containerClassName?: string;
  ariaLabel?: string;
}

export const TIME_24H_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const formatTimeInput24 = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

export const TimeInput24: React.FC<TimeInput24Props> = ({
  value,
  onChange,
  id,
  disabled,
  required,
  placeholder = 'HH:mm',
  variant = 'default',
  containerClassName,
  ariaLabel = '24-hour time'
}) => {
  const isBlue = variant === 'blue';
  const shellClassName = containerClassName || `flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-2 py-1.5 shadow-sm transition focus-within:ring-2 ${
    isBlue
      ? 'border-blue-100 bg-white focus-within:border-blue-300 focus-within:ring-blue-100'
      : 'border-slate-200 bg-white focus-within:border-brand/40 focus-within:ring-brand/10'
  }`;
  const badgeClassName = `rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-widest ${
    isBlue ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
  }`;

  return (
    <div className={shellClassName}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        maxLength={5}
        pattern="[0-2][0-9]:[0-5][0-9]"
        placeholder={placeholder}
        value={value}
        required={required}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={event => onChange(formatTimeInput24(event.target.value))}
        className="h-8 min-w-0 flex-1 bg-transparent px-2 text-left text-sm font-black text-slate-950 outline-none placeholder:text-slate-300 disabled:cursor-not-allowed disabled:text-slate-400"
      />
      <span className={badgeClassName}>24H</span>
    </div>
  );
};
