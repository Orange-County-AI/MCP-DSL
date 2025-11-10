/**
 * Common types used throughout the MCP-DSL compiler
 */

/**
 * Source position in the input text
 */
export interface Position {
  line: number;
  column: number;
  offset: number;
}

/**
 * Source range spanning from start to end position
 */
export interface SourceRange {
  start: Position;
  end: Position;
}

/**
 * Diagnostic severity levels
 */
export enum DiagnosticSeverity {
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
}

/**
 * Diagnostic message with location information
 */
export interface Diagnostic {
  severity: DiagnosticSeverity;
  message: string;
  range: SourceRange;
  code?: string;
}

/**
 * Context kind for semantic disambiguation
 * Used to enforce context-specific validation rules
 */
export enum ContextKind {
  CapabilitySet = 'capability_set',
  RequestParams = 'request_params',
  ResponseResult = 'response_result',
  ErrorData = 'error_data',
  DefinitionBlock = 'definition_block',
  GeneralValue = 'general_value',
}
