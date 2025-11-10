/**
 * AST Node definitions for MCP-DSL
 * Based on GRAMMAR.md structure
 */

import type { SourceRange, ContextKind } from '../types/common.js';

/**
 * Base interface for all AST nodes
 */
export interface BaseNode {
  type: string;
  range: SourceRange;
}

// ============================================================================
// Document Structure
// ============================================================================

export interface DocumentNode extends BaseNode {
  type: 'Document';
  body: (MessageNode | DefinitionNode | ServerBlockNode)[];
}

export interface ServerBlockNode extends BaseNode {
  type: 'ServerBlock';
  name: string;
  version?: VersionNode;
  body: ObjectNode;
}

export interface VersionNode extends BaseNode {
  type: 'Version';
  major: number;
  minor: number;
  patch: number;
}

// ============================================================================
// Messages
// ============================================================================

export type MessageNode = RequestNode | ResponseNode | NotificationNode | ErrorNode;

export interface RequestNode extends BaseNode {
  type: 'Request';
  method: string;
  id: number;
  params?: ObjectNode;
}

export interface ResponseNode extends BaseNode {
  type: 'Response';
  id: number;
  result?: ValueNode;
}

export interface NotificationNode extends BaseNode {
  type: 'Notification';
  method: string;
  params?: ObjectNode;
}

export interface ErrorNode extends BaseNode {
  type: 'Error';
  id: number;
  code: number;
  message: string;
  data?: ValueNode;
}

// ============================================================================
// Definitions
// ============================================================================

export type DefinitionNode =
  | ResourceDefNode
  | ToolDefNode
  | PromptDefNode
  | ResourceTemplateDefNode
  | CollectionDefNode;

export interface ResourceDefNode extends BaseNode {
  type: 'ResourceDef';
  name: string;
  body: ObjectNode;
}

export interface ToolDefNode extends BaseNode {
  type: 'ToolDef';
  name: string;
  body: ObjectNode;
}

export interface PromptDefNode extends BaseNode {
  type: 'PromptDef';
  name: string;
  body: ObjectNode;
}

export interface ResourceTemplateDefNode extends BaseNode {
  type: 'ResourceTemplateDef';
  name: string;
  body: ObjectNode;
}

export interface CollectionDefNode extends BaseNode {
  type: 'CollectionDef';
  definitionType: 'R' | 'T' | 'P' | 'RT';
  items: NamedBlockNode[];
}

export interface NamedBlockNode extends BaseNode {
  type: 'NamedBlock';
  name: string;
  value: ObjectNode | StringNode | TypeExprNode;
}

// ============================================================================
// Type System
// ============================================================================

export type TypeExprNode =
  | UnionTypeNode
  | CastTypeNode
  | PrimaryTypeNode
  | PrimitiveTypeNode
  | ArrayTypeNode
  | ObjectTypeNode
  | EnumTypeNode
  | ReferenceTypeNode;

export interface UnionTypeNode extends BaseNode {
  type: 'UnionType';
  types: TypeExprNode[];
}

export interface CastTypeNode extends BaseNode {
  type: 'CastType';
  baseType: TypeExprNode;
  casts: string[]; // e.g., ['date-time', 'uri']
}

export interface PrimaryTypeNode extends BaseNode {
  type: 'PrimaryType';
  baseType: TypeExprNode;
  modifier?: '!' | '?';
}

export interface PrimitiveTypeNode extends BaseNode {
  type: 'PrimitiveType';
  primitiveType: 'str' | 'int' | 'num' | 'bool' | 'uri' | 'blob';
}

export interface ArrayTypeNode extends BaseNode {
  type: 'ArrayType';
  elementType?: TypeExprNode;
}

export interface ObjectTypeNode extends BaseNode {
  type: 'ObjectType';
  fields: FieldDefNode[];
}

export interface EnumTypeNode extends BaseNode {
  type: 'EnumType';
  values: string[];
}

export interface ReferenceTypeNode extends BaseNode {
  type: 'ReferenceType';
  name: string;
}

export interface FieldDefNode extends BaseNode {
  type: 'FieldDef';
  name: string;
  typeExpr: TypeExprNode;
  defaultValue?: ValueNode;
}

// ============================================================================
// Values
// ============================================================================

