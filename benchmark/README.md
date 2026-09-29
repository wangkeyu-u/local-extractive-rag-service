# Curated fixture benchmark

This is a synthetic, versioned fixture for deterministic offline regression testing. It is not a sample of production traffic and cannot support claims about general RAG quality.

- 12 single-hop questions
- 6 multi-hop questions
- 3 unanswerable questions
- 2 generated PDFs, 2 Markdown documents, and 3 plain-text documents

The retriever indexes only `corpus/`. Ground truth is kept separately in `ground_truth.json` and contains source/page/section evidence locators, never chunk IDs or expected answer text.
