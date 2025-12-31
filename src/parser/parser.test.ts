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

  // ============================================================================
  // Grammar v2.0.0 Features
  // ============================================================================

  test('parses type alias', () => {
    const source = 'type UserId = str!';
    const tokens = tokenize(source);
    const ast = parse(tokens);

    expect(ast.body.length).toBe(1);
    const typeAlias = ast.body[0];
    expect(typeAlias.type).toBe('TypeAlias');

    if (typeAlias.type === 'TypeAlias') {
      expect(typeAlias.name).toBe('UserId');
      expect(typeAlias.typeExpr.type).toBe('PrimaryType');
    }
  });

  test('parses type alias with complex type', () => {
    const source = 'type Status = enum[pending, active, suspended]';
    const tokens = tokenize(source);
    const ast = parse(tokens);

    expect(ast.body.length).toBe(1);
    const typeAlias = ast.body[0];
    expect(typeAlias.type).toBe('TypeAlias');

    if (typeAlias.type === 'TypeAlias') {
      expect(typeAlias.name).toBe('Status');
      expect(typeAlias.typeExpr.type).toBe('EnumType');
    }
  });

  test('parses null type in union', () => {
    const source = 'T test {in: {value: str | null}}';
    const tokens = tokenize(source);
    const ast = parse(tokens);

    const def = ast.body[0];
    expect(def.type).toBe('ToolDef');
  });

  test('parses enum with string values', () => {
    const source = 'T test {in: {status: enum["in-progress", "on-hold", active]}}';
    const tokens = tokenize(source);
    const ast = parse(tokens);

    const def = ast.body[0];
    expect(def.type).toBe('ToolDef');
  });

  test('parses spread operator in object', () => {
    const source = 'T test {in: {...BaseFields, name: str!}}';
    const tokens = tokenize(source);
    const ast = parse(tokens);

    const def = ast.body[0];
    expect(def.type).toBe('ToolDef');

    if (def.type === 'ToolDef') {
      const inField = def.body.properties[0];
      if (inField.type === 'FieldAssignment' && inField.value.type === 'Object') {
        expect(inField.value.properties[0].type).toBe('Spread');
        if (inField.value.properties[0].type === 'Spread') {
          expect(inField.value.properties[0].name).toBe('BaseFields');
        }
      }
    }
  });

  test('parses error message requiring string', () => {
    const source = 'x #1 404: "Not Found"';
    const tokens = tokenize(source);
    const ast = parse(tokens);

    expect(ast.body.length).toBe(1);
    const error = ast.body[0];
    expect(error.type).toBe('Error');

    if (error.type === 'Error') {
      expect(error.code).toBe(404);
      expect(error.message).toBe('Not Found');
    }
  });

  test('parses long-form role indicators', () => {
    const source = 'T test {user: "value", assistant: "value", system: "value"}';
    const tokens = tokenize(source);
    const ast = parse(tokens);

    const def = ast.body[0];
    expect(def.type).toBe('ToolDef');

    if (def.type === 'ToolDef') {
      expect(def.body.properties.length).toBe(3);
    }
  });

  test('parses ellipsis token correctly', () => {
    const source = 'T test {in: {...Foo}}';
    const tokens = tokenize(source);

    // Check that ... is tokenized as ELLIPSIS
    const ellipsisToken = tokens.find(t => t.lexeme === '...');
    expect(ellipsisToken).toBeDefined();
    expect(ellipsisToken?.type).toBe('...');
  });
});
