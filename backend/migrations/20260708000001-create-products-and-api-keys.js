'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('products', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.literal('gen_random_uuid()'),
                primaryKey: true,
                allowNull: false,
            },
            slug: { type: Sequelize.STRING, allowNull: false, unique: true },
            name: { type: Sequelize.STRING, allowNull: false },
            brand_name: { type: Sequelize.STRING, allowNull: true },
            brand_color: { type: Sequelize.STRING, allowNull: true },
            logo_url: { type: Sequelize.STRING, allowNull: true },
            from_email: { type: Sequelize.STRING, allowNull: false },
            reply_to_email: { type: Sequelize.STRING, allowNull: true },
            layout_html: { type: Sequelize.TEXT, allowNull: true },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });

        await queryInterface.createTable('api_keys', {
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
            name: { type: Sequelize.STRING, allowNull: true },
            key_hash: { type: Sequelize.STRING, allowNull: false },
            last_used_at: { type: Sequelize.DATE, allowNull: true },
            revoked_at: { type: Sequelize.DATE, allowNull: true },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });

        // Keys are looked up by hash on every ingest — index it (unique per hash).
        await queryInterface.addIndex('api_keys', {
            fields: ['key_hash'],
            unique: true,
            name: 'uq_api_keys_key_hash',
        });
        await queryInterface.addIndex('api_keys', { fields: ['product_id'], name: 'ix_api_keys_product' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('api_keys');
        await queryInterface.dropTable('products');
    },
};
