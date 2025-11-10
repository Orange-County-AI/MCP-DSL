// MCP-DSL Parser & Compiler - TypeScript Implementation
// Demonstrates core parsing and compilation logic

interface Token {
  type: 'symbol' | 'string' | 'number' | 'identifier' | 'operator';
  value: string;
  line: number;
  column: number;
}

class MCPDSLLexer {
  private input: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  
  constructor(input: string) {
    this.input = input;
  }
  
  tokenize(): Token[] {
    const tokens: Token[] = [];
    
    while (this.position < this.input.length) {
      this.skipWhitespace();
      if (this.position >= this.input.length) break;
      
      const char = this.input[this.position];
      
      // Operators and symbols
      if ('><!x#@?:=|&-'.includes(char)) {
        tokens.push({
          type: 'operator',
          value: char,
          line: this.line,
          column: this.column
        });
        this.advance();
      }
      // String literals
      else if (char === '"') {
        tokens.push(this.readString());
      }
      // Numbers
      else if (/[0-9]/.test(char)) {
        tokens.push(this.readNumber());
      }
      // Identifiers and keywords
      else if (/[a-zA-Z_]/.test(char)) {
        tokens.push(this.readIdentifier());
      }
      // Braces, brackets, parens, comma
      else if ('{}[](),'.includes(char)) {
        tokens.push({
          type: 'symbol',
          value: char,
          line: this.line,
          column: this.column
        });
        this.advance();
      }
    }
    
    return tokens;
  }
  
  private advance(): void {
    if (this.input[this.position] === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    this.position++;
  }
  
  private skipWhitespace(): void {
    while (this.position < this.input.length && /\s/.test(this.input[this.position])) {
      this.advance();
    }
  }
  
  private readString(): Token {
    const start = { line: this.line, column: this.column };
    this.advance(); // Skip opening quote
    let value = '';
    
    while (this.position < this.input.length && this.input[this.position] !== '"') {
      if (this.input[this.position] === '\\') {
        this.advance();
        value += this.input[this.position];
      } else {
        value += this.input[this.position];
      }
      this.advance();
    }
    
    this.advance(); // Skip closing quote
    return { type: 'string', value, line: start.line, column: start.column };
  }
  
  private readNumber(): Token {
    const start = { line: this.line, column: this.column };
    let value = '';
    
    while (this.position < this.input.length && /[0-9.]/.test(this.input[this.position])) {
      value += this.input[this.position];
      this.advance();
    }
    
    return { type: 'number', value, line: start.line, column: start.column };
  }
  
  private readIdentifier(): Token {
    const start = { line: this.line, column: this.column };
    let value = '';
    
    while (this.position < this.input.length && /[a-zA-Z0-9_/]/.test(this.input[this.position])) {
      value += this.input[this.position];
      this.advance();
    }
    
    return { type: 'identifier', value, line: start.line, column: start.column };
  }
  
  private getIndentation(): number {
    let indent = 0;
    let pos = this.position;
    
    // Count back to start of line
    while (pos > 0 && this.input[pos - 1] !== '\n') {
      pos--;
    }
    
    // Count forward spaces/tabs from line start
    while (pos < this.position) {
      if (this.input[pos] === ' ' || this.input[pos] === '\t') {
        indent++;
      }
      pos++;
    }
    
    return indent;
  }
}

class MCPDSLParser {
  private tokens: Token[];
  private position: number = 0;
  
  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }
  
  parse(): any {
    return this.parseMessage();
  }
  
  private parseMessage(): any {
    const first = this.peek();
    
    if (!first) return null;
    
    switch (first.value) {
      case '>': return this.parseRequest();
      case '<': return this.parseResponse();
      case '!': return this.parseNotification();
      case 'x': return this.parseError();
      case 'R': return this.parseResource();
      case 'T': return this.parseTool();
      case 'P': return this.parsePrompt();
      default: return this.parseBlock();
    }
  }
  
  private parseRequest(): any {
    this.expect('>');
    const method = this.expect('identifier').value;
    let id = null;
    
    if (this.peek()?.value === '#') {
      this.advance();
      id = this.expect('number').value;
    }
    
    const params = this.peek()?.value === '{' ? this.parseBlock() : null;
    
    return {
      type: 'request',
      method,
      id: id ? parseInt(id) : null,
      params
    };
  }
  
