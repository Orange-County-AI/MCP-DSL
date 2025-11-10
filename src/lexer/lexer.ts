/**
 * Lexer for MCP-DSL
 * Tokenizes input text according to GRAMMAR.md lexical structure
 */

import { Token, TokenType, createToken } from '../types/tokens.js';
import type { Position, SourceRange } from '../types/common.js';
import { unescapeString } from '../utils/string-utils.js';

/**
 * Lexer class that tokenizes MCP-DSL source code
 */
export class Lexer {
  private source: string;
  private tokens: Token[] = [];
  private start = 0;
  private current = 0;
  private line = 1;
  private column = 1;
  private indentStack: number[] = [0];

  constructor(source: string) {
    this.source = source;
  }

  /**
   * Tokenize the entire source and return tokens
   */
  tokenize(): Token[] {
    while (!this.isAtEnd()) {
      this.start = this.current;
      this.scanToken();
    }

    // Emit remaining DEDENTs
    while (this.indentStack.length > 1) {
      this.indentStack.pop();
      this.addToken(TokenType.DEDENT, '');
    }

    this.addToken(TokenType.EOF, '');
    return this.tokens;
  }

  private scanToken(): void {
    const c = this.advance();

    switch (c) {
      // Single-character tokens
      case '(':
        this.addToken(TokenType.LPAREN, c);
        break;
      case ')':
        this.addToken(TokenType.RPAREN, c);
        break;
      case '{':
        this.addToken(TokenType.LBRACE, c);
        break;
      case '}':
        this.addToken(TokenType.RBRACE, c);
        break;
      case '[':
        this.addToken(TokenType.LBRACKET, c);
        break;
      case ']':
        this.addToken(TokenType.RBRACKET, c);
        break;
      case ',':
        this.addToken(TokenType.COMMA, c);
        break;
      case '.':
        this.addToken(TokenType.DOT, c);
        break;
      case '+':
        this.addToken(TokenType.PLUS, c);
        break;
      case '=':
        this.addToken(TokenType.EQUALS, c);
        break;
      case '>':
        this.addToken(TokenType.REQUEST, c);
        break;
      case '<':
        this.addToken(TokenType.RESPONSE, c);
        break;
      case '@':
        this.addToken(TokenType.AT, c);
        break;

      // Ambiguous tokens
      case '#':
        if (this.isAtLineStart()) {
          // Comment
          this.comment();
        } else {
          this.addToken(TokenType.HASH, c);
        }
        break;

      case '!':
        this.addToken(TokenType.NOTIFICATION, c);
        break;

      case '?':
        this.addToken(TokenType.QUESTION, c);
        break;

      case ':':
        if (this.match(':')) {
          this.addToken(TokenType.DOUBLE_COLON, '::');
        } else {
          this.addToken(TokenType.COLON, c);
        }
        break;

      case '|':
        this.addToken(TokenType.PIPE, c);
        break;

      case '/':
        this.addToken(TokenType.SLASH, c);
        break;

      case '-':
        if (this.match('>')) {
          this.addToken(TokenType.ARROW, '->');
        } else if (this.isDigit(this.peek())) {
          this.number();
        } else {
          throw this.error(`Unexpected character: ${c}`);
        }
        break;

      case '"':
        this.string();
        break;

      // Whitespace
      case ' ':
      case '\t':
      case '\r':
        // Handle indentation at start of line
        if (this.column === 2) {
          this.handleIndentation();
        }
        break;

      case '\n':
        this.addToken(TokenType.NEWLINE, c);
        this.line++;
        this.column = 0; // Will be incremented to 1
        break;

      default:
        if (this.isDigit(c)) {
          this.number();
        } else if (this.isAlpha(c)) {
          this.identifier();
        } else {
          throw this.error(`Unexpected character: ${c}`);
        }
    }
  }

  private identifier(): void {
    while (this.isAlphaNumeric(this.peek())) {
      this.advance();
    }

    // Check for method path (identifier/identifier)
    if (this.peek() === '/' && this.isAlpha(this.peekNext())) {
      while (this.peek() === '/' && this.isAlpha(this.peekNext())) {
        this.advance(); // consume '/'
        while (this.isAlphaNumeric(this.peek())) {
          this.advance();
        }
      }
      const text = this.source.substring(this.start, this.current);
      this.addToken(TokenType.METHOD_PATH, text);
      return;
    }

    const text = this.source.substring(this.start, this.current);
    const type = this.getKeywordType(text);
    this.addToken(type, text);
  }

