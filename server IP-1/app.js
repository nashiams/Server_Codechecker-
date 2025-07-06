require("dotenv").config();
const express = require("express");
const cors = require("cors");
// const morgan = require("morgan");
const router = require("./routes/index");
// Initialize express app
const app = express();

// Import routes

// Import middleware
const errorHandler = require("./middlewares/errorHandler");
// const authenticate = require("./middlewares/authenticate");

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
// app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route (public)
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "DevChecklist.AI API is running",
    timestamp: new Date().toISOString(),
  });
});

// Public routes

app.use("/", router);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.originalUrl} not found`,
  });
});

// Global error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`DevChecklist.AI server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  });
}

module.exports = app;
