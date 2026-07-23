# Claude Code Hooks — nodes-dashboard

This repo was the pilot for three Claude Code hooks (format+lint, destructive-command
guard, PostCompact context refresh). After validating them here, they were extracted
into the shared [ai-instructions](https://github.com/oceanprotocol/ai-instructions)
repo so every Ocean repo pulls the same scripts instead of drifting local copies.

**Source of truth for what each hook does:** [ai-instructions/hooks/README.md](../ai-instructions/hooks/README.md).
This file only covers how nodes-dashboard is wired up and what's specific to this repo.

## How this repo consumes the hooks

- `ai-instructions` is a git submodule at [`./ai-instructions`](../ai-instructions).
- [`.claude/hooks`](hooks) is a symlink to `../ai-instructions/hooks` — no
  scripts are duplicated in this repo, so updates to the shared hooks only
  require bumping the submodule pointer.
- [`.claude/settings.json`](settings.json) wires the three hooks up; its content
  is identical to [ai-instructions/hooks/settings.snippet.json](../ai-instructions/hooks/settings.snippet.json).

```
.claude/
├── hooks -> ../ai-instructions/hooks   (symlink)
├── settings.json                       (hooks config, matches the shared snippet)
└── HOOKS.md                            (this file)
ai-instructions/                        (git submodule)
└── hooks/
    ├── format-and-lint.sh
    ├── block-destructive.sh
    ├── refresh-context.sh
    └── README.md
```

Pulling in future hook changes is a normal submodule bump:

```bash
git submodule update --remote ai-instructions
git add ai-instructions
git commit -m "Bump ai-instructions submodule"
```

After any hooks change lands, open `/hooks` once in your Claude Code session
(or restart) so the update is picked up.

## Validation already done (2026-07-21)

All three scripts were pipe-tested with synthesized hook payloads directly
against this repo's own toolchain (Yarn 4 node-modules linker, `.nvmrc` pinned
to Node 24) — including force-push/`rm -rf` denials, the new `git commit`/
`git push` confirmation prompts, and prettier/eslint actually reformatting a
scratch `.ts` file. See `ai-instructions/hooks/README.md` for the full test
notes from when these were generalized. Re-run anytime with:

```bash
export CLAUDE_PROJECT_DIR="$(pwd)"
echo '{"tool_name":"Bash","tool_input":{"command":"git push --force"}}' | .claude/hooks/block-destructive.sh
echo '{"tool_name":"Edit","tool_input":{"file_path":"'"$CLAUDE_PROJECT_DIR"'/src/some/file.ts"}}' | .claude/hooks/format-and-lint.sh
echo '{"session_id":"test","trigger":"auto"}' | .claude/hooks/refresh-context.sh
```

Known repo quirk found during the pilot (unrelated to the hooks themselves):
`.eslintrc.json` (extends only `next/core-web-vitals`) takes priority over
`.eslintrc`, so the stricter rules in `.eslintrc` (`require-await`,
`no-unused-vars`, …) are currently inactive — worth consolidating the two
configs at some point.

## Rollout decision (proposed, documented in full in ai-instructions/hooks/README.md)

| Hook | Verdict | Where |
|------|---------|-------|
| Block destructive commands | Roll out broadly | All repos — repo-agnostic, zero deps beyond `jq` |
| Format + lint after edits | Roll out per repo | Repos with prettier/eslint set up |
| Refresh context after compaction | Roll out broadly | All repos — most valuable in repos that have a `CLAUDE.md` |

Rollout: one PR per repo, following the "Wire up Claude Code hooks" steps in
[ai-instructions/README.md](../ai-instructions/README.md#wire-up-claude-code-hooks),
starting with the actively developed repos (ocean-node, ocean-cli, oceanJS,
ocean-market, nodes-analytics, incentive-backend).
