/**
 * Recursive descent parser for MCP-DSL
 * Based on GRAMMAR.md with zero left recursion
 */

import { TokenCursor, createCursor } from '../lexer/token-cursor.js';
import { TokenType, type Token } from '../types/tokens.js';
import type { SourceRange } from '../types/common.js';
import * as AST from '../ast/nodes.js';

/**
 * Parser class that builds an AST from tokens
 */
export class Parser {
  private cursor: TokenCursor;

  constructor(tokens: Token[]) {
    this.cursor = createCursor(tokens);
  }

  /**
   * Parse the entire document
   * document ::= (message | definition | server_block)*
   */
  parse(): AST.DocumentNode {
    const start = this.cursor.current().range.start;
    const body: (AST.MessageNode | AST.DefinitionNode | AST.ServerBlockNode)[] = [];

    while (!this.cursor.isAtEnd()) {
      // Skip newlines and comments
      this.cursor.skip(TokenType.NEWLINE, TokenType.COMMENT);

      if (this.cursor.isAtEnd()) break;

      if (this.isMessageStart()) {
        body.push(this.parseMessage());
      } else if (this.isDefinitionStart()) {
        body.push(this.parseDefinition());
      } else if (this.cursor.check(TokenType.SERVER)) {
        body.push(this.parseServerBlock());
      } else {
        throw this.cursor.error(`Unexpected token: ${this.cursor.current().type}`);
      }

      this.cursor.skip(TokenType.NEWLINE, TokenType.COMMENT);
    }

    const end = this.cursor.current().range.end;
    return {
      type: 'Document',
      body,
      range: { start, end },
    };
  }

  // ============================================================================
  // Server Block
  // ============================================================================

  /**
   * server_block ::= 'server' IDENTIFIER version? block
   */
  private parseServerBlock(): AST.ServerBlockNode {
    const start = this.cursor.current().range.start;

    this.cursor.expect(TokenType.SERVER);
    const name = this.cursor.expect(TokenType.IDENTIFIER).lexeme;

    let version: AST.VersionNode | undefined;
    if (this.cursor.check(TokenType.IDENTIFIER) && this.cursor.current().lexeme.startsWith('v')) {
      version = this.parseVersion();
    }

    const body = this.parseObject();

    return {
      type: 'ServerBlock',
      name,
      version,
      body,
      range: { start, end: this.cursor.current().range.end },
    };
  }

  /**
   * version ::= 'v' (INTEGER '.' INTEGER '.' INTEGER)
   */
  private parseVersion(): AST.VersionNode {
    const start = this.cursor.current().range.start;
    const versionToken = this.cursor.expect(TokenType.IDENTIFIER);

    // Parse v1.2.3 format
    const match = versionToken.lexeme.match(/^v(\d+)\.(\d+)\.(\d+)$/);
    if (!match) {
      throw this.cursor.error('Invalid version format. Expected vX.Y.Z');
    }

    return {
      type: 'Version',
      major: parseInt(match[1]),
      minor: parseInt(match[2]),
      patch: parseInt(match[3]),
      range: { start, end: versionToken.range.end },
    };
  }

  // ============================================================================
  // Messages
  // ============================================================================

  private isMessageStart(): boolean {
    return this.cursor.checkAny(
      TokenType.REQUEST,
      TokenType.RESPONSE,
      TokenType.NOTIFICATION,
      TokenType.ERROR
    );
  }

  /**
   * Parse any message type
   */
  private parseMessage(): AST.MessageNode {
    if (this.cursor.check(TokenType.REQUEST)) {
      return this.parseRequest();
    } else if (this.cursor.check(TokenType.RESPONSE)) {
      return this.parseResponse();
    } else if (this.cursor.check(TokenType.NOTIFICATION)) {
      return this.parseNotification();
    } else if (this.cursor.check(TokenType.ERROR)) {
      return this.parseError();
    }

    throw this.cursor.error('Expected message start');
  }

