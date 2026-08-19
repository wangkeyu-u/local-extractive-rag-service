# Rollback guide

This work started from the repository's original default branch without rewriting it.

- Remote: `https://github.com/wangkeyu-u/local-extractive-rag-service.git`
- Original default branch: `main`
- Original HEAD: `a62ab5738031547343343ba8c3c22f7398441414`
- Implementation branch: `codex/interview-alignment`
- Round 1 HEAD: `735d0ebd27817d48e4662d6a3646ecb19130a9e0`
- Round 1 local tag: `codex/round1-complete`

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

## Two rollback levels

Return to the original repository baseline in a new local branch:

```bash
git switch -c rollback/original a62ab5738031547343343ba8c3c22f7398441414
```

Return only to the completed Round 1 state in a new local branch:

```bash
git switch -c rollback/round1 codex/round1-complete
```

The tag is local and annotated. Verify that it still resolves to the recorded Round 1 commit before using it:

```bash
test "$(git rev-parse 'codex/round1-complete^{}')" = "735d0ebd27817d48e4662d6a3646ecb19130a9e0"
```
