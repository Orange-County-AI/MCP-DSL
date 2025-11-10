/**
 * Decompiler: Transforms JSON-RPC 2.0 messages back to MCP-DSL
 */

import type {
  JsonRpcMessageType,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcError,
  McpToolDefinition,
  McpResourceDefinition,
  McpPromptDefinition,
} from '../compiler/json-rpc-types.js';
import { getDslFieldName } from '../utils/mappings.js';
import { flattenToDottedPaths } from '../utils/string-utils.js';

/**
 * Decompiler class that transforms JSON-RPC to DSL text
 */
export class Decompiler {
  private indentLevel = 0;
  private indentSize = 2;

  /**
   * Decompile JSON-RPC messages to DSL
   */
  decompile(messages: JsonRpcMessageType[]): string {
    return messages.map(msg => this.decompileMessage(msg)).join('\n');
  }

  /**
   * Decompile tool definitions to DSL
   */
  decompileTools(tools: McpToolDefinition[]): string {
    return tools.map(tool => this.decompileTool(tool)).join('\n\n');
  }

  /**
   * Decompile resource definitions to DSL
   */
  decompileResources(resources: McpResourceDefinition[]): string {
    return resources.map(res => this.decompileResource(res)).join('\n\n');
  }

  /**
   * Decompile prompt definitions to DSL
   */
  decompilePrompts(prompts: McpPromptDefinition[]): string {
    return prompts.map(prompt => this.decompilePrompt(prompt)).join('\n\n');
  }

  // ============================================================================
  // Messages
  // ============================================================================

  private decompileMessage(message: JsonRpcMessageType): string {
    if ('method' in message && 'id' in message) {
      return this.decompileRequest(message as JsonRpcRequest);
    } else if ('result' in message) {
      return this.decompileResponse(message as JsonRpcResponse);
    } else if ('method' in message) {
      return this.decompileNotification(message as JsonRpcNotification);
    } else if ('error' in message) {
      return this.decompileError(message as JsonRpcError);
    }
    throw new Error('Unknown message type');
  }

  private decompileRequest(request: JsonRpcRequest): string {
    let result = `> ${request.method}#${request.id}`;

    if (request.params) {
      result += ' ' + this.decompileObject(request.params);
    }

    return result;
  }

  private decompileResponse(response: JsonRpcResponse): string {
    let result = `< #${response.id}`;

    if (response.result !== undefined) {
      result += ' ' + this.decompileValue(response.result);
    }

    return result;
  }

  private decompileNotification(notification: JsonRpcNotification): string {
    let result = `! ${notification.method}`;

    if (notification.params) {
      result += ' ' + this.decompileObject(notification.params);
    }

    return result;
  }

  private decompileError(error: JsonRpcError): string {
    const { id, error: err } = error;
    return `x #${id} ${err.code}: "${err.message}"${err.data ? ' ' + this.decompileValue(err.data) : ''}`;
  }

  // ============================================================================
  // Definitions
  // ============================================================================

  private decompileTool(tool: McpToolDefinition): string {
    const parts: string[] = [];

    if (tool.description) {
      parts.push(`desc: "${tool.description}"`);
    }

    if (tool.inputSchema) {
      parts.push(`in: ${this.decompileValue(tool.inputSchema)}`);
    }

    if (tool.outputSchema) {
      parts.push(`out: ${this.decompileValue(tool.outputSchema)}`);
    }

    // Add annotations
    if (tool.annotations) {
      for (const [key, value] of Object.entries(tool.annotations)) {
        if (value === true) {
          parts.push(`@${key}`);
        } else {
          parts.push(`@${key}: ${this.decompileValue(value)}`);
        }
      }
    }

    return `T ${tool.name} {${parts.join(', ')}}`;
  }

