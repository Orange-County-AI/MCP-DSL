/**
 * Training Data Generator for MCP-DSL vs JSON-RPC Experiment
 *
 * Generates parallel datasets:
 * - Natural Language → MCP-DSL
 * - Natural Language → JSON-RPC
 *
 * Usage: bun run experiment/data/generate.ts
 */

import { compileDsl } from '../../src/index.js';
import { writeFileSync } from 'fs';

// ============================================================================
// Types
// ============================================================================

interface TrainingExample {
  instruction: string;
  input: string;
  output: string;
}

interface GeneratedPair {
  prompt: string;
  dsl: string;
  jsonRpc: string;
}

// ============================================================================
// Data Templates
// ============================================================================

const TOOL_NAMES = [
  'search', 'get_weather', 'send_email', 'create_file', 'read_file',
  'delete_file', 'list_directory', 'execute_command', 'fetch_url',
  'translate_text', 'summarize', 'analyze_sentiment', 'extract_entities',
  'generate_image', 'resize_image', 'compress_file', 'encrypt_data',
  'query_database', 'insert_record', 'update_record', 'delete_record',
  'get_user', 'create_user', 'authenticate', 'refresh_token',
  'send_notification', 'schedule_task', 'cancel_task', 'get_logs',
  'deploy_service', 'rollback_deployment', 'scale_service', 'get_metrics'
];

const PARAM_TYPES = ['str', 'int', 'num', 'bool', 'uri'];
const OPTIONAL_MODIFIER = ['', '?'];
const REQUIRED_MODIFIER = ['!', ''];

const DESCRIPTIONS = [
  'Searches for information',
  'Retrieves data from the system',
  'Processes the input',
  'Transforms the data',
  'Validates the request',
  'Executes the operation',
  'Fetches external resources',
  'Analyzes the content',
  'Generates output',
  'Stores the result'
];

// ============================================================================
// Random Helpers
// ============================================================================

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomString(words: number = 3): string {
  const wordList = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta',
                    'test', 'data', 'query', 'result', 'value', 'item', 'record', 'entry'];
  return pickN(wordList, words).join('_');
}

// ============================================================================
// Generators
// ============================================================================

function generateSimpleToolCall(): GeneratedPair {
  const tool = pick(TOOL_NAMES);
  const paramName = pick(['query', 'input', 'text', 'data', 'value', 'id', 'name']);
  const paramValue = randomString(2);
  const messageId = randomInt(1, 1000);

  const dsl = `> tools/call#${messageId} {name: "${tool}", args: {${paramName}: "${paramValue}"}}`;

  const prompt = `Call the ${tool.replace(/_/g, ' ')} tool with ${paramName} set to "${paramValue}"`;

  let jsonRpc: string;
  try {
    const result = compileDsl(dsl);
    jsonRpc = JSON.stringify(result.messages[0], null, 2);
  } catch (e) {
    // Fallback if compilation fails
    jsonRpc = JSON.stringify({
      jsonrpc: '2.0',
      id: messageId,
      method: 'tools/call',
      params: {
        name: tool,
        arguments: { [paramName]: paramValue }
      }
    }, null, 2);
  }

  return { prompt, dsl, jsonRpc };
}

function generateToolDefinition(): GeneratedPair {
  const tool = pick(TOOL_NAMES);
  const desc = pick(DESCRIPTIONS);
  const numParams = randomInt(1, 4);
  const params: string[] = [];
  const paramDescriptions: string[] = [];

  for (let i = 0; i < numParams; i++) {
    const paramName = pick(['query', 'input', 'text', 'data', 'value', 'id', 'name', 'path', 'url', 'count']) + (i > 0 ? i.toString() : '');
    const paramType = pick(PARAM_TYPES);
    const modifier = pick([...REQUIRED_MODIFIER, ...OPTIONAL_MODIFIER]);
    params.push(`${paramName}: ${paramType}${modifier}`);
    paramDescriptions.push(`${paramName} (${paramType}${modifier || 'optional'})`);
  }

  const dsl = `T ${tool} {desc: "${desc}", in: {${params.join(', ')}}}`;
  const prompt = `Define a tool called "${tool}" that ${desc.toLowerCase()}. It should accept: ${paramDescriptions.join(', ')}.`;

  let jsonRpc: string;
  try {
    const result = compileDsl(dsl);
    jsonRpc = JSON.stringify(result.definitions.tools?.[0], null, 2);
  } catch (e) {
    jsonRpc = JSON.stringify({
      name: tool,
      description: desc,
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    }, null, 2);
  }

  return { prompt, dsl, jsonRpc };
}

