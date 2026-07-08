import { DataTypes, InferAttributes, InferCreationAttributes, Model, CreationOptional } from 'sequelize';
import sequelize from '../config/db';
import { Step } from '../types/workflow';

export class WorkflowVersion extends Model<
    InferAttributes<WorkflowVersion>,
    InferCreationAttributes<WorkflowVersion>
> {
    declare id: CreationOptional<string>;
    declare workflow_id: string;
    declare version: number;
    declare steps: Step[];
    declare created_by: string | null;
    declare created_at: CreationOptional<Date>;
}

WorkflowVersion.init(
    {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        workflow_id: { type: DataTypes.UUID, allowNull: false },
        version: { type: DataTypes.INTEGER, allowNull: false },
        steps: { type: DataTypes.JSONB, allowNull: false },
        created_by: { type: DataTypes.UUID, allowNull: true },
        created_at: DataTypes.DATE,
    },
    {
        sequelize,
        tableName: 'workflow_versions',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
    },
);
