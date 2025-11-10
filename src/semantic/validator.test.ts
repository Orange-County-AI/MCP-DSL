import { describe, expect, test } from 'bun:test';
import { tokenize } from '../lexer/lexer.js';
import { parse } from '../parser/parser.js';
import { validateDocument } from './validator.js';
import { DiagnosticSeverity } from '../types/common.js';

describe('Semantic Validator', () => {
  test('validates valid document', () => {
    const source = '> initialize#1 {v: "2025-06-18"}';
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const result = validateDocument(ast);

    expect(result.valid).toBe(true);
    expect(result.diagnostics.length).toBe(0);
  });

  test('detects negative message ID', () => {
    const source = '> initialize#-1 {v: "2025-06-18"}';
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const result = validateDocument(ast);

    expect(result.valid).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
    expect(result.diagnostics[0].message).toContain('non-negative');
  });

  test('validates tool definition requires description', () => {
    const source = 'T search {in: {query: str}}';
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const result = validateDocument(ast);

    expect(result.diagnostics.length).toBeGreaterThan(0);
    const warning = result.diagnostics.find(d => d.message.includes('description'));
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe(DiagnosticSeverity.Warning);
  });

  test('validates resource requires URI', () => {
    const source = 'R weather {desc: "Weather data"}';
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const result = validateDocument(ast);

    expect(result.valid).toBe(false);
    const error = result.diagnostics.find(d => d.message.includes('uri'));
    expect(error).toBeDefined();
    expect(error?.severity).toBe(DiagnosticSeverity.Error);
  });

  test('validates valid resource definition', () => {
    const source = 'R weather {uri: "weather://current", desc: "Weather data"}';
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const result = validateDocument(ast);

    expect(result.valid).toBe(true);
  });

  test('validates error code range', () => {
    const source = 'x #1 -99999: "Invalid"';
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const result = validateDocument(ast);

    const warning = result.diagnostics.find(d => d.message.toLowerCase().includes('error code'));
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe(DiagnosticSeverity.Warning);
  });

  test('validates standard JSON-RPC error code', () => {
    const source = 'x #1 -32600: "Invalid Request"';
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const result = validateDocument(ast);

    // Should not have error code warning for standard JSON-RPC codes
    const warning = result.diagnostics.find(d => d.message.toLowerCase().includes('error code'));
    expect(warning).toBeUndefined();
  });

  test('allows valid tool definition', () => {
    const source = 'T search {desc: "Search tool", in: {query: str}}';
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const result = validateDocument(ast);

    expect(result.valid).toBe(true);
  });

  test('validates version numbers', () => {
    // This would need a server block to test
    const source = '> initialize#1 {v: "2025-06-18"}';
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const result = validateDocument(ast);

    expect(result.valid).toBe(true);
  });
});
