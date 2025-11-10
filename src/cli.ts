#!/usr/bin/env bun
/**
 * MCP-DSL CLI Tool
 * Command-line interface for DSL ↔ JSON-RPC transformations
 */

import { program } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import { compileDsl, parseDsl } from './index.js';
import { decompile, decompileTools, decompileResources } from './decompiler/decompiler.js';
import { validateDocument } from './semantic/validator.js';
import { DiagnosticSeverity } from './types/common.js';
import type { Diagnostic } from './types/common.js';
import type { JsonRpcMessageType } from './compiler/json-rpc-types.js';

/**
 * Read input from file or stdin
 */
function readInput(inputPath?: string): string {
  if (!inputPath || inputPath === '-') {
    // Read from stdin
    const chunks: Buffer[] = [];
    const fd = 0; // stdin file descriptor
    let chunk: Buffer | null;

    while ((chunk = readFileSync(fd)) !== null && chunk.length > 0) {
      chunks.push(chunk);
      if (chunk.length < 4096) break;
    }

    return Buffer.concat(chunks).toString('utf8');
  }

  return readFileSync(inputPath, 'utf8');
}

/**
 * Write output to file or stdout
 */
function writeOutput(content: string, outputPath?: string): void {
  if (!outputPath || outputPath === '-') {
    process.stdout.write(content);
  } else {
    writeFileSync(outputPath, content, 'utf8');
  }
}

/**
 * Format diagnostics for display
 */
function formatDiagnostics(diagnostics: Diagnostic[]): string {
  return diagnostics
    .map(d => {
      const severity = d.severity.toUpperCase();
      const location = `${d.range.start.line}:${d.range.start.column}`;
      return `[${severity}] ${location}: ${d.message}`;
    })
    .join('\n');
}

// ============================================================================
// Commands
// ============================================================================

program
  .name('mcp-dsl')
  .description('MCP-DSL: A token-efficient Domain Specific Language for Model Context Protocol')
  .version('0.1.0');

// Compile DSL to JSON-RPC
program
  .command('compile')
  .description('Compile MCP-DSL to JSON-RPC')
  .option('-i, --input <file>', 'Input file (or - for stdin)')
  .option('-o, --output <file>', 'Output file (or - for stdout)')
  .option('--messages', 'Output only messages')
  .option('--tools', 'Output only tool definitions')
  .option('--resources', 'Output only resource definitions')
  .option('--pretty', 'Pretty-print JSON output')
  .option('--no-validate', 'Skip semantic validation')
  .action((options) => {
    try {
      const source = readInput(options.input);

      // Parse
      const ast = parseDsl(source);

      // Validate
      if (options.validate !== false) {
        const validation = validateDocument(ast);
        if (!validation.valid) {
          console.error('Validation errors:');
          console.error(formatDiagnostics(validation.diagnostics));
          process.exit(1);
        }
      }

      // Compile
      const result = compileDsl(source);

      // Determine what to output
      let output: any;
      if (options.messages) {
        output = result.messages;
      } else if (options.tools) {
        output = result.tools;
      } else if (options.resources) {
        output = result.resources;
      } else {
        output = result;
      }

      // Format output
      const json = options.pretty
        ? JSON.stringify(output, null, 2)
        : JSON.stringify(output);

      writeOutput(json + '\n', options.output);
    } catch (error) {
      console.error('Compilation failed:', (error as Error).message);
      process.exit(1);
    }
  });

// Decompile JSON-RPC to DSL
program
  .command('decompile')
  .description('Decompile JSON-RPC to MCP-DSL')
  .option('-i, --input <file>', 'Input file (or - for stdin)')
  .option('-o, --output <file>', 'Output file (or - for stdout)')
  .option('--messages', 'Decompile only messages')
  .option('--tools', 'Decompile only tool definitions')
  .option('--resources', 'Decompile only resource definitions')
  .action((options) => {
    try {
      const jsonStr = readInput(options.input);
      const json = JSON.parse(jsonStr);

      let dsl: string;
      if (options.messages) {
        dsl = decompile(Array.isArray(json) ? json : [json]);
      } else if (options.tools) {
        dsl = decompileTools(Array.isArray(json) ? json : [json]);
      } else if (options.resources) {
        dsl = decompileResources(Array.isArray(json) ? json : [json]);
      } else {
        // Handle full compilation result format
        if (json.messages) {
          const parts: string[] = [];
          if (json.messages.length > 0) {
            parts.push(decompile(json.messages));
          }
          if (json.tools && json.tools.length > 0) {
            parts.push(decompileTools(json.tools));
          }
          if (json.resources && json.resources.length > 0) {
            parts.push(decompileResources(json.resources));
          }
          dsl = parts.join('\n\n');
        } else {
          // Assume it's just messages
          dsl = decompile(Array.isArray(json) ? json : [json]);
        }
      }

      writeOutput(dsl + '\n', options.output);
    } catch (error) {
      console.error('Decompilation failed:', (error as Error).message);
      process.exit(1);
    }
  });

// Lint (validate only, no output)
program
  .command('lint')
  .description('Validate MCP-DSL without generating output')
  .option('-i, --input <file>', 'Input file (or - for stdin)')
  .action((options) => {
    try {
      const source = readInput(options.input);
      const ast = parseDsl(source);
      const validation = validateDocument(ast);

      if (validation.diagnostics.length > 0) {
        console.error(formatDiagnostics(validation.diagnostics));
      }

      if (!validation.valid) {
        process.exit(1);
      }

      console.log('No errors found.');
    } catch (error) {
      console.error('Linting failed:', (error as Error).message);
      process.exit(1);
    }
  });

// Format DSL (parse and pretty-print)
program
  .command('format')
  .description('Format MCP-DSL (parse and decompile)')
  .option('-i, --input <file>', 'Input file (or - for stdin)')
  .option('-o, --output <file>', 'Output file (or - for stdout)')
  .action((options) => {
    try {
      const source = readInput(options.input);
      const result = compileDsl(source);

      // Decompile everything back to DSL (this provides formatting)
      const parts: string[] = [];
      if (result.messages.length > 0) {
        parts.push(decompile(result.messages));
      }
      if (result.tools.length > 0) {
        parts.push(decompileTools(result.tools));
      }
      if (result.resources.length > 0) {
        parts.push(decompileResources(result.resources));
      }

      const formatted = parts.join('\n\n');
      writeOutput(formatted + '\n', options.output);
    } catch (error) {
      console.error('Formatting failed:', (error as Error).message);
      process.exit(1);
    }
  });

program.parse();
