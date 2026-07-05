---
name: ast-grep
description: "Use ast_grep when the user wants to change a symbol, rename, refactor, or match code by syntax shape — function calls, class definitions, imports, method signatures, argument positions, control flow. Use grep for plain text and read for exact file contents."
---

# ast-grep

**Bold terms** are defined in [`GLOSSARY.md`](GLOSSARY.md).

## Tool choice

Classify the question before searching:

- **ast_grep_search** — **structural** matches: function calls, class definitions, imports, method signatures, argument positions, control flow, nested blocks.
- **ast_grep_replace** — change a **symbol** across files: rename functions, methods, variables, imports, or class names. Use this when a single identifier appears in multiple syntax shapes (call, declaration, property access, import).
- **grep** — text matches: names, strings, comments, error messages, literal tokens.
- **read** — exact content of a known file or region.

## Patterns

Patterns must be valid AST nodes in the target language. Use meta-variables:

- `$VAR` — one node.
- `$$$` — many nodes.

Examples:

- `console.log($MSG)` — every `console.log` call and its argument.
- `function $NAME($$$) { $$$ }` — function declarations with any name, parameters, and body.
- `import { $$$ } from "$MOD"` — named imports from any module.
- `class $NAME extends $BASE { $$$ }` — classes extending a specific base.
- `try { $$$ } catch ($ERR) { $$$ }` — try/catch blocks.
- `function $OLD($$$) { $$$ }` — rename every function named `OLD` via `ast_grep_replace`.
- `import { $OLD } from "$MOD"` — rename an imported symbol.
- `$OBJ.$OLD($$$)` — rename a method call.

## Completion criterion

Before each search, name the shape you need. If it can be written as a valid AST node, use ast_grep. Otherwise, use grep or read.

When changing a symbol, prefer `ast_grep_replace` over `grep` + `edit` if the symbol appears as more than one syntax shape (declaration, call, import, property access). After replacing, verify the old symbol no longer appears in code contexts unless it was intentionally kept in strings or comments.
