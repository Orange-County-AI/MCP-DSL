/**
 * Semantic Validator: Context-aware validation of AST nodes
 * Enforces rules that can't be checked during parsing (GRAMMAR.md:178)
 */

import * as AST from '../ast/nodes.js';
import { visit } from '../ast/visitor.js';
import type { AstVisitor } from '../ast/visitor.js';
import { Diagnostic, DiagnosticSeverity, ContextKind } from '../types/common.js';
import { ANNOTATION_MAPPINGS } from '../utils/mappings.js';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  diagnostics: Diagnostic[];
}

/**
 * Semantic validator that enforces context-sensitive rules
 */
export class SemanticValidator implements AstVisitor<Diagnostic[]> {
  private diagnostics: Diagnostic[] = [];
  private currentContext: ContextKind = ContextKind.GeneralValue;

  /**
   * Validate an AST and return diagnostics
   */
  validate(node: AST.DocumentNode): ValidationResult {
    this.diagnostics = [];
    visit(node, this);
    return {
      valid: this.diagnostics.every(d => d.severity !== DiagnosticSeverity.Error),
      diagnostics: this.diagnostics,
    };
  }

  private addDiagnostic(severity: DiagnosticSeverity, message: string, range: AST.BaseNode['range']): void {
    this.diagnostics.push({
      severity,
      message,
      range,
    });
  }

  private withContext<T>(context: ContextKind, fn: () => T): T {
    const prevContext = this.currentContext;
    this.currentContext = context;
    const result = fn();
    this.currentContext = prevContext;
    return result;
  }

  // ============================================================================
  // Document
  // ============================================================================

  visitDocument(node: AST.DocumentNode): Diagnostic[] {
    for (const child of node.body) {
      visit(child, this);
    }
    return this.diagnostics;
  }

  visitServerBlock(node: AST.ServerBlockNode): Diagnostic[] {
    // Validate server block body
    this.withContext(ContextKind.DefinitionBlock, () => {
      visit(node.body, this);
    });

    // Check for required fields
    const body = node.body;
    const hasCapabilities = body.properties.some(
      p => p.type === 'FieldAssignment' && (p as AST.FieldAssignmentNode).name === 'caps'
    );

    if (!hasCapabilities) {
      this.addDiagnostic(
        DiagnosticSeverity.Warning,
        'Server block should define capabilities',
        node.range
      );
    }

    return this.diagnostics;
  }

  visitVersion(node: AST.VersionNode): Diagnostic[] {
    // Validate semantic versioning
    if (node.major < 0 || node.minor < 0 || node.patch < 0) {
      this.addDiagnostic(
        DiagnosticSeverity.Error,
        'Version numbers must be non-negative',
        node.range
      );
    }
    return this.diagnostics;
  }

  // ============================================================================
  // Messages
  // ============================================================================

  visitRequest(node: AST.RequestNode): Diagnostic[] {
    // Validate message ID
    if (node.id < 0) {
      this.addDiagnostic(
        DiagnosticSeverity.Error,
        'Message ID must be non-negative',
        node.range
      );
    }

    // Validate params if present
    if (node.params) {
      this.withContext(ContextKind.RequestParams, () => {
        visit(node.params!, this);
      });
    }

    return this.diagnostics;
  }

  visitResponse(node: AST.ResponseNode): Diagnostic[] {
    // Validate message ID
    if (node.id < 0) {
      this.addDiagnostic(
        DiagnosticSeverity.Error,
        'Message ID must be non-negative',
        node.range
      );
    }

    // Validate result if present
    if (node.result) {
      this.withContext(ContextKind.ResponseResult, () => {
        visit(node.result!, this);
      });
    }

    return this.diagnostics;
  }

  visitNotification(node: AST.NotificationNode): Diagnostic[] {
    // Validate params if present
    if (node.params) {
      this.withContext(ContextKind.RequestParams, () => {
        visit(node.params!, this);
      });
    }

    return this.diagnostics;
  }

  visitError(node: AST.ErrorNode): Diagnostic[] {
    // Validate message ID
    if (node.id < 0) {
      this.addDiagnostic(
        DiagnosticSeverity.Error,
        'Message ID must be non-negative',
        node.range
      );
    }

    // Validate error code (JSON-RPC error codes)
    // Standard JSON-RPC codes: -32768 to -32000
    // Reserved MCP codes: -32000 to -32099
    if (node.code < -32768 || node.code > -32000) {
      this.addDiagnostic(
        DiagnosticSeverity.Warning,
        'Error code outside standard JSON-RPC range (-32768 to -32000)',
        node.range
      );
    }

    // Validate data if present
    if (node.data) {
      this.withContext(ContextKind.ErrorData, () => {
        visit(node.data!, this);
      });
    }

    return this.diagnostics;
  }

