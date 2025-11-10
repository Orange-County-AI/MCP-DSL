/**
 * Token types for the MCP-DSL lexer
 * Based on GRAMMAR.md lexical structure
 */

export enum TokenType {
  // Literals
  IDENTIFIER = 'IDENTIFIER',
  METHOD_PATH = 'METHOD_PATH',
  INTEGER = 'INTEGER',
  DECIMAL = 'DECIMAL',
  STRING = 'STRING',

  // Message operators
  REQUEST = '>',           // Request message
  RESPONSE = '<',          // Response message
  NOTIFICATION = '!',      // Notification message
  ERROR = 'x',             // Error message

  // Definition types
  RESOURCE = 'R',          // Resource definition
  TOOL = 'T',              // Tool definition
  PROMPT = 'P',            // Prompt definition
  RESOURCE_TEMPLATE = 'RT', // Resource template

  // Delimiters
  HASH = '#',              // Message ID prefix
  COLON = ':',             // Key-value separator
  COMMA = ',',             // List separator
  DOT = '.',               // Dot path separator
  PIPE = '|',              // Multiline string prefix
  QUESTION = '?',          // Optional modifier
  EXCLAMATION = '!',       // Required modifier (reused, context-dependent)
  AT = '@',                // Annotation prefix

  // Brackets
  LPAREN = '(',
  RPAREN = ')',
  LBRACE = '{',
  RBRACE = '}',
  LBRACKET = '[',
  RBRACKET = ']',

  // Operators
  EQUALS = '=',            // Default value assignment
  DOUBLE_COLON = '::',     // Type cast
  PIPE_OP = '|',           // Union type (reused, context-dependent)
  PLUS = '+',              // Content composition

  // Keywords
  SERVER = 'server',
  ENUM = 'enum',
  TRUE = 'true',
  FALSE = 'false',
  NULL = 'null',

  // Primitive types
  STR = 'str',
  INT = 'int',
  NUM = 'num',
  BOOL = 'bool',
  URI = 'uri',
  BLOB = 'blob',

  // Content types
  TXT = 'txt',
  IMG = 'img',
  AUD = 'aud',
  RES = 'res',
  EMB = 'emb',

  // Role indicators (for prompts)
  ROLE_USER = 'u',
  ROLE_ASSISTANT = 'a',
  ROLE_SYSTEM = 's',

  // Special
  SLASH = '/',
  ARROW = '->',
  NEWLINE = 'NEWLINE',
  INDENT = 'INDENT',
  DEDENT = 'DEDENT',
  EOF = 'EOF',

  // Trivia (for decompiler support)
  WHITESPACE = 'WHITESPACE',
  COMMENT = 'COMMENT',
}

/**
 * Token with lexeme, type, and location information
 */
export interface Token {
  type: TokenType;
  lexeme: string;
  literal?: string | number | boolean | null;
  range: SourceRange;
  trivia?: Token[]; // Leading whitespace/comments for decompiler
}

/**
 * Helper to create a token
 */
export function createToken(
  type: TokenType,
  lexeme: string,
  range: SourceRange,
  literal?: string | number | boolean | null,
  trivia?: Token[]
): Token {
  return { type, lexeme, range, literal, trivia };
}
