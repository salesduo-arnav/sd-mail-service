'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('campaigns', {
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
            name: { type: Sequelize.STRING, allowNull: false },
            // Either a saved template OR inline subject/body/cta.
            template_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'templates', key: 'id' },
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE',
            },
            category: { type: Sequelize.STRING, allowNull: false, defaultValue: 'marketing' },
            subject: { type: Sequelize.TEXT, allowNull: true },
            body: { type: Sequelize.TEXT, allowNull: true },
            cta: { type: Sequelize.JSONB, allowNull: true },
            audience: { type: Sequelize.JSONB, allowNull: true }, // e.g. { all: true }
            status: {
                type: Sequelize.ENUM('draft', 'queued', 'sending', 'sent', 'failed'),
                allowNull: false,
                defaultValue: 'queued',
            },
            total_recipients: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
            sent_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
            failed_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
            suppressed_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
            created_by: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'admin_users', key: 'id' },
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE',
            },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            completed_at: { type: Sequelize.DATE, allowNull: true },
        });
        await queryInterface.addIndex('campaigns', { fields: ['product_id', 'created_at'], name: 'ix_campaigns_product_created' });

        // Link messages to a campaign + make each (campaign, subscriber) send idempotent.
        await queryInterface.addColumn('messages', 'campaign_id', {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'campaigns', key: 'id' },
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
        });
        await queryInterface.addIndex('messages', {
            fields: ['campaign_id', 'subscriber_id'],
            unique: true,
            where: { campaign_id: { [Sequelize.Op.ne]: null } },
            name: 'uq_messages_campaign_subscriber',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('messages', 'uq_messages_campaign_subscriber');
        await queryInterface.removeColumn('messages', 'campaign_id');
        await queryInterface.dropTable('campaigns');
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_campaigns_status";');
    },
};
