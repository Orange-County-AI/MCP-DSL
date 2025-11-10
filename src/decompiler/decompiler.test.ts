import { describe, expect, test } from 'bun:test';
import { decompile, decompileTools, decompileResources } from './decompiler.js';
import type { JsonRpcRequest, JsonRpcResponse, JsonRpcNotification, JsonRpcError } from '../compiler/json-rpc-types.js';

describe('Decompiler', () => {
  test('decompiles simple request', () => {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
      },
    };

    const result = decompile([request]);
    expect(result).toBe('> initialize#1 {v: "2025-06-18"}');
  });

  test('decompiles response', () => {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: {
        status: 'ok',
        value: 42,
      },
    };

    const result = decompile([response]);
    expect(result).toBe('< #1 {status: "ok", value: 42}');
  });

  test('decompiles notification', () => {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    };

    const result = decompile([notification]);
    expect(result).toBe('! notifications/initialized');
  });

  test('decompiles error message', () => {
    const error: JsonRpcError = {
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: -32600,
        message: 'Invalid Request',
      },
    };

    const result = decompile([error]);
    expect(result).toBe('x #1 -32600: "Invalid Request"');
  });

  test('applies field name mappings', () => {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
      },
    };

    const result = decompile([request]);
    expect(result).toContain('v: "2025-06-18"');
    expect(result).toContain('caps: {}');
  });

  test('handles isError field negation', () => {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: {
        isError: false,
      },
    };

    const result = decompile([response]);
    expect(result).toContain('ok: true'); // isError: false -> ok: true
  });

  test('decompiles arrays', () => {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: {
        items: [1, 2, 3],
      },
    };

    const result = decompile([response]);
    expect(result).toContain('items: [1, 2, 3]');
  });

  test('decompiles nested objects', () => {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: {
        data: {
          value: 42,
        },
      },
    };

    const result = decompile([response]);
    expect(result).toContain('data: {value: 42}');
  });

  test('decompiles tool definition', () => {
    const tool = {
      name: 'search',
      description: 'Search for information',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
      },
    };

    const result = decompileTools([tool]);
    expect(result).toContain('T search');
    expect(result).toContain('desc: "Search for information"');
  });

  test('decompiles resource definition', () => {
    const resource = {
      name: 'weather',
      uri: 'weather://current/NYC',
      mimeType: 'application/json',
      description: 'Weather data',
    };

    const result = decompileResources([resource]);
    expect(result).toContain('R weather');
    expect(result).toContain('uri: "weather://current/NYC"');
    expect(result).toContain('mime: "application/json"');
  });

  test('handles capabilities as bare names', () => {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        capabilities: {
          tools: {},
          resources: {
            subscribe: true,
          },
        },
      },
    };

    const result = decompile([request]);
    expect(result).toContain('caps: {tools, resources.subscribe}');
  });

  test('escapes strings correctly', () => {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: {
        message: 'Line 1\nLine 2\tTab',
      },
    };

    const result = decompile([response]);
    expect(result).toContain('\\n');
    expect(result).toContain('\\t');
  });
});
