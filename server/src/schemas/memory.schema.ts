import { Type, Static } from '@sinclair/typebox'

// Memory schema
export const MemorySchema = Type.Object({
  id: Type.Number(),
  userId: Type.Number(),
  key: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  content: Type.String(),
  metadata: Type.Optional(Type.Union([Type.Any(), Type.Null()])),
  createdAt: Type.Any(), // Date object from Prisma
  updatedAt: Type.Any()  // Date object from Prisma
})

// Request schemas
export const RememberRequestSchema = Type.Object({
  content: Type.String({ minLength: 1, description: 'The memory content to store' }),
  key: Type.Optional(Type.String({ description: 'Optional categorization key' })),
  metadata: Type.Optional(Type.Any({ description: 'Additional metadata (tags, importance, etc.)' })),
  userId: Type.Optional(Type.Number({ description: 'User ID (optional, defaults to authenticated user)' }))
})

export const RecallRequestSchema = Type.Object({
  key: Type.Optional(Type.String({ description: 'Filter by key' })),
  search: Type.Optional(Type.String({ description: 'Search in content' })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 50, description: 'Maximum number of memories to return' })),
  offset: Type.Optional(Type.Number({ minimum: 0, default: 0, description: 'Number of memories to skip' })),
  userId: Type.Optional(Type.Number({ description: 'User ID (optional, defaults to authenticated user)' }))
})

export const ResetRequestSchema = Type.Object({
  key: Type.Optional(Type.String({ description: 'Only delete memories with this key (optional)' })),
  userId: Type.Optional(Type.Number({ description: 'User ID (optional, defaults to authenticated user)' }))
})

// Response schemas
export const MemoryResponseSchema = MemorySchema

export const RecallResponseSchema = Type.Object({
  memories: Type.Array(MemoryResponseSchema),
  total: Type.Number(),
  hasMore: Type.Boolean()
})

export const ResetResponseSchema = Type.Object({
  deletedCount: Type.Number(),
  message: Type.String()
})

// API Response wrapper
export const ApiResponseSchema = (dataSchema: any) => Type.Object({
  success: Type.Boolean(),
  data: Type.Optional(dataSchema),
  message: Type.Optional(Type.String()),
  error: Type.Optional(Type.String())
})

// Type exports
export type MemoryType = Static<typeof MemorySchema>
export type RememberRequestType = Static<typeof RememberRequestSchema>
export type RecallRequestType = Static<typeof RecallRequestSchema>
export type ResetRequestType = Static<typeof ResetRequestSchema>
export type MemoryResponseType = Static<typeof MemoryResponseSchema>
export type RecallResponseType = Static<typeof RecallResponseSchema>
export type ResetResponseType = Static<typeof ResetResponseSchema>