  private parseResponse(): any {
    this.expect('<');
    this.expect('#');
    const id = this.expect('number').value;
    const result = this.parseBlock();
    
    return {
      type: 'response',
      id: parseInt(id),
      result
    };
  }
  
  private parseNotification(): any {
    this.expect('!');
    const method = this.expect('identifier').value;
    const params = this.peek()?.value === '{' ? this.parseBlock() : null;
    
    return {
      type: 'notification',
      method,
      params
    };
  }
  
  private parseError(): any {
    this.expect('x');
    this.expect('#');
    const id = this.expect('number').value;

    // Handle negative error codes (e.g., -32601)
    let code: string;
    if (this.peek()?.value === '-') {
      this.advance(); // Skip the minus sign
      code = '-' + this.expect('number').value;
    } else {
      code = this.expect('number').value;
    }

    this.expect(':');
    const message = this.expect('string').value;

    return {
      type: 'error',
      id: parseInt(id),
      code: parseInt(code),
      message
    };
  }
  
  private parseResource(): any {
    this.expect('R');
    const name = this.expect('identifier').value;
    const definition = this.parseBlock();
    
    return {
      type: 'resource',
      name,
      ...definition
    };
  }
  
  private parseTool(): any {
    this.expect('T');
    const name = this.expect('identifier').value;
    const definition = this.parseBlock();
    
    return {
      type: 'tool',
      name,
      ...definition
    };
  }
  
  private parsePrompt(): any {
    this.expect('P');
    const name = this.expect('identifier').value;
    const definition = this.parseBlock();
    
    return {
      type: 'prompt',
      name,
      ...definition
    };
  }
  
  private parseBlock(): any {
    this.expect('{');
    const obj: any = {};

    while (this.peek()?.value !== '}') {
      if (!this.peek()) break; // Safety check

      // Skip commas
      if (this.peek()?.value === ',') {
        this.advance();
        continue;
      }

      // Parse annotations
      if (this.peek()?.value === '@') {
        this.advance();
        const annotationName = this.expect('identifier').value;
        if (this.peek()?.value === ':') {
          this.advance();
          obj[`@${annotationName}`] = this.parseValue();
        } else {
          obj[`@${annotationName}`] = true;
        }
        // Skip optional comma after annotation
        if (this.peek()?.value === ',') {
          this.advance();
        }
        continue;
      }

      // Parse regular fields
      const key = this.expect('identifier').value;
      this.expect(':');
      obj[key] = this.parseValue();

      // Skip optional comma after field
      if (this.peek()?.value === ',') {
        this.advance();
      }
    }

    this.expect('}');
    return obj;
  }
  
  private parseValue(): any {
    const token = this.peek();
    
    if (!token) return null;
    
    switch (token.type) {
      case 'string':
        this.advance();
        return token.value;
      
      case 'number':
        this.advance();
        return parseFloat(token.value);
      
      case 'identifier':
        const value = token.value;
        this.advance();
        
        // Check for type annotations
        if (this.peek()?.value === '!') {
          this.advance();
          return { type: value, required: true };
        } else if (this.peek()?.value === '?') {
          this.advance();
          return { type: value, required: false };
        }
        
        // Check for special types
        if (value === 'str' || value === 'int' || value === 'num' || value === 'bool') {
          return { type: value };
        }
        
        return value;
      
      case 'operator':
        if (token.value === '|') {
          return this.parsePipeString();
        }
        break;
      
      case 'symbol':
        if (token.value === '{') {
          return this.parseBlock();
        } else if (token.value === '[') {
          return this.parseArray();
        }
        break;
    }
    
    return null;
  }
  
  private parsePipeString(): string {
    this.expect('|');

    // For this demo implementation, we'll collect string content after the pipe
    // A full implementation would properly handle indentation-based multiline text

    // Skip whitespace and look for the next token
    // If it's a string, use that. Otherwise return a placeholder.
    if (this.peek()?.type === 'string') {
      const content = this.expect('string').value;
      return content;
    }

    // For now, return placeholder for complex multiline cases
    return "multiline content here";
  }
  
  private parseArray(): any {
    this.expect('[');
    const arr: any[] = [];
    
    while (this.peek()?.value !== ']') {
      arr.push(this.parseValue());
      if (this.peek()?.value === ',') {
        this.advance();
      }
    }
    
    this.expect(']');
    return arr;
  }
  
