import { DataTypes, InferAttributes, InferCreationAttributes, Model, CreationOptional } from 'sequelize';
import sequelize from '../config/db';

export interface EventData {
    [key: string]: unknown;
}

export class EventLog extends Model<InferAttributes<EventLog>, InferCreationAttributes<EventLog>> {
    declare id: CreationOptional<string>;
    declare product_id: string;
    declare event_key: string;
    declare idempotency_key: string;
    declare subscriber_id: string | null;
    declare occurred_at: Date | null;
    declare received_at: CreationOptional<Date>;
    declare data: CreationOptional<EventData>;
}

EventLog.init(
    {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        product_id: { type: DataTypes.UUID, allowNull: false },
        event_key: { type: DataTypes.STRING, allowNull: false },
        idempotency_key: { type: DataTypes.STRING, allowNull: false },
        subscriber_id: { type: DataTypes.UUID, allowNull: true },
        occurred_at: { type: DataTypes.DATE, allowNull: true },
        received_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    { sequelize, tableName: 'event_log', underscored: true, timestamps: false },
);
