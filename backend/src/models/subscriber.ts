import { DataTypes, InferAttributes, InferCreationAttributes, Model, CreationOptional } from 'sequelize';
import sequelize from '../config/db';

export interface SubscriberAttributesJson {
    [key: string]: unknown;
}

export class Subscriber extends Model<InferAttributes<Subscriber>, InferCreationAttributes<Subscriber>> {
    declare id: CreationOptional<string>;
    declare product_id: string;
    declare external_id: string;
    declare email: string | null;
    declare name: string | null;
    declare attributes: CreationOptional<SubscriberAttributesJson>;
    declare timezone: string | null;
    declare last_seen_at: Date | null;
    declare created_at: CreationOptional<Date>;
    declare updated_at: CreationOptional<Date>;
}

Subscriber.init(
    {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        product_id: { type: DataTypes.UUID, allowNull: false },
        external_id: { type: DataTypes.STRING, allowNull: false },
        email: { type: DataTypes.STRING, allowNull: true },
        name: { type: DataTypes.STRING, allowNull: true },
        attributes: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
        timezone: { type: DataTypes.STRING, allowNull: true },
        last_seen_at: { type: DataTypes.DATE, allowNull: true },
        created_at: DataTypes.DATE,
        updated_at: DataTypes.DATE,
    },
    {
        sequelize,
        tableName: 'subscribers',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
);
