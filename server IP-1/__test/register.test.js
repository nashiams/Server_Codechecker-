const request = require("supertest");

// Mock console.log to avoid startup messages
console.log = jest.fn();

// Mock dependencies
jest.mock("../models");
jest.mock("../helpers/jwt");
jest.mock("../helpers/bcrypts");

// Mock authentication middleware
jest.mock("../middlewares/authenticate", () => (req, res, next) => {
  next();
});

// Import mocked dependencies
const { User } = require("../models");
const { signToken } = require("../helpers/jwt");
const { hashPassword } = require("../helpers/bcrypts");

// Import the app
const app = require("../app");

describe("User Registration", () => {
  const testUser = {
    email: "test@example.com",
    password: "TestPassword123!",
    name: "Test User",
  };

  beforeAll(() => {
    // Setup mock implementations
    hashPassword.mockImplementation((password) => `hashed_${password}`);
    signToken.mockImplementation(
      (payload) => `jwt_token_${JSON.stringify(payload)}`
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should successfully register a new user", async () => {
    const mockCreatedUser = {
      id: 1,
      ...testUser,
      password: "hashed_TestPassword123!",
      google_id: null,
      todoist_id: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    User.create.mockResolvedValue(mockCreatedUser);

    const response = await request(app).post("/api/authentic/").send(testUser);

    expect(response.status).toBe(201);

    expect(User.create).toHaveBeenCalledWith(testUser);
  });
});