  /**
   * request ::= '>' METHOD_PATH '#' message_id params?
   */
  private parseRequest(): AST.RequestNode {
    const start = this.cursor.current().range.start;

    this.cursor.expect(TokenType.REQUEST);
    // Accept either METHOD_PATH or IDENTIFIER
    const methodToken = this.cursor.expectAny([TokenType.METHOD_PATH, TokenType.IDENTIFIER]);
    const method = methodToken.lexeme;
    this.cursor.expect(TokenType.HASH);
    const id = this.cursor.expect(TokenType.INTEGER).literal as number;

    let params: AST.ObjectNode | undefined;
    if (this.cursor.check(TokenType.LBRACE)) {
      params = this.parseObject();
    }

    return {
      type: 'Request',
      method,
      id,
      params,
      range: { start, end: this.cursor.current().range.end },
    };
  }

  /**
   * response ::= '<' '#' message_id result?
   */
  private parseResponse(): AST.ResponseNode {
    const start = this.cursor.current().range.start;

    this.cursor.expect(TokenType.RESPONSE);
    this.cursor.expect(TokenType.HASH);
    const id = this.cursor.expect(TokenType.INTEGER).literal as number;

    let result: AST.ValueNode | undefined;
    if (this.cursor.check(TokenType.LBRACE)) {
      result = this.parseValue();
    }

    return {
      type: 'Response',
      id,
      result,
      range: { start, end: this.cursor.current().range.end },
    };
  }

  /**
   * notification ::= '!' METHOD_PATH params?
   */
  private parseNotification(): AST.NotificationNode {
    const start = this.cursor.current().range.start;

    this.cursor.expect(TokenType.NOTIFICATION);
    // Accept either METHOD_PATH or IDENTIFIER
    const methodToken = this.cursor.expectAny([TokenType.METHOD_PATH, TokenType.IDENTIFIER]);
    const method = methodToken.lexeme;

    let params: AST.ObjectNode | undefined;
    if (this.cursor.check(TokenType.LBRACE)) {
      params = this.parseObject();
    }

    return {
      type: 'Notification',
      method,
      params,
      range: { start, end: this.cursor.current().range.end },
    };
  }

  /**
   * error ::= 'x' '#' message_id error_code ':' error_message data?
   */
  private parseError(): AST.ErrorNode {
    const start = this.cursor.current().range.start;

    this.cursor.expect(TokenType.ERROR);
    this.cursor.expect(TokenType.HASH);
    const id = this.cursor.expect(TokenType.INTEGER).literal as number;

    // Skip whitespace/newlines before error code
    this.cursor.skip(TokenType.NEWLINE, TokenType.COMMENT);

    const code = this.cursor.expect(TokenType.INTEGER).literal as number;

    // Skip whitespace/newlines before colon
    this.cursor.skip(TokenType.NEWLINE, TokenType.COMMENT);
    this.cursor.expect(TokenType.COLON);

    // Skip whitespace/newlines before message
    this.cursor.skip(TokenType.NEWLINE, TokenType.COMMENT);

    let message: string;
    const messageToken = this.cursor.current();
    if (messageToken.type === TokenType.STRING) {
      message = messageToken.literal as string;
      this.cursor.next();
    } else if (messageToken.type === TokenType.IDENTIFIER) {
      message = messageToken.lexeme;
      this.cursor.next();
    } else {
      throw this.cursor.error('Expected error message');
    }

    let data: AST.ValueNode | undefined;
    if (this.cursor.check(TokenType.LBRACE)) {
      data = this.parseValue();
    }

    return {
      type: 'Error',
      id,
      code,
      message,
      data,
      range: { start, end: this.cursor.current().range.end },
    };
  }

  // ============================================================================
  // Definitions
  // ============================================================================

  private isDefinitionStart(): boolean {
    return this.cursor.checkAny(
      TokenType.RESOURCE,
      TokenType.TOOL,
      TokenType.PROMPT,
      TokenType.RESOURCE_TEMPLATE
    );
  }

  /**
   * definition ::= resource_def | tool_def | prompt_def | template_def | collection_def
   */
  private parseDefinition(): AST.DefinitionNode {
    const start = this.cursor.current();

    // Check for collection syntax: T[], R[], etc.
    if (this.cursor.peek(1).type === TokenType.LBRACKET) {
      return this.parseCollectionDef();
    }

    const defType = this.cursor.current().type;
    this.cursor.next();

    const name = this.cursor.expect(TokenType.IDENTIFIER).lexeme;
    const body = this.parseObject();

    const range: SourceRange = {
      start: start.range.start,
      end: this.cursor.current().range.end,
    };

    switch (defType) {
      case TokenType.RESOURCE:
        return { type: 'ResourceDef', name, body, range };
      case TokenType.TOOL:
        return { type: 'ToolDef', name, body, range };
      case TokenType.PROMPT:
        return { type: 'PromptDef', name, body, range };
      case TokenType.RESOURCE_TEMPLATE:
        return { type: 'ResourceTemplateDef', name, body, range };
      default:
        throw this.cursor.error('Expected definition type');
    }
  }