function generateInitialize(): GeneratedPair {
  const messageId = randomInt(1, 100);
  const version = '2025-06-18';
  const capabilities = pick([
    '{tools, resources}',
    '{tools}',
    '{resources, prompts}',
    '{tools, resources, prompts}',
    '{}'
  ]);

  const dsl = `> initialize#${messageId} {v: "${version}", caps: ${capabilities}}`;
  const prompt = `Initialize an MCP connection with protocol version ${version} and capabilities: ${capabilities.replace(/[{}]/g, '').replace(/,/g, ', ') || 'none'}`;

  let jsonRpc: string;
  try {
    const result = compileDsl(dsl);
    jsonRpc = JSON.stringify(result.messages[0], null, 2);
  } catch (e) {
    jsonRpc = JSON.stringify({
      jsonrpc: '2.0',
      id: messageId,
      method: 'initialize',
      params: {
        protocolVersion: version,
        capabilities: {}
      }
    }, null, 2);
  }

  return { prompt, dsl, jsonRpc };
}

function generateResponse(): GeneratedPair {
  const messageId = randomInt(1, 1000);
  const isSuccess = Math.random() > 0.2;

  let dsl: string;
  let prompt: string;

  if (isSuccess) {
    const resultType = pick(['simple', 'object', 'array']);

    if (resultType === 'simple') {
      const value = randomInt(1, 100);
      dsl = `< #${messageId} {ok: true, value: ${value}}`;
      prompt = `Generate a successful response for message ${messageId} with value ${value}`;
    } else if (resultType === 'object') {
      const key = pick(['result', 'data', 'output']);
      const value = randomString(2);
      dsl = `< #${messageId} {ok: true, ${key}: "${value}"}`;
      prompt = `Generate a successful response for message ${messageId} with ${key} "${value}"`;
    } else {
      const items = [randomInt(1, 10), randomInt(1, 10), randomInt(1, 10)];
      dsl = `< #${messageId} {ok: true, items: [${items.join(', ')}]}`;
      prompt = `Generate a successful response for message ${messageId} with items [${items.join(', ')}]`;
    }
  } else {
    dsl = `< #${messageId} {ok: false}`;
    prompt = `Generate an error response for message ${messageId}`;
  }

  let jsonRpc: string;
  try {
    const result = compileDsl(dsl);
    jsonRpc = JSON.stringify(result.messages[0], null, 2);
  } catch (e) {
    jsonRpc = JSON.stringify({
      jsonrpc: '2.0',
      id: messageId,
      result: { isError: !isSuccess }
    }, null, 2);
  }

  return { prompt, dsl, jsonRpc };
}

function generateNotification(): GeneratedPair {
  const methods = [
    'notifications/initialized',
    'notifications/progress',
    'notifications/cancelled',
    'notifications/resources/updated',
    'notifications/tools/list_changed'
  ];

  const method = pick(methods);
  const hasParams = Math.random() > 0.5;

  let dsl: string;
  let prompt: string;

  if (hasParams && method === 'notifications/progress') {
    const progressToken = randomInt(1, 100);
    const progress = randomInt(0, 100);
    dsl = `! ${method} {progressToken: ${progressToken}, progress: ${progress}}`;
    prompt = `Send a progress notification with token ${progressToken} at ${progress}% progress`;
  } else {
    dsl = `! ${method}`;
    prompt = `Send a ${method.split('/').pop()?.replace(/_/g, ' ')} notification`;
  }

  let jsonRpc: string;
  try {
    const result = compileDsl(dsl);
    jsonRpc = JSON.stringify(result.messages[0], null, 2);
  } catch (e) {
    jsonRpc = JSON.stringify({
      jsonrpc: '2.0',
      method: method
    }, null, 2);
  }

  return { prompt, dsl, jsonRpc };
}

