'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('templates', {
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
            // marketing = workflow-driven (footer, prefs); transactional = required mail (no footer).
            type: {
                type: Sequelize.ENUM('transactional', 'marketing'),
                allowNull: false,
                defaultValue: 'marketing',
            },
            workflow_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'workflows', key: 'id' },
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE',
            },
            channel: {
                type: Sequelize.ENUM('email', 'slack', 'in_app', 'sms'),
                allowNull: false,
                defaultValue: 'email',
            },
            subject: { type: Sequelize.TEXT, allowNull: true },
            body: { type: Sequelize.TEXT, allowNull: true },
            cta: { type: Sequelize.JSONB, allowNull: true },
            variables: { type: Sequelize.JSONB, allowNull: true },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });
        await queryInterface.addIndex('templates', {
            fields: ['product_id', 'key'],
            unique: true,
            name: 'uq_templates_product_key',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('templates');
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_templates_type";');
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_templates_channel";');
    },
};
