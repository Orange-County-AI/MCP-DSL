/**
 * JSON-RPC 2.0 types for MCP
 */

export interface JsonRpcMessage {
  jsonrpc: '2.0';
}

export interface JsonRpcRequest extends JsonRpcMessage {
  id: number | string;
  method: string;
  params?: Record<string, any>;
}

export interface JsonRpcResponse extends JsonRpcMessage {
  id: number | string;
  result?: any;
}

export interface JsonRpcNotification extends JsonRpcMessage {
  method: string;
  params?: Record<string, any>;
}

export interface JsonRpcError extends JsonRpcMessage {
  id: number | string;
  error: {
    code: number;
    message: string;
    data?: any;
  };
}

export type JsonRpcMessageType = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification | JsonRpcError;

/**
 * JSON Schema types
 */
export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: any[];
  oneOf?: JsonSchema[];
  format?: string;
  contentEncoding?: string;
  default?: any;
  description?: string;
  [key: string]: any;
}

/**
 * MCP-specific types
 */
export interface McpCapabilities {
  [key: string]: any | McpCapabilities;
}

export interface McpImplementation {
  name: string;
  version: string;
}

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema;
  annotations?: Record<string, any>;
}

export interface McpResourceDefinition {
  name?: string;
  uri: string;
  mimeType?: string;
  description?: string;
  annotations?: Record<string, any>;
}

export interface McpPromptDefinition {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  messages?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: any;
  }>;
}

export interface McpContent {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;
  [key: string]: any;
}
