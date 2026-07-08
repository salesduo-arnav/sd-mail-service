import winston from 'winston';

const levels = { error: 0, warn: 1, info: 2, http: 3, debug: 4 };

const level = () => {
    if (process.env.LOG_LEVEL) return process.env.LOG_LEVEL;
    return process.env.NODE_ENV === 'production' ? 'http' : 'debug';
};

const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.printf((info) => {
        const { timestamp, level: lvl, message, ...meta } = info;
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${lvl}]: ${message}${metaStr}`;
    }),
);

const transports: winston.transport[] = [
    new winston.transports.Console({
        silent: process.env.NODE_ENV === 'test',
    }),
];

if (process.env.NODE_ENV !== 'test') {
    transports.push(
        new winston.transports.File({ filename: 'logs/error.log', level: 'error', maxsize: 5_242_880, maxFiles: 5 }),
        new winston.transports.File({ filename: 'logs/combined.log', maxsize: 5_242_880, maxFiles: 5 }),
    );
}

const Logger = winston.createLogger({ level: level(), levels, format, transports });

export default Logger;
