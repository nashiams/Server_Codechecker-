"use strict";
const { Model } = require("sequelize");
const { hashPassword } = require("../helpers/bcrypts"); // Assuming this is your hashing utility

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  User.init(
    {
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: {
          msg: "Email already exists",
        },
        validate: {
          notEmpty: {
            msg: "Email is required",
          },
          isEmail: {
            msg: "Invalid email format",
          },
          notNull: {
            msg: "Email is required",
          },
        },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Password is required",
          },
          notNull: {
            msg: "Password is required", // Corrected message from "Email is required"
          },
          len: {
            args: [6],
            msg: "Password must be at least 6 characters long", // More descriptive message
          },
        },
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Name is required",
          },
          notNull: {
            msg: "Name is required", // Corrected message from "Email is required"
          },
        },
      },
      // --- New Columns Added Below ---
      google_id: {
        type: DataTypes.STRING,
        unique: true, // Ensures one Google account maps to one user record
        allowNull: true, // Null for manual login users
      },
      todoist_id: {
        type: DataTypes.STRING,
        unique: true, // Ensures one Todoist account maps to one user record
        allowNull: true, // Null until Todoist is linked
      },
      todoist_access_token: {
        type: DataTypes.STRING,
        allowNull: true, // Null until Todoist is linked
      },
      todoist_refresh_token: {
        type: DataTypes.STRING,
        allowNull: true, // Null until Todoist is linked
      },
      todoist_token_expires_at: {
        type: DataTypes.DATE,
        allowNull: true, // Null until Todoist is linked
      },
      // --- End of New Columns ---
    },
    {
      sequelize,
      modelName: "User",
      // Add hooks here if they are instance-level (beforeValidate, afterSave, etc.)
      // Note: `createdAt` and `updatedAt` are usually added automatically by Sequelize
      // if `timestamps` option is true (which it is by default).
    }
  );

  // The beforeCreate hook should remain as is, as the password (whether user-input or random)
  // should always be hashed before saving to the database for consistency and security.
  User.beforeCreate((user) => {
    // Only hash if the password is provided and not null (which it should always be for 'create')
    if (user.password) {
      user.password = hashPassword(user.password);
    }
  });

  return User;
};
