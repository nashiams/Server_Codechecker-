const axios = require("axios");

class TodoistController {
  static todoistApiUrl = "https://api.todoist.com/rest/v2";

  // Helper to get the API Key from environment variables
  static getApiKey() {
    const apiKey = process.env.TODOIST_API_KEY;

    if (!apiKey) {
      // This is a critical configuration error. Log it and throw.
      console.error(
        "CRITICAL ERROR: TODOIST_API_KEY is not defined in environment variables."
      );
      throw {
        name: "ConfigurationError",
        message:
          "Todoist API key is missing. Please configure it in your .env file.",
      };
    }
    return apiKey;
  }

  // --- GET ALL TASKS ---
  // This will retrieve all tasks and subtasks from the configured Todoist account.
  static async getTasks(req, res, next) {
    try {
      console.log("masuk");
      const todoistApiKey = TodoistController.getApiKey();
      console.log("Using Todoist API Key:", todoistApiKey);

      const response = await axios({
        method: "GET",
        url: `${TodoistController.todoistApiUrl}/tasks`,
        headers: {
          Authorization: `Bearer ${todoistApiKey}`,
          "Content-Type": "application/json",
        },
      });

      // Todoist API returns an array of tasks.
      // Subtasks are also just tasks with a 'parent_id'.
      // You might want to process this array on the frontend to display them hierarchically.
      res.status(200).json(response.data);
    } catch (error) {
      console.error("Error in TodoistController.getTasks:", error.message);
      // Pass error to global error handler
      next({
        name: "TodoistApiError",
        message:
          error.response?.data?.error ||
          "Failed to retrieve tasks from Todoist.",
        statusCode: error.response?.status || 500,
      });
    }
  }

  // --- CREATE TASK (Main Task and Subtasks) ---
  // This function will create a main task and then its subtasks based on the provided JSON structure.
  static async createTask(req, res, next) {
    try {
      console.log("masukkkkkkkkkkkk");
      const todoistApiKey = TodoistController.getApiKey();
      const { message, simplifiedChecklist } = req.body; // Expecting the exact JSON structure you provided

      console.log("masukkkkkkkkkkkk");

      if (
        !message ||
        !simplifiedChecklist ||
        !simplifiedChecklist.checklist ||
        !simplifiedChecklist.summary
      ) {
        throw {
          name: "BadRequest",
          message:
            "Invalid input format. Expected 'message', 'simplifiedChecklist.checklist', and 'simplifiedChecklist.summary'.",
        };
      }

      const { checklist, summary } = simplifiedChecklist;

      // 1. Create the Main Todoist Task
      const mainTaskPayload = {
        content: message, // 'message' from your JSON maps to main task content
        description: summary, // 'summary' from your JSON maps to main task description
      };

      console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", mainTaskPayload);

      const mainTaskResponse = await axios({
        method: "POST",
        url: `${TodoistController.todoistApiUrl}/tasks`,
        data: mainTaskPayload,
        headers: {
          Authorization: `Bearer ${todoistApiKey}`,
          "Content-Type": "application/json",
          "X-Request-Id": `${Date.now()}-main-task-${crypto.randomUUID()}`, // Idempotency key
        },
      });

      const mainTaskId = mainTaskResponse.data.id;
      const createdTasks = [mainTaskResponse.data]; // Store the main task

      // 2. Loop through checklist items and create them as Subtasks
      for (const item of checklist) {
        if (!item.itemDescription) {
          console.warn(
            "Skipping subtask due to missing itemDescription:",
            item
          );
          continue; // Skip if no description
        }

        const subtaskPayload = {
          content: item.itemDescription,
          parent_id: mainTaskId, // Link subtask to the main task
          // Todoist tasks are incomplete by default on creation.
          // We'll handle 'isCompleted' if needed, with a separate update call.
        };

        const subtaskResponse = await axios({
          method: "POST",
          url: `${TodoistController.todoistApiUrl}/tasks`,
          data: subtaskPayload,
          headers: {
            Authorization: `Bearer ${todoistApiKey}`,
            "Content-Type": "application/json",
            "X-Request-Id": `${Date.now()}-subtask-${crypto.randomUUID()}`, // Idempotency key
          },
        });
        createdTasks.push(subtaskResponse.data);

        // If the subtask is marked as completed in the input, complete it in Todoist
        if (item.isCompleted) {
          await axios({
            method: "POST",
            url: `${TodoistController.todoistApiUrl}/tasks/${subtaskResponse.data.id}/close`,
            headers: {
              Authorization: `Bearer ${todoistApiKey}`,
              "Content-Type": "application/json",
            },
          });
        }
      }

      // Respond with the created tasks (main task + subtasks)
      res.status(201).json({
        message:
          "Checklist tasks and subtasks created successfully in Todoist.",
        createdTasks: createdTasks,
      });
    } catch (error) {
      console.error("Error in TodoistController.createTask:", error.message);
      next({
        name: "TodoistApiError",
        message:
          error.response?.data?.error ||
          "Failed to create tasks in Todoist. Ensure API key is valid and content is not empty.",
        statusCode: error.response?.status || 500,
      });
    }
  }