  private decompileResource(resource: McpResourceDefinition): string {
    const parts: string[] = [];

    if (resource.uri) {
      parts.push(`uri: "${resource.uri}"`);
    }

    if (resource.mimeType) {
      parts.push(`mime: "${resource.mimeType}"`);
    }

    if (resource.description) {
      parts.push(`desc: "${resource.description}"`);
    }

    // Add annotations
    if (resource.annotations) {
      for (const [key, value] of Object.entries(resource.annotations)) {
        if (value === true) {
          parts.push(`@${key}`);
        } else {
          parts.push(`@${key}: ${this.decompileValue(value)}`);
        }
      }
    }

    const name = resource.name || 'resource';
    return `R ${name} {${parts.join(', ')}}`;
  }

  private decompilePrompt(prompt: McpPromptDefinition): string {
    const parts: string[] = [];

    if (prompt.description) {
      parts.push(`desc: "${prompt.description}"`);
    }

    if (prompt.arguments) {
      parts.push(`args: ${this.decompileValue(prompt.arguments)}`);
    }

    if (prompt.messages) {
      parts.push(`msgs: ${this.decompileValue(prompt.messages)}`);
    }

    return `P ${prompt.name} {${parts.join(', ')}}`;
  }

  // ============================================================================
  // Values
  // ============================================================================

  private decompileValue(value: any): string {
    if (value === null) {
      return 'null';
    }

    if (value === undefined) {
      return 'null';
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    if (typeof value === 'string') {
      return `"${this.escapeString(value)}"`;
    }

    if (Array.isArray(value)) {
      return this.decompileArray(value);
    }

    if (typeof value === 'object') {
      return this.decompileObject(value);
    }

    return String(value);
  }

  private decompileArray(arr: any[]): string {
    if (arr.length === 0) {
      return '[]';
    }

    const items = arr.map(item => this.decompileValue(item));
    return `[${items.join(', ')}]`;
  }

  private decompileObject(obj: Record<string, any>): string {
    if (Object.keys(obj).length === 0) {
      return '{}';
    }

    const pairs: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
      // Apply reverse field name mappings
      const dslKey = this.applyReverseFieldMapping(key, value);

      // Handle special cases
      if (key === 'isError' && typeof value === 'boolean') {
        // isError: false -> ok: true (negated)
        pairs.push(`ok: ${!value}`);
        continue;
      }

      // Handle capabilities as bare names
      if (key === 'capabilities' && typeof value === 'object' && !Array.isArray(value)) {
        const capPaths = flattenToDottedPaths(value);
        if (capPaths.length === 0) {
          pairs.push(`${dslKey}: {}`);
        } else if (capPaths.length === 1) {
          pairs.push(`${dslKey}: {${capPaths[0]}}`);
        } else {
          pairs.push(`${dslKey}: {${capPaths.join(', ')}}`);
        }
        continue;
      }

      pairs.push(`${dslKey}: ${this.decompileValue(value)}`);
    }

    return `{${pairs.join(', ')}}`;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private applyReverseFieldMapping(jsonKey: string, value: any): string {
    const mapping: Record<string, string> = {
      protocolVersion: 'v',
      capabilities: 'caps',
      clientInfo: 'info',
      serverInfo: 'info',
      arguments: 'args',
      description: 'desc',
      mimeType: 'mime',
      inputSchema: 'in',
      outputSchema: 'out',
      messages: 'msgs',
    };

    return mapping[jsonKey] || jsonKey;
  }

  private escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t')
      .replace(/\r/g, '\\r');
  }

  private indent(): string {
    return ' '.repeat(this.indentLevel * this.indentSize);
  }
}

/**
 * Convenience function to decompile messages to DSL
 */
export function decompile(messages: JsonRpcMessageType[]): string {
  const decompiler = new Decompiler();
  return decompiler.decompile(messages);
}

/**
 * Convenience function to decompile tool definitions
 */
export function decompileTools(tools: McpToolDefinition[]): string {
  const decompiler = new Decompiler();
  return decompiler.decompileTools(tools);
}

/**
 * Convenience function to decompile resource definitions
 */
export function decompileResources(resources: McpResourceDefinition[]): string {
  const decompiler = new Decompiler();
  return decompiler.decompileResources(resources);
}
