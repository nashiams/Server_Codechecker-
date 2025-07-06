const request = require("supertest");
const crypto = require("crypto");

// Mock console.log before importing app to avoid startup messages (uncomment if needed)
// console.log = jest.fn();

// --- Mock axios ---
jest.mock("axios", () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  default: jest.fn(),
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  })),
}));

// --- Mock all other dependencies before importing anything else ---
jest.mock("../models");
jest.mock("../helpers/jwt");
jest.mock("../helpers/bcrypts");
jest.mock("crypto", () => {
  const originalCrypto = jest.requireActual("crypto");
  return {
    ...originalCrypto,
    randomUUID: jest.fn(() => "test-uuid-12345"),
  };
});
jest.mock("../services/geminiService", () => ({
  generateStructured: jest.fn(),
}));

// Mock authentication middleware
jest.mock("../middlewares/authenticate", () => (req, res, next) => {
  next();
});

// Import dependencies after mocking - now we can access the mocked axios
const axios = require("axios");
const { User } = require("../models");
const { signToken } = require("../helpers/jwt");
const { hashPassword, comparePassword } = require("../helpers/bcrypts");
const { generateStructured } = require("../services/geminiService");

// Import the actual app
const app = require("../app");

// Now axios is the mocked version and can be used
const mockAxios = axios;

