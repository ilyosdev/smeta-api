import { config } from 'dotenv';
import { cleanEnv, num, str } from 'envalid';

config();

export const env = cleanEnv(process.env, {
  PORT: num({ default: 3000 }),
  NODE_ENV: str({ choices: ['dev', 'stage', 'prod'], default: 'dev' }),
  CORS_ORIGINS: str({ default: 'http://localhost:3001' }),

  DATABASE_URL: str(),
  DB_HOST: str({ default: 'localhost' }),
  DB_PORT: num({ default: 5432 }),
  DB_USERNAME: str({ default: 'postgres' }),
  DB_PASSWORD: str({ default: 'postgres' }),
  DB_NAME: str({ default: 'smetakon' }),

  REDIS_HOST: str({ default: 'localhost' }),
  REDIS_PORT: num({ default: 6379 }),
  REDIS_PASSWORD: str({ default: '' }),

  ACCESS_TOKEN_SECRET: str(),
  REFRESH_TOKEN_SECRET: str(),
  ACCESS_TOKEN_EXPIRES_IN: str({ default: '15m' }),
  REFRESH_TOKEN_EXPIRES_IN: str({ default: '7d' }),

  TELEGRAM_BOT_TOKEN: str({ default: '' }),
  TELEGRAM_WEBHOOK_URL: str({ default: '' }),
  TELEGRAM_WEBHOOK_SECRET: str({ default: '' }),

  GEMINI_API_KEY: str({ default: '' }),
  GOOGLE_SERVICE_ACCOUNT_PATH: str({ default: '' }),
  GCP_PROJECT_ID: str({ default: '' }),
  GCP_LOCATION: str({ default: 'us-central1' }),

  S3_ENDPOINT: str({ default: '' }),
  S3_ACCESS_KEY: str({ default: '' }),
  S3_SECRET_KEY: str({ default: '' }),
  S3_BUCKET: str({ default: 'smetakon' }),

  SUPER_ADMIN_PHONE: str({ default: '+998900000000' }),
  SUPER_ADMIN_PASSWORD: str({ default: 'admin123' }),
  SUPER_ADMIN_NAME: str({ default: 'Super Admin' }),
});
