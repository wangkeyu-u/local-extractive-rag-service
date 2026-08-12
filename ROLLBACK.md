# Rollback guide

This work started from the repository's original default branch without rewriting it.

- Remote: `https://github.com/wangkeyu-u/local-extractive-rag-service.git`
- Original default branch: `main`
- Original HEAD: `a62ab5738031547343343ba8c3c22f7398441414`
- Implementation branch: `codex/interview-alignment`

## Inspect or restore the baseline

The safest way to inspect the untouched baseline is to create a separate branch or worktree:

```bash
git switch -c inspect/original a62ab5738031547343343ba8c3c22f7398441414
```

To discard the implementation branch locally after switching away from it:

```bash
git switch main
git branch -D codex/interview-alignment
```

To restore an individual file from the original baseline while staying on the implementation branch:

```bash
git restore --source=a62ab5738031547343343ba8c3c22f7398441414 -- path/to/file
```

No force push or push is part of this implementation workflow. The original `main` ref remains unchanged.