describe("All Controllers Tests", () => {
  // Define variables that need to be accessed across tests
  const validApiKey = "test-todoist-api-key-12345";
  const validAuthToken = "Bearer 7e78415613fc979e1e10e64bed0610cf23244265";

  // Test data with non-conflicting IDs
  const testUsers = {
    newUser: {
      email: "test.new.user.2024@example.com",
      password: "TestPassword123!",
      name: "Test New User 2024",
    },
    existingUser: {
      id: 99001,
      email: "test.existing.user.2024@example.com",
      password: "ExistingPassword123!",
      name: "Test Existing User 2024",
      google_id: null,
      todoist_id: null,
      todoist_access_token: null,
      todoist_refresh_token: null,
      todoist_token_expires_at: null,
    },
  };

  const testTasks = [
    {
      id: "3355791117",
      content: "Main Task 1",
      description: "Description 1",
      parent_id: null,
    },
    {
      id: "3355791118",
      content: "Subtask 1.1",
      parent_id: "3355791117",
    },
  ];

  const testChecklistData = {
    message: "Code Review Checklist",
    simplifiedChecklist: {
      summary: "Overall the code meets most requirements",
      checklist: [
        {
          itemDescription: "Implement user authentication with JWT",
          isCompleted: true,
        },
        {
          itemDescription: "Add input validation",
          isCompleted: false,
        },
      ],
    },
  };

  const testRequirements = `
    1. Implement user authentication with JWT
    2. Add input validation for all endpoints
    3. Create error handling middleware
  `;

  const testCode = `
    const jwt = require('jsonwebtoken');

    function authenticateUser(req, res, next) {
      const token = req.headers.authorization;
      if (!token) return res.status(401).json({ error: 'No token' });
      next();
    }

    module.exports = { authenticateUser };
  `;

  const mockGeminiResponse = {
    summary: "The code partially implements the requirements.",
    checklist: [
      {
        itemDescription: "Implement user authentication with JWT",
        isCompleted: true,
        details: "Found authenticateUser function",
      },
      {
        itemDescription: "Add input validation for all endpoints",
        isCompleted: false,
        details: "No input validation found",
      },
      {
        itemDescription: "Create error handling middleware",
        isCompleted: false,
        details: "No error handling middleware found",
      },
    ],
  };

  beforeAll(async () => {
    process.env.TODOIST_API_KEY = "7e78415613fc979e1e10e64bed0610cf23244265";
    process.env.NODE_ENV = "test";
    process.env.CLIENT_URL = "http://localhost:5173";
  });

  beforeEach(() => {
    // 1. Clear all mocks
    jest.clearAllMocks();

    // 2. Set up default mock implementations for helper functions
    hashPassword.mockImplementation((password) => `hashed_${password}`);
    comparePassword.mockImplementation(
      (plain, hashed) => hashed === `hashed_${plain}`
    );
    signToken.mockImplementation(
      (payload) => `jwt_token_${JSON.stringify(payload)}`
    );
    generateStructured.mockResolvedValue(mockGeminiResponse);

    // 3. Set up default mock implementations for axios
    mockAxios.default.mockImplementation((config) => {
      if (
        config.method === "GET" &&
        config.url.includes("/tasks") &&
        config?.headers?.Authorization ===
          `Bearer ${process.env.TODOIST_API_KEY}`
      ) {
        return Promise.resolve({ data: testTasks });
      }
      if (
        config.method === "POST" &&
        config.url.includes("/tasks") &&
        !config.url.includes("/close") &&
        config?.headers?.Authorization ===
          `Bearer ${process.env.TODOIST_API_KEY}`
      ) {
        const taskId = crypto.randomUUID();
        return Promise.resolve({
          data: {
            id: taskId,
            content: config.data.content,
            parent_id: config.data.parent_id || null,
          },
        });
      }
      if (
        config.method === "POST" &&
        config.url.includes("/close") &&
        config?.headers?.Authorization ===
          `Bearer ${process.env.TODOIST_API_KEY}`
      ) {
        return Promise.resolve({ status: 204 });
      }
      if (
        config.method === "DELETE" &&
        config?.headers?.Authorization ===
          `Bearer ${process.env.TODOIST_API_KEY}`
      ) {
        return Promise.resolve({ status: 204 });
      }
      if (
        config.method === "POST" &&
        config.url.includes("localhost:3000/api/todoist/create")
      ) {
        return Promise.resolve({
          data: {
            message:
              "Checklist tasks and subtasks created successfully in Todoist.",
            createdTasks: [
              { id: "3355791120", content: config.data.message },
              {
                id: "3355791121",
                content: "Implement user authentication with JWT",
                parent_id: "3355791120",
              },
              {
                id: "3355791122",
                content: "Add input validation",
                parent_id: "3355791120",
              },
            ],
          },
        });
      }
      return Promise.reject(
        new Error(
          `Unhandled axios default call in test: ${config.method} ${config.url}`
        )
      );
    });

    mockAxios.get.mockImplementation((url, config) =>
      mockAxios.default({ method: "GET", url, ...config })
    );
    mockAxios.post.mockImplementation((url, data, config) =>
      mockAxios.default({ method: "POST", url, data, ...config })
    );
    mockAxios.put.mockImplementation((url, data, config) => {
      if (
        url.startsWith("https://api.todoist.com/rest/v2/tasks/") &&
        config?.headers?.Authorization ===
          `Bearer ${process.env.TODOIST_API_KEY}`
      ) {
        return Promise.resolve({ data: { success: true } });
      }
      return Promise.reject(
        new Error(`Unhandled axios PUT request in test: ${url}`)
      );
    });
    mockAxios.delete.mockImplementation((url, config) =>
      mockAxios.default({ method: "DELETE", url, ...config })
    );

    console.log("Mocks are set up for this test run!");
  });

  afterAll(async () => {
    delete process.env.TODOIST_API_KEY;
    delete process.env.NODE_ENV;
    delete process.env.CLIENT_URL;
    jest.clearAllMocks();
  });

  // ============ USER CONTROLLER TESTS ============
  describe("UserController", () => {
    describe("POST /api/authentic/", () => {
      it("should successfully register a new user", async () => {
        const mockCreatedUser = {
          id: 99003,
          ...testUsers.newUser,
          password: "hashed_TestPassword123!",
          google_id: null,
          todoist_id: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        User.create.mockResolvedValue(mockCreatedUser);

        const response = await request(app)
          .post("/api/authentic/")
          .send(testUsers.newUser);

        if (response.status !== 201) {
          console.log(
            "Register failed:",
            response.status,
            response.body,
            response.text
          );
        }

        expect(response.status).toBe(201);
        expect(response.body).toEqual(mockCreatedUser);
        expect(User.create).toHaveBeenCalledWith(testUsers.newUser);
      });
    });
  });

  // ============ HEALTH CHECK TEST ============
  describe("Health Check", () => {
    it("should return health status", async () => {
      const response = await request(app).get("/api/health");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: "OK",
        message: expect.any(String),
        timestamp: expect.any(String),
      });
    });
  });
});

