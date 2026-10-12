// Everything except DATABASE_URL / REDIS_URL (set by global-setup) gets a fixed test value.
const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  JWT_ACCESS_SECRET: 'e2e-access-secret-0123456789',
  JWT_ACCESS_TTL: '15m',
  REFRESH_TTL_DAYS: '30',
  DEVICE_ID_PEPPER: 'e2e-device-pepper-0123456789',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_PUBLIC_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'clockin-e2e',
  S3_ACCESS_KEY: 'e2e',
  S3_SECRET_KEY: 'e2e-secret',
  SMTP_URL: 'smtp://localhost:1025',
  MAIL_FROM: 'ClockIn <no-reply@clockin.test>',
  APP_PUBLIC_URL: 'http://admin.clockin.test',
  API_PUBLIC_URL: 'http://api.clockin.test',
};
for (const [key, value] of Object.entries(TEST_ENV)) {
  process.env[key] = value;
}
