import { DataTypes, InferAttributes, InferCreationAttributes, Model, CreationOptional } from 'sequelize';
import sequelize from '../config/db';

export type Channel = 'email' | 'slack' | 'in_app' | 'sms';
export type PrefStatus = 'subscribed' | 'unsubscribed';

export class SubscriberPreference extends Model<
    InferAttributes<SubscriberPreference>,
    InferCreationAttributes<SubscriberPreference>
> {
    declare id: CreationOptional<string>;
    declare subscriber_id: string;
    declare category: string;
    declare channel: CreationOptional<Channel>;
    declare status: CreationOptional<PrefStatus>;
    declare updated_at: CreationOptional<Date>;
}

SubscriberPreference.init(
    {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        subscriber_id: { type: DataTypes.UUID, allowNull: false },
        category: { type: DataTypes.STRING, allowNull: false },
        channel: { type: DataTypes.ENUM('email', 'slack', 'in_app', 'sms'), allowNull: false, defaultValue: 'email' },
        status: { type: DataTypes.ENUM('subscribed', 'unsubscribed'), allowNull: false, defaultValue: 'subscribed' },
        updated_at: DataTypes.DATE,
    },
    {
        sequelize,
        tableName: 'subscriber_preferences',
        underscored: true,
        timestamps: true,
        createdAt: false,
        updatedAt: 'updated_at',
    },
);
