const { OAuth2Client } = require("google-auth-library");
const { comparePassword, hashPassword } = require("../helpers/bcrypts");
const { signToken } = require("../helpers/jwt");
const { User } = require("../models");

class UserController {
  static async register(req, res, next) {
    try {
      const user = await User.create(req.body);
      res.status(201).json(user);
    } catch (error) {
      console.log(error);
      next(error);
    }
  }

  static async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ where: { email } });

      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const isPasswordValid = comparePassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const token = signToken({ id: user.id, email: user.email });
      res.status(200).json({ token, userId: user.id, username: user.name });
    } catch (error) {
      console.log(error);
      next(error);
    }
  }

  static async google(req, res, next) {
    try {
      const { googleToken } = req.body;
      if (!googleToken) {
        throw { name: "BadRequest", message: "Google Token is required" };
      }

      const client = new OAuth2Client();

      const ticket = await client.verifyIdToken({
        idToken: googleToken,
        audience: process.env.GOOGLE_CLIENT_ID, // Your Google Client ID
      });
      const payload = ticket.getPayload(); // Contains user info from Google

      let user;

      // Scenario 1: Check if a user already exists with this Google ID
      // This is the most reliable way to find a returning Google-specific user
      user = await User.findOne({
        where: { google_id: payload.sub }, // payload.sub is the unique Google ID
      });

      if (user) {
        // User found by Google ID, means they've logged in with Google before
        // No need to create or update email/password
        console.log("Existing user found by Google ID:", user.email);
      } else {
        // Scenario 2: No user found with this Google ID. Check by email.
        // This handles cases where an existing manual login user might be linking Google
        user = await User.findOne({
          where: { email: payload.email },
        });

        if (user) {
          // User found by email (e.g., existing manual login user)
          // Link this existing account to the Google ID if not already linked
          if (!user.google_id) {
            await user.update({
              google_id: payload.sub,
              name: payload.name || user.name, // Update name if Google provides it and it's missing
            });
            console.log("Existing user linked with Google ID:", user.email);
          }
          // If google_id already exists and matches, nothing to do. If it exists but differs, that's an edge case
          // you might want to handle (e.g., error: "Email already linked to another Google account").
          // For simplicity, we assume unique email and that if google_id exists, it's correct.
        } else {
          // Scenario 3: Brand new user logging in via Google
          // Create a new user entry primarily identified by Google ID
          user = await User.create({
            email: payload.email, // Email from Google
            // Generate a dummy password since Google users don't have one in your app
            password: hashPassword(
              Date.now().toString() + Math.random().toString()
            ),
            name: payload.name, // Name from Google
            google_id: payload.sub, // Unique Google ID
            // Assuming default role "Staff" for all Google sign-ups as per your previous code
            // Adjust 'role' if you have different roles for Google users
            // role: "Staff", // If you have a 'role' column and want to set it here
          });
          console.log("New user created via Google:", user.email);
        }
      }

      // After ensuring the user exists (either found or created), generate your app's JWT
      const access_token = signToken({ id: user.id });
      res.status(200).json({ access_token });
    } catch (error) {
      console.error("Error in AuthController.google:", error);
      next(error); // Pass error to global error handler
    }
  }
}
module.exports = UserController;
