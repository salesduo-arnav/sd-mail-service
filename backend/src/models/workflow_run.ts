import { DataTypes, InferAttributes, InferCreationAttributes, Model, CreationOptional } from 'sequelize';
import sequelize from '../config/db';
import { RunStatus } from '../types/workflow';

export class WorkflowRun extends Model<InferAttributes<WorkflowRun>, InferCreationAttributes<WorkflowRun>> {
    declare id: CreationOptional<string>;
    declare workflow_id: string;
    declare workflow_version_id: string | null;
    declare subscriber_id: string;
    declare trigger_event_id: string | null;
    declare status: CreationOptional<RunStatus>;
    declare cancel_on: string[] | null;
    declare created_at: CreationOptional<Date>;
    declare completed_at: Date | null;
}

WorkflowRun.init(
    {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        workflow_id: { type: DataTypes.UUID, allowNull: false },
        workflow_version_id: { type: DataTypes.UUID, allowNull: true },
        subscriber_id: { type: DataTypes.UUID, allowNull: false },
        trigger_event_id: { type: DataTypes.UUID, allowNull: true },
        status: {
            type: DataTypes.ENUM('active', 'canceled', 'completed', 'failed'),
            allowNull: false,
            defaultValue: 'active',
        },
        cancel_on: { type: DataTypes.JSONB, allowNull: true },
        created_at: DataTypes.DATE,
        completed_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
        sequelize,
        tableName: 'workflow_runs',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
    },
);
