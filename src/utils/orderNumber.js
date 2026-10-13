import crypto from 'crypto';

/**
 * Generate human-friendly, collision-resistant order number
 * Format: DMH-YYYYMMDD-XXXX (e.g. DMH-20260907-7B9A)
 */
export const generateOrderNumber = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();

  return `DMH-${year}${month}${day}-${randomPart}`;
};
