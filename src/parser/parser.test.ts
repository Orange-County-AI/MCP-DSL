import { describe, expect, test } from 'bun:test';
import { parse } from './parser.js';
import { tokenize } from '../lexer/lexer.js';

describe('Parser', () => {
  test('parses simple request message', () => {
    const source = '> initialize#1 {v: "2025-06-18"}';
    const tokens = tokenize(source);
    const ast = parse(tokens);

    expect(ast.type).toBe('Document');
    expect(ast.body.length).toBe(1);

    const message = ast.body[0];
    expect(message.type).toBe('Request');

    if (message.type === 'Request') {
      expect(message.method).toBe('initialize');
      expect(message.id).toBe(1);
      expect(message.params).toBeDefined();
      expect(message.params?.type).toBe('Object');
    }
  });

  test('parses response message', () => {
    const source = '< #1 {ok: true}';
    const tokens = tokenize(source);
    const ast = parse(tokens);

    expect(ast.body.length).toBe(1);

    const message = ast.body[0];
    expect(message.type).toBe('Response');

    if (message.type === 'Response') {
      expect(message.id).toBe(1);
      expect(message.result).toBeDefined();
    }
  });

  test('parses notification message', () => {
    const source = '! notifications/initialized';
    const tokens = tokenize(source);
    const ast = parse(tokens);

    expect(ast.body.length).toBe(1);

    const message = ast.body[0];
    expect(message.type).toBe('Notification');

    if (message.type === 'Notification') {
      expect(message.method).toBe('notifications/initialized');
    }
  });

  test('parses tool definition', () => {
    const source = 'T search {desc: "Search for information", in: {query: str}}';
    const tokens = tokenize(source);
    const ast = parse(tokens);

    expect(ast.body.length).toBe(1);

    const def = ast.body[0];
    expect(def.type).toBe('ToolDef');

    if (def.type === 'ToolDef') {
      expect(def.name).toBe('search');
      expect(def.body.type).toBe('Object');
    }
  });

  test('parses resource definition', () => {
    const source = 'R weather {uri: "weather://current/NYC", mime: "application/json"}';
    const tokens = tokenize(source);
    const ast = parse(tokens);

    expect(ast.body.length).toBe(1);

    const def = ast.body[0];
    expect(def.type).toBe('ResourceDef');

    if (def.type === 'ResourceDef') {
      expect(def.name).toBe('weather');
    }
  });

  test('parses primitive types', () => {
    const source = 'T test {in: {s: str, i: int, n: num, b: bool}}';
    const tokens = tokenize(source);
    const ast = parse(tokens);

    const def = ast.body[0];
    expect(def.type).toBe('ToolDef');

    if (def.type === 'ToolDef') {
      const inField = def.body.properties[0];
      expect(inField.type).toBe('FieldAssignment');
    }
  });

  test('parses type modifiers', () => {
    const source = 'T test {in: {required: str!, optional: str?}}';
    const tokens = tokenize(source);
    const ast = parse(tokens);

    const def = ast.body[0];
    expect(def.type).toBe('ToolDef');
  });

  test('parses annotations', () => {
    const source = 'T test {@readonly, @priority: 1.0}';
    const tokens = tokenize(source);
    const ast = parse(tokens);

    const def = ast.body[0];
    expect(def.type).toBe('ToolDef');

    if (def.type === 'ToolDef') {
      expect(def.body.properties.length).toBe(2);
      expect(def.body.properties[0].type).toBe('Annotation');
      expect(def.body.properties[1].type).toBe('Annotation');
    }
  });

  test('parses array values', () => {
    const source = 'T test {tags: ["a", "b", "c"]}';
    const tokens = tokenize(source);
    const ast = parse(tokens);

    const def = ast.body[0];
    expect(def.type).toBe('ToolDef');

    if (def.type === 'ToolDef') {
      const field = def.body.properties[0];
      expect(field.type).toBe('FieldAssignment');

      if (field.type === 'FieldAssignment') {
        expect(field.value.type).toBe('Array');

        if (field.value.type === 'Array') {
          expect(field.value.elements.length).toBe(3);
        }
      }
    }
  });

  test('parses nested objects', () => {
    const source = 'T test {config: {timeout: 30, retries: 3}}';
    const tokens = tokenize(source);
    const ast = parse(tokens);

    const def = ast.body[0];
    expect(def.type).toBe('ToolDef');

    if (def.type === 'ToolDef') {
      const field = def.body.properties[0];
      expect(field.type).toBe('FieldAssignment');

      if (field.type === 'FieldAssignment') {
        expect(field.value.type).toBe('Object');

        if (field.value.type === 'Object') {
          expect(field.value.properties.length).toBe(2);
        }
      }
    }
  });
});
