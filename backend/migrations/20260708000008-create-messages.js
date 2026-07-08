'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('messages', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.literal('gen_random_uuid()'),
                primaryKey: true,
                allowNull: false,
            },
            product_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'products', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            type: { type: Sequelize.ENUM('transactional', 'marketing'), allowNull: false },
            to_email: { type: Sequelize.STRING, allowNull: false },
            subscriber_id: {
                type: Sequelize.UUID,
                allowNull: true, // transactional sends may have no subscriber (e.g. signup OTP)
                references: { model: 'subscribers', key: 'id' },
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE',
            },
            run_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'workflow_runs', key: 'id' },
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE',
            },
            run_step_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'run_steps', key: 'id' },
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE',
            },
            template_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'templates', key: 'id' },
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE',
            },
            channel: {
                type: Sequelize.ENUM('email', 'slack', 'in_app', 'sms'),
                allowNull: false,
                defaultValue: 'email',
            },
            provider_message_id: { type: Sequelize.STRING, allowNull: true },
            status: {
                type: Sequelize.ENUM('queued', 'sent', 'delivered', 'bounced', 'complained', 'failed', 'suppressed'),
                allowNull: false,
                defaultValue: 'queued',
            },
            error: { type: Sequelize.TEXT, allowNull: true },
            sent_at: { type: Sequelize.DATE, allowNull: true },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });
        await queryInterface.addIndex('messages', {
            fields: ['subscriber_id', 'created_at'],
            name: 'ix_messages_subscriber_created',
        });
        // One message per run_step guarantees idempotent (re)delivery.
        await queryInterface.addIndex('messages', {
            fields: ['run_step_id'],
            unique: true,
            where: { run_step_id: { [Sequelize.Op.ne]: null } },
            name: 'uq_messages_run_step',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('messages');
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_messages_type";');
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_messages_status";');
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_messages_channel";');
    },
};