export type ValueNode =
  | StringNode
  | IntegerNode
  | DecimalNode
  | BooleanNode
  | NullNode
  | ArrayNode
  | ObjectNode
  | ContentValueNode
  | IdentifierNode
  | CastValueNode;

export interface StringNode extends BaseNode {
  type: 'String';
  value: string;
}

export interface IntegerNode extends BaseNode {
  type: 'Integer';
  value: number;
}

export interface DecimalNode extends BaseNode {
  type: 'Decimal';
  value: number;
}

export interface BooleanNode extends BaseNode {
  type: 'Boolean';
  value: boolean;
}

export interface NullNode extends BaseNode {
  type: 'Null';
}

export interface IdentifierNode extends BaseNode {
  type: 'Identifier';
  name: string;
}

export interface ArrayNode extends BaseNode {
  type: 'Array';
  elements: ValueNode[];
}

export interface ObjectNode extends BaseNode {
  type: 'Object';
  properties: (FieldAssignmentNode | AnnotationNode | DefinitionNode)[];
  contextKind?: ContextKind; // For semantic validation
}

export interface FieldAssignmentNode extends BaseNode {
  type: 'FieldAssignment';
  name: string;
  modifier?: '!' | '?';
  value: ValueNode;
}

export interface CastValueNode extends BaseNode {
  type: 'CastValue';
  value: ValueNode;
  casts: string[];
}

// ============================================================================
// Content Types
// ============================================================================

export type ContentValueNode =
  | TextContentNode
  | ImageContentNode
  | AudioContentNode
  | ResourceRefNode
  | EmbeddedResourceNode
  | ToolRefNode;

export interface TextContentNode extends BaseNode {
  type: 'TextContent';
  content: string;
  multiline: boolean;
}

export interface ImageContentNode extends BaseNode {
  type: 'ImageContent';
  data: string;
  format?: 'jpeg' | 'png' | 'gif' | 'webp';
}

export interface AudioContentNode extends BaseNode {
  type: 'AudioContent';
  data: string;
  format?: 'mp3' | 'wav' | 'ogg' | 'flac';
}

export interface ResourceRefNode extends BaseNode {
  type: 'ResourceRef';
  name: string;
}

export interface ToolRefNode extends BaseNode {
  type: 'ToolRef';
  name: string;
}

export interface EmbeddedResourceNode extends BaseNode {
  type: 'EmbeddedResource';
  content: ObjectNode;
}

// ============================================================================
// Annotations
// ============================================================================

export interface AnnotationNode extends BaseNode {
  type: 'Annotation';
  name: string;
  value?: ValueNode | ValueNode[];
}

// ============================================================================
// Special Constructs
// ============================================================================

export interface CapabilitySetNode extends BaseNode {
  type: 'CapabilitySet';
  capabilities: CapabilityNode[];
}

export interface CapabilityNode extends BaseNode {
  type: 'Capability';
  path: string[]; // e.g., ['roots', 'listChanged'] for roots.listChanged
}

export interface RoleMessageNode extends BaseNode {
  type: 'RoleMessage';
  role: 'u' | 'a' | 's';
  content: ValueNode;
}

export interface CompositeContentNode extends BaseNode {
  type: 'CompositeContent';
  parts: ContentValueNode[];
}

// ============================================================================
// Type guards
// ============================================================================

export function isMessageNode(node: BaseNode): node is MessageNode {
  return ['Request', 'Response', 'Notification', 'Error'].includes(node.type);
}

export function isDefinitionNode(node: BaseNode): node is DefinitionNode {
  return ['ResourceDef', 'ToolDef', 'PromptDef', 'ResourceTemplateDef', 'CollectionDef'].includes(node.type);
}

export function isValueNode(node: BaseNode): node is ValueNode {
  return ['String', 'Integer', 'Decimal', 'Boolean', 'Null', 'Array', 'Object', 'Identifier', 'CastValue'].includes(node.type)
    || isContentValueNode(node);
}

export function isContentValueNode(node: BaseNode): node is ContentValueNode {
  return ['TextContent', 'ImageContent', 'AudioContent', 'ResourceRef', 'EmbeddedResource', 'ToolRef'].includes(node.type);
}

export function isTypeExprNode(node: BaseNode): node is TypeExprNode {
  return ['UnionType', 'CastType', 'PrimaryType', 'PrimitiveType', 'ArrayType', 'ObjectType', 'EnumType', 'ReferenceType'].includes(node.type);
}
