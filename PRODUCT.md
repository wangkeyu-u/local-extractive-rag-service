# Groundline Product Context

## Product definition

Groundline is a desktop retrieval console for small local text collections. It helps a user ask a question, see an extractive answer or refusal, and inspect the exact evidence used.

The product is successful when a reviewer can answer four questions without leaving the workspace:

1. Is the local index ready?
2. Which documents are included?
3. Why did this passage rank first?
4. Does the answer stay inside the retrieved text?

## Users

| User | Need |
| --- | --- |
| Reviewer | Understand the retrieval and privacy boundaries quickly |
| Developer | Inspect scores, ranks, matched terms, chunks, and latency |
| Knowledge user | Read a concise answer and verify its citations |

## Product rules

1. Evidence is the primary output. The answer is a readable view over that evidence.
2. Local-only and extractive behavior must remain visible.
3. Weak retrieval produces a clear refusal, not conversational filler.
4. Controls shown in the interface must change the real backend behavior.
5. Corpus writes require safe plain filenames and UTF-8 text.
6. The supported surface is desktop only.

## Core workflows

- Query: ask a question, adjust Top K, inspect the answer, open a citation, and revisit local history.
- Corpus: add, replace, read, filter, and delete `.txt` sources. Every mutation can rebuild the index.
- Index: set chunk size and overlap, rebuild, and verify active values through health metadata.
- Checks: run four transparent Top-1 source expectations against the included demo corpus.

## Voice and visual direction

The interface should feel like a forensic retrieval console: quiet, precise, and operational. A graphite shell, thin structural dividers, amber signal color, IBM Plex Sans, and IBM Plex Mono create hierarchy without decorative effects.

Interface copy uses short, literal language. It avoids assistant personas, marketing claims, fake model controls, and unsupported accuracy language.

## Boundaries

- No external LLM, embedding API, telemetry, auth, or cloud store.
- No semantic guarantee beyond TF-IDF word and phrase overlap.
- No persistent vector index or incremental indexing.
- No phone layout, hamburger navigation, mobile drawer, or touch-first workflow.
- The four-case check is a regression signal for the included corpus, not a benchmark.