  private peek(): Token | null {
    return this.position < this.tokens.length ? this.tokens[this.position] : null;
  }
  
  private advance(): void {
    this.position++;
  }
  
  private expect(type: string): Token {
    const token = this.peek();
    if (!token) {
      throw new Error(`Expected ${type} but reached end of input`);
    }
    
    if (type === token.type || type === token.value) {
      this.advance();
      return token;
    }
    
    throw new Error(`Expected ${type} but got ${token.type}: ${token.value}`);
  }
}

class MCPDSLCompiler {
  compile(ast: any): any {
    if (!ast) return null;
    
    switch (ast.type) {
      case 'request':
        return this.compileRequest(ast);
      case 'response':
        return this.compileResponse(ast);
      case 'notification':
        return this.compileNotification(ast);
      case 'error':
        return this.compileError(ast);
      case 'resource':
        return this.compileResource(ast);
      case 'tool':
        return this.compileTool(ast);
      case 'prompt':
        return this.compilePrompt(ast);
      default:
        return this.compileObject(ast);
    }
  }
  
  private compileRequest(ast: any): any {
    const result: any = {
      jsonrpc: "2.0",
      method: ast.method
    };
    
    if (ast.id !== null) {
      result.id = ast.id;
    }
    
    if (ast.params) {
      result.params = this.compileParams(ast.params);
    }
    
    return result;
  }
  
  private compileResponse(ast: any): any {
    return {
      jsonrpc: "2.0",
      id: ast.id,
      result: this.compileObject(ast.result)
    };
  }
  
  private compileNotification(ast: any): any {
    const result: any = {
      jsonrpc: "2.0",
      method: ast.method
    };
    
    if (ast.params) {
      result.params = this.compileParams(ast.params);
    }
    
    return result;
  }
  
  private compileError(ast: any): any {
    return {
      jsonrpc: "2.0",
      id: ast.id,
      error: {
        code: ast.code,
        message: ast.message
      }
    };
  }
  
  private compileResource(ast: any): any {
    const result: any = {
      name: ast.name
    };
    
    // Extract standard fields
    if (ast.uri) result.uri = ast.uri;
    if (ast.desc) result.description = ast.desc;
    if (ast.mime) result.mimeType = ast.mime;
    if (ast.size) result.size = ast.size;
    
    // Extract annotations
    const annotations: any = {};
    for (const key in ast) {
      if (key.startsWith('@')) {
        annotations[key.substring(1)] = ast[key];
      }
    }
    
    if (Object.keys(annotations).length > 0) {
      result.annotations = annotations;
    }
    
    return result;
  }
  
  private compileTool(ast: any): any {
    const result: any = {
      name: ast.name
    };
    
    if (ast.desc) result.description = ast.desc;
    
    // Compile input schema
    if (ast.in) {
      result.inputSchema = this.compileSchema(ast.in);
    }
    
    // Compile output schema
    if (ast.out) {
      result.outputSchema = this.compileSchema(ast.out);
    }
    
    // Extract annotations
    const annotations: any = {};
    if (ast['@readonly']) annotations.readOnlyHint = true;
    if (ast['@idempotent']) annotations.idempotentHint = true;
    if (ast['@destructive'] === false) annotations.destructiveHint = false;
    if (ast['@openWorld'] === false) annotations.openWorldHint = false;
    
    if (Object.keys(annotations).length > 0) {
      result.annotations = annotations;
    }
    
    return result;
  }
  
  private compilePrompt(ast: any): any {
    const result: any = {
      name: ast.name
    };
    
    if (ast.desc) result.description = ast.desc;
    
    // Compile arguments
    if (ast.args) {
      result.arguments = this.compilePromptArgs(ast.args);
    }
    
    // Compile messages
    if (ast.msgs) {
      result.messages = this.compileMessages(ast.msgs);
    }
    
    return result;
  }
  
  private compileParams(params: any): any {
    const result: any = {};
    
    for (const key in params) {
      if (!key.startsWith('@')) {
        result[key] = this.compileValue(params[key]);
      }
    }
    
    // Handle special field mappings
    if (params.v) {
      result.protocolVersion = params.v;
      delete result.v;
    }
    
    if (params.caps) {
      result.capabilities = this.compileCapabilities(params.caps);
      delete result.caps;
    }
    
    if (params.info) {
      result.clientInfo = params.info;
      delete result.info;
    }
    
    if (params.args) {
      result.arguments = params.args;
      delete result.args;
    }
    
    return result;
  }
  
