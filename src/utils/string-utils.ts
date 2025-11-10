/**
 * String manipulation utilities for lexer and decompiler
 */

/**
 * Escape sequences mapping
 * Based on GRAMMAR.md:15
 */
const ESCAPE_SEQUENCES: Record<string, string> = {
  '\\n': '\n',
  '\\t': '\t',
  '\\r': '\r',
  '\\"': '"',
  '\\\\': '\\',
  '\\{{': '{{',
};

const REVERSE_ESCAPE_SEQUENCES: Record<string, string> = {
  '\n': '\\n',
  '\t': '\\t',
  '\r': '\\r',
  '"': '\\"',
  '\\': '\\\\',
};

/**
 * Unescape a string literal
 */
export function unescapeString(str: string): string {
  return str.replace(/\\[ntr"\\]|\\{{/g, (match) => ESCAPE_SEQUENCES[match] || match);
}

/**
 * Escape a string for DSL output
 */
export function escapeString(str: string): string {
  return str.replace(/[\n\t\r"\\]/g, (match) => REVERSE_ESCAPE_SEQUENCES[match] || match);
}

/**
 * Parse multiline string with indentation handling
 * Based on GRAMMAR.md:272
 */
export interface MultilineParseResult {
  content: string;
  baseIndent: number;
}

export function parseMultilineString(lines: string[]): MultilineParseResult {
  if (lines.length === 0) {
    return { content: '', baseIndent: 0 };
  }

  // First non-empty line establishes base indentation
  const firstLine = lines[0];
  const baseIndent = firstLine.length - firstLine.trimStart().length;

  const processedLines = lines.map((line) => {
    if (line.trim() === '') {
      return ''; // Preserve empty lines
    }

    const currentIndent = line.length - line.trimStart().length;
    if (currentIndent < baseIndent) {
      throw new Error('Multiline string indentation is less than base indentation');
    }

    // Strip base indentation, preserve relative indentation
    return line.slice(baseIndent);
  });

  return {
    content: processedLines.join('\n'),
    baseIndent,
  };
}

/**
 * Format multiline string for DSL output
 */
export function formatMultilineString(content: string, indent: number): string {
  const lines = content.split('\n');
  const indentStr = ' '.repeat(indent);
  return lines.map(line => indentStr + line).join('\n');
}

/**
 * Check if a string needs multiline representation
 */
export function needsMultiline(str: string): boolean {
  return str.includes('\n') || str.length > 80;
}

/**
 * Parse dotted capability path
 * e.g., "roots.listChanged" -> ["roots", "listChanged"]
 */
export function parseDottedPath(path: string): string[] {
  return path.split('.').filter(p => p.length > 0);
}

/**
 * Build nested object from dotted path
 * e.g., ["roots", "listChanged"] -> {roots: {listChanged: true}}
 * Based on GRAMMAR.md:263
 */
export function buildNestedObject(path: string[], value: any = true): any {
  if (path.length === 0) {
    return value;
  }

  const [first, ...rest] = path;
  return { [first]: buildNestedObject(rest, value) };
}

/**
 * Flatten nested object to dotted paths
 * Inverse of buildNestedObject
 */
export function flattenToDottedPaths(obj: any, prefix: string = ''): string[] {
  const paths: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (Object.keys(value).length === 0) {
        // Empty object - just add the path
        paths.push(path);
      } else {
        // Non-empty object - recurse
        paths.push(...flattenToDottedPaths(value, path));
      }
    } else if (value === true) {
      // Boolean true - add path
      paths.push(path);
    } else {
      // Other values - skip (capabilities are typically boolean flags)
    }
  }

  return paths;
}
