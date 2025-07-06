const axios = require("axios"); // For making HTTP requests (e.g., to your own Todoist endpoint)
const crypto = require("crypto"); // Node.js built-in module for generating unique IDs (for X-Request-Id)
// const generateStructured = require("../services/geminiService"); // Import the unchanged geminiService
// const { default: generateStructured } = require("../services/geminiService");
const { generateStructured } = require("../services/geminiService");

// Define the JSON schema for the AI's output.
// This ensures the Gemini API returns data in a predictable and usable format.
const checklistSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "Text Summary Checklist",
  type: "object",
  properties: {
    summary: {
      type: "string",
    },
    checklist: {
      type: "array",
      items: {
        type: "object",
        properties: {
          itemDescription: {
            type: "string",
          },
          isCompleted: {
            type: "boolean",
            default: false,
          },
          // priority and dueDate can be added here if you want Gemini to output them
        },
        // Ensure these properties are always present in each checklist item
        required: ["itemDescription", "isCompleted"],
        // Disallow any additional properties not defined in the schema
        additionalProperties: false,
      },
      // Ensure at least one checklist item is generated
      minItems: 1,
      // Increased maxItems to 30 as per request
      maxItems: 30,
      // unevaluatedItems can be used for stricter validation of items outside 'properties'
      // For this schema, `additionalProperties: false` is sufficient.
    },
  },
  // Ensure both summary and checklist are present in the top-level response
  required: ["summary", "checklist"],
  // Disallow any additional top-level properties
  additionalProperties: false,
};

class CodeCheckController {
  // Make the schema accessible within the class
  static checklistSchema = checklistSchema;

  /**
   * Handles the request to analyze user code against requirements and
   * create corresponding tasks in Todoist.
   * @param {object} req - The Express request object, expected to contain
   * 'requirements' and 'code' in the body.
   * @param {object} res - The Express response object.
   * @param {function} next - The Express next middleware function for error handling.
   */

