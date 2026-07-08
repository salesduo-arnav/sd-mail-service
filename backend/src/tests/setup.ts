// Jest setup — runs before each test file.
// Tests run against a dedicated database (NODE_ENV=test, PGDATABASE=sd_mail_test)
// with a Redis on db 1. Suite-specific fixtures are added in Phase 2.

process.env.NODE_ENV = 'test';

jest.setTimeout(60_000);