  // --- UPDATE TASK ---
  // This allows updating a single task (main task or subtask).
  // E.g., changing content, description, or completing it.
  static async updateTask(req, res, next) {
    try {
      const todoistApiKey = TodoistController.getApiKey();
      const { id } = req.params; // Task ID from URL parameter
      const updates = req.body; // Object containing fields to update (e.g., { content: "New text", description: "Updated desc" })

      if (!id) {
        throw {
          name: "BadRequest",
          message: "Task ID is required for update.",
        };
      }
      if (Object.keys(updates).length === 0) {
        throw { name: "BadRequest", message: "No update data provided." };
      }

      // Todoist API uses POST for updates to /tasks/:id
      const response = await axios({
        method: "POST",
        url: `${TodoistController.todoistApiUrl}/tasks/${id}`,
        data: updates,
        headers: {
          Authorization: `Bearer ${todoistApiKey}`,
          "Content-Type": "application/json",
          "X-Request-Id": `${Date.now()}-update-task-${id}-${crypto.randomUUID()}`, // Idempotency key
        },
      });

      res.status(200).json(response.data);
    } catch (error) {
      console.error("Error in TodoistController.updateTask:", error.message);
      next({
        name: "TodoistApiError",
        message:
          error.response?.data?.error || "Failed to update task in Todoist.",
        statusCode: error.response?.status || 500,
      });
    }
  }

  // --- DELETE TASK ---
  static async deleteTask(req, res, next) {
    try {
      const todoistApiKey = TodoistController.getApiKey();
      const { id } = req.params; // Task ID from URL parameter

      if (!id) {
        throw {
          name: "BadRequest",
          message: "Task ID is required for deletion.",
        };
      }

      const response = await axios({
        method: "DELETE",
        url: `${TodoistController.todoistApiUrl}/tasks/${id}`,
        headers: {
          Authorization: `Bearer ${todoistApiKey}`,
        },
      });

      // Todoist API returns 204 No Content for successful deletion
      res.status(204).send();
    } catch (error) {
      console.error("Error in TodoistController.deleteTask:", error.message);
      next({
        name: "TodoistApiError",
        message:
          error.response?.data?.error || "Failed to delete task from Todoist.",
        statusCode: error.response?.status || 500,
      });
    }
  }

  // --- COMPLETE TASK (Renamed from original placeholder) ---
  // This explicitly marks a task as completed in Todoist.
  static async completeTask(req, res, next) {
    try {
      const todoistApiKey = TodoistController.getApiKey();
      const { id } = req.params; // Task ID from URL parameter

      if (!id) {
        throw {
          name: "BadRequest",
          message: "Task ID is required to complete a task.",
        };
      }

      await axios({
        method: "POST",
        url: `${TodoistController.todoistApiUrl}/tasks/${id}/close`, // Specific endpoint to close a task
        headers: {
          Authorization: `Bearer ${todoistApiKey}`,
          "Content-Type": "application/json",
        },
      });

      res.status(204).send(); // 204 No Content for successful operation
    } catch (error) {
      console.error("Error in TodoistController.completeTask:", error.message);
      next({
        name: "TodoistApiError",
        message:
          error.response?.data?.error || "Failed to complete task in Todoist.",
        statusCode: error.response?.status || 500,
      });
    }
  }
}

module.exports = TodoistController;
