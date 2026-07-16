# Groundline Product Context

## Product

- **Name:** Groundline
- **Category:** Desktop developer/reviewer tool
- **Purpose:** Let a user query a small local text corpus and verify every extractive answer against ranked source evidence.
- **Primary success condition:** A user can tell whether the index is ready, get a supported answer or a safe refusal, and inspect the exact source, score, rank, and matched terms without leaving the workspace.

## Users

- **Reviewer or interviewer:** needs to understand the retrieval pipeline, privacy boundary, and failure behavior quickly.
- **Developer:** needs retrieval diagnostics such as ranks, similarity scores, matched terms, chunk IDs, latency, and deterministic evaluation cases.
- **Knowledge user:** needs a concise answer with citations and an obvious path to the underlying text.

## Product Principles

1. Evidence is the primary output; the answer is a readable view over that evidence.
2. Local-only and extractive behavior must stay visible and unambiguous.
3. Retrieval uncertainty must be shown as a confidence state or refusal, never hidden behind conversational polish.
4. Dense technical information should be scannable, not decorative.
5. The supported surface is desktop only; no phone navigation, mobile drawer, or mobile-first interaction model.

## Brand and Voice

- **Personality:** rigorous, calm, transparent, precise.
- **Visual register:** a modern evidence console or precision lab, with cool neutral surfaces, a dark navigation rail, and a restrained cobalt action color.
- **Interface copy:** direct, plain language; avoid marketing claims, chatbot persona, and self-congratulatory design commentary.
- **Typography:** one practical sans-serif family for controls, data, headings, and reading text. Use weight, size, spacing, and layout—not ornamental type—to create hierarchy.

## Core Information Architecture

- **Ask:** question composer, answer or refusal, answer diagnostics, ranked evidence, recent local query history.
- **Library:** indexed document inventory and truthful instructions for changing the corpus.
- **Evaluate:** transparent Top-1 golden-set checks with expected and observed sources.
- **Persistent navigation:** corpus identity, API/index state, reindex action, and local-only privacy statement.

## Interaction and Accessibility

- Keyboard-visible focus on all interactive controls.
- Enter submits; Shift+Enter inserts a line break.
- Cmd/Ctrl + 1/2/3 switches between primary views.
- Color is never the only carrier of state.
- Honor `prefers-reduced-motion`.
- Aim for WCAG AA contrast in default and dark themes.

## Anti-references

- Generic AI chat bubbles, glowing model avatars, prompt-gallery cards, or assistant persona language.
- Beige/parchment editorial landing pages and oversized display headlines.
- Glassmorphism, neon terminal styling, decorative gradients, striped stamps, excessive pills, and side-stripe selected states.
- Repeated uppercase eyebrow labels, numbered marketing sections, and hero metric templates.
- Fake upload UI, model selectors, or editable settings that the backend does not support.
- Mobile navigation, hamburger menus, bottom sheets, and phone-specific responsive behavior.

