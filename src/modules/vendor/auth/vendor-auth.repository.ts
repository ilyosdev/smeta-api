import { Inject, Injectable } from '@nestjs/common';
import { eq, or } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import { Drizzle, DRIZZLE_ORM } from 'src/common/database/drizzle.module';
import { NewOrganization, NewUser, organizations, User, users } from 'src/common/database/schemas';

@Injectable()
export class VendorAuthRepository {
  constructor(@Inject(DRIZZLE_ORM) private readonly db: Drizzle) {}

  async findUserByLogin(login: string): Promise<(User & { organization: { name: string } }) | null> {
    const result = await this.db.query.users.findFirst({
      where: or(eq(users.phone, login), eq(users.email, login)),
      with: {
        organization: true,
      },
    });
    return result ? { ...result, organization: { name: result.organization.name } } : null;
  }

  async findUserById(id: string): Promise<(User & { organization: { name: string } }) | null> {
    const result = await this.db.query.users.findFirst({
      where: eq(users.id, id),
      with: {
        organization: true,
      },
    });
    return result ? { ...result, organization: { name: result.organization.name } } : null;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const result = await this.db.query.users.findFirst({
      where: eq(users.email, email),
    });
    return result ?? null;
  }

  async findUserByPhone(phone: string): Promise<User | null> {
    const result = await this.db.query.users.findFirst({
      where: eq(users.phone, phone),
    });
    return result ?? null;
  }

  async createOrganization(data: NewOrganization): Promise<{ id: string; name: string }> {
    const id = randomUUID();
    await this.db.insert(organizations).values({ ...data, id });
    const [result] = await this.db.select().from(organizations).where(eq(organizations.id, id));
    return { id: result.id, name: result.name };
  }

  async createUser(data: NewUser): Promise<User> {
    const id = randomUUID();
    await this.db.insert(users).values({ ...data, id });
    const [result] = await this.db.select().from(users).where(eq(users.id, id));
    return result;
  }
}