  // ============================================================================
  // Definitions
  // ============================================================================

  visitToolDef(node: AST.ToolDefNode): Diagnostic[] {
    this.withContext(ContextKind.DefinitionBlock, () => {
      visit(node.body, this);
    });

    // Check for required fields
    const hasDescription = node.body.properties.some(
      p => p.type === 'FieldAssignment' && ['desc', 'description'].includes((p as AST.FieldAssignmentNode).name)
    );

    if (!hasDescription) {
      this.addDiagnostic(
        DiagnosticSeverity.Warning,
        'Tool should have a description',
        node.range
      );
    }

    // Validate annotations are tool-specific
    this.validateAnnotations(node.body, 'tool', node.range);

    return this.diagnostics;
  }

  visitResourceDef(node: AST.ResourceDefNode): Diagnostic[] {
    this.withContext(ContextKind.DefinitionBlock, () => {
      visit(node.body, this);
    });

    // Check for required URI field
    const hasUri = node.body.properties.some(
      p => p.type === 'FieldAssignment' && (p as AST.FieldAssignmentNode).name === 'uri'
    );

    if (!hasUri) {
      this.addDiagnostic(
        DiagnosticSeverity.Error,
        'Resource must have a uri field',
        node.range
      );
    }

    // Validate annotations are resource-specific
    this.validateAnnotations(node.body, 'resource', node.range);

    return this.diagnostics;
  }

  visitPromptDef(node: AST.PromptDefNode): Diagnostic[] {
    this.withContext(ContextKind.DefinitionBlock, () => {
      visit(node.body, this);
    });

    // Validate annotations are prompt-specific
    this.validateAnnotations(node.body, 'prompt', node.range);

    return this.diagnostics;
  }

  visitResourceTemplateDef(node: AST.ResourceTemplateDefNode): Diagnostic[] {
    this.withContext(ContextKind.DefinitionBlock, () => {
      visit(node.body, this);
    });

    // Check for required URI template
    const hasUri = node.body.properties.some(
      p => p.type === 'FieldAssignment' && (p as AST.FieldAssignmentNode).name === 'uri'
    );

    if (!hasUri) {
      this.addDiagnostic(
        DiagnosticSeverity.Error,
        'Resource template must have a uri field',
        node.range
      );
    }

    return this.diagnostics;
  }

  visitCollectionDef(node: AST.CollectionDefNode): Diagnostic[] {
    for (const item of node.items) {
      visit(item, this);
    }
    return this.diagnostics;
  }

  visitNamedBlock(node: AST.NamedBlockNode): Diagnostic[] {
    visit(node.value, this);
    return this.diagnostics;
  }

  // ============================================================================
  // Values
  // ============================================================================

  visitString(node: AST.StringNode): Diagnostic[] {
    return this.diagnostics;
  }

  visitInteger(node: AST.IntegerNode): Diagnostic[] {
    return this.diagnostics;
  }

  visitDecimal(node: AST.DecimalNode): Diagnostic[] {
    return this.diagnostics;
  }

  visitBoolean(node: AST.BooleanNode): Diagnostic[] {
    return this.diagnostics;
  }

  visitNull(node: AST.NullNode): Diagnostic[] {
    return this.diagnostics;
  }

  visitIdentifier(node: AST.IdentifierNode): Diagnostic[] {
    return this.diagnostics;
  }

  visitArray(node: AST.ArrayNode): Diagnostic[] {
    for (const elem of node.elements) {
      visit(elem, this);
    }
    return this.diagnostics;
  }

  visitObject(node: AST.ObjectNode): Diagnostic[] {
    // Validate based on context
    switch (this.currentContext) {
      case ContextKind.CapabilitySet:
        this.validateCapabilitySet(node);
        break;
      case ContextKind.RequestParams:
      case ContextKind.ResponseResult:
        this.validateParamsOrResult(node);
        break;
      case ContextKind.ErrorData:
        this.validateErrorData(node);
        break;
      case ContextKind.DefinitionBlock:
        this.validateDefinitionBlock(node);
        break;
      default:
        // General object, validate all properties
        for (const prop of node.properties) {
          visit(prop, this);
        }
    }

    return this.diagnostics;
  }

