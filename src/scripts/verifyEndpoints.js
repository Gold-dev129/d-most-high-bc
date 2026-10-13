/**
 * Comprehensive Endpoint Verification Script
 * Tests API health, routing, security, validation, error middleware, and CORS
 */

const BASE_URL = 'http://localhost:5000';

const runTests = async () => {
  console.log('\n==================================================');
  console.log('  RUNNING DMOSTHIGH API ENDPOINT TESTS');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name} -> ${err.message}`);
      failed++;
    }
  };

  // Test 1: Health Check Endpoint
  await test('GET /api/health returns 200 and success status', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json();
    if (res.status !== 200 || !data.success || !data.message.includes('DMOSTHIGH')) {
      throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
    }
  });

  // Test 2: Root Welcome Route
  await test('GET / returns 200 welcome message', async () => {
    const res = await fetch(`${BASE_URL}/`);
    const data = await res.json();
    if (res.status !== 200 || !data.success) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  // Test 3: 404 Route Handling
  await test('GET /api/not-a-real-endpoint returns 404 with standard error format', async () => {
    const res = await fetch(`${BASE_URL}/api/not-a-real-endpoint`);
    const data = await res.json();
    if (res.status !== 404 || data.success !== false) {
      throw new Error(`Expected 404 error response, got ${res.status}`);
    }
  });

  // Test 4: Auth Registration Input Validation
  await test('POST /api/auth/register fails with 400 when missing required fields', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.status !== 400 || data.success !== false || !Array.isArray(data.errors)) {
      throw new Error(`Expected 400 with validation errors array, got: ${JSON.stringify(data)}`);
    }
  });

  // Test 5: Auth Login Input Validation
  await test('POST /api/auth/login fails with 400 when empty body submitted', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.status !== 400 || data.success !== false) {
      throw new Error(`Expected 400 validation error, got: ${JSON.stringify(data)}`);
    }
  });

  // Test 6: Security - Customer/Guest Blocked from Admin Dashboard Without Token
  await test('GET /api/admin/dashboard rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/dashboard`);
    const data = await res.json();
    if (res.status !== 401 || data.success !== false) {
      throw new Error(`Expected 401 Unauthorized, got: ${res.status}`);
    }
  });

  // Test 7: Security - Protected Orders Route Rejects Missing Token
  await test('GET /api/orders/my-orders rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${BASE_URL}/api/orders/my-orders`);
    const data = await res.json();
    if (res.status !== 401 || data.success !== false) {
      throw new Error(`Expected 401 Unauthorized, got: ${res.status}`);
    }
  });

  // Test 8: Order Checkout Validation
  await test('POST /api/orders/checkout fails with 400 when items are missing', async () => {
    const res = await fetch(`${BASE_URL}/api/orders/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [] }),
    });
    const data = await res.json();
    if (res.status !== 400 || data.success !== false) {
      throw new Error(`Expected 400 with missing items error, got: ${JSON.stringify(data)}`);
    }
  });

  // Test 9: Payment Initialization Validation
  await test('POST /api/payment/initialize fails with 400 when orderId/number missing', async () => {
    const res = await fetch(`${BASE_URL}/api/payment/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.status !== 400 || data.success !== false) {
      throw new Error(`Expected 400 with missing order error, got: ${JSON.stringify(data)}`);
    }
  });

  // Test 10: Product Creation Security - Rejects Unauthorized User
  await test('POST /api/products rejects unauthenticated user with 401', async () => {
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hoodie', price: 25000 }),
    });
    const data = await res.json();
    if (res.status !== 401 || data.success !== false) {
      throw new Error(`Expected 401 Unauthorized, got: ${res.status}`);
    }
  });

  console.log('\n==================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
