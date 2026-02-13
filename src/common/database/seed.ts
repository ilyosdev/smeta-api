import { config } from 'dotenv';
config();

import * as bcrypt from 'bcrypt';
import { drizzle } from 'drizzle-orm/mysql2';
import * as mysql from 'mysql2/promise';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import * as schema from './schemas';
import { env } from '../config';

const SYSTEM_ORG_ID = '00000000-0000-0000-0000-000000000001';
const TEST_ORG_ID = '00000000-0000-0000-0000-000000000002';
const TEST_PROJECT_ID = '00000000-0000-0000-0000-000000000003';

const TEST_PASSWORD = 'test123';

const TEST_USERS = [
  { phone: '+998900000001', name: 'Operator Test', role: schema.UserRole.OPERATOR, orgId: SYSTEM_ORG_ID },
  { phone: '+998900000002', name: 'Direktor Test', role: schema.UserRole.DIREKTOR, orgId: TEST_ORG_ID },
  { phone: '+998900000003', name: 'Boss Test', role: schema.UserRole.BOSS, orgId: TEST_ORG_ID },
  { phone: '+998900000004', name: 'Bugalter Test', role: schema.UserRole.BUGALTERIYA, orgId: TEST_ORG_ID },
  { phone: '+998900000005', name: 'PTO Test', role: schema.UserRole.PTO, orgId: TEST_ORG_ID },
  { phone: '+998900000006', name: 'Snabjenets Test', role: schema.UserRole.SNABJENIYA, orgId: TEST_ORG_ID },
  { phone: '+998900000007', name: 'Skladchi Test', role: schema.UserRole.SKLAD, orgId: TEST_ORG_ID },
  { phone: '+998900000008', name: 'Prorab Test', role: schema.UserRole.PRORAB, orgId: TEST_ORG_ID },
  { phone: '+998900000009', name: 'Haydovchi Test', role: schema.UserRole.HAYDOVCHI, orgId: TEST_ORG_ID },
  { phone: '+998900000010', name: 'Moderator Test', role: schema.UserRole.MODERATOR, orgId: TEST_ORG_ID },
];

async function seed() {
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });

  const db = drizzle(pool, { schema, mode: 'default' });

  console.log('Seeding database...\n');

  // ─── 1. System Organization ────────────────────────
  const existingSystemOrg = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, SYSTEM_ORG_ID),
  });

  if (!existingSystemOrg) {
    await db.insert(schema.organizations).values({
      id: SYSTEM_ORG_ID,
      name: 'System',
      phone: null,
      isActive: true,
    });
    console.log('Created System organization');
  } else {
    console.log('System organization already exists');
  }

  // ─── 2. SUPER_ADMIN ───────────────────────────────
  const existingAdmin = await db.query.users.findFirst({
    where: eq(schema.users.phone, env.SUPER_ADMIN_PHONE),
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(env.SUPER_ADMIN_PASSWORD, 10);
    await db.insert(schema.users).values({
      id: randomUUID(),
      orgId: SYSTEM_ORG_ID,
      name: env.SUPER_ADMIN_NAME,
      phone: env.SUPER_ADMIN_PHONE,
      password: hashedPassword,
      role: schema.UserRole.SUPER_ADMIN,
      isActive: true,
    });
    console.log(`Created SUPER_ADMIN: ${env.SUPER_ADMIN_PHONE}`);
  } else {
    console.log('SUPER_ADMIN already exists');
  }

  // ─── 3. Test Organization ─────────────────────────
  const existingTestOrg = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, TEST_ORG_ID),
  });

  if (!existingTestOrg) {
    await db.insert(schema.organizations).values({
      id: TEST_ORG_ID,
      name: 'Test Qurilish LLC',
      phone: '+998901111111',
      isActive: true,
    });
    console.log('Created Test organization: Test Qurilish LLC');
  } else {
    console.log('Test organization already exists');
  }

  // ─── 4. Test Project ──────────────────────────────
  const existingProject = await db.query.projects.findFirst({
    where: eq(schema.projects.id, TEST_PROJECT_ID),
  });

  if (!existingProject) {
    await db.insert(schema.projects).values({
      id: TEST_PROJECT_ID,
      orgId: TEST_ORG_ID,
      name: 'Navoiy 108 - 9 qavatli turar joy',
      address: 'Toshkent sh., Navoiy ko\'chasi 108',
      floors: 9,
      budget: 5000000000,
      status: schema.ProjectStatus.ACTIVE,
    });
    console.log('Created Test project: Navoiy 108');
  } else {
    console.log('Test project already exists');
  }

  // ─── 5. Test Users (one per role) ─────────────────
  const hashedTestPassword = await bcrypt.hash(TEST_PASSWORD, 10);

  for (const testUser of TEST_USERS) {
    const existing = await db.query.users.findFirst({
      where: eq(schema.users.phone, testUser.phone),
    });

    if (existing) {
      console.log(`${testUser.role} already exists: ${testUser.phone}`);
      continue;
    }

    const userId = randomUUID();
    await db.insert(schema.users).values({
      id: userId,
      orgId: testUser.orgId,
      name: testUser.name,
      phone: testUser.phone,
      password: hashedTestPassword,
      role: testUser.role,
      isActive: true,
    });
    console.log(`Created ${testUser.role}: ${testUser.phone}`);

    // Assign company users to the test project
    if (testUser.orgId === TEST_ORG_ID) {
      const existingAssignment = await db.query.userProjects.findFirst({
        where: and(
          eq(schema.userProjects.userId, userId),
          eq(schema.userProjects.projectId, TEST_PROJECT_ID),
        ),
      });

      if (!existingAssignment) {
        await db.insert(schema.userProjects).values({
          id: randomUUID(),
          userId,
          projectId: TEST_PROJECT_ID,
        });
        console.log(`  → Assigned to project: Navoiy 108`);
      }
    }

    // Assign OPERATOR to the test organization
    if (testUser.role === schema.UserRole.OPERATOR) {
      const existingOp = await db.query.operatorOrganizations.findFirst({
        where: and(
          eq(schema.operatorOrganizations.operatorId, userId),
          eq(schema.operatorOrganizations.orgId, TEST_ORG_ID),
        ),
      });

      if (!existingOp) {
        await db.insert(schema.operatorOrganizations).values({
          id: randomUUID(),
          operatorId: userId,
          orgId: TEST_ORG_ID,
        });
        console.log(`  → Assigned operator to org: Test Qurilish LLC`);
      }
    }
  }

  console.log('\n✓ Seed complete!');
  await pool.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
