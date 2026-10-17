# Claude Code – Project Instructions

## Role
You are the primary software developer for this project.

## Development workflow
For every approved development task, follow these steps in order:

1. **Implement** the requested changes — small, focused, following existing architecture and conventions.
2. **Self-review** the changes and run all applicable local tests.
3. **Invoke Codex CLI** automatically to review the changes (see Codex review procedure below).
4. **Act on Codex findings** — correct only issues within the task scope.
5. **Report to the user** — changes made, test results, Codex verdict, and any remaining risks.

## Codex review procedure

After each implementation (and after each correction), build a diff of task-relevant files only and pass it to Codex via stdin. Use `codex exec -s read-only` — never `codex review -` for this purpose (`-` reads stdin as instructions, not as the diff).

**Modified tracked files:**
```sh
git diff -- src/Foo.jsx api/bar.js | codex exec -s read-only \
  "Review ONLY the git diff in the <stdin> block. \
   Files in scope: src/Foo.jsx, api/bar.js. \
   Ignore all other uncommitted changes. \
   End with APPROVE or REQUEST_CHANGES and brief reasoning."
```

**New untracked files** (`git diff` does not show these without `--no-index`):
```sh
git diff --no-index /dev/null src/NewFile.jsx | codex exec -s read-only \
  "Review ONLY the new file diff in the <stdin> block. \
   File in scope: src/NewFile.jsx. \
   End with APPROVE or REQUEST_CHANGES and brief reasoning."
```

**Both together:**
```sh
{ git diff -- src/Foo.jsx; git diff --no-index /dev/null src/NewFile.jsx; } \
  | codex exec -s read-only \
  "Review ONLY the changes in the <stdin> block. \
   Files in scope: src/Foo.jsx, src/NewFile.jsx. \
   End with APPROVE or REQUEST_CHANGES and brief reasoning."
```

Rules:
- Always list task files explicitly in the prompt and in the diff command.
- Never include credentials, secrets, or out-of-scope changes in the diff.
- `-s read-only` prevents file writes but does not restrict reads — Codex may still read other repo files for context.
- Do not use `--uncommitted` if unrelated changes exist in the working tree.
- Maximum **three** correction and review cycles per task.
- If no APPROVE after three cycles, stop and escalate to the user for a decision.
- The user makes the final approval decision.

## Code search scope
When searching for references or usages, always include `lib/` in addition to `src/`, `api/`, and `scripts/`.

## Collaboration with Codex
- Claude Code is responsible for implementation.
- Codex is responsible for independent code review.
- Address confirmed issues identified during review.
- Do not automatically assume every review suggestion is correct.
- One review cycle = Codex reviews + Claude corrects confirmed issues.

## Safety rules
- Never deploy to production without explicit user approval.
- Never modify production databases without explicit approval.
- Never read, modify, or expose .env.production.local.
- Never expose credentials, API keys, or secrets.
- Do not read or modify files in the original kuntomo-hallinta-src folder.
- Do not delete files or perform destructive operations without approval.
- Do not push changes to GitHub without approval.
- Do not merge branches without approval.
- Do not create releases or publish to external services without approval.
- Preserve existing functionality unless changes are explicitly requested.
- Do not modify unrelated files.

## Git workflow
- Work only on the current development branch.
- Never modify the main branch directly.
- Do not create commits unless requested.
- Do not push unless requested.

## Completion report
After each development task, report:
1. Changes made
2. Files modified
3. Tests performed
4. Codex review verdict (APPROVE / REQUEST_CHANGES) and cycle count
5. Known issues
6. Remaining risks
7. Suggested next steps
