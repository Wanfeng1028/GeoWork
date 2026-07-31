/**
 * Input validation utilities for GeoWork desktop application.
 * Provides client-side validation for forms and user input.
 */

/**
 * Validates an email address format.
 * @param email - The email string to validate
 * @returns true if the email is valid, false otherwise
 */
export function validateEmail(email: string): boolean {
  if (!email || email.trim() === '') {
    return false;
  }
  // RFC 5322 simplified email pattern
  const emailPattern = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  return emailPattern.test(email);
}

/**
 * Validates a password against strength requirements.
 * Requirements: at least 8 characters, contains letter and digit.
 * @param password - The password string to validate
 * @returns An object with `valid` boolean and `errors` array of error messages
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (password && !/[a-zA-Z]/.test(password)) {
    errors.push('Password must contain at least one letter');
  }

  if (password && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one digit');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates that a required field is not empty.
 * @param value - The value to check
 * @param fieldName - The name of the field (used in error message)
 * @returns An error message string if invalid, null if valid
 */
export function validateRequired(value: string, fieldName: string): string | null {
  if (!value || value.trim() === '') {
    return `${fieldName} is required`;
  }
  return null;
}

/**
 * Sanitizes a string to prevent XSS attacks by escaping HTML special characters.
 * Converts: < > & " ' to their HTML entity equivalents.
 * @param input - The raw input string
 * @returns The sanitized string with HTML entities escaped
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';

  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  };

  return input.replace(/[&<>"']/g, (char) => escapeMap[char] || char);
}
