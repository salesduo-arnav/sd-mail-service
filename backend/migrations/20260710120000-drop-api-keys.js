'use strict';

/**
 * Drop the api_keys table. Product API keys are retired — this is an internal-only
 * service, so all first-party producers authenticate with the shared service key
 * (X-Service-Key = INTERNAL_API_KEY) and name the product per request via product_slug.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
    async up(queryInterface) {
        await queryInterface.dropTable('api_keys');
    },

    async down(queryInterface, Sequelize) {
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
            key_encrypted: { type: Sequelize.TEXT, allowNull: true },
            last_used_at: { type: Sequelize.DATE, allowNull: true },
            revoked_at: { type: Sequelize.DATE, allowNull: true },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });
        await queryInterface.addIndex('api_keys', { fields: ['key_hash'], unique: true, name: 'uq_api_keys_key_hash' });
        await queryInterface.addIndex('api_keys', { fields: ['product_id'], name: 'ix_api_keys_product' });
    },
};