  private compileObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.compileValue(item));
    }
    
    const result: any = {};
    
    for (const key in obj) {
      if (!key.startsWith('@')) {
        result[key] = this.compileValue(obj[key]);
      }
    }
    
    return result;
  }
  
  private compileValue(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }
    
    if (typeof value === 'object') {
      if (value.type) {
        // This is a type annotation
        return this.compileType(value);
      } else if (Array.isArray(value)) {
        return value.map(item => this.compileValue(item));
      } else {
        return this.compileObject(value);
      }
    }
    
    return value;
  }
  
  private compileSchema(schema: any): any {
    const result: any = {
      type: "object",
      properties: {},
      required: []
    };
    
    for (const key in schema) {
      const field = schema[key];
      
      if (typeof field === 'object' && field.type) {
        result.properties[key] = this.compileType(field);
        if (field.required) {
          result.required.push(key);
        }
      } else {
        result.properties[key] = this.compileType({ type: typeof field });
      }
    }
    
    return result;
  }
  
  private compileType(type: any): any {
    const typeMap: any = {
      'str': 'string',
      'int': 'integer',
      'num': 'number',
      'bool': 'boolean'
    };
    
    const jsonType = typeMap[type.type] || type.type;
    
    return {
      type: jsonType
    };
  }
  
  private compileCapabilities(caps: any): any {
    // Simple capability parsing for demo
    const result: any = {};
    
    if (caps.includes) {
      caps.includes.forEach((cap: string) => {
        const parts = cap.split('.');
        if (parts.length === 1) {
          result[parts[0]] = {};
        } else {
          if (!result[parts[0]]) {
            result[parts[0]] = {};
          }
          result[parts[0]][parts[1]] = true;
        }
      });
    }
    
    return result;
  }
  
  private compilePromptArgs(args: any): any[] {
    const result: any[] = [];
    
    for (const key in args) {
      const arg: any = {
        name: key
      };
      
      const field = args[key];
      if (typeof field === 'object' && field.type) {
        if (field.required) arg.required = true;
        if (field.description) arg.description = field.description;
      } else if (typeof field === 'string') {
        arg.description = field;
      }
      
      result.push(arg);
    }
    
    return result;
  }
  
  private compileMessages(msgs: any[]): any[] {
    return msgs.map(msg => {
      if (typeof msg === 'object') {
        const role = msg.u ? 'user' : msg.a ? 'assistant' : 'user';
        const content = msg.u || msg.a || msg;
        
        return {
          role,
          content: typeof content === 'string' ? 
            { type: 'text', text: content } : 
            this.compileContent(content)
        };
      }
      
      return msg;
    });
  }
  
  private compileContent(content: any): any {
    if (typeof content === 'string') {
      return { type: 'text', text: content };
    }

    if (content.txt) {
      return { type: 'text', text: content.txt };
    }

    if (content.img) {
      return {
        type: 'image',
        data: content.img,
        mimeType: content.mime || 'image/png'
      };
    }

    if (content.aud) {
      return {
        type: 'audio',
        data: content.aud,
        mimeType: content.mime || 'audio/mp3'
      };
    }

    if (content.res) {
      return {
        type: 'resource_link',
        ...content.res
      };
    }

    if (content.emb) {
      return {
        type: 'resource',
        resource: content.emb
      };
    }

    return content;
  }
}

class MCPDSLDecompiler {
  decompile(json: any): string {
    if (!json) return '';

    // Detect message type based on JSON-RPC structure
    if (json.jsonrpc === "2.0") {
      // Error response
      if (json.error) {
        return this.decompileError(json);
      }
      // Response with result
      else if ('result' in json && 'id' in json) {
        return this.decompileResponse(json);
      }
      // Request with id
      else if (json.method && 'id' in json) {
        return this.decompileRequest(json);
      }
      // Notification (no id)
      else if (json.method) {
        return this.decompileNotification(json);
      }
    }

    // Tool definition
    if (json.name && json.inputSchema) {
      return this.decompileTool(json);
    }

    // Resource definition
    if (json.name && json.uri) {
      return this.decompileResource(json);
    }

    // Prompt definition
    if (json.name && json.messages) {
      return this.decompilePrompt(json);
    }

    return '';
  }

