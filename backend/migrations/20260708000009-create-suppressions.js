'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('suppressions', {
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
            email: { type: Sequelize.STRING, allowNull: false },
            reason: {
                type: Sequelize.ENUM('hard_bounce', 'complaint', 'unsubscribe', 'manual'),
                allowNull: false,
            },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });
        // One row per (product, email, reason) so hard_bounce coexists with unsubscribe/complaint.
        // This reason-awareness is what lets transactional bypass unsubscribe but honor hard_bounce.
        await queryInterface.addIndex('suppressions', {
            fields: ['product_id', 'email', 'reason'],
            unique: true,
            name: 'uq_suppressions_product_email_reason',
        });
        await queryInterface.addIndex('suppressions', {
            fields: ['product_id', 'email'],
            name: 'ix_suppressions_product_email',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('suppressions');
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_suppressions_reason";');
    },
};
