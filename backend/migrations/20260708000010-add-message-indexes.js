'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        // The admin messages list filters by product_id and orders by created_at DESC.
        await queryInterface.addIndex('messages', {
            fields: ['product_id', 'created_at'],
            name: 'ix_messages_product_created',
        });
        // Run drill-down + webhook feedback look up messages by run_id.
        await queryInterface.addIndex('messages', {
            fields: ['run_id'],
            name: 'ix_messages_run',
            where: { run_id: { [require('sequelize').Op.ne]: null } },
        });
        // Suppression webhook + transactional gate look up by (product_id, to_email).
        await queryInterface.addIndex('messages', {
            fields: ['product_id', 'to_email'],
            name: 'ix_messages_product_to_email',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('messages', 'ix_messages_product_created');
        await queryInterface.removeIndex('messages', 'ix_messages_run');
        await queryInterface.removeIndex('messages', 'ix_messages_product_to_email');
    },
};
