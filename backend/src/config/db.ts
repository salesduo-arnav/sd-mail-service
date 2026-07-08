import fs from 'fs';
import { Sequelize } from 'sequelize';
import env, { isProd } from './env';
import Logger from '../utils/logger';

const RDS_CA_BUNDLE_PATH = '/app/rds-combined-ca-bundle.pem';

function loadRdsCaCert(): string | undefined {
    if (env.DB_SSL_CA) return env.DB_SSL_CA;
    try {
        return fs.readFileSync(RDS_CA_BUNDLE_PATH, 'utf8');
    } catch {
        return undefined;
    }
}

const sequelize = new Sequelize({
    dialect: 'postgres',
    host: env.PGHOST,
    port: env.PGPORT,
    username: env.PGUSER,
    password: env.PGPASSWORD,
    database: env.PGDATABASE,
    logging: false,
    pool: { max: 10, min: 2, acquire: 30000, idle: 10000 },
    ...(isProd && {
        dialectOptions: {
            ssl: { require: true, rejectUnauthorized: true, ca: loadRdsCaCert() },
        },
    }),
});

export const connectDB = async () => {
    await sequelize.authenticate();
    Logger.info('Database connected (Sequelize)');
};

export const closeDB = async () => {
    await sequelize.close();
};

export default sequelize;
