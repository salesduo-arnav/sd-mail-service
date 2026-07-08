import { DataTypes, InferAttributes, InferCreationAttributes, Model, CreationOptional } from 'sequelize';
import sequelize from '../config/db';
import { SuppressionReason } from '../types/workflow';

export class Suppression extends Model<InferAttributes<Suppression>, InferCreationAttributes<Suppression>> {
    declare id: CreationOptional<string>;
    declare product_id: string;
    declare email: string;
    declare reason: SuppressionReason;
    declare created_at: CreationOptional<Date>;
}

Suppression.init(
    {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        product_id: { type: DataTypes.UUID, allowNull: false },
        email: { type: DataTypes.STRING, allowNull: false },
        reason: {
            type: DataTypes.ENUM('hard_bounce', 'complaint', 'unsubscribe', 'manual'),
            allowNull: false,
        },
        created_at: DataTypes.DATE,
    },
    {
        sequelize,
        tableName: 'suppressions',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
    },
);
