# Offline benchmark results

> **CURATED FIXTURE ONLY.** Synthetic regression fixture; not production or representative quality evidence. These metrics must not be extrapolated beyond this benchmark.

- Benchmark: `local-rag-curated-fixture-v1`
- Samples: 12 single-hop, 6 multi-hop, 3 unanswerable
- Corpus SHA-256: `f2df4e34c663f7f47f0562b788d333ebe2f0fb58b77de12ad06bae87140693a2`
- Ground truth SHA-256: `c5f1f56688b3be23b96af20947ff13f0e7f849fe6d22ed0efad9169b100c50dd`
- Embedding: `deterministic-hash-v1-384`
- Gate: **PASS**

| Metric | Actual | Threshold | Gate |
|---|---:|---:|---|
| `single_recall_at_5` | 1.000000 | 1.000000 | PASS |
| `rrf_mrr_at_5` | 1.000000 | 0.900000 | PASS |
| `multi_evidence_coverage_at_8` | 1.000000 | 1.000000 | PASS |
| `sentence_citation_coverage` | 1.000000 | 1.000000 | PASS |
| `sentence_citation_precision` | 1.000000 | 1.000000 | PASS |
| `abstention_accuracy` | 1.000000 | 1.000000 | PASS |
