import React from 'react';

export const StarIcon = ({ className = "" }: { className?: string }) => {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none"
      stroke="currentColor"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="6.35" y1="6.35" x2="17.65" y2="17.65" />
      <line x1="17.65" y1="6.35" x2="6.35" y2="17.65" />
    </svg>
  );
};