  /**
   * collection_def ::= definition_type '[]' (IDENTIFIER block | inline_collection)
   */
  private parseCollectionDef(): AST.CollectionDefNode {
    const start = this.cursor.current().range.start;

    const defTypeToken = this.cursor.current();
    let definitionType: 'R' | 'T' | 'P' | 'RT';

    switch (defTypeToken.type) {
      case TokenType.RESOURCE:
        definitionType = 'R';
        break;
      case TokenType.TOOL:
        definitionType = 'T';
        break;
      case TokenType.PROMPT:
        definitionType = 'P';
        break;
      case TokenType.RESOURCE_TEMPLATE:
        definitionType = 'RT';
        break;
      default:
        throw this.cursor.error('Expected definition type');
    }

    this.cursor.next();
    this.cursor.expect(TokenType.LBRACKET);
    this.cursor.expect(TokenType.RBRACKET);

    const items: AST.NamedBlockNode[] = [];

    if (this.cursor.check(TokenType.LBRACE)) {
      // Parse inline collection
      this.cursor.next(); // consume {

      while (!this.cursor.check(TokenType.RBRACE) && !this.cursor.isAtEnd()) {
        this.cursor.skip(TokenType.NEWLINE, TokenType.COMMENT);

        const name = this.cursor.expect(TokenType.IDENTIFIER).lexeme;
        this.cursor.expect(TokenType.COLON);

        let value: AST.ObjectNode | AST.StringNode | AST.TypeExprNode;

        if (this.cursor.check(TokenType.LBRACE)) {
          value = this.parseObject();
        } else if (this.cursor.check(TokenType.STRING)) {
          value = this.parseString();
        } else {
          value = this.parseTypeExpr();
        }

        items.push({
          type: 'NamedBlock',
          name,
          value,
          range: { start: start, end: this.cursor.current().range.end },
        });

        if (this.cursor.check(TokenType.COMMA)) {
          this.cursor.next();
        }

        this.cursor.skip(TokenType.NEWLINE, TokenType.COMMENT);
      }

      this.cursor.expect(TokenType.RBRACE);
    }

    return {
      type: 'CollectionDef',
      definitionType,
      items,
      range: { start, end: this.cursor.current().range.end },
    };
  }

  // ============================================================================
  // Values - placeholder implementations to be expanded
  // ============================================================================

  private parseValue(): AST.ValueNode {
    // This will be expanded to handle all value types
    if (this.cursor.check(TokenType.LBRACE)) {
      return this.parseObject();
    } else if (this.cursor.check(TokenType.LBRACKET)) {
      return this.parseArray();
    } else if (this.cursor.check(TokenType.STRING)) {
      return this.parseString();
    } else if (this.cursor.check(TokenType.INTEGER)) {
      return this.parseInteger();
    } else if (this.cursor.check(TokenType.DECIMAL)) {
      return this.parseDecimal();
    } else if (this.cursor.check(TokenType.TRUE) || this.cursor.check(TokenType.FALSE)) {
      return this.parseBoolean();
    } else if (this.cursor.check(TokenType.NULL)) {
      return this.parseNull();
    } else if (this.cursor.check(TokenType.IDENTIFIER) ||
               this.cursor.checkAny(TokenType.STR, TokenType.INT, TokenType.NUM, TokenType.BOOL, TokenType.URI, TokenType.BLOB,
                                    TokenType.ROLE_USER, TokenType.ROLE_ASSISTANT, TokenType.ROLE_SYSTEM)) {
      // Could be an identifier or type keyword
      const token = this.cursor.current();
      this.cursor.next();

      // Check for type modifiers (! or ?) after type keywords
      let modifier: '!' | '?' | undefined;
      if (this.cursor.check(TokenType.EXCLAMATION) || this.cursor.check(TokenType.NOTIFICATION)) {
        modifier = '!';
        this.cursor.next();
      } else if (this.cursor.check(TokenType.QUESTION)) {
        modifier = '?';
        this.cursor.next();
      }

      // If there's a modifier, return a TypeReference node
      if (modifier) {
        return {
          type: 'TypeReference',
          name: token.lexeme,
          modifier,
          range: { start: token.range.start, end: this.cursor.peek(-1).range.end },
        };
      }

      return {
        type: 'Identifier',
        name: token.lexeme,
        range: token.range,
      };
    }

    throw this.cursor.error('Expected value');
  }