function generateError(): GeneratedPair {
  const messageId = randomInt(1, 1000);
  const errorCodes = [
    { code: -32700, message: 'Parse error' },
    { code: -32600, message: 'Invalid Request' },
    { code: -32601, message: 'Method not found' },
    { code: -32602, message: 'Invalid params' },
    { code: -32603, message: 'Internal error' }
  ];

  const error = pick(errorCodes);
  const dsl = `x #${messageId} ${error.code}: "${error.message}"`;
  const prompt = `Generate an error response for message ${messageId} with code ${error.code} (${error.message})`;

  let jsonRpc: string;
  try {
    const result = compileDsl(dsl);
    jsonRpc = JSON.stringify(result.messages[0], null, 2);
  } catch (e) {
    jsonRpc = JSON.stringify({
      jsonrpc: '2.0',
      id: messageId,
      error: {
        code: error.code,
        message: error.message
      }
    }, null, 2);
  }

  return { prompt, dsl, jsonRpc };
}

function generateResourceDefinition(): GeneratedPair {
  const resourceNames = ['config', 'logs', 'metrics', 'users', 'settings', 'cache', 'state'];
  const name = pick(resourceNames);
  const mimeTypes = ['application/json', 'text/plain', 'application/xml'];
  const mime = pick(mimeTypes);
  const uri = `resource://${name}/${randomString(1)}`;

  const dsl = `R ${name} {uri: "${uri}", mime: "${mime}"}`;
  const prompt = `Define a resource called "${name}" at URI "${uri}" with MIME type "${mime}"`;

  let jsonRpc: string;
  try {
    const result = compileDsl(dsl);
    jsonRpc = JSON.stringify(result.definitions.resources?.[0], null, 2);
  } catch (e) {
    jsonRpc = JSON.stringify({
      name,
      uri,
      mimeType: mime
    }, null, 2);
  }

  return { prompt, dsl, jsonRpc };
}

function generateMultiStepSequence(): GeneratedPair {
  const numSteps = randomInt(2, 4);
  const dslParts: string[] = [];
  const promptParts: string[] = [];
  const jsonRpcParts: any[] = [];

  for (let i = 0; i < numSteps; i++) {
    const tool = pick(TOOL_NAMES);
    const messageId = i + 1;
    const paramValue = randomString(2);

    dslParts.push(`> tools/call#${messageId} {name: "${tool}", args: {input: "${paramValue}"}}`);
    promptParts.push(`${i + 1}. Call ${tool.replace(/_/g, ' ')} with input "${paramValue}"`);

    jsonRpcParts.push({
      jsonrpc: '2.0',
      id: messageId,
      method: 'tools/call',
      params: {
        name: tool,
        arguments: { input: paramValue }
      }
    });
  }

  const dsl = dslParts.join('\n');
  const prompt = `Execute the following tool sequence:\n${promptParts.join('\n')}`;
  const jsonRpc = JSON.stringify(jsonRpcParts, null, 2);

  return { prompt, dsl, jsonRpc };
}

function generateComplexToolDefinition(): GeneratedPair {
  const tool = pick(TOOL_NAMES);
  const desc = pick(DESCRIPTIONS);

  // Nested object with enum
  const dsl = `T ${tool} {
  desc: "${desc}"
  in: {
    query: str!
    options?: {
      limit?: int = 10
      format: enum[json, xml, csv]
      filters?: [{
        field: str!
        operator: enum[eq, ne, gt, lt]
        value: str!
      }]
    }
  }
  out: {
    results: [{
      id: str!
      score: num
      data: {}
    }]
    total: int
  }
}`;

  const prompt = `Define a complex tool "${tool}" that ${desc.toLowerCase()}. It should:
- Accept a required query string
- Have optional options with limit (default 10), format (json/xml/csv), and filters array
- Return results array with id, score, data and a total count`;

  let jsonRpc: string;
  try {
    const result = compileDsl(dsl);
    jsonRpc = JSON.stringify(result.definitions.tools?.[0], null, 2);
  } catch (e) {
    // Fallback with approximate structure
    jsonRpc = JSON.stringify({
      name: tool,
      description: desc,
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          options: {
            type: 'object',
            properties: {
              limit: { type: 'integer', default: 10 },
              format: { type: 'string', enum: ['json', 'xml', 'csv'] },
              filters: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    operator: { type: 'string', enum: ['eq', 'ne', 'gt', 'lt'] },
                    value: { type: 'string' }
                  },
                  required: ['field', 'operator', 'value']
                }
              }
            }
          }
        },
        required: ['query']
      },
      outputSchema: {
        type: 'object',
        properties: {
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                score: { type: 'number' },
                data: { type: 'object' }
              },
              required: ['id']
            }
          },
          total: { type: 'integer' }
        }
      }
    }, null, 2);
  }

  return { prompt, dsl, jsonRpc };
}

