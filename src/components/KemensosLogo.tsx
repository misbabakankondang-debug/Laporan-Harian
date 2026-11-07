import React from 'react';

interface KemensosLogoProps {
  className?: string;
}

export const KemensosLogo: React.FC<KemensosLogoProps> = ({ className = 'w-16 h-16' }) => {
  return (
    <svg
      viewBox="0 0 160 160"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Logo Kementerian Sosial Republik Indonesia"
    >
      {/* Outer Circle with Navy Blue & Gold Border */}
      <circle cx="80" cy="80" r="76" fill="#003366" stroke="#D4AF37" strokeWidth="4" />
      <circle cx="80" cy="80" r="69" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3 3" />
      
      {/* Golden Star at the top */}
      <path
        d="M80 22 L83.5 31.5 L93.5 32 L85.5 38.5 L88.5 48 L80 42.5 L71.5 48 L74.5 38.5 L66.5 32 L76.5 31.5 Z"
        fill="#FFD700"
        stroke="#B8860B"
        strokeWidth="1"
      />

      {/* Padi (Left) & Kapas (Right) decorative garland */}
      {/* Padi (Rice - Gold) */}
      <path
        d="M48 45 C35 60 34 85 46 108"
        stroke="#FFD700"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="41" cy="54" r="3.5" fill="#FFD700" />
      <circle cx="37" cy="67" r="3.5" fill="#FFD700" />
      <circle cx="36" cy="81" r="3.5" fill="#FFD700" />
      <circle cx="40" cy="95" r="3.5" fill="#FFD700" />

      {/* Kapas (Cotton - White with Green calyx) */}
      <path
        d="M112 45 C125 60 126 85 114 108"
        stroke="#2E7D32"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="119" cy="54" r="4" fill="#FFFFFF" stroke="#2E7D32" strokeWidth="1" />
      <circle cx="123" cy="67" r="4" fill="#FFFFFF" stroke="#2E7D32" strokeWidth="1" />
      <circle cx="124" cy="81" r="4" fill="#FFFFFF" stroke="#2E7D32" strokeWidth="1" />
      <circle cx="120" cy="95" r="4" fill="#FFFFFF" stroke="#2E7D32" strokeWidth="1" />

      {/* Center Shield / House & Protective Hands Silhouette */}
      {/* Caring Hands forming a protective base */}
      <path
        d="M42 114 C56 126 104 126 118 114 C112 108 98 106 80 110 C62 106 48 108 42 114 Z"
        fill="#D4AF37"
      />

      {/* Stylized Human Figure (Nurturing & Social Solidarity) */}
      {/* Central Adult / Protector */}
      <circle cx="80" cy="58" r="7.5" fill="#FFFFFF" />
      <path
        d="M68 95 C68 76 92 76 92 95 C92 104 68 104 68 95 Z"
        fill="#FFFFFF"
      />
      
      {/* Protected Child / Youth Left */}
      <circle cx="65" cy="74" r="5" fill="#FFD700" />
      <path
        d="M57 97 C57 85 73 85 73 97 Z"
        fill="#FFD700"
      />

      {/* Protected Child / Youth Right */}
      <circle cx="95" cy="74" r="5" fill="#FFD700" />
      <path
        d="M87 97 C87 85 103 85 103 97 Z"
        fill="#FFD700"
      />

      {/* Bottom Ribbon with Indonesian Motto Text */}
      <path
        d="M36 128 Q80 138 124 128 L120 138 Q80 148 40 138 Z"
        fill="#B8860B"
      />
      <text
        x="80"
        y="136"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="7"
        fontWeight="bold"
        letterSpacing="0.8"
      >
        KEMENSOS RI
      </text>
    </svg>
  );
};