  private parseObject(): AST.ObjectNode {
    const start = this.cursor.current().range.start;

    this.cursor.expect(TokenType.LBRACE);
    const properties: (AST.FieldAssignmentNode | AST.AnnotationNode | AST.DefinitionNode)[] = [];

    while (!this.cursor.check(TokenType.RBRACE) && !this.cursor.isAtEnd()) {
      this.cursor.skip(TokenType.NEWLINE, TokenType.COMMENT);

      if (this.cursor.check(TokenType.AT)) {
        properties.push(this.parseAnnotation());
      } else if (this.isDefinitionStart()) {
        properties.push(this.parseDefinition());
      } else if (this.cursor.check(TokenType.IDENTIFIER) ||
                 this.cursor.checkAny(TokenType.STR, TokenType.INT, TokenType.NUM, TokenType.BOOL, TokenType.URI, TokenType.BLOB,
                                      TokenType.IN, TokenType.OUT, TokenType.TXT, TokenType.IMG, TokenType.AUD, TokenType.RES,
                                      TokenType.ROLE_USER, TokenType.ROLE_ASSISTANT, TokenType.ROLE_SYSTEM)) {
        properties.push(this.parseFieldAssignment());
      } else {
        break;
      }

      if (this.cursor.check(TokenType.COMMA)) {
        this.cursor.next();
      }

      this.cursor.skip(TokenType.NEWLINE, TokenType.COMMENT);
    }

    this.cursor.expect(TokenType.RBRACE);

    return {
      type: 'Object',
      properties,
      range: { start, end: this.cursor.current().range.end },
    };
  }

  private parseFieldAssignment(): AST.FieldAssignmentNode {
    const start = this.cursor.current().range.start;

    // Field names can be identifiers or certain keywords
    const nameToken = this.cursor.current();
    if (!this.cursor.check(TokenType.IDENTIFIER) &&
        !this.cursor.checkAny(TokenType.STR, TokenType.INT, TokenType.NUM, TokenType.BOOL, TokenType.URI, TokenType.BLOB,
                             TokenType.IN, TokenType.OUT, TokenType.TXT, TokenType.IMG, TokenType.AUD, TokenType.RES,
                             TokenType.ROLE_USER, TokenType.ROLE_ASSISTANT, TokenType.ROLE_SYSTEM)) {
      throw this.cursor.error('Expected field name');
    }
    const name = nameToken.lexeme;
    this.cursor.next();

    let modifier: '!' | '?' | undefined;
    if (this.cursor.check(TokenType.EXCLAMATION) || this.cursor.check(TokenType.NOTIFICATION)) {
      modifier = '!';
      this.cursor.next();
    } else if (this.cursor.check(TokenType.QUESTION)) {
      modifier = '?';
      this.cursor.next();
    }

    this.cursor.expect(TokenType.COLON);
    const value = this.parseValue();

    return {
      type: 'FieldAssignment',
      name,
      modifier,
      value,
      range: { start, end: this.cursor.current().range.end },
    };
  }

  private parseArray(): AST.ArrayNode {
    const start = this.cursor.current().range.start;

    this.cursor.expect(TokenType.LBRACKET);
    const elements: AST.ValueNode[] = [];

    while (!this.cursor.check(TokenType.RBRACKET) && !this.cursor.isAtEnd()) {
      this.cursor.skip(TokenType.NEWLINE, TokenType.COMMENT);
      elements.push(this.parseValue());

      if (this.cursor.check(TokenType.COMMA)) {
        this.cursor.next();
      }

      this.cursor.skip(TokenType.NEWLINE, TokenType.COMMENT);
    }

    this.cursor.expect(TokenType.RBRACKET);

    return {
      type: 'Array',
      elements,
      range: { start, end: this.cursor.current().range.end },
    };
  }

  private parseString(): AST.StringNode {
    const token = this.cursor.expect(TokenType.STRING);
    return {
      type: 'String',
      value: token.literal as string,
      range: token.range,
    };
  }

