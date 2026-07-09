---
name: ast-grep
description: "MANDATORY for any structural code task: searching or changing symbols, function calls, class definitions, imports, method signatures, argument positions, control flow, or nested blocks. Use grep only for plain text, strings, comments, logs, or error messages."
---

# ast-grep

**Bold terms** are defined in [`GLOSSARY.md`](GLOSSARY.md).

## Decision rule (use this order)

Before any search or edit across code, classify the target:

1. **Is it a code shape?** → Use `ast_grep_search` or `ast_grep_replace`.
2. **Is it plain text, a string literal, a comment, an error message, or a log line?** → Use `grep`/`ffgrep`.
3. **Do you already know the exact file and lines?** → Use `read`.

Do not use `grep` as a default for code-shape queries. Grep finds false positives in strings, comments, and unrelated contexts.

## When to use ast-grep

| Use `ast_grep_search` | Use `ast_grep_replace` |
|---|---|
| Find all calls to a function or method | Rename a function, method, variable, class, or import |
| Find all imports from a module | Change a call signature across files |
| Find all class definitions or extensions | Replace a symbol that appears in many syntax shapes |
| Find all try/catch, if/else, or loops | Move an argument position |
| Find all arrow functions with a given shape | Convert `console.log` calls to a logger |

## When to use grep instead

- Searching for literal text in strings, comments, or logs.
- Searching configuration files, JSON, YAML, Markdown, SQL, or raw text.
- The language is not supported by `ast_grep_search`.
- `ast_grep_search` failed to parse the file due to syntax quirks.

## Patterns

Patterns must be valid AST nodes in the target language. Use meta-variables:

- `$VAR` — one node.
- `$$$` — many nodes.

Examples:

- `console.log($MSG)` — every `console.log` call and its argument.
- `$LOGGER.$LEVEL($MSG)` — any logger method call.
- `function $NAME($$$) { $$$ }` — function declarations with any name, parameters, and body.
- `import { $$$ } from "$MOD"` — named imports from any module.
- `class $NAME extends $BASE { $$$ }` — classes extending a specific base.
- `try { $$$ } catch ($ERR) { $$$ }` — try/catch blocks.
- `const $NAME = ($$$) => $$$` — arrow functions assigned to a variable.
- `$OBJ.$OLD($$$)` — rename a method call.

## Replacement rules

When changing a symbol, prefer `ast_grep_replace` over `grep` + `edit` if the symbol appears as more than one syntax shape (declaration, call, import, property access).

After replacing, verify the old symbol no longer appears in code contexts unless it was intentionally kept in strings or comments.

## Workflow

1. Name the shape you need.
2. If it can be written as a valid AST node, run `ast_grep_search` with the correct `lang`.
3. If the result is wrong or empty due to parse issues, fall back to `grep` or `read` and document why.
4. For renames or refactors, run `ast_grep_replace` with `dryRun=true` first, review, then apply with `dryRun=false`.

## Common pitfalls

- `ast_grep_search` ignores comments and string literals. If you need those, use `grep`.
- Patterns must be complete AST nodes. `console.log` alone is not valid; use `console.log($$$)`.
- Always specify the correct `lang`. Mixed-language repos may need multiple searches.
- `ast_grep_replace` dry-run first. It can rewrite many files at once.
