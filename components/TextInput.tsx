

import React from 'react';

interface TextInputProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  isRequired?: boolean;
  className?: string;
  disabled?: boolean;
  maxLength?: number;
}

export const TextInput: React.FC<TextInputProps> = ({ label, name, value, onChange, placeholder, type = "text", isRequired = false, className = "", disabled = false, maxLength }) => {
  const isOverLimit = maxLength && value.length > maxLength;

  return (
    <div className={label ? "mb-4" : ""}>
      {label && (
        <label htmlFor={name} className={`block text-sm font-medium mb-1 ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
          {label} {isRequired && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        type={type}
        name={name}
        id={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={isRequired}
        disabled={disabled}
        className={`w-full px-3 py-2 bg-white border rounded-md shadow-sm placeholder-gray-400 
                   focus:outline-none focus:ring-2 text-gray-900 
                   ${isOverLimit
                     ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                     : 'border-gray-300 focus:ring-sky-500 focus:border-sky-500'
                   }
                   ${disabled ? 'opacity-70 cursor-not-allowed bg-gray-100' : ''} ${className}`}
      />
      {maxLength && (
        <div className={`text-xs text-right mt-1 ${isOverLimit ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
          {value.length} / {maxLength}
        </div>
      )}
    </div>
  );
};