  private parseInteger(): AST.IntegerNode {
    const token = this.cursor.expect(TokenType.INTEGER);
    return {
      type: 'Integer',
      value: token.literal as number,
      range: token.range,
    };
  }

  private parseDecimal(): AST.DecimalNode {
    const token = this.cursor.expect(TokenType.DECIMAL);
    return {
      type: 'Decimal',
      value: token.literal as number,
      range: token.range,
    };
  }

  private parseBoolean(): AST.BooleanNode {
    const token = this.cursor.expectAny([TokenType.TRUE, TokenType.FALSE]);
    return {
      type: 'Boolean',
      value: token.type === TokenType.TRUE,
      range: token.range,
    };
  }

  private parseNull(): AST.NullNode {
    const token = this.cursor.expect(TokenType.NULL);
    return {
      type: 'Null',
      range: token.range,
    };
  }

  private parseAnnotation(): AST.AnnotationNode {
    const start = this.cursor.current().range.start;

    this.cursor.expect(TokenType.AT);
    const name = this.cursor.expect(TokenType.IDENTIFIER).lexeme;

    let value: AST.ValueNode | AST.ValueNode[] | undefined;

    if (this.cursor.check(TokenType.COLON)) {
      this.cursor.next();
      value = this.parseValue();
    } else if (this.cursor.check(TokenType.LPAREN)) {
      this.cursor.next();
      const values: AST.ValueNode[] = [];

      while (!this.cursor.check(TokenType.RPAREN) && !this.cursor.isAtEnd()) {
        values.push(this.parseValue());
        if (this.cursor.check(TokenType.COMMA)) {
          this.cursor.next();
        }
      }

      this.cursor.expect(TokenType.RPAREN);
      value = values;
    }

    return {
      type: 'Annotation',
      name,
      value,
      range: { start, end: this.cursor.current().range.end },
    };
  }

  // ============================================================================
  // Type Expressions - basic implementation
  // ============================================================================

  private parseTypeExpr(): AST.TypeExprNode {
    return this.parseUnionType();
  }

  private parseUnionType(): AST.TypeExprNode {
    const start = this.cursor.current().range.start;
    let left = this.parseCastType();

    if (this.cursor.check(TokenType.PIPE)) {
      const types: AST.TypeExprNode[] = [left];

      while (this.cursor.check(TokenType.PIPE)) {
        this.cursor.next();
        types.push(this.parseCastType());
      }

      return {
        type: 'UnionType',
        types,
        range: { start, end: this.cursor.current().range.end },
      };
    }

    return left;
  }

  private parseCastType(): AST.TypeExprNode {
    const start = this.cursor.current().range.start;
    let baseType = this.parsePrimaryType();

    if (this.cursor.check(TokenType.DOUBLE_COLON)) {
      const casts: string[] = [];

      while (this.cursor.check(TokenType.DOUBLE_COLON)) {
        this.cursor.next();
        casts.push(this.cursor.expect(TokenType.IDENTIFIER).lexeme);
      }

      return {
        type: 'CastType',
        baseType,
        casts,
        range: { start, end: this.cursor.current().range.end },
      };
    }

    return baseType;
  }

  private parsePrimaryType(): AST.TypeExprNode {
    const start = this.cursor.current().range.start;
    let baseType = this.parseBaseType();

    let modifier: '!' | '?' | undefined;
    if (this.cursor.check(TokenType.EXCLAMATION) || this.cursor.check(TokenType.NOTIFICATION)) {
      modifier = '!';
      this.cursor.next();
    } else if (this.cursor.check(TokenType.QUESTION)) {
      modifier = '?';
      this.cursor.next();
    }

    if (modifier) {
      return {
        type: 'PrimaryType',
        baseType,
        modifier,
        range: { start, end: this.cursor.current().range.end },
      };
    }

    return baseType;
  }

  private parseBaseType(): AST.TypeExprNode {
    if (this.cursor.checkAny(TokenType.STR, TokenType.INT, TokenType.NUM, TokenType.BOOL, TokenType.URI, TokenType.BLOB)) {
      return this.parsePrimitiveType();
    } else if (this.cursor.check(TokenType.LBRACKET)) {
      return this.parseArrayType();
    } else if (this.cursor.check(TokenType.LBRACE)) {
      return this.parseObjectType();
    } else if (this.cursor.check(TokenType.ENUM)) {
      return this.parseEnumType();
    } else if (this.cursor.check(TokenType.IDENTIFIER)) {
      return this.parseReferenceType();
    } else if (this.cursor.check(TokenType.LPAREN)) {
      this.cursor.next();
      const type = this.parseTypeExpr();
      this.cursor.expect(TokenType.RPAREN);
      return type;
    }

    throw this.cursor.error('Expected type expression');
  }

