import { DataTypes, InferAttributes, InferCreationAttributes, Model, CreationOptional } from 'sequelize';
import sequelize from '../config/db';
import { Channel, MessageType, TemplateCtaJson } from '../types/workflow';

export class Template extends Model<InferAttributes<Template>, InferCreationAttributes<Template>> {
    declare id: CreationOptional<string>;
    declare product_id: string;
    declare key: string;
    declare type: CreationOptional<MessageType>;
    declare workflow_id: string | null;
    declare channel: CreationOptional<Channel>;
    declare subject: string | null;
    declare body: string | null;
    declare cta: TemplateCtaJson | null;
    declare variables: string[] | null;
    declare updated_at: CreationOptional<Date>;
}

Template.init(
    {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        product_id: { type: DataTypes.UUID, allowNull: false },
        key: { type: DataTypes.STRING, allowNull: false },
        type: { type: DataTypes.ENUM('transactional', 'marketing'), allowNull: false, defaultValue: 'marketing' },
        workflow_id: { type: DataTypes.UUID, allowNull: true },
        channel: { type: DataTypes.ENUM('email', 'slack', 'in_app', 'sms'), allowNull: false, defaultValue: 'email' },
        subject: { type: DataTypes.TEXT, allowNull: true },
        body: { type: DataTypes.TEXT, allowNull: true },
        cta: { type: DataTypes.JSONB, allowNull: true },
        variables: { type: DataTypes.JSONB, allowNull: true },
        updated_at: DataTypes.DATE,
    },
    {
        sequelize,
        tableName: 'templates',
        underscored: true,
        timestamps: true,
        createdAt: false,
        updatedAt: 'updated_at',
    },
);
