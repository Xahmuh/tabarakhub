import React from 'react';

interface SpinWheelMarkProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const sizeClasses = {
    sm: 'h-12 w-12',
    md: 'h-16 w-16',
    lg: 'h-20 w-20'
};

export const SpinWheelMark: React.FC<SpinWheelMarkProps> = ({ size = 'md', className = '' }) => (
    <svg
        className={`${sizeClasses[size]} ${className}`}
        viewBox="0 0 96 96"
        fill="none"
        aria-hidden="true"
    >
        <circle cx="48" cy="50" r="34" fill="#FFF7ED" />
        <path d="M48 16a34 34 0 0 1 29.45 17L48 50V16Z" fill="#DC2626" />
        <path d="M77.45 33A34 34 0 0 1 77.45 67L48 50l29.45-17Z" fill="#F59E0B" />
        <path d="M77.45 67A34 34 0 0 1 48 84V50l29.45 17Z" fill="#FDE68A" />
        <path d="M48 84A34 34 0 0 1 18.55 67L48 50v34Z" fill="#DC2626" />
        <path d="M18.55 67A34 34 0 0 1 18.55 33L48 50 18.55 67Z" fill="#F59E0B" />
        <path d="M18.55 33A34 34 0 0 1 48 16v34L18.55 33Z" fill="#FDE68A" />
        <circle cx="48" cy="50" r="35" stroke="#991B1B" strokeWidth="4" />
        <circle cx="48" cy="50" r="7" fill="#991B1B" stroke="#FFFFFF" strokeWidth="3" />
        <circle cx="48" cy="50" r="42" stroke="#FEE2E2" strokeWidth="4" />
        <path d="M48 6 57 19H39L48 6Z" fill="#991B1B" stroke="#FFFFFF" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="48" cy="7" r="3" fill="#F59E0B" />
    </svg>
);
