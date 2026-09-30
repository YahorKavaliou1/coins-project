/** Password rules. Must match PASSWORD_RULES / MIN_PASSWORD_LENGTH in app/schemas/user.py. */
export const MIN_PASSWORD_LENGTH = 10;

export interface PasswordRule {
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { label: `At least ${MIN_PASSWORD_LENGTH} characters`, test: (p) => p.length >= MIN_PASSWORD_LENGTH },
  { label: "An uppercase letter", test: (p) => /\p{Lu}/u.test(p) },
  { label: "A lowercase letter", test: (p) => /\p{Ll}/u.test(p) },
  { label: "A digit", test: (p) => /\p{Nd}/u.test(p) },
  { label: "A special character (!@#…)", test: (p) => /[^\p{L}\p{N}\s]/u.test(p) },
];

/** First unmet rule as an error message, or null when the password is strong enough. */
export function passwordError(password: string): string | null {
  const failed = PASSWORD_RULES.find((rule) => !rule.test(password));
  return failed ? `Password needs: ${failed.label.toLowerCase()}` : null;
}
