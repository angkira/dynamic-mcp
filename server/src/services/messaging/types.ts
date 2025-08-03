export interface ToolCallData {
  toolName: string;
  parameters: Record<string, unknown>;
}

export interface ToolResultData {
  toolName: string;
  result: unknown;
}
