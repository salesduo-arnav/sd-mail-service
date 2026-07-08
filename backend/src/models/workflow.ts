import { DataTypes, InferAttributes, InferCreationAttributes, Model, CreationOptional } from 'sequelize';
import sequelize from '../config/db';

export class Workflow extends Model<InferAttributes<Workflow>, InferCreationAttributes<Workflow>> {
    declare id: CreationOptional<string>;
    declare product_id: string;
    declare key: string;
    declare name: string;
    declare trigger_event_key: string;
    declare category: string;
    declare audience: CreationOptional<string>;
    declare active_version_id: string | null;
    declare enabled: CreationOptional<boolean>;
    declare created_at: CreationOptional<Date>;
    declare updated_at: CreationOptional<Date>;
}

Workflow.init(
    {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        product_id: { type: DataTypes.UUID, allowNull: false },
        key: { type: DataTypes.STRING, allowNull: false },
        name: { type: DataTypes.STRING, allowNull: false },
        trigger_event_key: { type: DataTypes.STRING, allowNull: false },
        category: { type: DataTypes.STRING, allowNull: false },
        audience: { type: DataTypes.STRING, allowNull: false, defaultValue: 'event_subscriber' },
        active_version_id: { type: DataTypes.UUID, allowNull: true },
        enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: DataTypes.DATE,
        updated_at: DataTypes.DATE,
    },
    {
        sequelize,
        tableName: 'workflows',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
);
