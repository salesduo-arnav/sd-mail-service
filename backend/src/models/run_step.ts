import { DataTypes, InferAttributes, InferCreationAttributes, Model, CreationOptional } from 'sequelize';
import sequelize from '../config/db';
import { StepType } from '../types/workflow';

export class RunStep extends Model<InferAttributes<RunStep>, InferCreationAttributes<RunStep>> {
    declare id: CreationOptional<string>;
    declare run_id: string;
    declare step_index: number;
    declare step_type: StepType;
    declare scheduled_for: Date | null;
    declare job_id: string | null;
    declare executed_at: Date | null;
}

RunStep.init(
    {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        run_id: { type: DataTypes.UUID, allowNull: false },
        step_index: { type: DataTypes.INTEGER, allowNull: false },
        step_type: { type: DataTypes.ENUM('send', 'delay', 'cancel_on', 'repeat'), allowNull: false },
        scheduled_for: { type: DataTypes.DATE, allowNull: true },
        job_id: { type: DataTypes.STRING, allowNull: true },
        executed_at: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, tableName: 'run_steps', underscored: true, timestamps: false },
);
