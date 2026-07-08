import { DataTypes, InferAttributes, InferCreationAttributes, Model, CreationOptional } from 'sequelize';
import sequelize from '../config/db';
import { Channel, MessageStatus, MessageType } from '../types/workflow';

export class Message extends Model<InferAttributes<Message>, InferCreationAttributes<Message>> {
    declare id: CreationOptional<string>;
    declare product_id: string;
    declare type: MessageType;
    declare to_email: string;
    declare subscriber_id: string | null;
    declare run_id: string | null;
    declare run_step_id: string | null;
    declare template_id: string | null;
    declare channel: CreationOptional<Channel>;
    declare provider_message_id: string | null;
    declare status: CreationOptional<MessageStatus>;
    declare error: string | null;
    declare sent_at: Date | null;
    declare created_at: CreationOptional<Date>;
}

Message.init(
    {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        product_id: { type: DataTypes.UUID, allowNull: false },
        type: { type: DataTypes.ENUM('transactional', 'marketing'), allowNull: false },
        to_email: { type: DataTypes.STRING, allowNull: false },
        subscriber_id: { type: DataTypes.UUID, allowNull: true },
        run_id: { type: DataTypes.UUID, allowNull: true },
        run_step_id: { type: DataTypes.UUID, allowNull: true },
        template_id: { type: DataTypes.UUID, allowNull: true },
        channel: { type: DataTypes.ENUM('email', 'slack', 'in_app', 'sms'), allowNull: false, defaultValue: 'email' },
        provider_message_id: { type: DataTypes.STRING, allowNull: true },
        status: {
            type: DataTypes.ENUM('queued', 'sent', 'delivered', 'bounced', 'complained', 'failed', 'suppressed'),
            allowNull: false,
            defaultValue: 'queued',
        },
        error: { type: DataTypes.TEXT, allowNull: true },
        sent_at: { type: DataTypes.DATE, allowNull: true },
        created_at: DataTypes.DATE,
    },
    {
        sequelize,
        tableName: 'messages',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
    },
);