  private decompileRequest(json: any): string {
    const method = json.method;
    const id = json.id;
    const params = json.params || {};

    let result = `> ${method}#${id}`;

    if (Object.keys(params).length > 0) {
      result += ' ' + this.decompileParams(params);
    }

    return result;
  }

  private decompileResponse(json: any): string {
    const id = json.id;
    const result = json.result || {};

    let output = `< #${id}`;

    if (Object.keys(result).length > 0) {
      output += ' ' + this.decompileObject(result);
    }

    return output;
  }

  private decompileNotification(json: any): string {
    const method = json.method;
    const params = json.params || {};

    let result = `! ${method}`;

    if (Object.keys(params).length > 0) {
      result += ' ' + this.decompileParams(params);
    }

    return result;
  }

  private decompileError(json: any): string {
    const id = json.id;
    const code = json.error.code;
    const message = json.error.message;

    return `x #${id} ${code}:"${message}"`;
  }

  private decompileTool(json: any): string {
    const name = json.name;
    let result = `T ${name} {\n`;

    if (json.description) {
      result += `  desc: "${json.description}"\n`;
    }

    if (json.inputSchema) {
      result += `  in: ${this.decompileSchema(json.inputSchema, 2)}\n`;
    }

    if (json.outputSchema) {
      result += `  out: ${this.decompileSchema(json.outputSchema, 2)}\n`;
    }

    // Handle annotations
    if (json.annotations) {
      if (json.annotations.readOnlyHint) {
        result += `  @readonly\n`;
      }
      if (json.annotations.idempotentHint) {
        result += `  @idempotent\n`;
      }
      if (json.annotations.destructiveHint === false) {
        result += `  @destructive: false\n`;
      }
      if (json.annotations.openWorldHint === false) {
        result += `  @openWorld: false\n`;
      }
    }

    result += '}';
    return result;
  }

  private decompileResource(json: any): string {
    const name = json.name;
    let result = `R ${name} {\n`;

    if (json.uri) {
      result += `  uri: "${json.uri}"\n`;
    }

    if (json.description) {
      result += `  desc: "${json.description}"\n`;
    }

    if (json.mimeType) {
      result += `  mime: "${json.mimeType}"\n`;
    }

    if (json.size !== undefined) {
      result += `  size: ${json.size}\n`;
    }

    if (json.annotations) {
      for (const [key, value] of Object.entries(json.annotations)) {
        if (typeof value === 'boolean' && value === true) {
          result += `  @${key}\n`;
        } else {
          result += `  @${key}: ${JSON.stringify(value)}\n`;
        }
      }
    }

    result += '}';
    return result;
  }

  private decompilePrompt(json: any): string {
    const name = json.name;
    let result = `P ${name} {\n`;

    if (json.description) {
      result += `  desc: "${json.description}"\n`;
    }

    if (json.arguments && json.arguments.length > 0) {
      result += `  args: {\n`;
      for (const arg of json.arguments) {
        const required = arg.required ? '!' : '';
        result += `    ${arg.name}: str${required}\n`;
      }
      result += `  }\n`;
    }

    if (json.messages && json.messages.length > 0) {
      result += `  msgs: [\n`;
      for (const msg of json.messages) {
        const role = msg.role === 'user' ? 'u' : 'a';
        const content = typeof msg.content === 'string' ? msg.content :
                       msg.content.text || JSON.stringify(msg.content);
        result += `    ${role}: "${content}"\n`;
      }
      result += `  ]\n`;
    }

    result += '}';
    return result;
  }

  private decompileParams(params: any): string {
    const obj: any = {};

    // Reverse special field mappings
    if (params.protocolVersion) {
      obj.v = params.protocolVersion;
    }

    if (params.capabilities) {
      obj.caps = this.decompileCapabilities(params.capabilities);
    }

    if (params.clientInfo) {
      obj.info = params.clientInfo;
    }

    if (params.serverInfo) {
      obj.info = params.serverInfo;
    }

    if (params.arguments) {
      obj.args = params.arguments;
    }

    // Copy other params
    for (const [key, value] of Object.entries(params)) {
      if (!['protocolVersion', 'capabilities', 'clientInfo', 'serverInfo', 'arguments'].includes(key)) {
        obj[key] = value;
      }
    }

    return this.decompileObject(obj);
  }

