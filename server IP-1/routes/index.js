const express = require("express");
const router = express.Router();

const requirementsRoutes = require("./requirementsRoutes");
const homeRoutes = require("./homeRoutes");
const authenticRoutes = require("./authenticRoutes");

// Protected routes (require Bearer token)
router.use("/api/codecheck", requirementsRoutes);
router.use("/api/authentic", authenticRoutes);
router.use("/api/todoist", homeRoutes);

module.exports = router;
