import React from 'react';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
}

const GlassPanel: React.FC<GlassPanelProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 ${className}`}>
      {children}
    </div>
  );
};

export default GlassPanel;
