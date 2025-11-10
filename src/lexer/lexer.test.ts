import { describe, expect, test } from 'bun:test';
import { Lexer, tokenize } from './lexer.js';
import { TokenType } from '../types/tokens.js';

describe('Lexer', () => {
  test('tokenizes simple request', () => {
    const source = '> tools/call#42';
    const tokens = tokenize(source);

    expect(tokens.length).toBe(5); // REQUEST, METHOD_PATH, HASH, INTEGER, EOF
    expect(tokens[0].type).toBe(TokenType.REQUEST);
    expect(tokens[1].type).toBe(TokenType.METHOD_PATH);
    expect(tokens[1].lexeme).toBe('tools/call');
    expect(tokens[2].type).toBe(TokenType.HASH);
    expect(tokens[3].type).toBe(TokenType.INTEGER);
    expect(tokens[3].literal).toBe(42);
    expect(tokens[4].type).toBe(TokenType.EOF);
  });

  test('tokenizes string literals', () => {
    const source = '"hello world"';
    const tokens = tokenize(source);

    expect(tokens[0].type).toBe(TokenType.STRING);
    expect(tokens[0].literal).toBe('hello world');
  });

  test('handles escape sequences', () => {
    const source = '"line1\\nline2\\ttab"';
    const tokens = tokenize(source);

    expect(tokens[0].type).toBe(TokenType.STRING);
    expect(tokens[0].literal).toBe('line1\nline2\ttab');
  });

  test('tokenizes numbers', () => {
    const source = '42 3.14 -5';
    const tokens = tokenize(source);

    expect(tokens[0].type).toBe(TokenType.INTEGER);
    expect(tokens[0].literal).toBe(42);
    expect(tokens[1].type).toBe(TokenType.DECIMAL);
    expect(tokens[1].literal).toBe(3.14);
    expect(tokens[2].type).toBe(TokenType.INTEGER);
    expect(tokens[2].literal).toBe(-5);
  });

  test('tokenizes keywords', () => {
    const source = 'server enum true false null';
    const tokens = tokenize(source);

    expect(tokens[0].type).toBe(TokenType.SERVER);
    expect(tokens[1].type).toBe(TokenType.ENUM);
    expect(tokens[2].type).toBe(TokenType.TRUE);
    expect(tokens[3].type).toBe(TokenType.FALSE);
    expect(tokens[4].type).toBe(TokenType.NULL);
  });

  test('tokenizes type keywords', () => {
    const source = 'str int num bool uri blob';
    const tokens = tokenize(source);

    expect(tokens[0].type).toBe(TokenType.STR);
    expect(tokens[1].type).toBe(TokenType.INT);
    expect(tokens[2].type).toBe(TokenType.NUM);
    expect(tokens[3].type).toBe(TokenType.BOOL);
    expect(tokens[4].type).toBe(TokenType.URI);
    expect(tokens[5].type).toBe(TokenType.BLOB);
  });

  test('tokenizes definition types', () => {
    const source = 'R T P RT';
    const tokens = tokenize(source);

    expect(tokens[0].type).toBe(TokenType.RESOURCE);
    expect(tokens[1].type).toBe(TokenType.TOOL);
    expect(tokens[2].type).toBe(TokenType.PROMPT);
    expect(tokens[3].type).toBe(TokenType.RESOURCE_TEMPLATE);
  });

  test('tokenizes message operators', () => {
    const source = '> < ! x';
    const tokens = tokenize(source);

    expect(tokens[0].type).toBe(TokenType.REQUEST);
    expect(tokens[1].type).toBe(TokenType.RESPONSE);
    expect(tokens[2].type).toBe(TokenType.NOTIFICATION);
    expect(tokens[3].type).toBe(TokenType.ERROR);
  });

  test('tokenizes double colon', () => {
    const source = 'str::uri';
    const tokens = tokenize(source);

    expect(tokens[0].type).toBe(TokenType.STR);
    expect(tokens[1].type).toBe(TokenType.DOUBLE_COLON);
    expect(tokens[2].type).toBe(TokenType.URI);
  });

  test('tokenizes brackets and delimiters', () => {
    const source = '(){} [],:';
    const tokens = tokenize(source);

    expect(tokens[0].type).toBe(TokenType.LPAREN);
    expect(tokens[1].type).toBe(TokenType.RPAREN);
    expect(tokens[2].type).toBe(TokenType.LBRACE);
    expect(tokens[3].type).toBe(TokenType.RBRACE);
    expect(tokens[4].type).toBe(TokenType.LBRACKET);
    expect(tokens[5].type).toBe(TokenType.RBRACKET);
    expect(tokens[6].type).toBe(TokenType.COMMA);
    expect(tokens[7].type).toBe(TokenType.COLON);
  });

  test('tokenizes identifiers', () => {
    const source = 'myVariable _private CamelCase';
    const tokens = tokenize(source);

    expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
    expect(tokens[0].lexeme).toBe('myVariable');
    expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
    expect(tokens[1].lexeme).toBe('_private');
    expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
    expect(tokens[2].lexeme).toBe('CamelCase');
  });
});
