import * as path from 'path';
import { Sequelize } from 'sequelize';

const DB_PATH = path.resolve(__dirname, '../database.sqlite');
const SQLITE_BUSY_TIMEOUT_MS = 10_000;

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: DB_PATH,
  logging: false,
  pool: {
    // Keep a single writer to avoid SQLITE_BUSY from concurrent connections
    max: 1,
    min: 0,
    idle: 10_000,
    acquire: 30_000,
  },
  retry: {
    max: 5,
    match: [/SQLITE_BUSY/i, /SequelizeTimeoutError/i],
    backoffBase: 200,
    backoffExponent: 1.5,
  },
  dialectOptions: {
    busyTimeout: SQLITE_BUSY_TIMEOUT_MS,
  },
  define: {
    freezeTableName: true
  }
});

// Apply pragmatic settings to reduce lock contention on SQLite.
export const initSQLite = async (): Promise<void> => {
  await sequelize.query('PRAGMA journal_mode=WAL;');
  await sequelize.query(`PRAGMA busy_timeout=${SQLITE_BUSY_TIMEOUT_MS};`);
};

export default sequelize;
