'use strict';

// Drop two dead template columns: `variables` (stored but never read by the renderer)
// and `workflow_id` (a back-reference the engine never uses — templates match by key).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        await queryInterface.removeColumn('templates', 'variables');
        await queryInterface.removeColumn('templates', 'workflow_id');
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.addColumn('templates', 'workflow_id', {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'workflows', key: 'id' },
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
        });
        await queryInterface.addColumn('templates', 'variables', {
            type: Sequelize.JSONB,
            allowNull: true,
        });
    },
};
