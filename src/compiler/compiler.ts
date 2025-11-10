/**
 * Compiler: Transforms MCP-DSL AST to JSON-RPC 2.0 messages
 */

import * as AST from '../ast/nodes.js';
import { visit } from '../ast/visitor.js';
import type { AstVisitor } from '../ast/visitor.js';
import {
  getJsonFieldName,
  ANNOTATION_MAPPINGS,
  TYPE_MAPPINGS,
  TYPE_CAST_FORMATS,
} from '../utils/mappings.js';
import { buildNestedObject } from '../utils/string-utils.js';
import type {
  JsonRpcMessageType,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcError,
  JsonSchema,
  McpToolDefinition,
  McpResourceDefinition,
  McpPromptDefinition,
} from './json-rpc-types.js';

/**
 * Compilation result
 */
export interface CompilationResult {
  messages: JsonRpcMessageType[];
  definitions: {
    tools?: McpToolDefinition[];
    resources?: McpResourceDefinition[];
    prompts?: McpPromptDefinition[];
    resourceTemplates?: McpResourceDefinition[];
  };
  serverInfo?: {
    name: string;
    version: string;
    capabilities?: any;
  };
}

/**
 * Compiler class that transforms AST to JSON-RPC
 */
export class Compiler implements AstVisitor<any> {
  private result: CompilationResult = {
    messages: [],
    definitions: {},
  };

  /**
   * Compile a document AST to JSON-RPC messages and definitions
   */
  compile(document: AST.DocumentNode): CompilationResult {
    this.result = {
      messages: [],
      definitions: {},
    };

    for (const node of document.body) {
      if (AST.isMessageNode(node)) {
        const message = visit(node, this);
        this.result.messages.push(message);
      } else if (AST.isDefinitionNode(node)) {
        const definition = visit(node, this);
        this.addDefinition(node.type, definition);
      } else if (node.type === 'ServerBlock') {
        this.result.serverInfo = visit(node, this);
      }
    }

    return this.result;
  }

  private addDefinition(type: string, definition: any): void {
    switch (type) {
      case 'ToolDef':
        if (!this.result.definitions.tools) this.result.definitions.tools = [];
        this.result.definitions.tools.push(definition);
        break;
      case 'ResourceDef':
        if (!this.result.definitions.resources) this.result.definitions.resources = [];
        this.result.definitions.resources.push(definition);
        break;
      case 'PromptDef':
        if (!this.result.definitions.prompts) this.result.definitions.prompts = [];
        this.result.definitions.prompts.push(definition);
        break;
      case 'ResourceTemplateDef':
        if (!this.result.definitions.resourceTemplates) this.result.definitions.resourceTemplates = [];
        this.result.definitions.resourceTemplates.push(definition);
        break;
    }
  }

  // ============================================================================
  // Document
  // ============================================================================

  visitDocument(node: AST.DocumentNode): any {
    return this.compile(node);
  }

  visitServerBlock(node: AST.ServerBlockNode): any {
    const body = this.visitObject(node.body);
    return {
      name: node.name,
      version: node.version ? `${node.version.major}.${node.version.minor}.${node.version.patch}` : undefined,
      ...body,
    };
  }

  visitVersion(node: AST.VersionNode): string {
    return `${node.major}.${node.minor}.${node.patch}`;
  }

  // ============================================================================
  // Messages
  // ============================================================================

  visitRequest(node: AST.RequestNode): JsonRpcRequest {
    return {
      jsonrpc: '2.0',
      id: node.id,
      method: node.method,
      params: node.params ? this.visitObject(node.params) : undefined,
    };
  }