  visitFieldAssignment(node: AST.FieldAssignmentNode): Diagnostic[] {
    // Validate modifier usage
    if (node.modifier === '!') {
      // Required modifier - check it's in a type context
      if (this.currentContext !== ContextKind.DefinitionBlock) {
        this.addDiagnostic(
          DiagnosticSeverity.Warning,
          'Required modifier (!) typically used in type definitions',
          node.range
        );
      }
    }

    visit(node.value, this);
    return this.diagnostics;
  }

  visitCastValue(node: AST.CastValueNode): Diagnostic[] {
    visit(node.value, this);
    return this.diagnostics;
  }

  // ============================================================================
  // Content Types
  // ============================================================================

  visitTextContent(node: AST.TextContentNode): Diagnostic[] {
    return this.diagnostics;
  }

  visitImageContent(node: AST.ImageContentNode): Diagnostic[] {
    // Validate format if specified
    const validFormats = ['jpeg', 'png', 'gif', 'webp'];
    if (node.format && !validFormats.includes(node.format)) {
      this.addDiagnostic(
        DiagnosticSeverity.Warning,
        `Unknown image format: ${node.format}. Valid formats: ${validFormats.join(', ')}`,
        node.range
      );
    }
    return this.diagnostics;
  }

  visitAudioContent(node: AST.AudioContentNode): Diagnostic[] {
    // Validate format if specified
    const validFormats = ['mp3', 'wav', 'ogg', 'flac'];
    if (node.format && !validFormats.includes(node.format)) {
      this.addDiagnostic(
        DiagnosticSeverity.Warning,
        `Unknown audio format: ${node.format}. Valid formats: ${validFormats.join(', ')}`,
        node.range
      );
    }
    return this.diagnostics;
  }

  visitResourceRef(node: AST.ResourceRefNode): Diagnostic[] {
    return this.diagnostics;
  }

  visitToolRef(node: AST.ToolRefNode): Diagnostic[] {
    return this.diagnostics;
  }

  visitEmbeddedResource(node: AST.EmbeddedResourceNode): Diagnostic[] {
    visit(node.content, this);
    return this.diagnostics;
  }

  // ============================================================================
  // Special Constructs
  // ============================================================================

  visitAnnotation(node: AST.AnnotationNode): Diagnostic[] {
    // Check if annotation is known
    if (ANNOTATION_MAPPINGS[node.name]) {
      const mapping = ANNOTATION_MAPPINGS[node.name];

      // Validate annotation has correct value type
      if (node.name === 'impl' && Array.isArray(node.value)) {
        if (node.value.length !== 2) {
          this.addDiagnostic(
            DiagnosticSeverity.Error,
            '@impl annotation requires exactly 2 arguments: name and version',
            node.range
          );
        }
      }
    }

    if (node.value) {
      if (Array.isArray(node.value)) {
        for (const v of node.value) {
          visit(v, this);
        }
      } else {
        visit(node.value, this);
      }
    }

    return this.diagnostics;
  }

  visitCapabilitySet(node: AST.CapabilitySetNode): Diagnostic[] {
    for (const cap of node.capabilities) {
      visit(cap, this);
    }
    return this.diagnostics;
  }

  visitCapability(node: AST.CapabilityNode): Diagnostic[] {
    // Validate capability path structure
    if (node.path.length === 0) {
      this.addDiagnostic(
        DiagnosticSeverity.Error,
        'Capability path cannot be empty',
        node.range
      );
    }
    return this.diagnostics;
  }

  visitRoleMessage(node: AST.RoleMessageNode): Diagnostic[] {
    visit(node.content, this);
    return this.diagnostics;
  }

  visitCompositeContent(node: AST.CompositeContentNode): Diagnostic[] {
    for (const part of node.parts) {
      visit(part, this);
    }
    return this.diagnostics;
  }

  // ============================================================================
  // Type System
  // ============================================================================

  visitUnionType(node: AST.UnionTypeNode): Diagnostic[] {
    if (node.types.length < 2) {
      this.addDiagnostic(
        DiagnosticSeverity.Error,
        'Union type must have at least 2 types',
        node.range
      );
    }

    for (const type of node.types) {
      visit(type, this);
    }
    return this.diagnostics;
  }

  visitCastType(node: AST.CastTypeNode): Diagnostic[] {
    visit(node.baseType, this);
    return this.diagnostics;
  }

