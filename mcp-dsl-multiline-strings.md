# MCP-DSL: Multiline String Handling

## Overview

MCP-DSL provides two mechanisms for expressing text content: simple strings and multiline strings using pipe syntax. This document explores the design and usage of multiline strings, with particular focus on handling code blocks and other indentation-sensitive content.

## String Syntax Comparison

### Simple Strings
The default and most token-efficient approach for single-line or simple content:

```mcp-dsl
desc: "A single-line description"
error: "Failed to parse\nCheck syntax"  # \n for line breaks
```

**Escape sequences**: `\n` (newline), `\t` (tab), `\"` (quote), `\\` (backslash), `\{{` (literal brace)

### Multiline Strings (Pipe Syntax)
For content that spans multiple lines or requires preserved formatting:

```mcp-dsl
content: |
  First line
  Second line
  Preserves structure
```

## Pipe Syntax Rules

The pipe operator (`|`) enables multiline text with the following behavior:

1. **Marker placement**: The `|` appears after the field name and colon
2. **Content start**: Text begins on the next line
3. **Indentation scope**: All lines at or deeper than the pipe's indentation level are included
4. **Preservation**: Relative indentation and empty lines are maintained
5. **Termination**: Content ends when indentation returns to or below the field level

## Indentation-Based Code Blocks

Since pipe syntax preserves relative indentation, code blocks can be embedded using markdown's 4-space indentation convention or through template variable formatting:

```mcp-dsl
P python_analyzer {
  desc: "Analyzes Python code for issues"
  args: {
    code: str!
    focus?: enum[performance, security, style, all] = "all"
  }
  msgs: [
    u: |
      Please analyze this Python code:
      
          {{code}}
      
      Focus areas: {{focus}}
      
      Provide feedback on:
      1. Potential bugs
      2. Performance optimizations
      3. Pythonic improvements
    
    a: |
      I'll analyze your Python code focusing on {{focus}}.
      
      Here's my analysis...
  ]
}
```

## Use Cases for Multiline Strings

### Structured Text Content

```mcp-dsl
P meeting_summary {
  msgs: [
    u: |
      Please summarize this meeting transcript:

      Attendees: {{attendees}}
      Date: {{date}}

      Key discussion points:
      - Budget allocation for Q4
      - Timeline for product launch
      - Resource requirements

      Action items:
      1. Review vendor proposals by Friday
      2. Schedule follow-up with engineering team
      3. Prepare board presentation
  ]
}
```

### Code Review Examples

#### SQL Query Review
```mcp-dsl
P sql_review {
  msgs: [
    u: |
      Review this SQL query for performance:
      
          {{query}}
      
      Database: {{db_type}}
      Table size: {{table_size}} rows
  ]
}
```

#### React Component Generator
```mcp-dsl
P react_component {
  args: {
    name: str!
    props: str!
    hooks?: str
  }
  msgs: [
    u: |
      Generate a React component:

      Component: {{name}}
      Props: {{props}}
      {{#if hooks}}Hooks needed: {{hooks}}{{/if}}

      Requirements:
      - TypeScript
      - Proper prop types
      - Error boundaries
      - Loading states
  ]
}
```

#### Documentation Generator
```mcp-dsl
P doc_generator {
  msgs: [
    u: |
      Generate documentation for this function:

          {{function_code}}

      Include:
      - Purpose and overview
      - Parameter descriptions
      - Return value details
      - Usage examples
      - Edge cases
  ]
}
```

### Conversational Prompts

```mcp-dsl
P technical_interview {
  args: {
    candidate_name: str!
    role: str!
    experience_level: enum[junior, mid, senior]!
  }
  msgs: [
    u: |
      You are conducting a technical interview for {{candidate_name}}.

      Role: {{role}}
      Level: {{experience_level}}

      Interview structure:
      1. Technical background (10 min)
      2. Problem-solving exercise (30 min)
      3. System design discussion (20 min)
      4. Q&A (10 min)

      Begin with a warm introduction and ask about their recent projects.

    a: |
      Hello {{candidate_name}}! Thank you for joining us today.

      I'm looking forward to learning about your experience as a {{role}}.
      Let's start by discussing your background...
  ]
}
```

### Long-Form Instructions

```mcp-dsl
P essay_grader {
  args: {
    essay: str!
    grade_level: str!
    rubric: str!
  }
  msgs: [
    u: |
      Grade the following essay according to the provided rubric:

      ESSAY:
      {{essay}}

      RUBRIC:
      {{rubric}}

      GRADING CRITERIA:

      Content & Ideas (40%):
      - Clarity of thesis statement
      - Development of main arguments
      - Use of supporting evidence
      - Logical organization

      Writing Quality (30%):
      - Grammar and mechanics
      - Sentence variety
      - Word choice
      - Paragraph structure

      Analysis & Critical Thinking (30%):
      - Depth of analysis
      - Original insights
      - Connection to broader themes

      Provide:
      1. Overall grade (A-F)
      2. Scores for each criterion
      3. Specific strengths
      4. Areas for improvement
      5. Actionable feedback
  ]
}
```

