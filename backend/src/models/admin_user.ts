import { DataTypes, InferAttributes, InferCreationAttributes, Model, CreationOptional } from 'sequelize';
import sequelize from '../config/db';

export class AdminUser extends Model<InferAttributes<AdminUser>, InferCreationAttributes<AdminUser>> {
    declare id: CreationOptional<string>;
    declare email: string;
    declare name: string | null;
    declare password_hash: string | null;
    declare created_at: CreationOptional<Date>;
}

AdminUser.init(
    {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        email: { type: DataTypes.STRING, allowNull: false, unique: true },
        name: { type: DataTypes.STRING, allowNull: true },
        password_hash: { type: DataTypes.STRING, allowNull: true },
        created_at: DataTypes.DATE,
    },
    { sequelize, tableName: 'admin_users', underscored: true, timestamps: true, createdAt: 'created_at', updatedAt: false },
);
