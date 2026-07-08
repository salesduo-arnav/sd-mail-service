'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('workflow_runs', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.literal('gen_random_uuid()'),
                primaryKey: true,
                allowNull: false,
            },
            workflow_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'workflows', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            workflow_version_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'workflow_versions', key: 'id' },
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE',
            },
            subscriber_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'subscribers', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            trigger_event_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'event_log', key: 'id' },
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE',
            },
            status: {
                type: Sequelize.ENUM('active', 'canceled', 'completed', 'failed'),
                allowNull: false,
                defaultValue: 'active',
            },
            cancel_on: { type: Sequelize.JSONB, allowNull: true },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            completed_at: { type: Sequelize.DATE, allowNull: true },
        });
        await queryInterface.addIndex('workflow_runs', {
            fields: ['workflow_id', 'subscriber_id', 'status'],
            name: 'ix_runs_workflow_subscriber_status',
        });
        // Cancellation looks up active runs for a subscriber.
        await queryInterface.addIndex('workflow_runs', {
            fields: ['subscriber_id', 'status'],
            name: 'ix_runs_subscriber_status',
        });

        await queryInterface.createTable('run_steps', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.literal('gen_random_uuid()'),
                primaryKey: true,
                allowNull: false,
            },
            run_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'workflow_runs', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            step_index: { type: Sequelize.INTEGER, allowNull: false },
            step_type: {
                type: Sequelize.ENUM('send', 'delay', 'cancel_on', 'repeat'),
                allowNull: false,
            },
            scheduled_for: { type: Sequelize.DATE, allowNull: true },
            job_id: { type: Sequelize.STRING, allowNull: true },
            executed_at: { type: Sequelize.DATE, allowNull: true },
        });
        await queryInterface.addIndex('run_steps', {
            fields: ['run_id', 'step_index'],
            unique: true,
            name: 'uq_run_steps_run_index',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('run_steps');
        await queryInterface.dropTable('workflow_runs');
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_workflow_runs_status";');
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_run_steps_step_type";');
    },
};