  private parsePrimitiveType(): AST.PrimitiveTypeNode {
    const token = this.cursor.current();
    this.cursor.next();

    let primitiveType: 'str' | 'int' | 'num' | 'bool' | 'uri' | 'blob';

    switch (token.type) {
      case TokenType.STR:
        primitiveType = 'str';
        break;
      case TokenType.INT:
        primitiveType = 'int';
        break;
      case TokenType.NUM:
        primitiveType = 'num';
        break;
      case TokenType.BOOL:
        primitiveType = 'bool';
        break;
      case TokenType.URI:
        primitiveType = 'uri';
        break;
      case TokenType.BLOB:
        primitiveType = 'blob';
        break;
      default:
        throw this.cursor.error('Expected primitive type');
    }

    return {
      type: 'PrimitiveType',
      primitiveType,
      range: token.range,
    };
  }

  private parseArrayType(): AST.ArrayTypeNode {
    const start = this.cursor.current().range.start;

    this.cursor.expect(TokenType.LBRACKET);

    let elementType: AST.TypeExprNode | undefined;
    if (!this.cursor.check(TokenType.RBRACKET)) {
      elementType = this.parseTypeExpr();
    }

    this.cursor.expect(TokenType.RBRACKET);

    return {
      type: 'ArrayType',
      elementType,
      range: { start, end: this.cursor.current().range.end },
    };
  }

  private parseObjectType(): AST.ObjectTypeNode {
    const start = this.cursor.current().range.start;

    this.cursor.expect(TokenType.LBRACE);
    const fields: AST.FieldDefNode[] = [];

    while (!this.cursor.check(TokenType.RBRACE) && !this.cursor.isAtEnd()) {
      this.cursor.skip(TokenType.NEWLINE, TokenType.COMMENT);
      fields.push(this.parseFieldDef());

      if (this.cursor.check(TokenType.COMMA)) {
        this.cursor.next();
      }

      this.cursor.skip(TokenType.NEWLINE, TokenType.COMMENT);
    }

    this.cursor.expect(TokenType.RBRACE);

    return {
      type: 'ObjectType',
      fields,
      range: { start, end: this.cursor.current().range.end },
    };
  }

  private parseFieldDef(): AST.FieldDefNode {
    const start = this.cursor.current().range.start;

    const name = this.cursor.expect(TokenType.IDENTIFIER).lexeme;
    this.cursor.expect(TokenType.COLON);
    const typeExpr = this.parseTypeExpr();

    let defaultValue: AST.ValueNode | undefined;
    if (this.cursor.check(TokenType.EQUALS)) {
      this.cursor.next();
      defaultValue = this.parseValue();
    }

    return {
      type: 'FieldDef',
      name,
      typeExpr,
      defaultValue,
      range: { start, end: this.cursor.current().range.end },
    };
  }

  private parseEnumType(): AST.EnumTypeNode {
    const start = this.cursor.current().range.start;

    this.cursor.expect(TokenType.ENUM);
    this.cursor.expect(TokenType.LBRACKET);

    const values: string[] = [];

    while (!this.cursor.check(TokenType.RBRACKET) && !this.cursor.isAtEnd()) {
      values.push(this.cursor.expect(TokenType.IDENTIFIER).lexeme);

      if (this.cursor.check(TokenType.COMMA)) {
        this.cursor.next();
      }
    }

    this.cursor.expect(TokenType.RBRACKET);

    return {
      type: 'EnumType',
      values,
      range: { start, end: this.cursor.current().range.end },
    };
  }

  private parseReferenceType(): AST.ReferenceTypeNode {
    const token = this.cursor.expect(TokenType.IDENTIFIER);
    return {
      type: 'ReferenceType',
      name: token.lexeme,
      range: token.range,
    };
  }
}

/**
 * Convenience function to parse source code
 */
export function parse(tokens: Token[]): AST.DocumentNode {
  const parser = new Parser(tokens);
  return parser.parse();
}
