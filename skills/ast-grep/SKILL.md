---
name: ast-grep
description: "Use ast_grep for structural code searches where the pattern depends on syntax shape — function calls, class definitions, imports, argument positions, control flow. Use grep for plain text and read for exact file contents."
---

# ast-grep

**Bold terms** are defined in [`GLOSSARY.md`](GLOSSARY.md).

## Tool choice

Classify the question before searching:

- **ast_grep_search** — **structural** matches: function calls, class definitions, imports, method signatures, argument positions, control flow, nested blocks.
- **ast_grep_replace** — same as search, but you want to rewrite the matched structure across files.
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

## Completion criterion

Before each search, name the shape you need. If it can be written as a valid AST node, use ast_grep. Otherwise, use grep or read.