  private decompileObject(obj: any, indent: number = 0): string {
    if (typeof obj !== 'object' || obj === null) {
      return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      const items = obj.map(item => this.decompileValue(item, indent + 2));
      return `[${items.join(', ')}]`;
    }

    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';

    const indentStr = ' '.repeat(indent);
    const innerIndentStr = ' '.repeat(indent + 2);

    let result = '{\n';
    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i];
      result += innerIndentStr + key + ': ' + this.decompileValue(value, indent + 2);
      if (i < entries.length - 1) {
        result += ',';
      }
      result += '\n';
    }
    result += indentStr + '}';

    return result;
  }

  private decompileValue(value: any, indent: number = 0): string {
    if (value === null || value === undefined) {
      return 'null';
    }

    if (typeof value === 'string') {
      return `"${value}"`;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      const items = value.map(item => this.decompileValue(item, indent));
      return `[${items.join(', ')}]`;
    }

    if (typeof value === 'object') {
      return this.decompileObject(value, indent);
    }

    return String(value);
  }

  private decompileSchema(schema: any, indent: number = 0): string {
    if (!schema || !schema.properties) {
      return '{}';
    }

    const indentStr = ' '.repeat(indent);
    const innerIndentStr = ' '.repeat(indent + 2);

    let result = '{\n';
    const entries = Object.entries(schema.properties);

    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i];
      const typeDef = value as any;
      const isRequired = schema.required && schema.required.includes(key);

      result += innerIndentStr + key + ': ' + this.decompileType(typeDef, isRequired);
      if (i < entries.length - 1) {
        result += ',';
      }
      result += '\n';
    }

    result += indentStr + '}';
    return result;
  }

  private decompileType(type: any, required: boolean = false): string {
    const typeMap: any = {
      'string': 'str',
      'integer': 'int',
      'number': 'num',
      'boolean': 'bool'
    };

    const dslType = typeMap[type.type] || type.type;
    const requiredMarker = required ? '!' : '';

    return dslType + requiredMarker;
  }

  private decompileCapabilities(caps: any): any {
    // For simple inline representation
    const capabilities: string[] = [];

    for (const [key, value] of Object.entries(caps)) {
      if (typeof value === 'object' && value !== null && Object.keys(value).length > 0) {
        for (const subKey of Object.keys(value)) {
          capabilities.push(`${key}.${subKey}`);
        }
      } else {
        capabilities.push(key);
      }
    }

    return { includes: capabilities };
  }
}

// Usage Example
function parseMCPDSL(input: string): any {
  const lexer = new MCPDSLLexer(input);
  const tokens = lexer.tokenize();

  const parser = new MCPDSLParser(tokens);
  const ast = parser.parse();

  const compiler = new MCPDSLCompiler();
  return compiler.compile(ast);
}

function decompileMCPJSON(json: any): string {
  const decompiler = new MCPDSLDecompiler();
  return decompiler.decompile(json);
}

// Test examples
const examples = [
  `> initialize#1 {
    v: "2025-06-18"
    caps: {roots.listChanged, sampling}
    info: @impl("MyClient", "1.0.0")
  }`,
  
  `T search {
    desc: "Search the web"
    in: {
      query: str!
      limit: int = 10
    }
    @readonly
  }`,
  
  `< #42 {
    content: [txt"Result found"]
  }`,
  
  `! progress {
    token: "abc123"
    progress: 50
    total: 100
  }`,
  
  `P code_review {
    desc: "Reviews code for quality"
    msgs: [
      u: |
        Please review this {{language}} code:
        Focus on performance and readability.
      a: "I'll analyze the code now."
    ]
  }`
];

// Export for use in other modules
export { MCPDSLLexer, MCPDSLParser, MCPDSLCompiler, MCPDSLDecompiler, parseMCPDSL, decompileMCPJSON };

// Only run examples if this file is executed directly (not imported)
if (import.meta.main) {
  // Process each example
  examples.forEach((example, index) => {
    console.log(`\n=== Example ${index + 1} ===`);
    console.log('MCP-DSL Input:');
    console.log(example);

    try {
      const result = parseMCPDSL(example);
      console.log('\nCompiled JSON:');
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Parsing error:', error);
    }
  });
}