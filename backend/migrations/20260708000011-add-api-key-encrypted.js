'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Encrypted-at-rest copy of the plaintext key so a superadmin can reveal it
        // later. `key_hash` remains the auth lookup; this is decryptable only with the
        // app secret (AES-256-GCM). Null for keys created before reveal existed.
        await queryInterface.addColumn('api_keys', 'key_encrypted', {
            type: Sequelize.TEXT,
            allowNull: true,
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('api_keys', 'key_encrypted');
    },
};
