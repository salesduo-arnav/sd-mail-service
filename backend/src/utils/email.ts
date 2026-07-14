/** Normalize an email for storage + comparison so suppression/lookup is case-insensitive. */
export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}
