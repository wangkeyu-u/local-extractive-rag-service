# Aurora Operations

## Backup Protocol

- The archive retains exactly 14 nightly snapshots.
- Operators verify integrity with the command `aurora backup verify`.

```bash
aurora backup verify --latest
```

## Access Keys

Amber access keys expire after 90 days. Renewal requires a supervisor signature.

## Incident Response

A Comet severity incident must be reported to mission control within 15 minutes.
