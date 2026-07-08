import { DataTypes, InferAttributes, InferCreationAttributes, Model, CreationOptional } from 'sequelize';
import sequelize from '../config/db';
import { TemplateCtaJson } from '../types/workflow';

export type CampaignStatus = 'draft' | 'queued' | 'sending' | 'sent' | 'failed';
export interface CampaignAudience {
    all?: boolean;
}

export class Campaign extends Model<InferAttributes<Campaign>, InferCreationAttributes<Campaign>> {
    declare id: CreationOptional<string>;
    declare product_id: string;
    declare name: string;
    declare template_id: string | null;
    declare category: CreationOptional<string>;
    declare subject: string | null;
    declare body: string | null;
    declare cta: TemplateCtaJson | null;
    declare audience: CampaignAudience | null;
    declare status: CreationOptional<CampaignStatus>;
    declare total_recipients: CreationOptional<number>;
    declare sent_count: CreationOptional<number>;
    declare failed_count: CreationOptional<number>;
    declare suppressed_count: CreationOptional<number>;
    declare created_by: string | null;
    declare created_at: CreationOptional<Date>;
    declare completed_at: Date | null;
}

Campaign.init(
    {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        product_id: { type: DataTypes.UUID, allowNull: false },
        name: { type: DataTypes.STRING, allowNull: false },
        template_id: { type: DataTypes.UUID, allowNull: true },
        category: { type: DataTypes.STRING, allowNull: false, defaultValue: 'marketing' },
        subject: { type: DataTypes.TEXT, allowNull: true },
        body: { type: DataTypes.TEXT, allowNull: true },
        cta: { type: DataTypes.JSONB, allowNull: true },
        audience: { type: DataTypes.JSONB, allowNull: true },
        status: {
            type: DataTypes.ENUM('draft', 'queued', 'sending', 'sent', 'failed'),
            allowNull: false,
            defaultValue: 'queued',
        },
        total_recipients: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        sent_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        failed_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        suppressed_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        created_by: { type: DataTypes.UUID, allowNull: true },
        created_at: DataTypes.DATE,
        completed_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
        sequelize,
        tableName: 'campaigns',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
    },
);
