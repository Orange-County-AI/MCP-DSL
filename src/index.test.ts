import { describe, expect, test } from 'bun:test';
import { compileDsl } from './index.js';

describe('End-to-End Integration', () => {
  test('compiles simple request', () => {
    const source = '> initialize#1 {v: "2025-06-18"}';

    const result = compileDsl(source);

    expect(result.messages.length).toBe(1);

    const request = result.messages[0];
    expect(request.jsonrpc).toBe('2.0');
    expect((request as any).method).toBe('initialize');
    expect((request as any).id).toBe(1);
    expect((request as any).params.protocolVersion).toBe('2025-06-18');
  });

  test('compiles tool definition with schema', () => {
    const source = 'T search {desc: "Search for information", in: {query: str}}';

    const result = compileDsl(source);

    expect(result.definitions.tools).toBeDefined();
    expect(result.definitions.tools?.length).toBe(1);

    const tool = result.definitions.tools![0];
    expect(tool.name).toBe('search');
    expect(tool.description).toBe('Search for information');
    expect(tool.inputSchema).toBeDefined();
  });

  test('compiles resource definition', () => {
    const source = 'R resource1 {uri: "file://test", desc: "Test resource"}';

    const result = compileDsl(source);

    expect(result.definitions.resources?.length).toBe(1);
    expect(result.definitions.resources![0].uri).toBe('file://test');
  });

  test('compiles arrays in values', () => {
    const source = '< #1 {items: [1, 2, 3]}';

    const result = compileDsl(source);
    const response = result.messages[0];

    expect((response as any).result.items).toEqual([1, 2, 3]);
  });
});
