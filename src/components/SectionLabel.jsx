import React from 'react';

export function SectionLabel({ children, right }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-xs font-bold uppercase tracking-widest text-[#8B8D91]">
        {children}
      </h3>
      {right}
    </div>
  );
}
