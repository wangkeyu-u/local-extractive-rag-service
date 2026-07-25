# Groundline Interface Plan

## Direction

Groundline uses the spatial grammar of a professional desktop operations tool: persistent navigation, a focused working canvas, and a dedicated inspector. The visual concept is a forensic retrieval console rather than a chatbot or marketing dashboard.

The default theme is graphite with a restrained amber signal color. Surfaces are separated by one-pixel dividers instead of floating cards. IBM Plex Sans carries interface text, IBM Plex Mono carries states, scores, identifiers, and settings. Answer and source passages use a reading serif to distinguish evidence from controls.

## Layout

```text
+------------------+--------------------------------------+-------------------+
| corpus rail      | query canvas                         | evidence inspector|
|                  |                                      |                   |
| Query            | question                             | source identity   |
| Corpus           | extraction                           | similarity        |
| Checks           | retrieval trace                      | full passage      |
|                  | ranked passages                      | matched terms     |
| source list      | recent runs                          |                   |
|                  |                                      |                   |
| local status     |                                      |                   |
+------------------+--------------------------------------+-------------------+
```

The application requires at least 1180 pixels of layout width. Narrow browser windows preserve the desktop canvas instead of switching to a phone interface.

## Query workspace

The central canvas follows the order a retrieval reviewer needs:

1. Corpus and index state
2. Question and Top K
3. Extractive answer or refusal
4. Tokenize, vectorize, rank, extract trace
5. Ranked passage ledger
6. Recent browser-local runs

Clicking an answer citation or ranked passage updates the right inspector. The inspector keeps the source name, chunk and rank, similarity, full passage, and matched terms visible together.

## Corpus workspace

The Corpus view is a real source manager, not a read-only inventory. It supports:

- UTF-8 `.txt` selection from the desktop
- replacement confirmation for duplicate names
- source filtering and raw-text preview
- file, word, character, and chunk counts
- deletion confirmation and automatic reindexing
- manual index rebuild

The top readout shows the chunk size and overlap currently reported by the backend.

## Settings

Top K is a query-time value. Chunk size and overlap are index-time values. Applying index-time changes sends them to `POST /index` and waits for the rebuild before closing the dialog.

Invalid overlap stays visibly blocked. The interface also shows the active retrieval method and refusal threshold returned by `/health`.

## Checks workspace

Checks use four versioned questions and expected rank-one sources. Results show expected source, actual source, score, and pass or review state. The surrounding copy states that this is a small regression check, not a general accuracy claim.

## Required states

- API offline
- index empty, building, or ready
- query running
- answer available
- insufficient evidence
- empty inspector
- corpus mutation success or failure
- evaluation pending, running, pass, or review

## Accessibility

- Semantic navigation, main, aside, form, headings, labels, and buttons
- Visible keyboard focus
- Text labels for icon-only controls
- Enter to run and Shift+Enter for a new line
- Cmd or Ctrl plus 1, 2, or 3 for workspace navigation
- Text and icon reinforcement for color-coded states
- Reduced-motion support

## Non-goals

- Phone UI and responsive mobile navigation
- Chat bubbles, model avatars, prompt marketplaces, or conversation personas
- Gradients, glass effects, neon terminal decoration, or excessive rounded cards
- Model selectors or controls without backend support
- Claims of semantic accuracy from the included four-case check
