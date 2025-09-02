import React from 'react';

interface CollapsibleSectionCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const CollapsibleSectionCard: React.FC<CollapsibleSectionCardProps> = ({ title, icon, children, className = "" }) => {
  return (
    <div className={`bg-white shadow-lg rounded-lg border border-gray-200 ${className}`}>
      <div className="flex items-center p-6">
        {icon && <span className="mr-3">{icon}</span>}
        <h2 className="text-xl font-semibold text-sky-700">{title}</h2>
      </div>
      <div className="px-6 pb-6 pt-4 border-t border-gray-200">
        {children}
      </div>
    </div>
  );
};
