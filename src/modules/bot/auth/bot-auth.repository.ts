import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { Drizzle, DRIZZLE_ORM } from 'src/common/database/drizzle.module';
import { User, users } from 'src/common/database/schemas';

@Injectable()
export class BotAuthRepository {
  constructor(@Inject(DRIZZLE_ORM) private readonly db: Drizzle) {}

  async findByTelegramId(telegramId: string): Promise<User | null> {
    const result = await this.db.query.users.findFirst({
      where: eq(users.telegramId, telegramId),
    });
    return result ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.db.query.users.findFirst({
      where: eq(users.id, id),
    });
    return result ?? null;
  }
}
