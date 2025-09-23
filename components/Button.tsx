
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className = '', ...props }) => {
  const baseStyle = "px-4 py-2.5 font-semibold rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white transition-all duration-150 ease-in-out flex items-center justify-center text-sm";
  
  let variantStyle = "";
  switch (variant) {
    case 'secondary':
      variantStyle = "bg-gray-200 hover:bg-gray-300 text-gray-700 focus:ring-gray-400 border border-gray-300";
      break;
    case 'danger':
      variantStyle = "bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500";
      break;
    case 'primary':
    default:
      // Primary styles are often gradient or specific theme colors, allow className to define fully or provide a default.
      // Removed 'text-white' to prevent conflicts with buttons that need dark text on a light background (e.g., outline buttons).
      // Consumers of the button should provide text color via className for primary variants, which they already do.
      variantStyle = "focus:ring-sky-500";
      break;
  }

  return (
    <button
      className={`${baseStyle} ${variantStyle} ${className} ${props.disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      {...props}
    >
      {children}
    </button>
  );
};