  visitPrimaryType(node: AST.PrimaryTypeNode): Diagnostic[] {
    visit(node.baseType, this);
    return this.diagnostics;
  }

  visitPrimitiveType(node: AST.PrimitiveTypeNode): Diagnostic[] {
    return this.diagnostics;
  }

  visitArrayType(node: AST.ArrayTypeNode): Diagnostic[] {
    if (node.elementType) {
      visit(node.elementType, this);
    }
    return this.diagnostics;
  }

  visitObjectType(node: AST.ObjectTypeNode): Diagnostic[] {
    for (const field of node.fields) {
      visit(field, this);
    }
    return this.diagnostics;
  }

  visitEnumType(node: AST.EnumTypeNode): Diagnostic[] {
    if (node.values.length === 0) {
      this.addDiagnostic(
        DiagnosticSeverity.Error,
        'Enum type must have at least one value',
        node.range
      );
    }

    // Check for duplicates
    const seen = new Set<string>();
    for (const value of node.values) {
      if (seen.has(value)) {
        this.addDiagnostic(
          DiagnosticSeverity.Warning,
          `Duplicate enum value: ${value}`,
          node.range
        );
      }
      seen.add(value);
    }

    return this.diagnostics;
  }

  visitReferenceType(node: AST.ReferenceTypeNode): Diagnostic[] {
    // Could validate that reference exists, but that requires symbol table
    return this.diagnostics;
  }

  visitFieldDef(node: AST.FieldDefNode): Diagnostic[] {
    visit(node.typeExpr, this);
    if (node.defaultValue) {
      visit(node.defaultValue, this);
    }
    return this.diagnostics;
  }

  // ============================================================================
  // Context-Specific Validation
  // ============================================================================

  private validateCapabilitySet(node: AST.ObjectNode): void {
    // Capability sets should only contain bare identifiers or dot-paths
    for (const prop of node.properties) {
      if (prop.type === 'FieldAssignment') {
        this.addDiagnostic(
          DiagnosticSeverity.Error,
          'Capability set cannot contain field assignments',
          prop.range
        );
      } else if (prop.type === 'Annotation') {
        this.addDiagnostic(
          DiagnosticSeverity.Error,
          'Capability set cannot contain annotations',
          prop.range
        );
      }
    }
  }

  private validateParamsOrResult(node: AST.ObjectNode): void {
    // Params and results allow field assignments and annotations, but not nested definitions
    for (const prop of node.properties) {
      if (AST.isDefinitionNode(prop)) {
        this.addDiagnostic(
          DiagnosticSeverity.Error,
          'Params/result cannot contain nested definitions',
          prop.range
        );
      } else if (prop.type === 'FieldAssignment') {
        visit(prop, this);
      } else if (prop.type === 'Annotation') {
        visit(prop, this);
      }
    }
  }

  private validateErrorData(node: AST.ObjectNode): void {
    // Error data allows field assignments only
    for (const prop of node.properties) {
      if (prop.type === 'Annotation') {
        this.addDiagnostic(
          DiagnosticSeverity.Warning,
          'Error data should not contain annotations',
          prop.range
        );
      } else if (AST.isDefinitionNode(prop)) {
        this.addDiagnostic(
          DiagnosticSeverity.Error,
          'Error data cannot contain nested definitions',
          prop.range
        );
      } else if (prop.type === 'FieldAssignment') {
        visit(prop, this);
      }
    }
  }

  private validateDefinitionBlock(node: AST.ObjectNode): void {
    // Definition blocks allow everything
    for (const prop of node.properties) {
      visit(prop, this);
    }
  }

  private validateAnnotations(node: AST.ObjectNode, target: string, range: AST.BaseNode['range']): void {
    for (const prop of node.properties) {
      if (prop.type === 'Annotation') {
        const annotation = prop as AST.AnnotationNode;
        const mapping = ANNOTATION_MAPPINGS[annotation.name];

        if (mapping && mapping.target !== 'any' && mapping.target !== target) {
          this.addDiagnostic(
            DiagnosticSeverity.Warning,
            `Annotation @${annotation.name} is intended for ${mapping.target}, not ${target}`,
            annotation.range
          );
        }
      }
    }
  }
}

/**
 * Convenience function to validate a document
 */
export function validateDocument(document: AST.DocumentNode): ValidationResult {
  const validator = new SemanticValidator();
  return validator.validate(document);
}
