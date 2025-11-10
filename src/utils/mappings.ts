/**
 * Mapping tables for DSL ↔ JSON-RPC conversions
 * Based on GRAMMAR.md field name and type mappings
 */

/**
 * DSL field abbreviations to JSON-RPC field names
 * Context-dependent mappings based on GRAMMAR.md:211
 */
export const FIELD_MAPPINGS: Record<string, string> = {
  v: 'protocolVersion',
  caps: 'capabilities',
  info: 'clientInfo', // or serverInfo, context-dependent
  args: 'arguments',
  desc: 'description',
  mime: 'mimeType',
  in: 'inputSchema',
  out: 'outputSchema',
  msgs: 'messages',
  ok: 'isError', // Note: negated boolean
};

/**
 * Get JSON field name from DSL abbreviation
 * @param dslField - DSL field name
 * @param context - Optional context for disambiguation
 */
export function getJsonFieldName(dslField: string, context?: string): string {
  if (dslField === 'info') {
    return context === 'client' ? 'clientInfo' : context === 'server' ? 'serverInfo' : 'info';
  }
  return FIELD_MAPPINGS[dslField] || dslField;
}

/**
 * Get DSL field name from JSON field name
 */
export function getDslFieldName(jsonField: string): string {
  const entry = Object.entries(FIELD_MAPPINGS).find(([_, json]) => json === jsonField);
  return entry ? entry[0] : jsonField;
}

/**
 * Annotation mappings to JSON-RPC
 * Based on GRAMMAR.md:247
 */
export interface AnnotationMapping {
  target: 'tool' | 'resource' | 'prompt' | 'initialize' | 'any';
  jsonPath: string;
  transform?: (value: any) => any;
}

export const ANNOTATION_MAPPINGS: Record<string, AnnotationMapping> = {
  readonly: {
    target: 'tool',
    jsonPath: 'annotations.readOnlyHint',
  },
  idempotent: {
    target: 'tool',
    jsonPath: 'annotations.idempotentHint',
  },
  destructive: {
    target: 'tool',
    jsonPath: 'annotations.destructiveHint',
    transform: (value) => value === false,
  },
  openWorld: {
    target: 'tool',
    jsonPath: 'annotations.openWorld',
  },
  priority: {
    target: 'resource',
    jsonPath: 'annotations.priority',
  },
  audience: {
    target: 'any',
    jsonPath: 'annotations.audience',
  },
  impl: {
    target: 'initialize',
    jsonPath: '',
    transform: (value: [string, string]) => ({
      name: value[0],
      version: value[1],
    }),
  },
};

/**
 * Primitive type mappings to JSON Schema
 * Based on GRAMMAR.md:228
 */
export const TYPE_MAPPINGS: Record<string, object> = {
  str: { type: 'string' },
  int: { type: 'integer' },
  num: { type: 'number' },
  bool: { type: 'boolean' },
  uri: { type: 'string', format: 'uri' },
  blob: { type: 'string', contentEncoding: 'base64' },
};

/**
 * Type cast format mappings
 * Based on GRAMMAR.md:228
 */
export const TYPE_CAST_FORMATS: Record<string, string> = {
  'date-time': 'date-time',
  'date': 'date',
  'time': 'time',
  'email': 'email',
  'hostname': 'hostname',
  'ipv4': 'ipv4',
  'ipv6': 'ipv6',
  'uri': 'uri',
  'uri-reference': 'uri-reference',
  'uuid': 'uuid',
};

/**
 * Image format mappings
 */
export const IMAGE_FORMATS = ['jpeg', 'png', 'gif', 'webp'] as const;
export type ImageFormat = typeof IMAGE_FORMATS[number];

/**
 * Audio format mappings
 */
export const AUDIO_FORMATS = ['mp3', 'wav', 'ogg', 'flac'] as const;
export type AudioFormat = typeof AUDIO_FORMATS[number];
