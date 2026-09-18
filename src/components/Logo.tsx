import React, { useState } from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const ColorRunLogo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const [imgError, setImgError] = useState(false);

  const sizeStyles = {
    sm: 'h-9 max-h-9',
    md: 'h-13 max-h-13',
    lg: 'h-20 max-h-20',
    // 75% increase over md (52px * 1.75 = 91px)
    xl: 'h-[91px] max-h-[91px] sm:h-[98px] sm:max-h-[98px]',
  }[size];

  if (imgError) {
    return (
      <div className={`flex flex-col items-center justify-center font-black tracking-tight select-none ${className}`}>
        <div className="flex items-center gap-1.5 text-2xl sm:text-3xl font-black drop-shadow-md">
          <span className="text-[#e5352f] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">COLOR</span>
          <span className="text-[#1f7fd6] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">RUN</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src="/assets/img/cr-logo.png"
      alt="Color Run"
      onError={() => setImgError(true)}
      className={`object-contain block mx-auto select-none filter drop-shadow-[0_3px_5px_rgba(0,0,0,0.35)] ${sizeStyles} ${className}`}
      draggable={false}
    />
  );
};

export const DGLogo: React.FC<{
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'login' | 'menu';
  imgClassName?: string;
  textColor?: string;
}> = ({
  className = '',
  size = 'xs',
  imgClassName = '',
  textColor = 'text-white',
}) => {
  const sizeStyles = {
    xs: 'w-14 sm:w-16 max-h-7',
    sm: 'w-20',
    md: 'w-28',
    lg: 'w-32 sm:w-36',
    // 1.75x of original xs (56px * 1.75 = 98px, 64px * 1.75 = 112px, max-h-12)
    login: 'w-[98px] sm:w-[112px] max-h-12',
    // 100% increase (double xs: 112px / 128px, max-h-14)
    menu: 'w-28 sm:w-32 max-h-14',
  }[size];

  return (
    <div className={`flex flex-col items-center justify-center gap-0.5 ${className}`}>
      <img
        src="/assets/img/dg-logo.png"
        alt="Data Games Lab"
        className={`object-contain block ${sizeStyles} ${imgClassName} select-none filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.2)]`}
        draggable={false}
      />
      <div className={`text-[9px] sm:text-[10px] font-extrabold tracking-wider sm:tracking-widest uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${textColor}`}>
        © DATA GAMES LAB LLC™
      </div>
    </div>
  );
};