// ============================================================================
// Main Generation
// ============================================================================

const GENERATORS = [
  { fn: generateSimpleToolCall, weight: 30 },
  { fn: generateToolDefinition, weight: 20 },
  { fn: generateInitialize, weight: 10 },
  { fn: generateResponse, weight: 15 },
  { fn: generateNotification, weight: 5 },
  { fn: generateError, weight: 5 },
  { fn: generateResourceDefinition, weight: 5 },
  { fn: generateMultiStepSequence, weight: 5 },
  { fn: generateComplexToolDefinition, weight: 5 }
];

function pickGenerator(): () => GeneratedPair {
  const totalWeight = GENERATORS.reduce((sum, g) => sum + g.weight, 0);
  let random = Math.random() * totalWeight;

  for (const gen of GENERATORS) {
    random -= gen.weight;
    if (random <= 0) {
      return gen.fn;
    }
  }

  return GENERATORS[0].fn;
}

function generateDataset(count: number): { dsl: TrainingExample[], jsonRpc: TrainingExample[] } {
  const dslExamples: TrainingExample[] = [];
  const jsonRpcExamples: TrainingExample[] = [];

  for (let i = 0; i < count; i++) {
    const generator = pickGenerator();
    const pair = generator();

    dslExamples.push({
      instruction: 'Convert the following request to MCP-DSL format.',
      input: pair.prompt,
      output: pair.dsl
    });

    jsonRpcExamples.push({
      instruction: 'Convert the following request to JSON-RPC format.',
      input: pair.prompt,
      output: pair.jsonRpc
    });

    if ((i + 1) % 1000 === 0) {
      console.log(`Generated ${i + 1} examples...`);
    }
  }

  return { dsl: dslExamples, jsonRpc: jsonRpcExamples };
}

function writeJsonl(examples: TrainingExample[], filename: string): void {
  const lines = examples.map(ex => JSON.stringify(ex));
  writeFileSync(filename, lines.join('\n'));
  console.log(`Wrote ${examples.length} examples to ${filename}`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('Generating training data...\n');

  // Training set
  console.log('Generating training set (10,000 examples)...');
  const train = generateDataset(10000);
  writeJsonl(train.dsl, 'experiment/data/train_dsl.jsonl');
  writeJsonl(train.jsonRpc, 'experiment/data/train_jsonrpc.jsonl');

  // Validation set
  console.log('\nGenerating validation set (1,000 examples)...');
  const val = generateDataset(1000);
  writeJsonl(val.dsl, 'experiment/data/val_dsl.jsonl');
  writeJsonl(val.jsonRpc, 'experiment/data/val_jsonrpc.jsonl');

  // Test set
  console.log('\nGenerating test set (1,000 examples)...');
  const test = generateDataset(1000);
  writeJsonl(test.dsl, 'experiment/data/test_dsl.jsonl');
  writeJsonl(test.jsonRpc, 'experiment/data/test_jsonrpc.jsonl');

  // Token count analysis
  console.log('\nToken count analysis (approximate):');
  const sampleSize = 100;
  let dslTokens = 0;
  let jsonRpcTokens = 0;

  for (let i = 0; i < sampleSize; i++) {
    // Rough approximation: 4 chars ≈ 1 token
    dslTokens += train.dsl[i].output.length / 4;
    jsonRpcTokens += train.jsonRpc[i].output.length / 4;
  }

  const avgDsl = dslTokens / sampleSize;
  const avgJsonRpc = jsonRpcTokens / sampleSize;
  const reduction = ((avgJsonRpc - avgDsl) / avgJsonRpc * 100).toFixed(1);

  console.log(`Average DSL output tokens: ${avgDsl.toFixed(1)}`);
  console.log(`Average JSON-RPC output tokens: ${avgJsonRpc.toFixed(1)}`);
  console.log(`Token reduction: ${reduction}%`);

  console.log('\nDone!');
}

main().catch(console.error);
