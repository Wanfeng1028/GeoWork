// Package validation provides common input validation functions
// for use across the server application. It centralizes validation
// logic for emails, passwords, names, IDs, and string sanitization.
package validation

import (
	"fmt"
	"regexp"
	"strings"
	"unicode"
)

// emailRegex is a compiled regular expression for validating email addresses.
// It checks for a basic user@domain.tld format.
var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

// idRegex validates that an ID consists of alphanumeric characters, hyphens, or underscores
// and is between 1 and 128 characters long.
var idRegex = regexp.MustCompile(`^[a-zA-Z0-9_\-]{1,128}$`)

// ValidateEmail checks that the given string is a valid email address.
// It returns an error describing the problem if validation fails.
func ValidateEmail(email string) error {
	if strings.TrimSpace(email) == "" {
		return fmt.Errorf("email is required")
	}
	if !emailRegex.MatchString(email) {
		return fmt.Errorf("invalid email format")
	}
	return nil
}

// ValidatePassword checks that the password meets minimum strength requirements:
// at least 8 characters, contains at least one letter and one digit.
func ValidatePassword(password string) error {
	if len(password) < 8 {
		return fmt.Errorf("password must be at least 8 characters")
	}
	hasLetter := false
	hasDigit := false
	for _, ch := range password {
		if unicode.IsLetter(ch) {
			hasLetter = true
		}
		if unicode.IsDigit(ch) {
			hasDigit = true
		}
	}
	if !hasLetter {
		return fmt.Errorf("password must contain at least one letter")
	}
	if !hasDigit {
		return fmt.Errorf("password must contain at least one digit")
	}
	return nil
}

// ValidateName checks that a name is non-empty and does not exceed maxLen characters.
func ValidateName(name string, maxLen int) error {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return fmt.Errorf("name is required")
	}
	if len(trimmed) > maxLen {
		return fmt.Errorf("name must not exceed %d characters", maxLen)
	}
	return nil
}

// ValidateID checks that an ID is non-empty and matches the expected format
// (alphanumeric, hyphens, underscores; 1-128 characters).
func ValidateID(id string) error {
	if strings.TrimSpace(id) == "" {
		return fmt.Errorf("id is required")
	}
	if !idRegex.MatchString(id) {
		return fmt.Errorf("invalid id format")
	}
	return nil
}

// dangerousChars contains characters that are stripped by SanitizeString
// to prevent injection attacks.
var dangerousChars = regexp.MustCompile(`[<>"'&;|` + "`" + `$\\]`)

// SanitizeString removes potentially dangerous characters from the input string
// to prevent XSS and injection attacks. It strips: < > " ' & ; | ` $ \
func SanitizeString(s string) string {
	return dangerousChars.ReplaceAllString(s, "")
}
