const request = require("supertest");
const axios = require("axios"); // This will be the mocked axios
const crypto = require("crypto"); // Needed for randomUUID if used in mocks

// --- Jest Mock Setup ---
// Mock all dependencies needed by TodoistController and its tests.
jest.mock("../models"); // If your TodoistController interacts with database models
jest.mock("../helpers/jwt"); // If authentication is handled before the controller
jest.mock("../helpers/bcrypts"); // Likely not needed by TodoistController, but included for completeness if you copy-pasted
jest.mock("../services/geminiService"); // Unlikely needed by TodoistController, but included for completeness

// Correct Jest mock for axios: Define the mock object directly inside the factory function
jest.mock("axios", () => {
  const mockAxios = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    default: jest.fn(), // For calls like axios(config)
    create: jest.fn(() => mockAxios), // If your code calls axios.create()
  };
  return mockAxios;
});

// Mock crypto.randomUUID if your code (or mocks) uses it
jest.mock("crypto", () => {
  const originalCrypto = jest.requireActual("crypto");
  return {
    ...originalCrypto,
    randomUUID: jest.fn(() => "test-uuid-12345"), // Consistent UUID for predictable task IDs
  };
});

// Mock authentication middleware if your routes are protected
jest.mock("../middlewares/authenticate", () => (req, res, next) => {
  // Directly call next() to bypass authentication in tests
  next();
});

// --- Import Dependencies and the App ---
// Import the mocked modules (they'll refer to your jest.fn()s)
const { User } = require("../models"); // Example, if TodoistController uses User model
const { signToken } = require("../helpers/jwt"); // If your tests need to generate tokens
const { hashPassword, comparePassword } = require("../helpers/bcrypts"); // Unlikely needed
const { generateStructured } = require("../services/geminiService"); // Unlikely needed

// Import the actual Express app instance
const app = require("../app");