## Design Benefits

### 1. Token Efficiency
Multiline strings avoid the overhead of escape sequences (`\n`) for every line break:

```mcp-dsl
# Inefficient: 45 tokens
desc: "Line 1\nLine 2\nLine 3\nLine 4\nLine 5"

# Efficient: 38 tokens
desc: |
  Line 1
  Line 2
  Line 3
  Line 4
  Line 5
```

### 2. Readability
Natural indentation makes content structure immediately apparent:
- No visual noise from escape sequences
- Content appears as it will be processed
- Easy to identify nested structures

### 3. Maintainability
Changes to multiline content are easier to track in version control:
- Diffs show actual line changes, not escape sequence modifications
- Indentation errors are visually obvious
- Comments can be added inline

### 4. Markdown Compatibility
When documenting MCP-DSL examples containing code:
- No conflict with markdown fence characters (```)
- Examples render correctly in GitHub, documentation sites, and IDEs
- Code blocks use natural 4-space indentation

### 5. Template Integration
Works seamlessly with template engines (Handlebars, Jinja, etc.):
- Template variables maintain proper indentation
- Conditionals and loops don't break formatting
- Output preserves intended structure

## Advanced Patterns

### Template Functions for Special Formatting

For complex formatting needs, delegate to the template engine:

```mcp-dsl
P code_formatter {
  msgs: [
    u: |
      {{#code language="python"}}
      {{user_code}}
      {{/code}}

      Please review the above code.
  ]
}
```

The template engine handles code block formatting appropriately for the output context.

### Mixed Content

Combine different indentation levels for complex structures:

```mcp-dsl
P api_documentation {
  args: {
    endpoint: str!
    method: str!
    example_request: str!
    example_response: str!
  }
  msgs: [
    u: |
      Document this API endpoint:

      Endpoint: {{method}} {{endpoint}}

      Example request:

          {{example_request}}

      Example response:

          {{example_response}}

      Requirements:
      - Authentication details
      - Rate limiting
      - Error codes
      - Best practices
  ]
}
```

### Nested Templates

Multiline strings can contain template logic:

```mcp-dsl
P report_generator {
  args: {
    sections: [str]!
    include_summary?: bool = true
  }
  msgs: [
    u: |
      Generate a report with the following sections:

      {{#each sections}}
      {{@index}}. {{this}}
      {{/each}}

      {{#if include_summary}}
      Include an executive summary at the beginning.
      {{/if}}

      Format requirements:
      - Professional tone
      - Data-driven insights
      - Clear recommendations
  ]
}
```

## Implementation Considerations

### Parser Behavior

When implementing a parser for pipe syntax:

1. **Indentation detection**: Measure whitespace at the start of the first content line to establish the base indentation level
2. **Relative preservation**: Strip the base indentation from all subsequent lines, preserving any additional indentation
3. **Empty line handling**: Preserve empty lines within the content block
4. **Termination**: End the multiline string when indentation returns to the field level or less

### Example Parsing

```mcp-dsl
field: |
  Line 1        # Base indentation: 2 spaces
    Indented    # Preserved: +2 spaces relative to base
  Line 3        # Base indentation
                # Empty line preserved
  Done          # Base indentation
next: value     # Terminates multiline (indentation <= field level)
```

### Token Counting

For LLM token efficiency calculations:

- Escape sequences count as 2 tokens each (`\n` = `\` + `n`)
- Actual newlines in multiline strings count as 1 token
- Break-even point: ~3+ lines favor pipe syntax
- Additional benefit: improved readability doesn't cost extra tokens

## When to Use Each Syntax

### Use Simple Strings When:
- Content is single-line or short
- Few line breaks needed (< 3)
- Escape sequences are acceptable
- Maximum token efficiency for short text

### Use Pipe Syntax When:
- Content spans multiple lines (3+)
- Preserving indentation matters
- Human readability is important
- Content includes code, lists, or structured text
- Template variables benefit from formatting context

## Summary

MCP-DSL's multiline string handling via pipe syntax provides:

1. **Token efficiency**: Reduces overhead for multi-line content
2. **Readability**: Natural presentation of structured text
3. **Markdown safety**: No conflicts with documentation rendering
4. **Indentation preservation**: Critical for code and structured content
5. **Template compatibility**: Works seamlessly with templating engines
6. **Version control friendly**: Clean diffs and easy maintenance

By offering both simple strings and pipe syntax, MCP-DSL optimizes for token count when possible while providing powerful multiline capabilities when needed.