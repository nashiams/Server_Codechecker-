"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.addColumn("Users", "google_id", {
      type: Sequelize.STRING,
      unique: true, // Each Google ID should be unique across Users
      allowNull: true, // Nullable as it's only present for Google-linked accounts
    });

    // Add todoist_id column
    await queryInterface.addColumn("Users", "todoist_id", {
      type: Sequelize.STRING,
      unique: true, // Each Todoist ID should be unique across Users
      allowNull: true, // Nullable until Todoist account is linked
    });

    // Add todoist_access_token column
    await queryInterface.addColumn("Users", "todoist_access_token", {
      type: Sequelize.STRING,
      allowNull: true, // Nullable until Todoist account is linked
    });

    // Add todoist_refresh_token column
    await queryInterface.addColumn("Users", "todoist_refresh_token", {
      type: Sequelize.STRING,
      allowNull: true, // Nullable until Todoist account is linked
    });

    // Add todoist_token_expires_at column
    await queryInterface.addColumn("Users", "todoist_token_expires_at", {
      type: Sequelize.DATE,
      allowNull: true, // Nullable until Todoist account is linked
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  },
};