describe("TodoistController", () => {
  // --- Global Test Data and Constants ---
  const validApiKey = "test-todoist-api-key-12345";
  const validAuthToken = "Bearer valid-jwt-token"; // This will be mocked by your auth middleware

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
        { itemDescription: "Add input validation", isCompleted: false },
      ],
    },
  };

  // --- beforeEach and afterAll Hooks ---
  beforeAll(async () => {
    // Set global environment variables once before all tests in this file
    process.env.TODOIST_API_KEY = "7e78415613fc979e1e10e64bed0610cf23244265";
    process.env.NODE_ENV = "test";
    process.env.CLIENT_URL = "http://localhost:5173";
  });

  beforeEach(() => {
    // Clear all mocks before each test to ensure a clean state
    jest.clearAllMocks();

    // Set up default mock implementations for axios methods
    // Use the imported 'axios' directly, as it is your mocked instance.

    // Mock axios.default for general axios(config) calls
    axios.default.mockImplementation((config) => {
      // Logic for various Todoist API calls your controller might make
      if (
        config.method === "GET" &&
        config.url ===
          "[https://api.todoist.com/rest/v2/tasks](https://api.todoist.com/rest/v2/tasks)" &&
        config?.headers?.Authorization ===
          `Bearer ${process.env.TODOIST_API_KEY}`
      ) {
        return Promise.resolve({ data: testTasks });
      }
      if (
        config.method === "POST" &&
        config.url ===
          "[https://api.todoist.com/rest/v2/tasks](https://api.todoist.com/rest/v2/tasks)" && // For creating new tasks
        config?.headers?.Authorization ===
          `Bearer ${process.env.TODOIST_API_KEY}`
      ) {
        // Simulate a new task being created
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
        return Promise.resolve({ status: 204, data: {} }); // Todoist close returns 204 No Content
      }
      if (
        config.method === "DELETE" &&
        config.url.startsWith(
          "[https://api.todoist.com/rest/v2/tasks/](https://api.todoist.com/rest/v2/tasks/)"
        ) &&
        config?.headers?.Authorization ===
          `Bearer ${process.env.TODOIST_API_KEY}`
      ) {
        return Promise.resolve({ status: 204, data: {} }); // Todoist delete returns 204 No Content
      }
      // This part handles the internal call your app makes to itself for task creation
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

      // Fallback for unhandled axios.default calls (good for debugging unmocked requests)
      return Promise.reject(
        new Error(
          `Unhandled axios.default call in TodoistController test: ${config.method} ${config.url}`
        )
      );
    });

    // Mock specific axios methods. These will use the `axios.default` logic as a fallback if not explicitly defined here.
    axios.get.mockImplementation((url, config) =>
      axios.default({ method: "GET", url, ...config })
    );
    axios.post.mockImplementation((url, data, config) =>
      axios.default({ method: "POST", url, data, ...config })
    );
    axios.put.mockImplementation((url, data, config) => {
      // Specific mock for PUT, as Todoist API for update might be unique
      if (
        url.startsWith(
          "[https://api.todoist.com/rest/v2/tasks/](https://api.todoist.com/rest/v2/tasks/)"
        ) &&
        config?.headers?.Authorization ===
          `Bearer ${process.env.TODOIST_API_KEY}`
      ) {
        return Promise.resolve({ data: { id: url.split("/").pop(), ...data } }); // Return updated data
      }
      return Promise.reject(
        new Error(
          `Unhandled axios PUT request in TodoistController test: ${url}`
        )
      );
    });
    axios.delete.mockImplementation((url, config) =>
      axios.default({ method: "DELETE", url, ...config })
    );

    // Mock other services if TodoistController uses them
    // Example: generateStructured.mockResolvedValue(mockGeminiResponse);
  });

  afterAll(async () => {
    // Clean up environment variables after all tests in this file complete
    delete process.env.TODOIST_API_KEY;
    delete process.env.NODE_ENV;
    delete process.env.CLIENT_URL;
    jest.clearAllMocks(); // Clear mocks one last time
  });

  // --- Test Cases for TodoistController Endpoints ---

  describe("GET /api/todoist/list", () => {
    it("should retrieve all tasks successfully", async () => {
      const response = await request(app)
        .get("/api/todoist/list")
        .set("Authorization", validAuthToken);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(testTasks);
      expect(axios.default).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          url: "[https://api.todoist.com/rest/v2/tasks](https://api.todoist.com/rest/v2/tasks)",
          headers: {
            Authorization: `Bearer ${validApiKey}`,
            "Content-Type": "application/json",
          },
        })
      );
    });

    it("should handle Todoist API errors", async () => {
      // Override default mock for this specific test
      axios.default.mockImplementationOnce(() => {
        const error = new Error("Todoist API Error");
        error.response = { status: 403, data: { error: "Invalid API key" } };
        throw error;
      });

      const response = await request(app)
        .get("/api/todoist/list")
        .set("Authorization", validAuthToken);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("Invalid API key");
    });

    it("should handle missing API key configuration", async () => {
      const originalApiKey = process.env.TODOIST_API_KEY;
      delete process.env.TODOIST_API_KEY; // Unset for this test

      const response = await request(app)
        .get("/api/todoist/list")
        .set("Authorization", validAuthToken);

      expect(response.status).toBe(500);
      expect(response.body.message).toContain("Todoist API key is missing");

      process.env.TODOIST_API_KEY = originalApiKey; // Restore it
    });
  });

  describe("POST /api/todoist/create", () => {
    it("should create main task and subtasks successfully", async () => {
      const response = await request(app)
        .post("/api/todoist/create")
        .set("Authorization", validAuthToken)
        .send(testChecklistData);

      expect(response.status).toBe(201);
      expect(response.body.message).toContain("successfully");
      expect(response.body.createdTasks).toHaveLength(3);
      expect(axios.default).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: "[https://api.todoist.com/rest/v2/tasks](https://api.todoist.com/rest/v2/tasks)",
          data: expect.objectContaining({ content: testChecklistData.message }),
        })
      );
    });

    it("should handle invalid input format", async () => {
      const response = await request(app)
        .post("/api/todoist/create")
        .set("Authorization", validAuthToken)
        .send({ message: "Invalid format" });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Invalid input format");
    });
  });

  describe("PUT /api/todoist/update/:id", () => {
    it("should update task successfully", async () => {
      const taskId = "3355791117";
      const updates = {
        content: "Updated Task Content",
        description: "Updated Description",
      };

      const response = await request(app)
        .put(`/api/todoist/update/${taskId}`)
        .set("Authorization", validAuthToken)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: taskId, ...updates });
      expect(axios.put).toHaveBeenCalledWith(
        `https://api.todoist.com/rest/v2/tasks/${taskId}`,
        updates,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${validApiKey}`,
          }),
        })
      );
    });

    it("should handle empty update data", async () => {
      const response = await request(app)
        .put("/api/todoist/update/3355791117")
        .set("Authorization", validAuthToken)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("No update data provided.");
    });

    it("should complete task using duplicate update route", async () => {
      const taskId = "3355791117";

      // Mock the specific call to close the task
      axios.post.mockImplementationOnce((url, data, config) => {
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
        .set("Authorization", validAuthToken)
        .send({ completed: true });

      expect(response.status).toBe(200);
      expect(axios.post).toHaveBeenCalledWith(
        `https://api.todoist.com/rest/v2/tasks/${taskId}/close`,
        {}, // Todoist close task often doesn't need a body
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${validApiKey}`,
          }),
        })
      );
    });
  });

  describe("DELETE /api/todoist/delete/:id", () => {
    it("should delete task successfully", async () => {
      const taskId = "3355791117";

      const response = await request(app)
        .delete(`/api/todoist/delete/${taskId}`)
        .set("Authorization", validAuthToken);

      expect(response.status).toBe(204);
      expect(axios.default).toHaveBeenCalledWith(
        // Or axios.delete if preferred
        expect.objectContaining({
          method: "DELETE",
          url: `https://api.todoist.com/rest/v2/tasks/${taskId}`,
          headers: expect.objectContaining({
            Authorization: `Bearer ${validApiKey}`,
          }),
        })
      );
    });

    it("should handle deletion errors", async () => {
      axios.default.mockImplementationOnce(() => {
        const error = new Error("Todoist API Error");
        error.response = { status: 404, data: { error: "Task not found" } };
        throw error;
      });

      const response = await request(app)
        .delete("/api/todoist/delete/9999999999")
        .set("Authorization", validAuthToken);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Task not found");
    });
  });

  describe("GET /api/todoist/tes", () => {
    it("should return test response", async () => {
      const response = await request(app)
        .get("/api/todoist/tes")
        .set("Authorization", validAuthToken);

      expect(response.status).toBe(200);
      expect(response.text).toBe("tes");
    });
  });
});
