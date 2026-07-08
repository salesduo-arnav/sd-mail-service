import { DataTypes, InferAttributes, InferCreationAttributes, Model, CreationOptional } from 'sequelize';
import sequelize from '../config/db';

export class ApiKey extends Model<InferAttributes<ApiKey>, InferCreationAttributes<ApiKey>> {
    declare id: CreationOptional<string>;
    declare product_id: string;
    declare name: string | null;
    declare key_hash: string;
    declare last_used_at: Date | null;
    declare revoked_at: Date | null;
    declare created_at: CreationOptional<Date>;
}

ApiKey.init(
    {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        product_id: { type: DataTypes.UUID, allowNull: false },
        name: { type: DataTypes.STRING, allowNull: true },
        key_hash: { type: DataTypes.STRING, allowNull: false },
        last_used_at: { type: DataTypes.DATE, allowNull: true },
        revoked_at: { type: DataTypes.DATE, allowNull: true },
        created_at: DataTypes.DATE,
    },
    { sequelize, tableName: 'api_keys', underscored: true, timestamps: true, createdAt: 'created_at', updatedAt: false },
);
