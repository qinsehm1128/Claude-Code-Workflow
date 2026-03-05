# First Workflow: Build a Simple API

Complete your first CCW workflow in 30 minutes. We'll build a simple REST API from specification to implementation.

## What We'll Build

A simple users API with:
- GET /users - List all users
- GET /users/:id - Get user by ID
- POST /users - Create new user
- PUT /users/:id - Update user
- DELETE /users/:id - Delete user

## Prerequisites

- CCW installed ([Installation Guide](./installation.md))
- Node.js >= 18.0.0
- Code editor (VS Code recommended)

## Step 1: Create Project (5 minutes)

```bash
# Create project directory
mkdir user-api
cd user-api

# Initialize npm project
npm init -y

# Install dependencies
npm install express
npm install --save-dev typescript @types/node @types/express
```

## Step 2: Generate Specification (5 minutes)

```bash
# Use CCW to generate API specification
ccw cli -p "Generate a REST API specification for a users resource with CRUD operations" --mode analysis
```

CCW will analyze your request and generate a specification document.

## Step 3: Implement API (15 minutes)

```bash
# Implement the API
ccw cli -p "Implement the users API following the specification with Express and TypeScript" --mode write
```

CCW will:
1. Create the project structure
2. Implement the routes
3. Add type definitions
4. Include error handling

## Step 4: Review Code (5 minutes)

```bash
# Review the implementation
ccw cli -p "Review the users API code for quality, security, and best practices" --mode analysis
```

## Step 5: Test and Run

```bash
# Compile TypeScript
npx tsc

# Run the server
node dist/index.js

# Test the API
curl http://localhost:3000/users
```

## Expected Result

You should have:
- `src/index.ts` - Main server file
- `src/routes/users.ts` - User routes
- `src/types/user.ts` - User types
- `src/middleware/error.ts` - Error handling

## Next Steps

- [CLI Reference](../cli/commands.md) - Learn all CLI commands
- [Skills Library](../skills/core-skills.md) - Explore built-in skills
- [Workflow System](../workflows/4-level.md) - Understand workflow orchestration

::: tip Congratulations! 🎉
You've completed your first CCW workflow. You can now use CCW for more complex projects.
:::
