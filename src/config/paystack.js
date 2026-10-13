import crypto from 'crypto';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export const isPaystackConfigured = () => {
  return Boolean(
    process.env.PAYSTACK_SECRET_KEY &&
    !process.env.PAYSTACK_SECRET_KEY.includes('your_')
  );
};

/**
 * Initialize a Paystack transaction
 * @param {Object} data - { email, amount (in Kobo), reference, callback_url, metadata }
 */
export const initializePaystackTransaction = async ({
  email,
  amount, // must be in Kobo (Naira * 100)
  reference,
  callback_url,
  metadata = {},
}) => {
  if (!isPaystackConfigured()) {
    throw new Error('Paystack secret key is not configured in .env file.');
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount,
      reference,
      callback_url,
      metadata,
    }),
  });

  const resData = await response.json();
  if (!response.ok || !resData.status) {
    throw new Error(resData.message || 'Failed to initialize Paystack payment.');
  }

  return resData.data; // { authorization_url, access_code, reference }
};

/**
 * Verify a Paystack transaction
 * @param {string} reference
 */
export const verifyPaystackTransaction = async (reference) => {
  if (!isPaystackConfigured()) {
    throw new Error('Paystack secret key is not configured in .env file.');
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  const resData = await response.json();
  if (!response.ok || !resData.status) {
    throw new Error(resData.message || 'Paystack verification failed.');
  }

  return resData.data;
};

/**
 * Verify Paystack webhook HMAC SHA512 signature
 * @param {string|Buffer} rawBody
 * @param {string} signatureHeader
 */
export const verifyPaystackSignature = (rawBody, signatureHeader) => {
  if (!process.env.PAYSTACK_SECRET_KEY) return false;
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');
  return hash === signatureHeader;
};
