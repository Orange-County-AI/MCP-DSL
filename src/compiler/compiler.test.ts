import { describe, expect, test } from 'bun:test';
import { tokenize } from '../lexer/lexer.js';
import { parse } from '../parser/parser.js';
import { compile } from './compiler.js';

describe('Compiler', () => {
  test('compiles simple request message', () => {
    const source = '> initialize#1 {v: "2025-06-18"}';
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const result = compile(ast);

    expect(result.messages.length).toBe(1);

    const message = result.messages[0];
    expect(message.jsonrpc).toBe('2.0');
    expect((message as any).method).toBe('initialize');
    expect((message as any).id).toBe(1);
    expect((message as any).params).toBeDefined();
    expect((message as any).params.protocolVersion).toBe('2025-06-18');
  });

  test('compiles response message', () => {
    const source = '< #1 {ok: true, value: 42}';
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const result = compile(ast);

    expect(result.messages.length).toBe(1);

    const message = result.messages[0];
    expect(message.jsonrpc).toBe('2.0');
    expect((message as any).id).toBe(1);
    expect((message as any).result).toBeDefined();
    expect((message as any).result.isError).toBe(false); // ok: true -> isError: false
    expect((message as any).result.value).toBe(42);
  });

  test('compiles notification message', () => {
    const source = '! notifications/initialized';
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const result = compile(ast);

    expect(result.messages.length).toBe(1);

    const message = result.messages[0];
    expect(message.jsonrpc).toBe('2.0');
    expect((message as any).method).toBe('notifications/initialized');
    expect((message as any).id).toBeUndefined();
  });

  test('compiles error message', () => {
    const source = 'x #1 -32600: "Invalid Request"';
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const result = compile(ast);

    expect(result.messages.length).toBe(1);

    const message = result.messages[0];
    expect(message.jsonrpc).toBe('2.0');
    expect((message as any).id).toBe(1);
    expect((message as any).error).toBeDefined();
    expect((message as any).error.code).toBe(-32600);
    expect((message as any).error.message).toBe('Invalid Request');
  });

  test('compiles tool definition', () => {
    const source = 'T search {desc: "Search for information", in: {query: str}}';
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const result = compile(ast);

    expect(result.definitions.tools).toBeDefined();
    expect(result.definitions.tools?.length).toBe(1);

    const tool = result.definitions.tools![0];
    expect(tool.name).toBe('search');
    expect(tool.description).toBe('Search for information');
    expect(tool.inputSchema).toBeDefined();
  });

  test('compiles resource definition', () => {
    const source = 'R weather {uri: "weather://current/NYC", mime: "application/json"}';
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const result = compile(ast);

    expect(result.definitions.resources).toBeDefined();
    expect(result.definitions.resources?.length).toBe(1);

    const resource = result.definitions.resources![0];
    expect(resource.name).toBe('weather');
    expect(resource.uri).toBe('weather://current/NYC');
    expect(resource.mimeType).toBe('application/json');
  });

  test('applies field name mappings', () => {
    const source = '> initialize#1 {v: "2025-06-18", caps: {}}';
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const result = compile(ast);

    const message = result.messages[0];
    expect((message as any).params.protocolVersion).toBe('2025-06-18');
    expect((message as any).params.capabilities).toBeDefined();
  });

  test('handles ok field negation', () => {
    const source = '< #1 {ok: false}';
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const result = compile(ast);

    const message = result.messages[0];
    expect((message as any).result.isError).toBe(true); // ok: false -> isError: true
  });

  test('compiles arrays', () => {
    const source = '< #1 {items: [1, 2, 3], names: ["a", "b"]}';
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const result = compile(ast);

    const message = result.messages[0];
    expect((message as any).result.items).toEqual([1, 2, 3]);
    expect((message as any).result.names).toEqual(['a', 'b']);
  });

  test('compiles nested objects', () => {
    const source = '< #1 {data: {nested: {value: 42}}}';
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const result = compile(ast);

    const message = result.messages[0];
    expect((message as any).result.data.nested.value).toBe(42);
  });

  test('handles annotations', () => {
    const source = 'T test {@readonly, @priority: 1.0}';
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const result = compile(ast);

    const tool = result.definitions.tools![0];
    expect(tool.annotations).toBeDefined();
    // Annotations are extracted during compilation
  });
});
