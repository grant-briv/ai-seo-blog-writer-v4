// Password validation utilities
// Extracted from legacy authService to maintain password validation without IndexedDB dependencies

const MIN_PASSWORD_LENGTH = 8;

// Password strength requirements
const PASSWORD_REQUIREMENTS = {
  minLength: MIN_PASSWORD_LENGTH,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
};

/**
 * Validates password strength
 */
export const validatePasswordStrength = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long`);
  }

  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_REQUIREMENTS.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (PASSWORD_REQUIREMENTS.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Checks if a password meets minimum security requirements
 */
export const isPasswordSecure = (password: string): boolean => {
  return validatePasswordStrength(password).isValid;
};

/**
 * Generates password requirements help text
 */
export const getPasswordRequirementsText = (): string[] => {
  return [
    `At least ${PASSWORD_REQUIREMENTS.minLength} characters long`,
    'Contains uppercase letters (A-Z)',
    'Contains lowercase letters (a-z)', 
    'Contains numbers (0-9)',
    'Contains special characters (!@#$%^&*)'
  ];
};