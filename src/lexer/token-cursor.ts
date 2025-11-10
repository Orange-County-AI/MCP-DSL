/**
 * TokenCursor provides LL(k) lookahead capabilities for the parser
 * Based on architectural guidance for bounded lookahead (k≤4)
 */

import type { Token } from '../types/tokens.js';
import { TokenType } from '../types/tokens.js';

/**
 * Cursor for navigating through tokens with lookahead support
 */
export class TokenCursor {
  private tokens: Token[];
  private position = 0;
  private marks: number[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /**
   * Get current token
   */
  current(): Token {
    return this.tokens[this.position] || this.tokens[this.tokens.length - 1];
  }

  /**
   * Advance to next token and return it
   */
  next(): Token {
    if (!this.isAtEnd()) {
      this.position++;
    }
    return this.current();
  }

  /**
   * Peek ahead k tokens (1-indexed)
   * peek(1) returns the next token
   * peek(2) returns the token after next, etc.
   */
  peek(k: number = 1): Token {
    const index = this.position + k;
    if (index >= this.tokens.length) {
      return this.tokens[this.tokens.length - 1]; // Return EOF
    }
    return this.tokens[index];
  }

  /**
   * Check if current token matches expected type
   */
  check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.current().type === type;
  }

  /**
   * Check if current token matches any of the expected types
   */
  checkAny(...types: TokenType[]): boolean {
    return types.some(type => this.check(type));
  }

  /**
   * Consume current token if it matches expected type
   * @returns true if token was consumed
   */
  match(type: TokenType): boolean {
    if (this.check(type)) {
      this.next();
      return true;
    }
    return false;
  }

  /**
   * Consume current token if it matches any of the expected types
   * @returns the matched type, or null if no match
   */
  matchAny(...types: TokenType[]): TokenType | null {
    for (const type of types) {
      if (this.check(type)) {
        this.next();
        return type;
      }
    }
    return null;
  }

  /**
   * Consume and return current token if it matches expected type
   * Throws error if it doesn't match
   */
  expect(type: TokenType, message?: string): Token {
    if (!this.check(type)) {
      throw this.error(message || `Expected ${type}, got ${this.current().type}`);
    }
    const token = this.current();
    this.next();
    return token;
  }

  /**
   * Consume and return current token if it matches any expected type
   * Throws error if it doesn't match any
   */
  expectAny(types: TokenType[], message?: string): Token {
    if (!this.checkAny(...types)) {
      throw this.error(
        message || `Expected one of [${types.join(', ')}], got ${this.current().type}`
      );
    }
    const token = this.current();
    this.next();
    return token;
  }

  /**
   * Mark current position for potential backtracking
   */
  mark(): void {
    this.marks.push(this.position);
  }

  /**
   * Reset to marked position
   */
  reset(): void {
    const mark = this.marks.pop();
    if (mark !== undefined) {
      this.position = mark;
    }
  }

  /**
   * Discard most recent mark without resetting
   */
  unmark(): void {
    this.marks.pop();
  }

  /**
   * Check if at end of token stream
   */
  isAtEnd(): boolean {
    return this.current().type === TokenType.EOF;
  }

  /**
   * Get current position
   */
  getPosition(): number {
    return this.position;
  }

  /**
   * Set position (use with caution)
   */
  setPosition(pos: number): void {
    this.position = Math.max(0, Math.min(pos, this.tokens.length - 1));
  }

  /**
   * Skip tokens of specific type(s)
   */
  skip(...types: TokenType[]): void {
    while (this.checkAny(...types) && !this.isAtEnd()) {
      this.next();
    }
  }

  /**
   * Peek ahead and check if a sequence of tokens matches
   * Returns true if all types match in order
   */
  peekSequence(...types: TokenType[]): boolean {
    for (let i = 0; i < types.length; i++) {
      if (this.peek(i + 1).type !== types[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Create error with current token location
   */
  error(message: string): Error {
    const token = this.current();
    const pos = token.range.start;
    return new Error(`[${pos.line}:${pos.column}] ${message}`);
  }

  /**
   * Get all remaining tokens (useful for debugging)
   */
  remaining(): Token[] {
    return this.tokens.slice(this.position);
  }

  /**
   * Get token at specific position
   */
  at(index: number): Token | undefined {
    return this.tokens[index];
  }

  /**
   * Get total number of tokens
   */
  length(): number {
    return this.tokens.length;
  }
}

/**
 * Create a token cursor from tokens
 */
export function createCursor(tokens: Token[]): TokenCursor {
  return new TokenCursor(tokens);
}
