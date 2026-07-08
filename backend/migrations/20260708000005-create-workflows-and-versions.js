'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('workflows', {
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
            key: { type: Sequelize.STRING, allowNull: false },
            name: { type: Sequelize.STRING, allowNull: false },
            trigger_event_key: { type: Sequelize.STRING, allowNull: false },
            category: { type: Sequelize.STRING, allowNull: false },
            audience: { type: Sequelize.STRING, allowNull: false, defaultValue: 'event_subscriber' },
            // Points at the live workflow_versions row. Plain uuid (no FK) to avoid a
            // circular dependency with workflow_versions.
            active_version_id: { type: Sequelize.UUID, allowNull: true },
            enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });
        await queryInterface.addIndex('workflows', {
            fields: ['product_id', 'key'],
            unique: true,
            name: 'uq_workflows_product_key',
        });
        // Trigger matching scans enabled workflows by (product, trigger_event_key).
        await queryInterface.addIndex('workflows', {
            fields: ['product_id', 'trigger_event_key', 'enabled'],
            name: 'ix_workflows_trigger',
        });

        await queryInterface.createTable('workflow_versions', {
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
            version: { type: Sequelize.INTEGER, allowNull: false },
            steps: { type: Sequelize.JSONB, allowNull: false },
            created_by: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'admin_users', key: 'id' },
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE',
            },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });
        await queryInterface.addIndex('workflow_versions', {
            fields: ['workflow_id', 'version'],
            unique: true,
            name: 'uq_workflow_versions_workflow_version',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('workflow_versions');
        await queryInterface.dropTable('workflows');
    },
};
