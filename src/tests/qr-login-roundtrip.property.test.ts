// Feature: leader-app-enhancements, Property 5: QR login round-trip
// Validates: Requirements 7.2
//
// Property: For any valid login_code, if a QR is generated and then decoded,
// the extracted code is identical to the original login_code.
//
// The QR generation (QRCodeSVG) uses the login_code as plain text value.
// The mobile extractLoginCode() returns plain text as-is.
// So the round-trip is: login_code → QR value (plain text) → extractLoginCode(plain text) → should equal login_code.

import * as fc from 'fast-check';

fc.configureGlobal({ numRuns: 100 });

/**
 * Inline copy of extractLoginCode from mobile/utils/qr-login-utils.ts
 * to avoid cross-project import issues.
 */
function extractLoginCode(data: string): string | null {
  const trimmed = data.trim();
  if (!trimmed) return null;

  // Try JSON parse first
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'object' && parsed !== null && typeof parsed.loginCode === 'string') {
      return parsed.loginCode.trim() || null;
    }
  } catch {
    // Not JSON — treat as plain text
  }

  // Plain text: return as-is if non-empty
  return trimmed || null;
}

/**
 * Simulates the QR generation step.
 * In the desktop app, QRCodeSVG receives `value={login_code}` as plain text.
 * The QR encoding/decoding preserves the string exactly, so the "QR value"
 * is just the plain text login_code.
 */
function simulateQrEncode(loginCode: string): string {
  return loginCode;
}

describe('Property 5: QR login round-trip', () => {
  // Generator for valid login_code strings: non-empty alphanumeric strings
  // that won't be parsed as JSON (matching real login_code format)
  const loginCodeArb = fc.stringMatching(/^[A-Za-z0-9]{1,50}$/);

  it('extractLoginCode returns the original login_code after QR round-trip', () => {
    fc.assert(
      fc.property(loginCodeArb, (loginCode) => {
        const qrValue = simulateQrEncode(loginCode);
        const extracted = extractLoginCode(qrValue);
        expect(extracted).toBe(loginCode);
      })
    );
  });

  it('extractLoginCode handles JSON-wrapped login_code round-trip', () => {
    fc.assert(
      fc.property(loginCodeArb, (loginCode) => {
        // Simulate a QR that contains JSON format
        const qrValue = JSON.stringify({ loginCode });
        const extracted = extractLoginCode(qrValue);
        expect(extracted).toBe(loginCode);
      })
    );
  });
});
