/**
 * MCP-DSL: Main entry point
 * Provides convenience functions for DSL ↔ JSON-RPC conversion
 */

import { tokenize } from './lexer/lexer.js';
import { parse } from './parser/parser.js';
import { compile, type CompilationResult } from './compiler/compiler.js';
import type { DocumentNode } from './ast/nodes.js';
import type { Token } from './types/tokens.js';

/**
 * Parse DSL source code to AST
 */
export function parseDsl(source: string): DocumentNode {
  const tokens = tokenize(source);
  return parse(tokens);
}

/**
 * Compile DSL source code to JSON-RPC messages and definitions
 */
export function compileDsl(source: string): CompilationResult {
  const ast = parseDsl(source);
  return compile(ast);
}

/**
 * Get tokens from DSL source (for debugging)
 */
export function tokenizeDsl(source: string): Token[] {
  return tokenize(source);
}

// Re-export key types and functions
export { tokenize, parse, compile };
export type { DocumentNode, Token, CompilationResult };
export * from './types/tokens.js';
export * from './ast/nodes.js';
export * from './compiler/json-rpc-types.js';
