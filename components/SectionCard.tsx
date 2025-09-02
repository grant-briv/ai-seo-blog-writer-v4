
import React, { useState } from 'react';
import { ChevronDownIcon } from './Icons';

interface SectionCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  startOpen?: boolean;
}

export const SectionCard: React.FC<SectionCardProps> = ({ title, icon, children, className = "", startOpen = true }) => {
  const [isOpen, setIsOpen] = useState(startOpen);
  const contentId = `section-content-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className={`bg-white shadow-lg rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <h2 className="text-xl font-semibold text-sky-700">
        <button
          type="button"
          className="flex items-center justify-between w-full p-6 text-left"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-controls={contentId}
        >
          <span className="flex items-center">
            {icon && <span className="mr-3">{icon}</span>}
            {title}
          </span>
          <ChevronDownIcon
            className={`w-5 h-5 text-gray-500 transition-transform duration-300 transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
      </h2>
      
      {/* Collapsible Content */}
      <div
        id={contentId}
        className={`transition-all duration-500 ease-in-out overflow-hidden ${isOpen ? 'max-h-[9999px]' : 'max-h-0'}`}
      >
        {/* The border-t provides a visual separator like CollapsibleSectionCard had */}
        <div className="px-6 pb-6 pt-4 border-t border-gray-200">
          {children}
        </div>
      </div>
    </div>
  );
};
