
import React, { useState } from 'react';

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className = "w-12 h-12" }) => {
  const [hasError, setHasError] = useState(false);
  const logoUrl = "https://rvoqfhvdwadauoeemyvs.supabase.co/storage/v1/object/public/assets/tabarak-logo.png";

  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-2xl bg-brand shadow-xl ${className}`}>
      {!hasError ? (
        <img 
          src={logoUrl} 
          alt="Tabarak Logo"
          className="w-full h-full object-contain p-1"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-white">
          <span className="text-[10px] font-black tracking-tighter leading-none">صيدلية</span>
          <span className="text-sm font-black tracking-tighter leading-none">تبارك</span>
        </div>
      )}
    </div>
  );
};
