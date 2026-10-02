/**
 * Production validation utilities for VaiCar platform.
 * Real validation for phone numbers, CPF, email, vehicle plates, etc.
 */

// Normalize phone/WhatsApp to digits only
export function cleanDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Validates Brazilian WhatsApp number.
 * Must include 2-digit DDD + 9-digit mobile number starting with 9.
 * Optional country code 55. Total digits: 11 (or 13 with 55).
 */
export function isValidWhatsApp(phone: string | null | undefined): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const digits = cleanDigits(phone);
  
  // Reject obvious test dummy strings or emails disguised as phones
  if (phone.includes('@') || phone.includes('vaicar.local')) return false;

  // With country code 55
  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = parseInt(digits.substring(2, 4), 10);
    const ninthDigit = digits.charAt(4);
    return ddd >= 11 && ddd <= 99 && ninthDigit === '9';
  }

  // Without country code (DDD + 9 digits)
  if (digits.length === 11) {
    const ddd = parseInt(digits.substring(0, 2), 10);
    const ninthDigit = digits.charAt(2);
    return ddd >= 11 && ddd <= 99 && ninthDigit === '9';
  }

  return false;
}

/**
 * Standard email validation rejecting empty, invalid syntax, or fake local domains
 */
export function isValidEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  
  if (trimmed.endsWith('@vaicar.local') || trimmed.endsWith('.local') || trimmed.length < 5) {
    return false;
  }

  // RFC 5322 compliant simplified regex
  const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return regex.test(trimmed);
}

/**
 * Algorithmic Brazilian CPF validation with check digits verification
 */
export function isValidCPF(cpf: string | null | undefined): boolean {
  if (!cpf || typeof cpf !== 'string') return false;
  const digits = cleanDigits(cpf);

  if (digits.length !== 11) return false;

  // Reject all repeated digits (e.g., 000.000.000-00, 111.111.111-11)
  if (/^(\d)\1{10}$/.test(digits)) return false;

  // Validate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(9), 10)) return false;

  // Validate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(10), 10)) return false;

  return true;
}

/**
 * Validates Brazilian vehicle plate (Mercosul: ABC1D23 or Traditional: ABC1234)
 */
export function isValidPlate(plate: string | null | undefined): boolean {
  if (!plate || typeof plate !== 'string') return false;
  const cleaned = plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (cleaned.length !== 7) return false;

  const traditional = /^[A-Z]{3}[0-9]{4}$/;
  const mercosul = /^[A-Z]{3}[0-9]{1}[A-Z]{1}[0-9]{2}$/;

  return traditional.test(cleaned) || mercosul.test(cleaned);
}

/**
 * Validates CNH (11 digits)
 */
export function isValidCNH(cnh: string | null | undefined): boolean {
  if (!cnh || typeof cnh !== 'string') return false;
  const digits = cleanDigits(cnh);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  return true;
}

/**
 * Validates driver age (must be >= 18 years old)
 */
export function isAdult(birthDate: string | null | undefined): boolean {
  if (!birthDate || typeof birthDate !== 'string') return false;
  const date = new Date(birthDate);
  if (isNaN(date.getTime())) return false;

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const m = today.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < date.getDate())) {
    age--;
  }
  return age >= 18;
}

/**
 * Validates photo requirement (non-empty, non-dummy, valid image format)
 */
export function isValidPhotoData(photo: string | null | undefined): boolean {
  if (!photo || typeof photo !== 'string') return false;
  const trimmed = photo.trim();
  if (trimmed.length < 5) return false;

  // Reject SVG, default avatars or unallowed placeholders
  if (trimmed.includes('image/svg+xml') || trimmed.endsWith('.svg')) return false;
  if (trimmed.includes('default-avatar') || trimmed.includes('unsplash.com/photo-fake')) return false;

  // 1. Relative upload paths (/uploads/users/..., uploads/drivers/..., etc.)
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) {
    return true;
  }

  // 2. Storage bucket paths (users/..., drivers/...)
  if (trimmed.startsWith('users/') || trimmed.startsWith('drivers/')) {
    return true;
  }

  // 3. HTTP or HTTPS URLs (Google Cloud Storage, Firebase Storage, S3, CDNs, etc.)
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.length >= 10;
  }

  // 4. Data URLs (data:image/jpeg;base64,..., data:image/png;base64, etc.)
  if (/^data:image\/(jpeg|jpg|png|webp|avif|heic);base64,/i.test(trimmed)) {
    return trimmed.length >= 25;
  }

  return false;
}