  private getKeywordType(text: string): TokenType {
    switch (text) {
      case 'server':
        return TokenType.SERVER;
      case 'enum':
        return TokenType.ENUM;
      case 'true':
        return TokenType.TRUE;
      case 'false':
        return TokenType.FALSE;
      case 'null':
        return TokenType.NULL;
      case 'str':
        return TokenType.STR;
      case 'int':
        return TokenType.INT;
      case 'num':
        return TokenType.NUM;
      case 'bool':
        return TokenType.BOOL;
      case 'uri':
        return TokenType.URI;
      case 'blob':
        return TokenType.BLOB;
      case 'txt':
        return TokenType.TXT;
      case 'img':
        return TokenType.IMG;
      case 'aud':
        return TokenType.AUD;
      case 'res':
        return TokenType.RES;
      case 'emb':
        return TokenType.EMB;
      case 'u':
        return TokenType.ROLE_USER;
      case 'a':
        return TokenType.ROLE_ASSISTANT;
      case 's':
        return TokenType.ROLE_SYSTEM;
      case 'R':
        return TokenType.RESOURCE;
      case 'T':
        return TokenType.TOOL;
      case 'P':
        return TokenType.PROMPT;
      case 'RT':
        return TokenType.RESOURCE_TEMPLATE;
      case 'x':
        return TokenType.ERROR;
      default:
        return TokenType.IDENTIFIER;
    }
  }

  private number(): void {
    while (this.isDigit(this.peek())) {
      this.advance();
    }

    // Check for decimal
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      this.advance(); // consume '.'
      while (this.isDigit(this.peek())) {
        this.advance();
      }

      const text = this.source.substring(this.start, this.current);
      const value = parseFloat(text);
      this.addToken(TokenType.DECIMAL, text, value);
    } else {
      const text = this.source.substring(this.start, this.current);
      const value = parseInt(text, 10);
      this.addToken(TokenType.INTEGER, text, value);
    }
  }

  private string(): void {
    while (this.peek() !== '"' && !this.isAtEnd()) {
      if (this.peek() === '\\') {
        this.advance(); // consume escape
        this.advance(); // consume escaped char
      } else {
        if (this.peek() === '\n') this.line++;
        this.advance();
      }
    }

    if (this.isAtEnd()) {
      throw this.error('Unterminated string');
    }

    this.advance(); // closing "

    // Unescape the string value
    const rawValue = this.source.substring(this.start + 1, this.current - 1);
    const value = unescapeString(rawValue);

    const text = this.source.substring(this.start, this.current);
    this.addToken(TokenType.STRING, text, value);
  }

  private comment(): void {
    while (this.peek() !== '\n' && !this.isAtEnd()) {
      this.advance();
    }
    const text = this.source.substring(this.start, this.current);
    this.addToken(TokenType.COMMENT, text);
  }

  private handleIndentation(): void {
    let indent = 0;
    while (this.peek() === ' ' || this.peek() === '\t') {
      this.advance();
      indent++;
    }

    const currentIndent = this.indentStack[this.indentStack.length - 1];

    if (indent > currentIndent) {
      this.indentStack.push(indent);
      this.addToken(TokenType.INDENT, ' '.repeat(indent));
    } else if (indent < currentIndent) {
      while (this.indentStack.length > 1 && this.indentStack[this.indentStack.length - 1] > indent) {
        this.indentStack.pop();
        this.addToken(TokenType.DEDENT, '');
      }

      if (this.indentStack[this.indentStack.length - 1] !== indent) {
        throw this.error('Inconsistent indentation');
      }
    }
  }

  private isAtLineStart(): boolean {
    // Check if we're at the beginning of a line
    return this.column === 1 || (this.current > 0 && this.source[this.current - 2] === '\n');
  }

  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  private isAlpha(c: string): boolean {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
  }

  private isAlphaNumeric(c: string): boolean {
    return this.isAlpha(c) || this.isDigit(c);
  }

  private advance(): string {
    const c = this.source.charAt(this.current);
    this.current++;
    this.column++;
    return c;
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.source.charAt(this.current) !== expected) return false;

    this.current++;
    this.column++;
    return true;
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.source.charAt(this.current);
  }

  private peekNext(): string {
    if (this.current + 1 >= this.source.length) return '\0';
    return this.source.charAt(this.current + 1);
  }

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private addToken(type: TokenType, lexeme: string, literal?: any): void {
    const range: SourceRange = {
      start: {
        line: this.line,
        column: this.column - lexeme.length,
        offset: this.start,
      },
      end: {
        line: this.line,
        column: this.column,
        offset: this.current,
      },
    };

    const token = createToken(type, lexeme, range, literal);
    this.tokens.push(token);
  }

  private error(message: string): Error {
    return new Error(`[${this.line}:${this.column}] ${message}`);
  }
}

/**
 * Convenience function to tokenize source code
 */
export function tokenize(source: string): Token[] {
  const lexer = new Lexer(source);
  return lexer.tokenize();
}
