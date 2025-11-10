import { describe, expect, test } from 'bun:test';
import { compileDsl } from './index.js';
import { decompile, decompileTools, decompileResources } from './decompiler/decompiler.js';
import { tokenize } from './lexer/lexer.js';
import { parse } from './parser/parser.js';
import { compile } from './compiler/compiler.js';

describe('Round-Trip Tests', () => {
  test('simple request round-trips', () => {
    const original = '> initialize#1 {v: "2025-06-18"}';

    // DSL -> JSON
    const result = compileDsl(original);
    expect(result.messages.length).toBe(1);

    // JSON -> DSL
    const decompiled = decompile(result.messages);
    expect(decompiled).toBe(original);
  });

  test('response round-trips', () => {
    const original = '< #1 {value: 42}';

    const result = compileDsl(original);
    const decompiled = decompile(result.messages);

    expect(decompiled).toBe(original);
  });

  test('notification round-trips', () => {
    const original = '! notifications/initialized';

    const result = compileDsl(original);
    const decompiled = decompile(result.messages);

    expect(decompiled).toBe(original);
  });

  test('error message round-trips', () => {
    const original = 'x #1 -32600: "Invalid Request"';

    const result = compileDsl(original);
    const decompiled = decompile(result.messages);

    expect(decompiled).toBe(original);
  });

  test('field mappings round-trip', () => {
    const original = '> initialize#1 {v: "2025-06-18", caps: {}}';

    const result = compileDsl(original);
    const decompiled = decompile(result.messages);

    // Check that field mappings are preserved
    expect(decompiled).toContain('v:');
    expect(decompiled).toContain('caps:');
  });

  test('ok field negation round-trips', () => {
    const original = '< #1 {ok: true}';

    const result = compileDsl(original);
    // JSON has isError: false
    expect((result.messages[0] as any).result.isError).toBe(false);

    const decompiled = decompile(result.messages);
    // Decompiled back to ok: true
    expect(decompiled).toContain('ok: true');
  });

  test('arrays round-trip', () => {
    const original = '< #1 {items: [1, 2, 3]}';

    const result = compileDsl(original);
    const decompiled = decompile(result.messages);

    expect(decompiled).toBe(original);
  });

  test('nested objects round-trip', () => {
    const original = '< #1 {data: {value: 42}}';

    const result = compileDsl(original);
    const decompiled = decompile(result.messages);

    expect(decompiled).toBe(original);
  });

  test('capabilities round-trip', () => {
    const original = '> initialize#1 {caps: {}}';

    const result = compileDsl(original);
    expect((result.messages[0] as any).params.capabilities).toBeDefined();

    const decompiled = decompile(result.messages);
    expect(decompiled).toContain('caps: {}');
  });

  test('tool definition round-trips', () => {
    const original = 'T search {desc: "Search tool"}';

    const tokens = tokenize(original);
    const ast = parse(tokens);
    const result = compile(ast);

    expect(result.definitions.tools).toBeDefined();
    expect(result.definitions.tools?.length).toBe(1);

    const decompiled = decompileTools(result.definitions.tools!);
    expect(decompiled).toContain('T search');
    expect(decompiled).toContain('desc: "Search tool"');
  });

  test('resource definition round-trips', () => {
    const original = 'R weather {uri: "weather://current"}';

    const tokens = tokenize(original);
    const ast = parse(tokens);
    const result = compile(ast);

    expect(result.definitions.resources).toBeDefined();
    expect(result.definitions.resources?.length).toBe(1);

    const decompiled = decompileResources(result.definitions.resources!);
    expect(decompiled).toContain('R weather');
    expect(decompiled).toContain('uri: "weather://current"');
  });

  test('string escaping round-trips', () => {
    const original = '< #1 {msg: "Line1\\nLine2"}';

    const result = compileDsl(original);
    expect((result.messages[0] as any).result.msg).toBe('Line1\nLine2');

    const decompiled = decompile(result.messages);
    expect(decompiled).toContain('\\n');
  });

  test('boolean values round-trip', () => {
    const original = '< #1 {success: true, failed: false}';

    const result = compileDsl(original);
    const decompiled = decompile(result.messages);

    expect(decompiled).toContain('success: true');
    expect(decompiled).toContain('failed: false');
  });

  test('null values round-trip', () => {
    const original = '< #1 {value: null}';

    const result = compileDsl(original);
    expect((result.messages[0] as any).result.value).toBeNull();

    const decompiled = decompile(result.messages);
    expect(decompiled).toContain('value: null');
  });

  test('mixed value types round-trip', () => {
    const original = '< #1 {str: "test", num: 42, bool: true, arr: [1, 2]}';

    const result = compileDsl(original);
    const decompiled = decompile(result.messages);

    expect(decompiled).toContain('str: "test"');
    expect(decompiled).toContain('num: 42');
    expect(decompiled).toContain('bool: true');
    expect(decompiled).toContain('arr: [1, 2]');
  });

  test('semantic equivalence after round-trip', () => {
    const original = '> tools/call#42 {name: "search", args: {query: "test"}}';

    // First pass: DSL -> JSON
    const firstResult = compileDsl(original);
    const firstJson = JSON.stringify(firstResult.messages[0]);

    // Round-trip: DSL -> JSON -> DSL -> JSON
    const decompiled = decompile(firstResult.messages);
    const secondResult = compileDsl(decompiled);
    const secondJson = JSON.stringify(secondResult.messages[0]);

    // JSON should be identical after round-trip
    expect(firstJson).toBe(secondJson);
  });
});
