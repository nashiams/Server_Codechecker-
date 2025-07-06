DevChecklist.AI API Documentation
Models :
User

    id: integer, unique (auto-generated)

    email: string, unique (required)

    password: string (required, min 5 characters, hashed)

    name: string (required)

    google_id: string, unique (nullable: present if logged in via Google)

    created_at: datetime (auto-generated)

    updated_at: datetime (auto-generated)

Relationship :

    No explicit many-to-many relationships defined through models in this application.

    User records are stored for authentication purposes.

Endpoints :

List of available endpoints:

Public endpoints:

    GET /api/health

    POST /api/auth/register

    POST /api/auth/login

    POST /api/auth/google

    POST /api/todoist/create-from-ai (Internal Server-to-Server)

Routes below need authentication (Your App's JWT Token Required):

    POST /api/check-code

    GET /api/todoist/tasks

    POST /api/todoist/tasks/:id

    POST /api/todoist/tasks/:id/complete

    DELETE /api/todoist/tasks/:id

1. GET /api/health

Description: Checks the health and responsiveness of the backend server.

Request:

    none

Response (200 - OK)

{
"status": "OK"
}

2. POST /api/auth/register

Description: Registers a new user account with email, password, and name.

Request:

    body:

{
"name": "string",
"email": "string",
"password": "string"
}

Response (201 - Created)

{
"access_token": "your_app_jwt_token",
"user": {
"id": 1,
"name": "string",
"email": "string"
}
}

Error Responses:

    400 Bad Request: If name, email, or password are missing/invalid, or email is already registered.

    {"message": "Email is required"}
    ```json
    {"message": "Password must be at least 5 characters"}
    ```json
    {"message": "Email already exists"}

    500 Internal Server Error: For unexpected server errors.

3. POST /api/auth/login

Description: Authenticates a user with email and password, returning your application's JWT token and user details.

Request:

    body:

{
"email": "string",
"password": "string"
}

Response (200 - OK)

{
"access_token": "your_app_jwt_token",
"user": {
"id": 1,
"name": "string",
"email": "string"
}
}

Error Responses:

    400 Bad Request: If email or password are missing.

    401 Unauthorized: If credentials are invalid.

    {"message": "Invalid email/password"}

    500 Internal Server Error: For unexpected server errors.

4. POST /api/auth/google

Description: Handles user registration or login via Google OAuth. Verifies the Google ID token and issues your application's JWT.

Request:

    body:

{
"googleToken": "string"
}

Response (200 - OK)

{
"access_token": "your_app_jwt_token",
"user": {
"id": 1,
"name": "string",
"email": "string",
"google_id": "string"
}
}

Error Responses:

    400 Bad Request: If googleToken is missing or invalid.

    {"message": "Google Token is required"}

    500 Internal Server Error: For verification failures or database issues.

5. POST /api/todoist/create-from-ai

Description: (INTERNAL SERVER-TO-SERVER ONLY) This endpoint is exclusively used by the CodeCheckController to create a main Todoist task and its subtasks based on AI analysis. It uses the TODOIST_API_KEY for external Todoist API calls and does NOT require your application's JWT for authentication.

Request:

    body:

{
"message": "string (main task content/summary)",
"simplifiedChecklist": {
"checklist": [
{
"itemDescription": "string (subtask content)",
"isCompleted": boolean (whether subtask should be marked complete)
}
// ... more checklist items
],
"summary": "string (main task description)"
}
}

Response (201 - Created)

{
"message": "Checklist tasks and subtasks created successfully in Todoist.",
"createdTasks": [
{
"id": "string",
"content": "string",
"parent_id": null,
"is_completed": false
// ... other Todoist task properties for the main task
},
{
"id": "string",
"content": "string",
"parent_id": "string",
"is_completed": true // or false
// ... other Todoist task properties for a subtask
}
// ... more created task objects
]
}

Error Responses:

    400 Bad Request: If the input JSON format is invalid or missing required fields.

    {"message": "Invalid input format. Expected 'message', 'simplifiedChecklist.checklist', and 'simplifiedChecklist.summary'."}

    401 Unauthorized: If the TODOIST_API_KEY provided in the Authorization header is invalid for the external Todoist API.

    {"message": "Failed to create tasks in Todoist. Ensure API key is valid and content is not empty."}

    500 Internal Server Error: For unexpected errors during Todoist API interaction.

6. POST /api/check-code

Description: Analyzes user-provided code against given requirements using Gemini AI. Upon successful analysis, it triggers the creation of corresponding tasks in the configured Todoist account via an internal API call.

Authentication: Requires your application's JWT in Authorization: Bearer <token>.

Request:

    body:

{
"requirements": "string (exam questions or requirements)",
"code": "string (user's code snippet)"
}

Response (200 - OK)

{
"message": "Code analyzed, checklist generated, and tasks created in Todoist.",
"simplifiedChecklist": {
"summary": "string (AI-generated overall assessment)",
"checklist": [
{
"itemDescription": "string (original requirement text)",
"isCompleted": boolean (AI's assessment of completion),
"details": "string (AI's explanation)"
}
// ... more checklist items
]
},
"next": "string (instruction for user)"
}

Error Responses:

    400 Bad Request: If requirements or code are empty or invalid.

    {"message": "Exam requirements text is required and cannot be empty."}

    401 Unauthorized: If your application's JWT is missing or invalid.

    500 Internal Server Error: For AI processing errors, or if the internal call to /api/todoist/create-from-ai fails.

7. GET /api/todoist/tasks

Description: Retrieves all active tasks (and their subtasks) from the shared Todoist account.

Authentication: Requires your application's JWT in Authorization: Bearer <token>.

Request:

    none

Response (200 - OK)

[
{
"id": "string",
"content": "string (main task content)",
"description": "string (main task description)",
"is_completed": boolean,
"priority": integer,
"project_id": "string",
"parent_id": null,
"subtasks": [
{
"id": "string",
"content": "string (subtask content)",
"is_completed": boolean,
"parent_id": "string"
// ... other subtask properties
}
// ... more subtasks for this task
]
}
// ... more main tasks
]

Error Responses:

    401 Unauthorized: If your application's JWT is missing or invalid.

    500 Internal Server Error: For errors during external Todoist API communication.

8. POST /api/todoist/tasks/:id

Description: Updates an existing task (e.g., content, description) in the shared Todoist account.

Authentication: Requires your application's JWT in Authorization: Bearer <token>.

Request:

    URL Parameters: id (string, Todoist task ID)

    body: (at least one field to update)

{
"content": "string (new task content)",
"description": "string (new task description)",
"priority": integer (1-4, 4 is highest)
// ... other updatable task fields
}

Response (200 - OK)

{
"id": "string",
"content": "string",
"description": "string",
"is_completed": boolean
// ... updated task object
}

Error Responses:

    400 Bad Request: If the request body is invalid or task ID is malformed.

    401 Unauthorized: If your application's JWT is missing or invalid.

    404 Not Found: If the task with the given id does not exist.

    500 Internal Server Error: For errors during external Todoist API communication.

9. POST /api/todoist/tasks/:id/complete

Description: Marks a specific task as completed in the shared Todoist account.

Authentication: Requires your application's JWT in Authorization: Bearer <token>.

Request:

    URL Parameters: id (string, Todoist task ID)

    body: none

Response (204 - No Content)

(No response body is returned for a successful completion)

Error Responses:

    401 Unauthorized: If your application's JWT is missing or invalid.

    404 Not Found: If the task with the given id does not exist.

    500 Internal Server Error: For errors during external Todoist API communication.

10. DELETE /api/todoist/tasks/:id

Description: Deletes a specific task from the shared Todoist account.

Authentication: Requires your application's JWT in Authorization: Bearer <token>.

Request:

    URL Parameters: id (string, Todoist task ID)

    body: none

Response (204 - No Content)

(No response body is returned for a successful deletion)

Error Responses:

    401 Unauthorized: If your application's JWT is missing or invalid.

    404 Not Found: If the task with the given id does not exist.

    500 Internal Server Error: For errors during external Todoist API communication.
