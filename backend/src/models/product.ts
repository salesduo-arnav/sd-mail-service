import { DataTypes, InferAttributes, InferCreationAttributes, Model, CreationOptional } from 'sequelize';
import sequelize from '../config/db';

export class Product extends Model<InferAttributes<Product>, InferCreationAttributes<Product>> {
    declare id: CreationOptional<string>;
    declare slug: string;
    declare name: string;
    declare brand_name: string | null;
    declare brand_color: string | null;
    declare logo_url: string | null;
    declare from_email: string;
    declare reply_to_email: string | null;
    declare layout_html: string | null;
    declare created_at: CreationOptional<Date>;
    declare updated_at: CreationOptional<Date>;
}

Product.init(
    {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        slug: { type: DataTypes.STRING, allowNull: false, unique: true },
        name: { type: DataTypes.STRING, allowNull: false },
        brand_name: { type: DataTypes.STRING, allowNull: true },
        brand_color: { type: DataTypes.STRING, allowNull: true },
        logo_url: { type: DataTypes.STRING, allowNull: true },
        from_email: { type: DataTypes.STRING, allowNull: false },
        reply_to_email: { type: DataTypes.STRING, allowNull: true },
        layout_html: { type: DataTypes.TEXT, allowNull: true },
        created_at: DataTypes.DATE,
        updated_at: DataTypes.DATE,
    },
    { sequelize, tableName: 'products', underscored: true, timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' },
);
