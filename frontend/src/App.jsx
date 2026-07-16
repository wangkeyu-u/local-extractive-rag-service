import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  Clipboard,
  Clock3,
  Copy,
  Database,
  FileSearch,
  FlaskConical,
  Gauge,
  History,
  Layers3,
  Library,
  Loader2,
  MessageSquare,
  Moon,
  PanelRight,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sun,
  Terminal,
  X,
  Zap,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
const HISTORY_KEY = "groundline.query-history";

const exampleQuestions = [
  "What is the refund policy?",
  "How long does standard shipping take?",
  "Does the company sell customer data?",
  "When is support available?",
];

const evaluationCases = [
  { question: "What is the refund window?", expected: "refund_policy.txt" },
  { question: "How long does express shipping take?", expected: "shipping_policy.txt" },
  { question: "Are customer notes private?", expected: "privacy_policy.txt" },
  { question: "What is AquaNote?", expected: "product_overview.txt" },
];

const navItems = [
  { id: "ask", label: "Ask", hint: "⌘ 1", icon: MessageSquare },
  { id: "library", label: "Library", hint: "⌘ 2", icon: Library },
  { id: "evaluate", label: "Evaluate", hint: "⌘ 3", icon: FlaskConical },
];

function readHistory() {
  try {
    return JSON.parse(window.localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(history) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 12)));
  } catch {
    // The app still works when browser storage is unavailable.
  }
}

function formatScore(score) {
  return `${Math.round((score || 0) * 100)}%`;
}

function formatNumber(number) {
  return Number(number || 0).toLocaleString();
}

