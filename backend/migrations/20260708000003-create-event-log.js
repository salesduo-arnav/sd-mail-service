'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('event_log', {
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
            event_key: { type: Sequelize.STRING, allowNull: false },
            idempotency_key: { type: Sequelize.STRING, allowNull: false },
            subscriber_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'subscribers', key: 'id' },
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE',
            },
            occurred_at: { type: Sequelize.DATE, allowNull: true },
            received_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            data: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        });

        // The dedup guarantee: an event is processed once per (product, idempotency_key).
        await queryInterface.addIndex('event_log', {
            fields: ['product_id', 'idempotency_key'],
            unique: true,
            name: 'uq_event_log_product_idempotency',
        });
        await queryInterface.addIndex('event_log', {
            fields: ['product_id', 'event_key'],
            name: 'ix_event_log_product_event_key',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('event_log');
    },
};