  visitResponse(node: AST.ResponseNode): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id: node.id,
      result: node.result ? visit(node.result, this) : undefined,
    };
  }

  visitNotification(node: AST.NotificationNode): JsonRpcNotification {
    return {
      jsonrpc: '2.0',
      method: node.method,
      params: node.params ? this.visitObject(node.params) : undefined,
    };
  }

  visitError(node: AST.ErrorNode): JsonRpcError {
    return {
      jsonrpc: '2.0',
      id: node.id,
      error: {
        code: node.code,
        message: node.message,
        data: node.data ? visit(node.data, this) : undefined,
      },
    };
  }

  // ============================================================================
  // Definitions
  // ============================================================================

  visitToolDef(node: AST.ToolDefNode): McpToolDefinition {
    const body = this.visitObject(node.body);
    return {
      name: node.name,
      description: body.description || body.desc,
      inputSchema: body.inputSchema || body.in || { type: 'object' },
      outputSchema: body.outputSchema || body.out,
      annotations: this.extractAnnotations(node.body),
    };
  }

  visitResourceDef(node: AST.ResourceDefNode): McpResourceDefinition {
    const body = this.visitObject(node.body);
    return {
      name: node.name,
      uri: body.uri,
      mimeType: body.mimeType || body.mime,
      description: body.description || body.desc,
      annotations: this.extractAnnotations(node.body),
    };
  }

  visitPromptDef(node: AST.PromptDefNode): McpPromptDefinition {
    const body = this.visitObject(node.body);
    return {
      name: node.name,
      description: body.description || body.desc,
      arguments: body.arguments || body.args,
      messages: body.messages || body.msgs,
    };
  }

  visitResourceTemplateDef(node: AST.ResourceTemplateDefNode): McpResourceDefinition {
    const body = this.visitObject(node.body);
    return {
      uri: body.uri,
      mimeType: body.mimeType || body.mime,
      description: body.description || body.desc,
      annotations: this.extractAnnotations(node.body),
    };
  }

  visitCollectionDef(node: AST.CollectionDefNode): any {
    return node.items.map(item => this.visitNamedBlock(item));
  }

  visitNamedBlock(node: AST.NamedBlockNode): any {
    if (node.value.type === 'Object') {
      return {
        name: node.name,
        ...this.visitObject(node.value),
      };
    }
    return visit(node.value, this);
  }

  // ============================================================================
  // Values
  // ============================================================================

  visitString(node: AST.StringNode): string {
    return node.value;
  }

  visitInteger(node: AST.IntegerNode): number {
    return node.value;
  }

  visitDecimal(node: AST.DecimalNode): number {
    return node.value;
  }

  visitBoolean(node: AST.BooleanNode): boolean {
    return node.value;
  }

  visitNull(node: AST.NullNode): null {
    return null;
  }

  visitIdentifier(node: AST.IdentifierNode): any {
    // Identifiers in value position might be type references or capability names
    return node.name;
  }

  visitArray(node: AST.ArrayNode): any[] {
    return node.elements.map(elem => visit(elem, this));
  }

  visitObject(node: AST.ObjectNode): Record<string, any> {
    const result: Record<string, any> = {};
    const annotations: Record<string, any> = {};

    for (const prop of node.properties) {
      if (prop.type === 'FieldAssignment') {
        const assignment = prop as AST.FieldAssignmentNode;
        const jsonFieldName = getJsonFieldName(assignment.name);
        let value = visit(assignment.value, this);

        // Special handling for 'ok' field (negated to isError)
        if (assignment.name === 'ok' && typeof value === 'boolean') {
          result['isError'] = !value;
        } else {
          result[jsonFieldName] = value;
        }
      } else if (prop.type === 'Annotation') {
        const annotation = prop as AST.AnnotationNode;
        const mapping = ANNOTATION_MAPPINGS[annotation.name];

        if (mapping) {
          if (mapping.jsonPath === '') {
            // Special annotation like @impl
            if (annotation.value && Array.isArray(annotation.value)) {
              const transformed = mapping.transform ? mapping.transform(annotation.value) : annotation.value;
              Object.assign(result, transformed);
            }
          } else {
            const value = annotation.value ? (Array.isArray(annotation.value) ? annotation.value.map(v => visit(v, this)) : visit(annotation.value, this)) : true;
            const transformed = mapping.transform ? mapping.transform(value) : value;
            const pathParts = mapping.jsonPath.split('.');
            this.setNestedValue(result, pathParts, transformed);
          }
        } else {
          // Custom annotation
          annotations[annotation.name] = annotation.value ? visit(annotation.value, this) : true;
        }
      } else if (AST.isDefinitionNode(prop)) {
        // Nested definition
        const def = visit(prop, this);
        if (!result.definitions) result.definitions = [];
        result.definitions.push(def);
      }
    }

    if (Object.keys(annotations).length > 0) {
      if (!result.annotations) result.annotations = {};
      Object.assign(result.annotations, annotations);
    }

    return result;
  }

  visitFieldAssignment(node: AST.FieldAssignmentNode): any {
    return visit(node.value, this);
  }

  visitCastValue(node: AST.CastValueNode): any {
    // Cast values don't affect JSON output, they're type hints
    return visit(node.value, this);
  }

  // ============================================================================
  // Content Types
  // ============================================================================

  visitTextContent(node: AST.TextContentNode): any {
    return {
      type: 'text',
      text: node.content,
    };
  }

  visitImageContent(node: AST.ImageContentNode): any {
    return {
      type: 'image',
      data: node.data,
      mimeType: node.format ? `image/${node.format}` : undefined,
    };
  }

  visitAudioContent(node: AST.AudioContentNode): any {
    return {
      type: 'audio',
      data: node.data,
      mimeType: node.format ? `audio/${node.format}` : undefined,
    };
  }

  visitResourceRef(node: AST.ResourceRefNode): any {
    return {
      type: 'resource',
      resource: {
        uri: node.name,
      },
    };
  }

  visitToolRef(node: AST.ToolRefNode): any {
    return {
      type: 'tool',
      name: node.name,
    };
  }

  visitEmbeddedResource(node: AST.EmbeddedResourceNode): any {
    return {
      type: 'resource',
      ...this.visitObject(node.content),
    };
  }

  // ============================================================================
  // Special Constructs
  // ============================================================================

  visitAnnotation(node: AST.AnnotationNode): any {
    return {
      [node.name]: node.value ? visit(node.value, this) : true,
    };
  }

  visitCapabilitySet(node: AST.CapabilitySetNode): any {
    const result: Record<string, any> = {};

    for (const cap of node.capabilities) {
      const nested = buildNestedObject(cap.path);
      this.mergeDeep(result, nested);
    }

    return result;
  }

  visitCapability(node: AST.CapabilityNode): any {
    return buildNestedObject(node.path);
  }

  visitRoleMessage(node: AST.RoleMessageNode): any {
    const roleMap = { u: 'user', a: 'assistant', s: 'system' };
    return {
      role: roleMap[node.role],
      content: visit(node.content, this),
    };
  }

  visitCompositeContent(node: AST.CompositeContentNode): any {
    return node.parts.map(part => visit(part, this));
  }

  // ============================================================================
  // Type System - compile to JSON Schema
  // ============================================================================

  visitUnionType(node: AST.UnionTypeNode): JsonSchema {
    return {
      oneOf: node.types.map(t => visit(t, this)),
    };
  }

  visitCastType(node: AST.CastTypeNode): JsonSchema {
    const schema = visit(node.baseType, this);

    // Apply format cast
    if (node.casts.length > 0) {
      const format = node.casts[node.casts.length - 1];
      if (TYPE_CAST_FORMATS[format]) {
        schema.format = TYPE_CAST_FORMATS[format];
      }
    }

    return schema;
  }

  visitPrimaryType(node: AST.PrimaryTypeNode): JsonSchema {
    const schema = visit(node.baseType, this);
    // Modifiers (! and ?) are handled at the field level, not in the schema itself
    return schema;
  }

  visitPrimitiveType(node: AST.PrimitiveTypeNode): JsonSchema {
    return { ...TYPE_MAPPINGS[node.primitiveType] };
  }

  visitArrayType(node: AST.ArrayTypeNode): JsonSchema {
    return {
      type: 'array',
      items: node.elementType ? visit(node.elementType, this) : undefined,
    };
  }

  visitObjectType(node: AST.ObjectTypeNode): JsonSchema {
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];

    for (const field of node.fields) {
      properties[field.name] = visit(field.typeExpr, this);

      // Check if field is required (has ! modifier)
      if (field.typeExpr.type === 'PrimaryType') {
        const primaryType = field.typeExpr as AST.PrimaryTypeNode;
        if (primaryType.modifier === '!') {
          required.push(field.name);
        }
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  visitEnumType(node: AST.EnumTypeNode): JsonSchema {
    return {
      type: 'string',
      enum: node.values,
    };
  }

  visitReferenceType(node: AST.ReferenceTypeNode): JsonSchema {
    return {
      $ref: `#/definitions/${node.name}`,
    };
  }

  visitFieldDef(node: AST.FieldDefNode): JsonSchema {
    const schema = visit(node.typeExpr, this);
    if (node.defaultValue) {
      schema.default = visit(node.defaultValue, this);
    }
    return schema;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private extractAnnotations(node: AST.ObjectNode): Record<string, any> | undefined {
    const annotations: Record<string, any> = {};

    for (const prop of node.properties) {
      if (prop.type === 'Annotation') {
        const annotation = prop as AST.AnnotationNode;
        annotations[annotation.name] = annotation.value ? visit(annotation.value, this) : true;
      }
    }

    return Object.keys(annotations).length > 0 ? annotations : undefined;
  }

  private setNestedValue(obj: any, path: string[], value: any): void {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key];
    }
    current[path[path.length - 1]] = value;
  }

  private mergeDeep(target: any, source: any): void {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) {
          target[key] = {};
        }
        this.mergeDeep(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
}

/**
 * Convenience function to compile DSL source to JSON-RPC
 */
export function compile(document: AST.DocumentNode): CompilationResult {
  const compiler = new Compiler();
  return compiler.compile(document);
}