  static async tes(req, res, next) {
    try {
      console.log("tes");
      const { requirements, code } = req.body;
      res.status(200).json({ message: requirements, k: code });
    } catch (error) {
      console.error(error);
    }
  }
  static async submitRequirements(req, res, next) {
    try {
      console.log("masukkkkkk");
      // Extract requirements and code from the request body.
      const { requirements, code } = req.body;

      // Retrieve the Todoist API Key from environment variables.
      // This key is used for authentication with the Todoist API.
      const todoistApiKey = process.env.TODOIST_API_KEY;

      // --- Input Validation ---
      if (
        !requirements ||
        typeof requirements !== "string" ||
        requirements.trim().length === 0
      ) {
        throw {
          name: "BadRequest",
          message: "Exam requirements text is required and cannot be empty.",
        };
      }
      if (!code || typeof code !== "string" || code.trim().length === 0) {
        throw {
          name: "BadRequest",
          message: "User code snippet is required and cannot be empty.",
        };
      }
      if (!todoistApiKey) {
        // This is a critical server-side configuration error.
        console.error(
          "CRITICAL ERROR: TODOIST_API_KEY is not defined in environment variables."
        );
        throw {
          name: "ConfigurationError",
          message:
            "Server configuration error: Todoist API key is missing. Please contact support.",
        };
      }

      //       // --- Construct Gemini Prompt for Code Analysis ---
      //       // This detailed prompt instructs the Gemini model on its role, the input format,
      //       // and the desired structured output for the checklist.
      const geminiPrompt = `
      You are an expert AI Assistant specializing in code review and checklist generation based on provided technical requirements. Your primary role is to evaluate a user's code against a given set of exam requirements.

      For each individual requirement, you must meticulously analyze the 'User Code' to determine whether that specific requirement has been completely and correctly implemented.

      The output must be a JSON object, strictly adhering to the JSON schema provided to you, which includes a 'summary' of your overall assessment and a 'checklist' array.

      For each item in the 'checklist' array:
      - 'itemDescription': This should be the exact text of the requirement from the 'Exam Requirements' list.
      - 'isCompleted': Set this to 'true' if the 'User Code' demonstrably fulfills this specific requirement. Set to 'false' if the requirement is incomplete, incorrect, or entirely missing from the code.
      - 'details': Provide a concise explanation justifying your 'isCompleted' assessment. If 'isCompleted' is true, describe *how* the code fulfills it (e.g., "Found a function 'loginUser' that handles authentication"). If 'isCompleted' is false, explain *what is missing or incorrect* (e.g., "Missing JWT token generation after successful login").

      ---
      Exam Requirements:
      ${requirements}

      User Code:
      \`\`\`
      ${code}
      \`\`\`

      Task: Analyze the 'User Code' against each 'Exam Requirement' and generate a JSON checklist. Ensure the 'isCompleted' status and 'details' are accurate based on the code provided.

      Response format:
      {
        "summary": "A concise overall summary of how well the provided code fulfills the exam requirements. This should be a brief general assessment.",
        "checklist": [
          {
            "itemDescription": "Requirement 1 text exactly as written in Exam Requirements",
            "isCompleted": true|false,
            "details": "Specific explanation of implementation or what's missing."
          },
          {
            "itemDescription": "Requirement 2 text exactly as written in Exam Requirements",
            "isCompleted": true|false,
            "details": "Specific explanation of implementation or what's missing."
          }
          // ... continue for all requirements, up to 30 items
        ]
      }
      `.trim(); // .trim() removes any leading/trailing whitespace from the multi-line string.

      // --- Call Gemini API for Structured Analysis ---
      // The generateStructured function (from geminiService.js) handles the API call
      // with the specified model, prompt, and output schema.
      const simplifiedChecklist = await generateStructured(
        geminiPrompt,
        CodeCheckController.checklistSchema // Pass the schema to ensure structured output
      );
      //   res.status(200).json({ message: simplifiedChecklist });
      // --- Prepare Data for Internal Todoist Task Creation ---
      // The TodoistController.createTask expects a specific format.
      // We map the AI's output to this format.
      const todoistTaskData = {
        message: simplifiedChecklist.summary, // Main Todoist task content from AI summary
        simplifiedChecklist: {
          checklist: simplifiedChecklist.checklist, // Checklist items as Todoist subtasks
          summary: simplifiedChecklist.summary, // Main Todoist task description from AI summary
        },
      };

      // --- Make Internal Request to Your Backend's Todoist Endpoint ---
      // This is an internal server-to-server call. It authenticates using the static
      // TODOIST_API_KEY directly, which is handled by the TodoistController itself.
      // We use process.env.PORT to ensure the URL points to your running backend.
      const todoistResponse = await axios.post(
        `http://localhost:3000/api/todoist/create`, // Correct URL for your internal API call
        todoistTaskData,
        {
          headers: {
            Authorization: `Bearer ${todoistApiKey}`, // The Todoist API key for the shared account
            "Content-Type": "application/json",
            // No need for your app's JWT here, as this is a server-to-server call.
            // The authentication with Todoist happens via the Bearer token in TodoistController.
          },
          // An X-Request-Id header for idempotency is a good practice for POST requests
          // to prevent duplicate tasks if the request is retried.
          "X-Request-Id": `${Date.now()}-${crypto.randomUUID()}`,
        }
      );

      // --- Send Success Response to Frontend ---
      // Respond with the AI-generated checklist and optionally the Todoist response for confirmation.
      return res.status(200).json({
        message:
          "Code analyzed, checklist generated, and tasks created in Todoist.",
        simplifiedChecklist, // Send the AI-generated checklist back for frontend display
        // todoistTasks: todoistResponse.data, // Optional: Include Todoist response details
        next: "Check your Todoist account for the generated tasks based on the analysis.",
      });
    } catch (error) {
      // --- Error Handling ---
      console.log(error);
      console.error(
        "Error in CodeCheckController.submitRequirements:",
        error.message
      );
      // Differentiate between various error types for more precise client feedback.
      if (error.name === "BadRequest" || error.name === "ConfigurationError") {
        return res.status(400).json({ message: error.message });
      } else if (error.name === "TodoistApiError") {
        // If the error originated from the internal Todoist API call, use its status code.
        // The TodoistController should ideally set error.statusCode.
        return res
          .status(error.statusCode || 500)
          .json({ message: error.message });
      }
      // For any other unexpected errors, pass them to the global error handler.
      next(error);
    }
  }
}

module.exports = CodeCheckController;
