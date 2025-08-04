# Memory API Documentation

The Memory API provides persistent storage for AI conversations and user notes, allowing the system to remember important information across sessions.

## Overview

The Memory API consists of three main operations:

- **Remember**: Store new memories
- **Recall**: Retrieve stored memories with filtering and search
- **Reset**: Delete memories (optionally filtered by key)

## Database Schema

```sql
CREATE TABLE "Memory" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "key" TEXT,                    -- Optional categorization
    "content" TEXT NOT NULL,       -- The memory content
    "metadata" JSONB,              -- Additional metadata
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
```

## API Endpoints

### POST /api/memory/remember

Store a new memory.

**Request Body:**

```json
{
  "content": "string (required)",
  "key": "string (optional)",
  "metadata": "object (optional)",
  "userId": "number (optional)"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "userId": 1,
    "key": "user-preferences",
    "content": "User prefers dark mode",
    "metadata": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Memory stored successfully"
}
```

### POST /api/memory/recall

Retrieve memories with optional filtering.

**Request Body:**

```json
{
  "key": "string (optional)",
  "search": "string (optional)",
  "limit": "number (optional, 1-100, default 50)",
  "offset": "number (optional, default 0)",
  "userId": "number (optional)"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "memories": [
      {
        "id": 1,
        "userId": 1,
        "key": "user-preferences",
        "content": "User prefers dark mode",
        "metadata": null,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 1,
    "hasMore": false
  },
  "message": "Retrieved 1 memories"
}
```

### POST /api/memory/reset

Delete memories, optionally filtered by key.

**Request Body:**

```json
{
  "key": "string (optional)",
  "userId": "number (optional)"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "deletedCount": 5,
    "message": "Deleted 5 memories for user 1"
  },
  "message": "Deleted 5 memories for user 1"
}
```

### GET /api/memory/stats

Get memory statistics for the user.

**Response:**

```json
{
  "success": true,
  "data": {
    "totalMemories": 25,
    "memoriesWithKeys": 15,
    "uniqueKeys": ["user-preferences", "project-info", "important-facts"],
    "oldestMemory": "2024-01-01T00:00:00.000Z",
    "newestMemory": "2024-01-02T00:00:00.000Z"
  },
  "message": "Memory statistics retrieved successfully"
}
```

### GET /api/memory

Convenience endpoint for basic recall using query parameters.

**Query Parameters:**

- `key`: Filter by key
- `search`: Search in content
- `limit`: Maximum results (1-100, default 50)
- `offset`: Skip results (default 0)

## MCP Tools

The Memory API is also available as MCP tools for AI integration:

### memory_remember

Store a new memory or important information.

**Parameters:**

```json
{
  "content": "string (required)",
  "key": "string (optional)",
  "metadata": "object (optional)",
  "userId": "number (optional)"
}
```

### memory_recall

Retrieve stored memories with optional filtering.

**Parameters:**

```json
{
  "key": "string (optional)",
  "search": "string (optional)",
  "limit": "number (optional, 1-100)",
  "offset": "number (optional)",
  "userId": "number (optional)"
}
```

### memory_reset

Delete stored memories, optionally filtered by key.

**Parameters:**

```json
{
  "key": "string (optional)",
  "userId": "number (optional)"
}
```

## Usage Examples

### Storing User Preferences

```json
POST /api/memory/remember
{
  "content": "User prefers dark mode and compact layout",
  "key": "user-preferences",
  "metadata": {
    "category": "ui",
    "importance": "medium"
  }
}
```

### Storing Project Information

```json
POST /api/memory/remember
{
  "content": "Working on e-commerce project using React, TypeScript, and Prisma",
  "key": "project-details",
  "metadata": {
    "technologies": ["React", "TypeScript", "Prisma"],
    "status": "in-progress"
  }
}
```

### Searching for Technical Info

```json
POST /api/memory/recall
{
  "search": "React",
  "limit": 10
}
```

### Getting User Preferences

```json
POST /api/memory/recall
{
  "key": "user-preferences"
}
```

### Cleaning Up Old Project Data

```json
POST /api/memory/reset
{
  "key": "old-project"
}
```

## Best Practices

1. **Use Keys for Organization**: Categorize memories with meaningful keys like `user-preferences`, `project-info`, `important-facts`.

2. **Include Context in Content**: Make memory content self-contained and descriptive.

3. **Use Metadata for Structure**: Store additional structured data in the metadata field.

4. **Regular Cleanup**: Periodically reset outdated memories to keep the system organized.

5. **Search Functionality**: Use the search parameter to find memories containing specific terms.

## Integration with AI

The Memory API is designed to work seamlessly with AI conversations:

- **Automatic Storage**: AI can remember important facts, preferences, and context
- **Context Retrieval**: AI can recall relevant memories to provide better responses
- **Learning**: AI can build up knowledge about users and projects over time
- **Personalization**: User preferences and patterns can be remembered and applied

## Error Handling

All endpoints return standard error responses:

```json
{
  "success": false,
  "error": "Error message description"
}
```

Common error scenarios:

- Missing required fields (400)
- Invalid parameters (400)
- Database connection issues (500)
- Authorization failures (403)

## Testing

Run the memory API tests:

```bash
npm run test:memory
```

This will test all memory operations including storing, retrieving, searching, and deleting memories.