describe("All Controllers Tests", () => {
  // Define variables that need to be accessed across tests
  const validApiKey = "test-todoist-api-key-12345";
  const validAuthToken = "Bearer 7e78415613fc979e1e10e64bed0610cf23244265";

  // Test data with non-conflicting IDs
  const testUsers = {
    newUser: {
      email: "test.new.user.2024@example.com",
      password: "TestPassword123!",
      name: "Test New User 2024",
    },
    existingUser: {
      id: 99001,
      email: "test.existing.user.2024@example.com",
      password: "ExistingPassword123!",
      name: "Test Existing User 2024",
      google_id: null,
      todoist_id: null,
      todoist_access_token: null,
      todoist_refresh_token: null,
      todoist_token_expires_at: null,
    },
  };

  const testTasks = [
    {
      id: "3355791117",
      content: "Main Task 1",
      description: "Description 1",
      parent_id: null,
    },
    {
      id: "3355791118",
      content: "Subtask 1.1",
      parent_id: "3355791117",
    },
  ];

  const testChecklistData = {
    message: "Code Review Checklist",
    simplifiedChecklist: {
      summary: "Overall the code meets most requirements",
      checklist: [
        {
          itemDescription: "Implement user authentication with JWT",
          isCompleted: true,
        },
        {
          itemDescription: "Add input validation",
          isCompleted: false,
        },
      ],
    },
  };

  const testRequirements = `
    1. Implement user authentication with JWT
    2. Add input validation for all endpoints
    3. Create error handling middleware
  `;

  const testCode = `
    const jwt = require('jsonwebtoken');

    function authenticateUser(req, res, next) {
      const token = req.headers.authorization;
      if (!token) return res.status(401).json({ error: 'No token' });
      next();
    }

    module.exports = { authenticateUser };
  `;

  const mockGeminiResponse = {
    summary: "The code partially implements the requirements.",
    checklist: [
      {
        itemDescription: "Implement user authentication with JWT",
        isCompleted: true,
        details: "Found authenticateUser function",
      },
      {
        itemDescription: "Add input validation for all endpoints",
        isCompleted: false,
        details: "No input validation found",
      },
      {
        itemDescription: "Create error handling middleware",
        isCompleted: false,
        details: "No error handling middleware found",
      },
    ],
  };

  // --- beforeAll: For global setup that runs once before all tests ---
  beforeAll(async () => {
    // These environment variables are generally stable across tests,
    // unless a specific test explicitly changes and then restores them.
    // Putting them here ensures they are set before any test runs.
    process.env.TODOIST_API_KEY = "7e78415613fc979e1e10e64bed0610cf23244265";
    process.env.NODE_ENV = "test";
    process.env.CLIENT_URL = "http://localhost:5173";

    // You can add any other one-time setup here, but keep it minimal.
  });

  // --- beforeEach: Clean mocks and set default behaviors for EACH test ---
  beforeEach(() => {
    // 1. Clear all mocks. This resets call counts and any mockImplementationOnce().
    jest.clearAllMocks();

    // 2. Set up default mock implementations for helper functions.
    hashPassword.mockImplementation((password) => `hashed_${password}`);
    comparePassword.mockImplementation(
      (plain, hashed) => hashed === `hashed_${plain}`
    );
    signToken.mockImplementation(
      (payload) => `jwt_token_${JSON.stringify(payload)}`
    );
    generateStructured.mockResolvedValue(mockGeminiResponse);

    // 3. Set up default mock implementations for axios.
    // This handles calls like `axios({ method: 'GET', url: '...' })`
    mockAxios.default.mockImplementation((config) => {
      if (
        config.method === "GET" &&
        config.url.includes("/tasks") &&
        config?.headers?.Authorization ===
          `Bearer ${process.env.TODOIST_API_KEY}`
      ) {
        return Promise.resolve({ data: testTasks });
      }
      if (
        config.method === "POST" &&
        config.url.includes("/tasks") &&
        !config.url.includes("/close") &&
        config?.headers?.Authorization ===
          `Bearer ${process.env.TODOIST_API_KEY}`
      ) {
        const taskId = crypto.randomUUID(); // Use mocked randomUUID for consistency
        return Promise.resolve({
          data: {
            id: taskId,
            content: config.data.content,
            parent_id: config.data.parent_id || null,
          },
        });
      }
      if (
        config.method === "POST" &&
        config.url.includes("/close") &&
        config?.headers?.Authorization ===
          `Bearer ${process.env.TODOIST_API_KEY}`
      ) {
        return Promise.resolve({ status: 204 });
      }
      if (
        config.method === "DELETE" &&
        config?.headers?.Authorization ===
          `Bearer ${process.env.TODOIST_API_KEY}`
      ) {
        return Promise.resolve({ status: 204 });
      }
      // If the URL matches your internal endpoint being called via axios
      if (
        config.method === "POST" &&
        config.url.includes("localhost:3000/api/todoist/create")
      ) {
        return Promise.resolve({
          data: {
            message:
              "Checklist tasks and subtasks created successfully in Todoist.",
            createdTasks: [
              { id: "3355791120", content: config.data.message },
              {
                id: "3355791121",
                content: "Implement user authentication with JWT",
                parent_id: "3355791120",
              },
              {
                id: "3355791122",
                content: "Add input validation",
                parent_id: "3355791120",
              },
            ],
          },
        });
      }
      return Promise.reject(
        new Error(
          `Unhandled axios default call in test: ${config.method} ${config.url}`
        )
      );
    });

    // These specifically handle calls like `axios.get(...)`, `axios.post(...)` etc.
    // They generally defer to the `mockAxios.default` if not specifically overridden here.
    mockAxios.get.mockImplementation((url, config) =>
      mockAxios.default({ method: "GET", url, ...config })
    );
    mockAxios.post.mockImplementation((url, data, config) =>
      mockAxios.default({ method: "POST", url, data, ...config })
    );
    mockAxios.put.mockImplementation((url, data, config) => {
      if (
        url.startsWith("https://api.todoist.com/rest/v2/tasks/") &&
        config?.headers?.Authorization ===
          `Bearer ${process.env.TODOIST_API_KEY}`
      ) {
        return Promise.resolve({ data: { success: true } });
      }
      return Promise.reject(
        new Error(`Unhandled axios PUT request in test: ${url}`)
      );
    });
    mockAxios.delete.mockImplementation((url, config) =>
      mockAxios.default({ method: "DELETE", url, ...config })
    );

    console.log("Mocks are set up for this test run!");
  });

  afterAll(async () => {
    // Clean up global environment variables that were set for the suite
    delete process.env.TODOIST_API_KEY;
    delete process.env.NODE_ENV;
    delete process.env.CLIENT_URL;
    jest.clearAllMocks(); // Clear mocks one last time after all tests
  });

  // ============ QUICK DEBUG TEST ============
  describe("Quick Debug", () => {
    it("should check if health endpoint works", async () => {
      const response = await request(app).get("/api/health");
      // console.log("Health check:", response.status, response.body); // Uncomment for debug
      expect(response.status).toBe(200);
    });
  });

  // ============ USER CONTROLLER TESTS ============
  describe("UserController", () => {
    describe("POST /api/authentic/", () => {
      it("should successfully register a new user", async () => {
        // Corrected mockCreatedUser to expect string dates, or use toMatchObject
        const mockCreatedUser = {
          id: 99003,
          ...testUsers.newUser,
          password: "hashed_TestPassword123!",
          google_id: null,
          todoist_id: null,
          createdAt: expect.any(String), // Expect any string
          updatedAt: expect.any(String), // Expect any string
        };

        User.create.mockResolvedValue(mockCreatedUser);

        const response = await request(app)
          .post("/api/authentic/")
          .send(testUsers.newUser);

        if (response.status !== 201) {
          console.log(
            "Register failed:",
            response.status,
            response.body,
            response.text
          );
        }

        expect(response.status).toBe(201);
        expect(response.body).toEqual(mockCreatedUser); // Use toEqual with expect.any(String)
        expect(User.create).toHaveBeenCalledWith(testUsers.newUser);
      });

      it("should handle SequelizeValidationError for missing email", async () => {
        const error = new Error("Validation error");
        error.name = "SequelizeValidationError";
        error.errors = [{ message: "Email is required" }];
        User.create.mockRejectedValue(error);

        const response = await request(app)
          .post("/api/authentic/")
          .send({ password: "test123", name: "Test" });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: "Email is required" });
      });

      it("should handle SequelizeUniqueConstraintError for duplicate email", async () => {
        const error = new Error("Unique constraint error");
        error.name = "SequelizeUniqueConstraintError";
        error.errors = [{ message: "Email already exists" }];
        User.create.mockRejectedValue(error);

        const response = await request(app)
          .post("/api/authentic/")
          .send(testUsers.newUser);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: "Email already exists" });
      });

      it("should handle general database errors", async () => {
        const error = new Error("Database connection failed");
        User.create.mockRejectedValue(error);

        const response = await request(app)
          .post("/api/authentic/")
          .send(testUsers.newUser);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ message: "Internal server error" });
      });
    });

    describe("POST /api/authentic/login", () => {
      it("should successfully login with valid credentials", async () => {
        const mockUser = {
          id: testUsers.existingUser.id,
          email: testUsers.existingUser.email,
          password: `hashed_${testUsers.existingUser.password}`,
          google_id: null,
          todoist_id: null,
        };

        User.findOne.mockResolvedValue(mockUser);

        const response = await request(app).post("/api/authentic/login").send({
          email: testUsers.existingUser.email,
          password: testUsers.existingUser.password,
        });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("token");
        expect(response.body).toHaveProperty("userId", mockUser.id);
      });

      it("should return 401 for non-existent user", async () => {
        User.findOne.mockResolvedValue(null);

        const response = await request(app).post("/api/authentic/login").send({
          email: "nonexistent@example.com",
          password: "anypassword",
        });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ message: "Invalid email or password" });
      });

      it("should return 401 for invalid password", async () => {
        const mockUser = {
          id: testUsers.existingUser.id,
          email: testUsers.existingUser.email,
          password: "hashed_differentpassword",
        };

        User.findOne.mockResolvedValue(mockUser);

        const response = await request(app).post("/api/authentic/login").send({
          email: testUsers.existingUser.email,
          password: "wrongpassword",
        });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ message: "Invalid email or password" });
      });

      it("should handle database errors during login", async () => {
        const error = new Error("Database query failed");
        User.findOne.mockRejectedValue(error);

        const response = await request(app).post("/api/authentic/login").send({
          email: testUsers.existingUser.email,
          password: testUsers.existingUser.password,
        });

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ message: "Internal server error" });
      });
    });

    describe("GET /api/authentic/tes", () => {
      it("should return test response", async () => {
        const response = await request(app).get("/api/authentic/tes");

        expect(response.status).toBe(200);
        expect(response.text).toBe("tes");
      });
    });
  });

  // ============ TODOIST CONTROLLER TESTS ============
  describe("TodoistController", () => {
    describe("GET /api/todoist/list", () => {
      it("should retrieve all tasks successfully", async () => {
        // This test's mock is already handled by the default axios.default mock in beforeEach
        const response = await request(app)
          .get("/api/todoist/list")
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          );

        expect(response.status).toBe(200);
        expect(response.body).toEqual(testTasks); // This should pass now with the default mock
        expect(mockAxios.default).toHaveBeenCalledWith(
          expect.objectContaining({
            method: "GET",
            url: "https://api.todoist.com/rest/v2/tasks",
            headers: {
              Authorization: `Bearer ${validApiKey}`, // Check against validApiKey from the test scope
              "Content-Type": "application/json",
            },
          })
        );
      });

      it("should handle Todoist API errors", async () => {
        // Override the default axios mock for this specific test
        mockAxios.default.mockImplementationOnce(() => {
          const apiError = new Error("Todoist API Error");
          apiError.response = {
            status: 403,
            data: { error: "Invalid API key" },
          };
          throw apiError;
        });

        const response = await request(app)
          .get("/api/todoist/list")
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          );

        expect(response.status).toBe(403);
        expect(response.body.message).toBe("Invalid API key");
      });

      it("should handle missing API key configuration", async () => {
        const originalApiKey = process.env.TODOIST_API_KEY; // Store original
        delete process.env.TODOIST_API_KEY; // Unset for this test

        const response = await request(app)
          .get("/api/todoist/list")
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          );

        expect(response.status).toBe(500); // Or whatever your app returns for internal config errors
        expect(response.body.message).toContain("Todoist API key is missing");

        process.env.TODOIST_API_KEY = originalApiKey; // Restore it after the test
      });
    });

    describe("POST /api/todoist/create", () => {
      it("should create main task and subtasks successfully", async () => {
        // This test's mock is already handled by the default axios.default mock in beforeEach
        const response = await request(app)
          .post("/api/todoist/create")
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          )
          .send(testChecklistData);

        expect(response.status).toBe(201);
        expect(response.body.message).toContain("successfully");
        expect(response.body.createdTasks).toHaveLength(3);
      });

      it("should handle invalid input format", async () => {
        const response = await request(app)
          .post("/api/todoist/create")
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          )
          .send({ message: "Invalid format" }); // This will hit the general unhandled axios.post case by default

        expect(response.status).toBe(400);
        expect(response.body.message).toContain("Invalid input format");
      });

      it("should skip subtasks with missing itemDescription", async () => {
        const dataWithMissingDesc = {
          ...testChecklistData,
          simplifiedChecklist: {
            ...testChecklistData.simplifiedChecklist,
            checklist: [
              { itemDescription: "Valid item", isCompleted: false },
              { isCompleted: true }, // Missing itemDescription
              { itemDescription: "Another valid item", isCompleted: false },
            ],
          },
        };

        const response = await request(app)
          .post("/api/todoist/create")
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          )
          .send(dataWithMissingDesc);

        expect(response.status).toBe(201);
        expect(response.body.createdTasks).toHaveLength(3);
      });

      it("should handle Todoist API errors during task creation", async () => {
        mockAxios.default.mockImplementationOnce(() => {
          const apiError = new Error("Todoist API Error");
          apiError.response = {
            status: 400,
            data: { error: "Task content cannot be empty" },
          };
          throw apiError;
        });

        const response = await request(app)
          .post("/api/todoist/create")
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          )
          .send(testChecklistData);

        expect(response.status).toBe(400);
        expect(response.body.message).toContain("Task content cannot be empty");
      });
    });

    describe("PUT /api/todoist/update/:id", () => {
      it("should update task successfully", async () => {
        const taskId = "3355791117";
        const updates = {
          content: "Updated Task Content",
          description: "Updated Description",
        };

        // This mock will be specific to this test
        mockAxios.put.mockResolvedValueOnce({
          data: { id: taskId, ...updates },
        });

        const response = await request(app)
          .put(`/api/todoist/update/${taskId}`)
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          )
          .send(updates);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ id: taskId, ...updates });
      });

      it("should handle empty update data", async () => {
        const response = await request(app)
          .put("/api/todoist/update/3355791117")
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          )
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("No update data provided.");
      });

      it("should complete task using duplicate update route", async () => {
        const taskId = "3355791117";

        // Mock the specific call to close the task
        mockAxios.post.mockImplementationOnce((url, data, config) => {
          if (
            url === `https://api.todoist.com/rest/v2/tasks/${taskId}/close` &&
            config?.headers?.Authorization ===
              `Bearer ${process.env.TODOIST_API_KEY}`
          ) {
            return Promise.resolve({ status: 204 });
          }
          return Promise.reject(
            new Error(`Unhandled axios POST to close task: ${url}`)
          );
        });

        const response = await request(app)
          .put(`/api/todoist/update/${taskId}`)
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          )
          .send({ completed: true });

        expect(response.status).toBe(200); // Assuming your update route returns 200 for successful completion
      });
    });

    describe("DELETE /api/todoist/delete/:id", () => {
      it("should delete task successfully", async () => {
        const taskId = "3355791117";

        const response = await request(app)
          .delete(`/api/todoist/delete/${taskId}`)
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          );

        expect(response.status).toBe(204);
      });

      it("should handle deletion errors", async () => {
        mockAxios.default.mockImplementationOnce(() => {
          const apiError = new Error("Todoist API Error");
          apiError.response = {
            status: 404,
            data: { error: "Task not found" },
          };
          throw apiError;
        });

        const response = await request(app)
          .delete("/api/todoist/delete/9999999999")
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          );

        expect(response.status).toBe(404);
      });
    });

    describe("GET /api/todoist/tes", () => {
      it("should return test response", async () => {
        const response = await request(app)
          .get("/api/todoist/tes")
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          );

        expect(response.status).toBe(200);
        expect(response.text).toBe("tes");
      });
    });
  });

  // ============ CODECHECK CONTROLLER TESTS ============
  describe("CodeCheckController", () => {
    describe("GET /api/codecheck/tes", () => {
      it("should return test response", async () => {
        const response = await request(app)
          .get("/api/codecheck/tes")
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          );

        expect(response.status).toBe(200);
        expect(response.text).toBe("tes");
      });
    });

    describe("POST /api/codecheck/", () => {
      it("should successfully analyze code and create Todoist tasks", async () => {
        const response = await request(app)
          .post("/api/codecheck/")
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          )
          .send({
            requirements: testRequirements,
            code: testCode,
          });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          message:
            "Code analyzed, checklist generated, and tasks created in Todoist.",
          simplifiedChecklist: mockGeminiResponse,
          next: "Check your Todoist account for the generated tasks based on the analysis.",
        });
      });

      it("should handle missing requirements", async () => {
        const response = await request(app)
          .post("/api/codecheck/")
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          )
          .send({ code: testCode });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain(
          "Exam requirements text is required"
        );
      });

      it("should handle empty requirements", async () => {
        const response = await request(app)
          .post("/api/codecheck/")
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          )
          .send({
            requirements: "   ",
            code: testCode,
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain(
          "Exam requirements text is required"
        );
      });

      it("should handle missing code", async () => {
        const response = await request(app)
          .post("/api/codecheck/")
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          )
          .send({ requirements: testRequirements });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain(
          "User code snippet is required"
        );
      });

      it("should handle empty code", async () => {
        const response = await request(app)
          .post("/api/codecheck/")
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          )
          .send({
            requirements: testRequirements,
            code: "",
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain(
          "User code snippet is required"
        );
      });

      it("should handle missing TODOIST_API_KEY", async () => {
        const originalApiKey = process.env.TODOIST_API_KEY;
        delete process.env.TODOIST_API_KEY;

        const response = await request(app)
          .post("/api/codecheck/")
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          )
          .send({
            requirements: testRequirements,
            code: testCode,
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain("Server configuration error");

        process.env.TODOIST_API_KEY = originalApiKey;
      });

      it("should handle Gemini service errors", async () => {
        const geminiError = new Error("Gemini API quota exceeded");
        generateStructured.mockRejectedValueOnce(geminiError);

        const response = await request(app)
          .post("/api/codecheck/")
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          )
          .send({
            requirements: testRequirements,
            code: testCode,
          });

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ message: "Internal server error" });
      });

      it("should handle BadRequest errors properly", async () => {
        const badRequestError = new Error("Custom bad request message");
        badRequestError.name = "BadRequest";
        generateStructured.mockRejectedValueOnce(badRequestError);

        const response = await request(app)
          .post("/api/codecheck/")
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          )
          .send({
            requirements: testRequirements,
            code: testCode,
          });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          message: "Custom bad request message",
        });
      });

      it("should handle TodoistApiError properly", async () => {
        const todoistError = new Error("Todoist API specific error");
        todoistError.name = "TodoistApiError";
        todoistError.statusCode = 403;
        mockAxios.post.mockRejectedValueOnce(todoistError); // Use mockAxios.post here

        const response = await request(app)
          .post("/api/codecheck/")
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          )
          .send({
            requirements: testRequirements,
            code: testCode,
          });

        expect(response.status).toBe(403);
        expect(response.body.message).toBe("Todoist API specific error");
      });

      it("should handle non-string requirements", async () => {
        const response = await request(app)
          .post("/api/codecheck/")
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          )
          .send({
            requirements: { invalid: "object" },
            code: testCode,
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain(
          "Exam requirements text is required"
        );
      });

      it("should handle non-string code", async () => {
        const response = await request(app)
          .post("/api/codecheck/")
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          )
          .send({
            requirements: testRequirements,
            code: 12345,
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain(
          "User code snippet is required"
        );
      });

      it("should process large code submissions", async () => {
        const largeCode =
          "function test() {\n" + '   console.log("test");\n'.repeat(100) + "}";

        const response = await request(app)
          .post("/api/codecheck/")
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          )
          .send({
            requirements: testRequirements,
            code: largeCode,
          });

        expect(response.status).toBe(200);
        expect(generateStructured).toHaveBeenCalledWith(
          expect.stringContaining(largeCode),
          expect.any(Object)
        );
      });

      it("should handle Gemini response with maximum checklist items", async () => {
        const maxItemsResponse = {
          summary: "Test with max items",
          checklist: Array(30)
            .fill(null)
            .map((_, i) => ({
              itemDescription: `Requirement ${i + 1}`,
              isCompleted: i % 2 === 0,
              details: `Details for requirement ${i + 1}`,
            })),
        };

        generateStructured.mockResolvedValueOnce(maxItemsResponse);

        const response = await request(app)
          .post("/api/codecheck/")
          .set(
            "Authorization",
            "Bearer 7e78415613fc979e1e10e64bed0610cf23244265"
          )
          .send({
            requirements: testRequirements,
            code: testCode,
          });

        expect(response.status).toBe(200);
        expect(response.body.simplifiedChecklist.checklist).toHaveLength(30);
      });
    });
  });

  // ============ HEALTH CHECK TEST ============
  describe("Health Check", () => {
    it("should return health status", async () => {
      const response = await request(app).get("/api/health");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: "OK",
        message: "DevChecklist.AI API is running",
        timestamp: expect.any(String),
      });
    });
  });

  // ============ 404 HANDLER TEST ============
  describe("404 Handler", () => {
    it("should return 404 for unknown routes", async () => {
      const response = await request(app).get("/api/unknown/route");

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: "Not Found",
        message: "Route /api/unknown/route not found",
      });
    });
  });
});
