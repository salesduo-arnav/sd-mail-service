const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const RDS_CA_BUNDLE_PATH = '/app/rds-combined-ca-bundle.pem';

let rdsCaCert;
if (process.env.DB_SSL_CA) {
    rdsCaCert = process.env.DB_SSL_CA;
} else {
    try {
        rdsCaCert = fs.readFileSync(RDS_CA_BUNDLE_PATH, 'utf8');
    } catch {
        // File won't exist in local dev — SSL config omits ca
    }
}

const base = {
    username: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'sd_mail',
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    dialect: 'postgres',
    logging: false,
};

module.exports = {
    development: { ...base },
    test: { ...base, database: process.env.PGDATABASE || 'sd_mail_test' },
    production: {
        ...base,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: true,
                ca: rdsCaCert,
            },
        },
    },
};