function formatTime(value) {
  if (!value) return "Not indexed";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function readApiError(response) {
  try {
    const payload = await response.json();
    return payload.detail || payload.message || "Request failed.";
  } catch {
    return "Request failed.";
  }
}

async function api(path, options) {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json();
}

function IconButton({ label, children, active = false, onClick }) {
  return (
    <button
      className={`icon-button ${active ? "is-active" : ""}`}
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function ConfidenceBadge({ confidence }) {
  const labels = {
    high: "High confidence",
    medium: "Medium confidence",
    low: "Low confidence",
    insufficient: "Insufficient evidence",
  };
  return (
    <span className={`confidence-badge ${confidence || "idle"}`}>
      <i />
      {labels[confidence] || "Awaiting query"}
    </span>
  );
}

function AnswerText({ answer, evidence, onCitation }) {
  if (!answer) return null;
  return answer.split(/(\[\d+\])/g).map((part, index) => {
    const match = part.match(/^\[(\d+)\]$/);
    const chunk = match ? evidence[Number(match[1]) - 1] : null;
    return chunk ? (
      <button
        className="citation"
        type="button"
        key={`${part}-${index}`}
        onClick={() => onCitation(chunk)}
      >
        {match[1]}
      </button>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    );
  });
}

function HighlightedText({ text, terms }) {
  const normalizedTerms = [...new Set(terms || [])].filter(Boolean);
  if (!normalizedTerms.length) return text;
  const escaped = normalizedTerms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  return text.split(pattern).map((part, index) =>
    normalizedTerms.some((term) => term.toLowerCase() === part.toLowerCase()) ? (
      <mark key={`${part}-${index}`}>{part}</mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
}

function Sidebar({
  activeView,
  health,
  documents,
  onNavigate,
  onReindex,
  isIndexing,
}) {
  return (
    <aside className="sidebar">
      <div className="brand-row">
        <button className="brand" type="button" onClick={() => onNavigate("ask")} aria-label="Open Ask workspace" title="Groundline">
          <span className="brand-symbol" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>
            <strong>GROUNDLINE</strong>
            <small>Evidence workspace</small>
          </span>
        </button>
      </div>

      <div className="workspace-card">
        <span className="workspace-monogram">AQ</span>
        <span>
          <small>Active corpus</small>
          <strong>AquaNote policies</strong>
        </span>
        <ChevronRight size={16} />
      </div>

      <nav className="primary-nav" aria-label="Primary navigation">
        <p>Workspace</p>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              type="button"
              key={item.id}
              className={activeView === item.id ? "is-active" : ""}
              onClick={() => onNavigate(item.id)}
              aria-label={item.label}
              title={item.label}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              <small>{item.hint}</small>
            </button>
          );
        })}
      </nav>

      <section className="index-card">
        <div className="index-card-heading">
          <span className={health?.index_ready ? "status-dot online" : "status-dot"} />
          <span>{health ? "Local API online" : "API offline"}</span>
        </div>
        <strong>{health?.index_ready ? "Evidence is ready." : "Index required."}</strong>
        <p>
          {health
            ? `${health.documents_indexed || documents.length} documents · ${health.chunks_indexed} chunks`
            : "Start FastAPI on port 8000 to connect the workspace."}
        </p>
        <button type="button" onClick={onReindex} disabled={isIndexing || !health}>
          {isIndexing ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
          {isIndexing ? "Building index…" : "Rebuild local index"}
        </button>
      </section>

      <div className="privacy-note">
        <ShieldCheck size={18} />
        <span>
          <strong>Local and extractive</strong>
          <small>Documents never leave this machine.</small>
        </span>
      </div>

      <div className="sidebar-footer">
        <Terminal size={15} />
        <span>FastAPI · TF-IDF · Extractive</span>
      </div>
    </aside>
  );
}

function Topbar({
  activeView,
  theme,
  evidenceOpen,
  onTheme,
  onEvidence,
  onSettings,
}) {
  const titles = {
    ask: ["Ask", "Evidence workspace"],
    library: ["Library", "Indexed material"],
    evaluate: ["Evaluate", "Retrieval checks"],
  };
  return (
    <header className="topbar">
      <div className="topbar-title">
        <span>{titles[activeView][0]}</span>
        <i>/</i>
        <strong>{titles[activeView][1]}</strong>
      </div>
      <div className="topbar-actions">
        <span className="local-pill"><span /> Local only</span>
        <IconButton label="Retrieval settings" onClick={onSettings}>
          <Settings2 size={17} />
        </IconButton>
        <IconButton label={theme === "light" ? "Use dark theme" : "Use light theme"} onClick={onTheme}>
          {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
        </IconButton>
        {activeView === "ask" ? (
          <IconButton label="Toggle evidence panel" active={evidenceOpen} onClick={onEvidence}>
            <PanelRight size={17} />
          </IconButton>
        ) : null}
      </div>
    </header>
  );
}

function EmptyEvidence() {
  return (
    <div className="empty-evidence">
      <div className="retrieval-orbit">
        <FileSearch size={23} />
      </div>
      <strong>No evidence yet</strong>
      <p>Run a query to inspect ranked chunks, matched terms, and source metadata.</p>
      <div className="mini-pipeline">
        <span>Query</span><i /><span>Rank</span><i /><span>Inspect</span>
      </div>
    </div>
  );
}

function EvidencePanel({ open, evidence, selected, onSelect, onClose }) {
  return (
    <aside className={`evidence-panel ${open ? "is-open" : ""}`}>
      <div className="evidence-header">
        <div>
          <small>Retrieval trace</small>
          <strong>Evidence</strong>
        </div>
        <IconButton label="Close evidence" onClick={onClose}><X size={17} /></IconButton>
      </div>
      <div className="evidence-tabs">
        <button className="is-active" type="button">Evidence <span>{evidence.length}</span></button>
        <span>{evidence.length ? `${new Set(evidence.map((item) => item.source)).size} sources` : "Waiting"}</span>
      </div>
      <div className="evidence-scroll">
        {!evidence.length ? (
          <EmptyEvidence />
        ) : (
          <>
            <div className="evidence-summary">
              <div>
                <small>Top similarity</small>
                <strong>{formatScore(evidence[0].score)}</strong>
              </div>
              <p>{evidence.length} grounded chunks ranked by local TF-IDF similarity.</p>
            </div>
            <div className="evidence-list">
              {evidence.map((chunk, index) => (
                <button
                  type="button"
                  key={`${chunk.source}-${chunk.chunk_id}`}
                  className={`evidence-card ${selected === chunk ? "is-selected" : ""}`}
                  onClick={() => onSelect(chunk)}
                >
                  <header>
                    <span>{index + 1}</span>
                    <strong>{chunk.source}</strong>
                    <em>{formatScore(chunk.score)}</em>
                  </header>
                  <p><HighlightedText text={chunk.text} terms={chunk.matched_terms} /></p>
                  <footer>
                    <span>Chunk {chunk.chunk_id + 1}</span>
                    <span>Rank {chunk.rank}</span>
                    <ArrowRight size={14} />
                  </footer>
                  {selected === chunk && chunk.matched_terms?.length ? (
                    <div className="matched-terms">
                      {chunk.matched_terms.map((term) => <span key={term}>{term}</span>)}
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function AskView({
  question,
  topK,
  health,
  documents,
  answerState,
  responseMs,
  history,
  isAsking,
  onQuestion,
  onTopK,
  onAsk,
  onExample,
  onCitation,
  onCopy,
  onHistory,
}) {
  const evidence = answerState?.chunks || answerState?.sources || [];
  const totalWords = documents.reduce((sum, document) => sum + document.words, 0);
  return (
    <section className="ask-view">
      <div className="ask-scroll">
        <div className="ask-container">
          <section className="ask-hero">
            <div className="hero-row">
              <div>
                <h1>Ask the local corpus</h1>
                <p>Retrieve an extractive answer, then verify it against the ranked source text.</p>
              </div>
              <div className={`workspace-readiness ${health?.index_ready ? "is-ready" : ""}`}>
                <span />
                <div>
                  <strong>{health?.index_ready ? "Index ready" : "Index pending"}</strong>
                  <small>{health ? `${documents.length} sources · ${health.chunks_indexed || 0} chunks` : "Waiting for local API"}</small>
                </div>
              </div>
            </div>
            <div className="metric-strip">
              <div><small>Sources</small><strong>{documents.length}</strong></div>
              <div><small>Chunks</small><strong>{health?.chunks_indexed || 0}</strong></div>
              <div><small>Corpus</small><strong>{formatNumber(totalWords)} words</strong></div>
              <div className="metric-promise"><ShieldCheck size={17} /><span><strong>No outbound calls</strong><small>TF-IDF · extractive</small></span></div>
            </div>
          </section>

          <form className="query-composer" onSubmit={onAsk}>
            <div className="composer-label">
              <span><MessageSquare size={17} /> Question</span>
              <span className={health?.index_ready ? "ready" : ""}><i />{health?.index_ready ? "Ready" : "Pending"}</span>
            </div>
            <textarea
              value={question}
              onChange={(event) => onQuestion(event.target.value)}
              placeholder="Ask something covered by docs/*.txt"
              rows={3}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div className="composer-footer">
              <div className="top-k-control">
                <Settings2 size={15} />
                <span>TOP K</span>
                <input type="range" min="1" max="8" value={topK} onChange={(event) => onTopK(Number(event.target.value))} />
                <strong>{topK}</strong>
              </div>
              <span className="keyboard-hint">Enter to retrieve · Shift+Enter for a new line</span>
              <button className="ask-button" type="submit" disabled={isAsking || !question.trim() || !health?.index_ready}>
                {isAsking ? <Loader2 className="spin" size={17} /> : <Search size={17} />}
                {isAsking ? "Searching…" : "Retrieve answer"}
              </button>
            </div>
          </form>

          <div className="example-row">
            <span>Examples</span>
            {exampleQuestions.map((example) => (
              <button type="button" key={example} onClick={() => onExample(example)}>
                {example}<ArrowRight size={14} />
              </button>
            ))}
          </div>

          <section className={`answer-card ${answerState ? "has-answer" : ""}`} aria-live="polite">
            <header>
              <div><FileSearch size={18} /><span>Extractive answer</span></div>
              <div className="answer-actions">
                <ConfidenceBadge confidence={answerState?.confidence} />
                {answerState ? <IconButton label="Copy answer" onClick={onCopy}><Copy size={16} /></IconButton> : null}
              </div>
            </header>
            {answerState ? (
              <>
                <div className="answer-copy">
                  <AnswerText answer={answerState.answer} evidence={evidence} onCitation={onCitation} />
                </div>
                <footer>
                  <span><Clock3 size={14} /> {responseMs} ms round trip</span>
                  <span><Gauge size={14} /> {answerState.retrieval_ms} ms retrieval</span>
                  <span><BookOpen size={14} /> {evidence.length} evidence chunks</span>
                  <span><ShieldCheck size={14} /> extractive only</span>
                </footer>
              </>
            ) : (
              <div className="answer-placeholder">
                <div className="placeholder-index"><Search size={20} /></div>
                <div><strong>Ready to retrieve</strong><p>The answer will use matching source sentences and cite the exact chunks used.</p></div>
              </div>
            )}
          </section>

          {history.length ? (
            <section className="history-section">
              <div className="history-heading"><span><History size={16} /> Recent queries</span><small>Stored in this browser</small></div>
              <div className="history-list">
                {history.slice(0, 4).map((item, index) => (
                  <button type="button" key={item.id} onClick={() => onHistory(item)}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{item.question}</strong>
                    <small>{item.response.confidence} · {item.elapsed} ms</small>
                    <ChevronRight size={15} />
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function LibraryView({ documents, health, isIndexing, onReindex }) {
  const [search, setSearch] = useState("");
  const visibleDocuments = documents.filter((document) =>
    document.source.toLowerCase().includes(search.toLowerCase()),
  );
  const totalWords = documents.reduce((sum, document) => sum + document.words, 0);
  const totalCharacters = documents.reduce((sum, document) => sum + document.characters, 0);
  return (
    <section className="page-view library-view">
      <div className="page-heading">
        <div>
          <h1>Corpus library</h1>
          <p>Inspect every plain-text source currently available to retrieval.</p>
        </div>
        <button className="primary-button" type="button" onClick={onReindex} disabled={isIndexing}>
          {isIndexing ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
          {isIndexing ? "Indexing…" : "Rebuild index"}
        </button>
      </div>

      <div className="library-metrics">
        <div><small>Files</small><strong>{documents.length}</strong><span>plain-text documents</span></div>
        <div><small>Words</small><strong>{formatNumber(totalWords)}</strong><span>searchable terms</span></div>
        <div><small>Characters</small><strong>{formatNumber(totalCharacters)}</strong><span>source material</span></div>
        <div><small>Last index</small><strong>{health?.indexed_at ? "Ready" : "—"}</strong><span>{formatTime(health?.indexed_at)}</span></div>
      </div>

      <div className="library-toolbar">
        <label><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter source files…" /></label>
        <span>{visibleDocuments.length} / {documents.length} sources</span>
      </div>

      <div className="document-table">
        <div className="document-row table-head">
          <span>Source</span><span>Words</span><span>Chunks</span><span>Size</span><span>Status</span>
        </div>
        {visibleDocuments.map((document, index) => (
          <article className="document-row" key={document.source}>
            <div className="document-title"><span>TXT</span><div><strong>{document.source}</strong><small>docs/{document.source}</small></div></div>
            <span>{formatNumber(document.words)}</span>
            <span>{document.chunks}</span>
            <span>{formatNumber(document.characters)} chars</span>
            <span className="document-ready"><i /> Indexed</span>
            <em>{index + 1}</em>
          </article>
        ))}
      </div>

      <div className="library-guide">
        <div><Terminal size={20} /><span><small>Add material</small><strong>Drop a UTF-8 .txt file into <code>docs/</code></strong></span></div>
        <p>Then rebuild the index. Files remain local and the in-memory matrix is replaced atomically.</p>
        <code>cp your-file.txt docs/ && make run</code>
      </div>
    </section>
  );
}

function EvaluationView({ health, results, running, onRun }) {
  const completed = results.length;
  const passed = results.filter((result) => result.passed).length;
  const score = completed ? Math.round((passed / completed) * 100) : null;
  const averageScore = completed
    ? Math.round((results.reduce((sum, result) => sum + (result.topScore || 0), 0) / completed) * 100)
    : null;
  return (
    <section className="page-view evaluation-view">
      <div className="page-heading">
        <div>
          <h1>Retrieval evaluation</h1>
          <p>Run four transparent golden questions and check which source reaches rank one.</p>
        </div>
        <button className="primary-button" type="button" onClick={onRun} disabled={running || !health?.index_ready}>
          {running ? <Loader2 className="spin" size={17} /> : <FlaskConical size={17} />}
          {running ? "Running cases…" : "Run evaluation"}
        </button>
      </div>

      <div className="evaluation-overview">
        <div className="score-card">
          <div className="score-ring">
            <span><strong>{score ?? "—"}</strong><small>{score === null ? "NOT RUN" : "/ 100"}</small></span>
          </div>
          <div><small>Retrieval health</small><h2>{score === null ? "Awaiting a baseline" : score >= 75 ? "Index is healthy" : "Tune the corpus"}</h2><p>Top-1 source accuracy across the built-in golden set.</p></div>
        </div>
        <div className="evaluation-stats">
          <div><BarChart3 size={18} /><span><small>Average score</small><strong>{averageScore === null ? "—" : `${averageScore}%`}</strong></span></div>
          <div><Zap size={18} /><span><small>Passed</small><strong>{completed ? `${passed} / ${completed}` : "—"}</strong></span></div>
          <div><Database size={18} /><span><small>Index</small><strong>{health?.chunks_indexed || 0} chunks</strong></span></div>
          <div><ShieldCheck size={18} /><span><small>Method</small><strong>Top-1 match</strong></span></div>
        </div>
      </div>

      <div className="evaluation-table">
        <div className="evaluation-row evaluation-head"><span>Golden question</span><span>Expected source</span><span>Top result</span><span>Outcome</span></div>
        {evaluationCases.map((testCase, index) => {
          const result = results[index];
          return (
            <article className="evaluation-row" key={testCase.question}>
              <div><small>Case {index + 1}</small><strong>{testCase.question}</strong></div>
              <span>{testCase.expected}</span>
              <span>{result?.actual || "Not run"}{result ? <small>{formatScore(result.topScore)}</small> : null}</span>
              <span className={result ? (result.passed ? "pass" : "review") : "pending"}>
                {running && !result ? <Loader2 className="spin" size={14} /> : result?.passed ? <Check size={14} /> : result ? <CircleAlert size={14} /> : <span />}
                {result ? (result.passed ? "PASS" : "REVIEW") : "PENDING"}
              </span>
            </article>
          );
        })}
      </div>

      <div className="evaluation-note">
        <Clipboard size={19} />
        <p><strong>What this proves:</strong> the correct document is ranked first for representative questions. It does not measure answer fluency or semantic recall beyond this small corpus.</p>
      </div>
    </section>
  );
}

function SettingsDialog({ topK, onTopK, onClose }) {
  useEffect(() => {
    const closeOnEscape = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-label="Retrieval settings" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><small>Retrieval settings</small><h2>Query controls</h2></div><IconButton label="Close settings" onClick={onClose}><X size={18} /></IconButton></header>
        <div className="settings-explainer"><Layers3 size={20} /><p>This project intentionally exposes one query-time control. Chunking and thresholds stay in code so the assessment remains predictable and easy to explain.</p></div>
        <label className="settings-range">
          <span><strong>Top K evidence chunks</strong><small>Maximum candidates retrieved for each question.</small></span>
          <em>{topK}</em>
          <input type="range" min="1" max="8" value={topK} onChange={(event) => onTopK(Number(event.target.value))} />
        </label>
        <div className="pipeline-settings">
          <div><small>Chunk size</small><strong>200 words</strong><span>fixed at indexing</span></div>
          <div><small>Overlap</small><strong>40 words</strong><span>fixed at indexing</span></div>
          <div><small>Minimum score</small><strong>0.12</strong><span>refusal threshold</span></div>
        </div>
        <footer><span><ShieldCheck size={15} /> Settings stay in this browser.</span><button type="button" onClick={onClose}>Done <Check size={15} /></button></footer>
      </section>
    </div>
  );
}

export default function App() {
  const booted = useRef(false);
  const [activeView, setActiveView] = useState("ask");
  const [question, setQuestion] = useState(exampleQuestions[0]);
  const [topK, setTopK] = useState(3);
  const [documents, setDocuments] = useState([]);
  const [health, setHealth] = useState(null);
  const [answerState, setAnswerState] = useState(null);
  const [responseMs, setResponseMs] = useState(null);
  const [history, setHistory] = useState(readHistory);
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [evaluationResults, setEvaluationResults] = useState([]);
  const [isBooting, setIsBooting] = useState(true);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [theme, setTheme] = useState(() => window.localStorage.getItem("groundline.theme") || "light");

  const evidence = useMemo(
    () => answerState?.chunks || answerState?.sources || [],
    [answerState],
  );

  async function loadSnapshot({ autoIndex = false } = {}) {
    setError("");
    try {
      const [nextHealth, documentPayload] = await Promise.all([
        api("/health"),
        api("/documents"),
      ]);
      setHealth(nextHealth);
      setDocuments(documentPayload.documents || []);
      if (autoIndex && !nextHealth.index_ready && documentPayload.documents?.length) {
        await rebuildIndex({ quiet: true });
      }
    } catch (requestError) {
      setHealth(null);
      setDocuments([]);
      setError(requestError.message);
    } finally {
      setIsBooting(false);
    }
  }

  async function rebuildIndex({ quiet = false } = {}) {
    setIsIndexing(true);
    setError("");
    try {
      await api("/index", { method: "POST" });
      const [nextHealth, documentPayload] = await Promise.all([
        api("/health"),
        api("/documents"),
      ]);
      setHealth(nextHealth);
      setDocuments(documentPayload.documents || []);
      setEvaluationResults([]);
      if (!quiet) setNotice("Local index rebuilt successfully.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsIndexing(false);
    }
  }

  async function askQuestion(event, overrideQuestion) {
    event?.preventDefault();
    const cleanQuestion = (overrideQuestion || question).trim();
    if (!cleanQuestion || isAsking) return;
    setQuestion(cleanQuestion);
    setIsAsking(true);
    setError("");
    const startedAt = performance.now();
    try {
      const response = await api("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: cleanQuestion, top_k: Number(topK) }),
      });
      const elapsed = Math.max(1, Math.round(performance.now() - startedAt));
      setAnswerState(response);
      setResponseMs(elapsed);
      setSelectedEvidence(response.chunks?.[0] || null);
      setEvidenceOpen(true);
      const entry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        question: cleanQuestion,
        response,
        elapsed,
        createdAt: new Date().toISOString(),
      };
      setHistory((current) => {
        const next = [entry, ...current.filter((item) => item.question !== cleanQuestion)].slice(0, 12);
        saveHistory(next);
        return next;
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsAsking(false);
    }
  }

  async function runEvaluation() {
    setIsEvaluating(true);
    setEvaluationResults([]);
    setError("");
    try {
      const results = [];
      for (const testCase of evaluationCases) {
        const response = await api("/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: testCase.question, top_k: 3 }),
        });
        const first = response.chunks?.[0];
        results.push({
          actual: first?.source || "No evidence",
          topScore: first?.score || 0,
          passed: first?.source === testCase.expected,
        });
        setEvaluationResults([...results]);
      }
      setNotice(`Evaluation complete: ${results.filter((result) => result.passed).length}/${results.length} passed.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsEvaluating(false);
    }
  }

  function openHistory(item) {
    setQuestion(item.question);
    setAnswerState(item.response);
    setResponseMs(item.elapsed);
    setSelectedEvidence(item.response.chunks?.[0] || null);
    setEvidenceOpen(true);
  }

  function copyAnswer() {
    if (!answerState?.answer) return;
    navigator.clipboard.writeText(answerState.answer).then(() => setNotice("Answer copied to clipboard."));
  }

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    loadSnapshot({ autoIndex: true });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("groundline.theme", theme);
  }, [theme]);

  useEffect(() => {
    const onShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && ["1", "2", "3"].includes(event.key)) {
        event.preventDefault();
        setActiveView(["ask", "library", "evaluate"][Number(event.key) - 1]);
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  return (
    <div className="app-shell">
      <Sidebar
        activeView={activeView}
        health={health}
        documents={documents}
        onNavigate={setActiveView}
        onReindex={() => rebuildIndex()}
        isIndexing={isIndexing}
      />
      <main className="main-shell">
        <Topbar
          activeView={activeView}
          theme={theme}
          evidenceOpen={evidenceOpen}
          onTheme={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
          onEvidence={() => setEvidenceOpen((current) => !current)}
          onSettings={() => setSettingsOpen(true)}
        />
        {error ? (
          <div className="error-banner" role="alert">
            <CircleAlert size={17} />
            <span><strong>Workspace error</strong>{error}</span>
            <button type="button" onClick={() => loadSnapshot()}><RefreshCw size={15} /> Retry</button>
          </div>
        ) : null}
        {activeView === "ask" ? (
          <div className={`ask-layout ${evidenceOpen ? "with-evidence" : ""}`}>
            <AskView
              question={question}
              topK={topK}
              health={health}
              documents={documents}
              answerState={answerState}
              responseMs={responseMs}
              history={history}
              isAsking={isAsking || isBooting}
              onQuestion={setQuestion}
              onTopK={setTopK}
              onAsk={askQuestion}
              onExample={(example) => askQuestion(null, example)}
              onCitation={(chunk) => {
                setSelectedEvidence(chunk);
                setEvidenceOpen(true);
              }}
              onCopy={copyAnswer}
              onHistory={openHistory}
            />
            <EvidencePanel
              open={evidenceOpen}
              evidence={evidence}
              selected={selectedEvidence}
              onSelect={setSelectedEvidence}
              onClose={() => setEvidenceOpen(false)}
            />
          </div>
        ) : null}
        {activeView === "library" ? (
          <LibraryView documents={documents} health={health} isIndexing={isIndexing} onReindex={() => rebuildIndex()} />
        ) : null}
        {activeView === "evaluate" ? (
          <EvaluationView health={health} results={evaluationResults} running={isEvaluating} onRun={runEvaluation} />
        ) : null}
      </main>
      {settingsOpen ? <SettingsDialog topK={topK} onTopK={setTopK} onClose={() => setSettingsOpen(false)} /> : null}
      {notice ? <div className="toast"><Check size={16} />{notice}</div> : null}
    </div>
  );
}
