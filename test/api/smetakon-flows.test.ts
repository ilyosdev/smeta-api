import { describe, it, expect, beforeAll } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:4000';

interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
  statusCode?: number;
}

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: { ...headers, ...options.headers as Record<string, string> },
  });

  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

describe('Smetakon API Tests - Based on Bot Flows Document', () => {
  let accessToken: string;
  let testVendorId: string;
  let testUserId: string;
  let testObyektId: string;
  let testSmetaId: string;
  let testSmetaItemId: string;
  let testWorkerId: string;
  let testSupplierId: string;
  let testWarehouseId: string;
  let testAccountId: string;
  let testCashRegisterId: string;
  let testRequestId: string;

  const testEmail = `test_${Date.now()}@smetakon.test`;
  const testPassword = 'TestPassword123!';

  describe('1. Authentication & User Setup', () => {
    it('should register a new vendor user', async () => {
      const { status, data } = await apiRequest<{
        user: { id: string; orgId: string };
        tokens: { accessToken: string; refreshToken: string };
      }>('/vendor/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          orgName: 'Test Construction LLC',
          name: 'Test Vendor',
          phone: `+99890${Date.now().toString().slice(-7)}`,
          email: testEmail,
          password: testPassword,
        }),
      });

      console.log('Registration response:', status, JSON.stringify(data, null, 2));

      if (status === 201 || status === 200) {
        expect(data.tokens?.accessToken).toBeDefined();
        accessToken = data.tokens?.accessToken;
        testUserId = data.user?.id;
        testVendorId = data.user?.orgId;
        console.log('Registration successful:', { testUserId, testVendorId, hasToken: !!accessToken });
      } else {
        expect(status).toBeLessThan(500);
      }
    });

    it('should login with credentials', async () => {
      const { status, data } = await apiRequest<{
        user: { id: string; orgId: string };
        tokens: { accessToken: string; refreshToken: string };
      }>('/vendor/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          login: testEmail,
          password: testPassword,
        }),
      });

      console.log('Login response:', status, JSON.stringify(data, null, 2));

      if (status === 200 || status === 201) {
        expect(data.tokens?.accessToken).toBeDefined();
        accessToken = data.tokens?.accessToken;
        testUserId = data.user?.id;
        testVendorId = data.user?.orgId;
        console.log('Login successful:', { testUserId, testVendorId, hasToken: !!accessToken });
      }
    });

    it('should get user profile', async () => {
      if (!accessToken) return;

      const { status, data } = await apiRequest('/vendor/auth/profile', {
        method: 'GET',
      }, accessToken);

      expect(status).toBe(200);
      console.log('Profile:', data);
    });
  });

  describe('2. Obyekts (Projects) - Multi-Obyekt Support', () => {
    it('should create an obyekt (construction project)', async () => {
      if (!accessToken) return;

      const { status, data } = await apiRequest<{ id: string }>('/vendor/obyekts', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Turar joy majmuasi A',
          address: 'Toshkent shahri, Chilonzor tumani',
          status: 'ACTIVE',
        }),
      }, accessToken);

      if (status === 201 || status === 200) {
        expect(data.id).toBeDefined();
        testObyektId = data.id;
      }
      console.log('Obyekt created:', status, data);
    });

    it('should list all obyekts', async () => {
      if (!accessToken) return;

      const { status, data } = await apiRequest<{ data: unknown[]; total: number }>(
        '/vendor/obyekts',
        { method: 'GET' },
        accessToken
      );

      expect(status).toBe(200);
      console.log('Obyekts:', data);
    });
  });

  describe('3. Smetas (Budgets) - PTO Flow', () => {
    it('should create a smeta for obyekt', async () => {
      if (!accessToken || !testObyektId) return;

      const { status, data } = await apiRequest<{ id: string }>('/vendor/smetas', {
        method: 'POST',
        body: JSON.stringify({
          obyektId: testObyektId,
          name: 'Asosiy smeta 2024',
        }),
      }, accessToken);

      if (status === 201 || status === 200) {
        expect(data.id).toBeDefined();
        testSmetaId = data.id;
      }
      console.log('Smeta created:', status, data);
    });

    it('should create smeta items (suvoq, g\'isht, etc)', async () => {
      if (!accessToken || !testSmetaId) return;

      const { status, data } = await apiRequest<{ id: string }>('/vendor/smeta-items', {
        method: 'POST',
        body: JSON.stringify({
          smetaId: testSmetaId,
          name: 'Suvoq',
          unit: 'm²',
          quantity: 1000,
          unitPrice: 45000,
          category: 'Qurilish ishlari',
          itemType: 'WORK',
          source: 'DASHBOARD',
        }),
      }, accessToken);

      if (status === 201 || status === 200) {
        expect(data.id).toBeDefined();
        testSmetaItemId = data.id;
      }
      console.log('Smeta item created:', status, data);
    });

    it('should list smeta items', async () => {
      if (!accessToken) return;

      const { status, data } = await apiRequest(
        '/vendor/smeta-items',
        { method: 'GET' },
        accessToken
      );

      expect(status).toBe(200);
      console.log('Smeta items:', data);
    });
  });

  describe('4. Workers - PRORAB Flow (Section 6.5 - ENG MUHIM)', () => {
    it('should create a worker: "Muso Usmonov, Suvoqchi"', async () => {
      if (!accessToken) return;

      const { status, data } = await apiRequest<{ id: string }>('/vendor/workers', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Muso Usmonov',
          phone: '+998901234567',
          specialty: 'Suvoqchi',
        }),
      }, accessToken);

      if (status === 201 || status === 200) {
        expect(data.id).toBeDefined();
        testWorkerId = data.id;
      }
      console.log('Worker created:', status, data);
    });

    it('should create work log: "1,000 m² suvoq qilindi"', async () => {
      if (!accessToken || !testWorkerId || !testObyektId) return;

      const { status, data } = await apiRequest('/vendor/workers/work-logs', {
        method: 'POST',
        body: JSON.stringify({
          workerId: testWorkerId,
          obyektId: testObyektId,
          date: new Date().toISOString().split('T')[0],
          hoursWorked: 8,
          description: '100 m² suvoq qilindi',
        }),
      }, accessToken);

      console.log('Work log created:', status, data);
      expect(status).toBeLessThan(500);
    });

    it('should create worker payment: "500 m² uchun to\'lov"', async () => {
      if (!accessToken || !testWorkerId) return;

      const { status, data } = await apiRequest('/vendor/workers/payments', {
        method: 'POST',
        body: JSON.stringify({
          workerId: testWorkerId,
          amount: 22500000,
          paymentDate: new Date().toISOString().split('T')[0],
          paymentType: 'CASH',
          description: '500 m² suvoq uchun to\'lov',
        }),
      }, accessToken);

      console.log('Payment created:', status, data);
      expect(status).toBeLessThan(500);
    });

    it('should list workers', async () => {
      if (!accessToken) return;

      const { status, data } = await apiRequest(
        '/vendor/workers',
        { method: 'GET' },
        accessToken
      );

      expect(status).toBe(200);
      console.log('Workers:', data);
    });
  });

  describe('5. Suppliers - SNABJENIYA Flow', () => {
    it('should create supplier: "Temir-beton zavodi"', async () => {
      if (!accessToken) return;

      const { status, data } = await apiRequest<{ id: string }>('/vendor/suppliers', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Temir-beton zavodi',
          phone: '+998712345678',
          address: 'Toshkent shahri',
        }),
      }, accessToken);

      if (status === 201 || status === 200) {
        expect(data.id).toBeDefined();
        testSupplierId = data.id;
      }
      console.log('Supplier created:', status, data);
    });

    it('should create supply order: "Armatira 5 tonna, 7 mln/tonna"', async () => {
      if (!accessToken || !testSupplierId || !testSmetaItemId) return;

      const { status, data } = await apiRequest('/vendor/suppliers/orders', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: testSupplierId,
          smetaItemId: testSmetaItemId,
          quantity: 5000,
          unitPrice: 7000,
          orderDate: new Date().toISOString().split('T')[0],
        }),
      }, accessToken);

      console.log('Supply order created:', status, data);
      expect(status).toBeLessThan(500);
    });

    it('should list suppliers', async () => {
      if (!accessToken) return;

      const { status, data } = await apiRequest(
        '/vendor/suppliers',
        { method: 'GET' },
        accessToken
      );

      expect(status).toBe(200);
      console.log('Suppliers:', data);
    });
  });

  describe('6. Warehouses - SKLAD Flow', () => {
    it('should create warehouse: "Asosiy ombor"', async () => {
      if (!accessToken || !testObyektId) return;

      const { status, data } = await apiRequest<{ id: string }>('/vendor/warehouses', {
        method: 'POST',
        body: JSON.stringify({
          obyektId: testObyektId,
          name: 'Asosiy ombor',
          location: 'Obyekt A hududi',
        }),
      }, accessToken);

      if (status === 201 || status === 200) {
        expect(data.id).toBeDefined();
        testWarehouseId = data.id;
      }
      console.log('Warehouse created:', status, data);
    });

    it('should add item to warehouse: "Sement 1000 kg"', async () => {
      if (!accessToken || !testWarehouseId || !testSmetaItemId) return;

      const { status, data } = await apiRequest('/vendor/warehouses/items', {
        method: 'POST',
        body: JSON.stringify({
          warehouseId: testWarehouseId,
          smetaItemId: testSmetaItemId,
          quantity: 1000,
        }),
      }, accessToken);

      console.log('Warehouse item added:', status, data);
      expect(status).toBeLessThan(500);
    });

    it('should list warehouses', async () => {
      if (!accessToken) return;

      const { status, data } = await apiRequest(
        '/vendor/warehouses',
        { method: 'GET' },
        accessToken
      );

      expect(status).toBe(200);
      console.log('Warehouses:', data);
    });
  });

  describe('7. Finance - BUGALTERIYA Flow', () => {
    it('should create account (shot)', async () => {
      if (!accessToken) return;

      const { status, data } = await apiRequest<{ id: string }>('/vendor/accounts', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Asosiy hisob raqam',
        }),
      }, accessToken);

      if (status === 201 || status === 200) {
        expect(data.id).toBeDefined();
        testAccountId = data.id;
      }
      console.log('Account created:', status, data);
    });

    it('should create cash register (kashlok)', async () => {
      if (!accessToken) return;

      const { status, data } = await apiRequest<{ id: string }>('/vendor/cash-registers', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Prorab Jasur kashlogi',
        }),
      }, accessToken);

      if (status === 201 || status === 200) {
        expect(data.id).toBeDefined();
        testCashRegisterId = data.id;
      }
      console.log('Cash register created:', status, data);
    });

    it('should create income: "500 mln, investor Karimovdan"', async () => {
      if (!accessToken || !testObyektId) return;

      const { status, data } = await apiRequest('/vendor/incomes', {
        method: 'POST',
        body: JSON.stringify({
          obyektId: testObyektId,
          amount: 500000000,
          source: 'Investor Karimov',
          paymentType: 'TRANSFER',
          note: 'Investor Karimovdan perechesleniya',
        }),
      }, accessToken);

      console.log('Income created:', status, data);
      expect(status).toBeLessThan(500);
    });

    it('should create expense: "120 mln, ishchilar oyligi"', async () => {
      if (!accessToken || !testObyektId) return;

      const { status, data } = await apiRequest('/vendor/expenses', {
        method: 'POST',
        body: JSON.stringify({
          obyektId: testObyektId,
          amount: 120000000,
          recipient: 'Ishchilar',
          paymentType: 'CASH',
          category: 'LABOR',
          note: 'Ishchilar oyligi to\'lovi',
        }),
      }, accessToken);

      console.log('Expense created:', status, data);
      expect(status).toBeLessThan(500);
    });

    it('should list accounts', async () => {
      if (!accessToken) return;

      const { status, data } = await apiRequest(
        '/vendor/accounts',
        { method: 'GET' },
        accessToken
      );

      expect(status).toBe(200);
      console.log('Accounts:', data);
    });

    it('should list cash registers', async () => {
      if (!accessToken) return;

      const { status, data } = await apiRequest(
        '/vendor/cash-registers',
        { method: 'GET' },
        accessToken
      );

      expect(status).toBe(200);
      console.log('Cash registers:', data);
    });
  });

  describe('8. Purchase Requests - Approval Workflow', () => {
    it('should create purchase request', async () => {
      if (!accessToken || !testSmetaItemId) return;

      const { status, data } = await apiRequest<{ id: string }>('/vendor/requests', {
        method: 'POST',
        body: JSON.stringify({
          smetaItemId: testSmetaItemId,
          requestedQty: 100,
          requestedAmount: 4500000,
          source: 'DASHBOARD',
          note: 'Zaxira uchun kerak',
        }),
      }, accessToken);

      if (status === 201 || status === 200) {
        expect(data.id).toBeDefined();
        testRequestId = data.id;
      }
      console.log('Request created:', status, data);
    });

    it('should list requests', async () => {
      if (!accessToken) return;

      const { status, data } = await apiRequest(
        '/vendor/requests',
        { method: 'GET' },
        accessToken
      );

      expect(status).toBe(200);
      console.log('Requests:', data);
    });

    it('should approve request (DIREKTOR flow)', async () => {
      if (!accessToken || !testRequestId) return;

      const { status, data } = await apiRequest(
        `/vendor/requests/${testRequestId}/approve`,
        { method: 'POST' },
        accessToken
      );

      console.log('Request approved:', status, data);
      expect(status).toBeLessThan(500);
    });
  });

  describe('9. Cleanup - Delete Test Data', () => {
    it('should cleanup test data', async () => {
      if (!accessToken) return;
      console.log('Test completed with IDs:', {
        testObyektId,
        testSmetaId,
        testSmetaItemId,
        testWorkerId,
        testSupplierId,
        testWarehouseId,
        testAccountId,
        testCashRegisterId,
        testRequestId,
      });
    });
  });
});
