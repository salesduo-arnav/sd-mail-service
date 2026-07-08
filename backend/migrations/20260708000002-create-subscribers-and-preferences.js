'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('subscribers', {
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
            external_id: { type: Sequelize.STRING, allowNull: false },
            email: { type: Sequelize.STRING, allowNull: true },
            name: { type: Sequelize.STRING, allowNull: true },
            attributes: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
            timezone: { type: Sequelize.STRING, allowNull: true },
            last_seen_at: { type: Sequelize.DATE, allowNull: true },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });

        await queryInterface.addIndex('subscribers', {
            fields: ['product_id', 'external_id'],
            unique: true,
            name: 'uq_subscribers_product_external',
        });
        // Nightly inactivity sweep scans by last_seen_at.
        await queryInterface.addIndex('subscribers', {
            fields: ['product_id', 'last_seen_at'],
            name: 'ix_subscribers_last_seen',
        });

        await queryInterface.createTable('subscriber_preferences', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.literal('gen_random_uuid()'),
                primaryKey: true,
                allowNull: false,
            },
            subscriber_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'subscribers', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            category: { type: Sequelize.STRING, allowNull: false },
            channel: {
                type: Sequelize.ENUM('email', 'slack', 'in_app', 'sms'),
                allowNull: false,
                defaultValue: 'email',
            },
            status: {
                type: Sequelize.ENUM('subscribed', 'unsubscribed'),
                allowNull: false,
                defaultValue: 'subscribed',
            },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });

        await queryInterface.addIndex('subscriber_preferences', {
            fields: ['subscriber_id', 'category', 'channel'],
            unique: true,
            name: 'uq_pref_subscriber_category_channel',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('subscriber_preferences');
        await queryInterface.dropTable('subscribers');
        // Drop the ENUM types created above so a re-run is clean.
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_subscriber_preferences_channel";');
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_subscriber_preferences_status";');
    },
};
