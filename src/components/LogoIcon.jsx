import React from 'react';

export function LogoIcon({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      <defs>
        {/* Metallic Gold Gradient */}
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F7E7AD" />
          <stop offset="40%" stopColor="#D4AF37" />
          <stop offset="85%" stopColor="#AA7C11" />
          <stop offset="100%" stopColor="#785509" />
        </linearGradient>

        {/* Emerald Cyan Pulse Gradient */}
        <linearGradient id="pulseGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1F4A40" />
          <stop offset="50%" stopColor="#3FA88C" />
          <stop offset="100%" stopColor="#6EE7B7" />
        </linearGradient>

        {/* Glow Filter */}
        <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Hexagon Shield Frame */}
      <path
        d="M24 4L40 12V28L24 44L8 28V12L24 4Z"
        fill="#131619"
        stroke="url(#goldGrad)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Inset Inner Shield Border */}
      <path
        d="M24 8L36 14V26L24 38L12 26V14L24 8Z"
        fill="#0A0C0E"
        stroke="url(#goldGrad)"
        strokeWidth="0.8"
        strokeOpacity="0.4"
      />

      {/* Gold Ingot / Bull Horn Geometric Accent */}
      <path
        d="M17 18L24 13L31 18"
        stroke="url(#goldGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#goldGlow)"
      />

      {/* Candlestick Wave Pulse */}
      <path
        d="M14 30L20 23L25 27L34 17"
        stroke="url(#pulseGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Arrowhead */}
      <path
        d="M30 17H34V21"
        stroke="url(#pulseGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Sparkle Dot */}
      <circle cx="34" cy="17" r="1.5" fill="#6EE7B7" />
    </svg>
  );
}
