# TDD skill

Use test-driven development when writing or changing code.

## Workflow

1. **Understand the behavior first.** Read the relevant code and any existing tests.
2. **Write a failing test.** Add a test that expresses the new behavior or the bug you are fixing.
3. **Run the test and confirm it fails.** Use `code_check`, `bash`, or the project's test runner.
4. **Write the smallest code change that makes the test pass.** Do not over-engineer.
5. **Run all relevant tests.** Make sure the new test passes and nothing else broke.
6. **Refactor.** Clean up duplication, improve names, and simplify while keeping tests green.
7. **Run the full suite again** before finishing.

## Tips

- If a codebase has no tests, add the first test for the behavior you are touching.
- Prefer small, focused tests with clear arrange/act/assert structure.
- Keep the red-green-refactor cycle tight; run tests often.
- Use `code_check_discover` and `code_check` to find the right test commands for the project.
