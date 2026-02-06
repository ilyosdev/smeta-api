import { Global, Module } from '@nestjs/common';
import { drizzle, MySql2Database } from 'drizzle-orm/mysql2';
import * as mysql from 'mysql2/promise';

import { env } from '../config';
import * as schema from './schemas';

export const DRIZZLE_ORM = Symbol('DRIZZLE_ORM');
export type Drizzle = MySql2Database<typeof schema>;
export type DrizzleTransaction = Parameters<Parameters<Drizzle['transaction']>[0]>[0];

export const drizzleProvider = [
  {
    provide: DRIZZLE_ORM,
    useFactory: async () => {
      const pool = mysql.createPool({
        host: env.DB_HOST,
        port: env.DB_PORT,
        user: env.DB_USERNAME,
        password: env.DB_PASSWORD,
        database: env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 50,
        queueLimit: 0,
      });
      return drizzle(pool, { schema, mode: 'default' }) as MySql2Database<typeof schema>;
    },
  },
];

@Global()
@Module({
  providers: [...drizzleProvider],
  exports: [DRIZZLE_ORM],
})
export class DrizzleModule {}
