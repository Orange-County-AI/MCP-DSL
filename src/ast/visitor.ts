/**
 * Visitor pattern for AST traversal
 * Used for compilation, decompilation, validation, and other transformations
 */

import type * as AST from './nodes.js';

/**
 * Base visitor interface with methods for each AST node type
 */
export interface AstVisitor<T = void> {
  // Document
  visitDocument(node: AST.DocumentNode): T;
  visitServerBlock(node: AST.ServerBlockNode): T;
  visitVersion(node: AST.VersionNode): T;

  // Messages
  visitRequest(node: AST.RequestNode): T;
  visitResponse(node: AST.ResponseNode): T;
  visitNotification(node: AST.NotificationNode): T;
  visitError(node: AST.ErrorNode): T;

  // Definitions
  visitResourceDef(node: AST.ResourceDefNode): T;
  visitToolDef(node: AST.ToolDefNode): T;
  visitPromptDef(node: AST.PromptDefNode): T;
  visitResourceTemplateDef(node: AST.ResourceTemplateDefNode): T;
  visitCollectionDef(node: AST.CollectionDefNode): T;
  visitNamedBlock(node: AST.NamedBlockNode): T;

  // Types
  visitUnionType(node: AST.UnionTypeNode): T;
  visitCastType(node: AST.CastTypeNode): T;
  visitPrimaryType(node: AST.PrimaryTypeNode): T;
  visitPrimitiveType(node: AST.PrimitiveTypeNode): T;
  visitArrayType(node: AST.ArrayTypeNode): T;
  visitObjectType(node: AST.ObjectTypeNode): T;
  visitEnumType(node: AST.EnumTypeNode): T;
  visitReferenceType(node: AST.ReferenceTypeNode): T;
  visitFieldDef(node: AST.FieldDefNode): T;

  // Values
  visitString(node: AST.StringNode): T;
  visitInteger(node: AST.IntegerNode): T;
  visitDecimal(node: AST.DecimalNode): T;
  visitBoolean(node: AST.BooleanNode): T;
  visitNull(node: AST.NullNode): T;
  visitIdentifier(node: AST.IdentifierNode): T;
  visitArray(node: AST.ArrayNode): T;
  visitObject(node: AST.ObjectNode): T;
  visitFieldAssignment(node: AST.FieldAssignmentNode): T;
  visitCastValue(node: AST.CastValueNode): T;

  // Content
  visitTextContent(node: AST.TextContentNode): T;
  visitImageContent(node: AST.ImageContentNode): T;
  visitAudioContent(node: AST.AudioContentNode): T;
  visitResourceRef(node: AST.ResourceRefNode): T;
  visitToolRef(node: AST.ToolRefNode): T;
  visitEmbeddedResource(node: AST.EmbeddedResourceNode): T;

  // Special
  visitAnnotation(node: AST.AnnotationNode): T;
  visitCapabilitySet(node: AST.CapabilitySetNode): T;
  visitCapability(node: AST.CapabilityNode): T;
  visitRoleMessage(node: AST.RoleMessageNode): T;
  visitCompositeContent(node: AST.CompositeContentNode): T;
}

/**
 * Helper function to visit any node with the appropriate visitor method
 */
export function visit<T>(node: AST.BaseNode, visitor: AstVisitor<T>): T {
  switch (node.type) {
    // Document
    case 'Document':
      return visitor.visitDocument(node as AST.DocumentNode);
    case 'ServerBlock':
      return visitor.visitServerBlock(node as AST.ServerBlockNode);
    case 'Version':
      return visitor.visitVersion(node as AST.VersionNode);

    // Messages
    case 'Request':
      return visitor.visitRequest(node as AST.RequestNode);
    case 'Response':
      return visitor.visitResponse(node as AST.ResponseNode);
    case 'Notification':
      return visitor.visitNotification(node as AST.NotificationNode);
    case 'Error':
      return visitor.visitError(node as AST.ErrorNode);

    // Definitions
    case 'ResourceDef':
      return visitor.visitResourceDef(node as AST.ResourceDefNode);
    case 'ToolDef':
      return visitor.visitToolDef(node as AST.ToolDefNode);
    case 'PromptDef':
      return visitor.visitPromptDef(node as AST.PromptDefNode);
    case 'ResourceTemplateDef':
      return visitor.visitResourceTemplateDef(node as AST.ResourceTemplateDefNode);
    case 'CollectionDef':
      return visitor.visitCollectionDef(node as AST.CollectionDefNode);
    case 'NamedBlock':
      return visitor.visitNamedBlock(node as AST.NamedBlockNode);

    // Types
    case 'UnionType':
      return visitor.visitUnionType(node as AST.UnionTypeNode);
    case 'CastType':
      return visitor.visitCastType(node as AST.CastTypeNode);
    case 'PrimaryType':
      return visitor.visitPrimaryType(node as AST.PrimaryTypeNode);
    case 'PrimitiveType':
      return visitor.visitPrimitiveType(node as AST.PrimitiveTypeNode);
    case 'ArrayType':
      return visitor.visitArrayType(node as AST.ArrayTypeNode);
    case 'ObjectType':
      return visitor.visitObjectType(node as AST.ObjectTypeNode);
    case 'EnumType':
      return visitor.visitEnumType(node as AST.EnumTypeNode);
    case 'ReferenceType':
      return visitor.visitReferenceType(node as AST.ReferenceTypeNode);
    case 'FieldDef':
      return visitor.visitFieldDef(node as AST.FieldDefNode);

    // Values
    case 'String':
      return visitor.visitString(node as AST.StringNode);
    case 'Integer':
      return visitor.visitInteger(node as AST.IntegerNode);
    case 'Decimal':
      return visitor.visitDecimal(node as AST.DecimalNode);
    case 'Boolean':
      return visitor.visitBoolean(node as AST.BooleanNode);
    case 'Null':
      return visitor.visitNull(node as AST.NullNode);
    case 'Identifier':
      return visitor.visitIdentifier(node as AST.IdentifierNode);
    case 'Array':
      return visitor.visitArray(node as AST.ArrayNode);
    case 'Object':
      return visitor.visitObject(node as AST.ObjectNode);
    case 'FieldAssignment':
      return visitor.visitFieldAssignment(node as AST.FieldAssignmentNode);
    case 'CastValue':
      return visitor.visitCastValue(node as AST.CastValueNode);

    // Content
    case 'TextContent':
      return visitor.visitTextContent(node as AST.TextContentNode);
    case 'ImageContent':
      return visitor.visitImageContent(node as AST.ImageContentNode);
    case 'AudioContent':
      return visitor.visitAudioContent(node as AST.AudioContentNode);
    case 'ResourceRef':
      return visitor.visitResourceRef(node as AST.ResourceRefNode);
    case 'ToolRef':
      return visitor.visitToolRef(node as AST.ToolRefNode);
    case 'EmbeddedResource':
      return visitor.visitEmbeddedResource(node as AST.EmbeddedResourceNode);

    // Special
    case 'Annotation':
      return visitor.visitAnnotation(node as AST.AnnotationNode);
    case 'CapabilitySet':
      return visitor.visitCapabilitySet(node as AST.CapabilitySetNode);
    case 'Capability':
      return visitor.visitCapability(node as AST.CapabilityNode);
    case 'RoleMessage':
      return visitor.visitRoleMessage(node as AST.RoleMessageNode);
    case 'CompositeContent':
      return visitor.visitCompositeContent(node as AST.CompositeContentNode);

    default:
      throw new Error(`Unknown node type: ${(node as AST.BaseNode).type}`);
  }
}
