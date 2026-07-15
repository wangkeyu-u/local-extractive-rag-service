import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
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
  FileText,
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
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
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
        <button className="brand" type="button" onClick={() => onNavigate("ask")}>
          <span className="brand-symbol" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>
            <strong>GROUNDLINE</strong>
            <small>LOCAL RAG / 01</small>
          </span>
        </button>
      </div>

      <div className="workspace-card">
        <span className="workspace-monogram">AQ</span>
        <span>
          <small>ACTIVE CORPUS</small>
          <strong>AquaNote policies</strong>
        </span>
        <ChevronRight size={16} />
      </div>

      <nav className="primary-nav" aria-label="Primary navigation">
        <p>WORKBENCH</p>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              type="button"
              key={item.id}
              className={activeView === item.id ? "is-active" : ""}
              onClick={() => onNavigate(item.id)}
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
          <span>{health ? "LOCAL API ONLINE" : "API OFFLINE"}</span>
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
          <strong>No model calls</strong>
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
    ask: ["Answer desk", "Query the evidence"],
    library: ["Corpus library", "Inspect indexed material"],
    evaluate: ["Retrieval lab", "Measure before you trust"],
  };
  return (
    <header className="topbar">
      <div className="topbar-title">
        <span>{titles[activeView][0]}</span>
        <i>/</i>
        <strong>{titles[activeView][1]}</strong>
      </div>
      <div className="topbar-actions">
        <span className="local-pill"><span /> LOCAL ONLY</span>
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
        <span />
        <FileSearch size={23} />
      </div>
      <strong>No trace yet</strong>
      <p>Ask a question and the exact supporting chunks will appear here.</p>
      <div className="mini-pipeline">
        <span>QUERY</span><i /><span>RANK</span><i /><span>QUOTE</span>
      </div>
    </div>
  );
}

function EvidencePanel({ open, evidence, selected, onSelect, onClose }) {
  return (
    <aside className={`evidence-panel ${open ? "is-open" : ""}`}>
      <div className="evidence-header">
        <div>
          <small>RETRIEVAL TRACE</small>
          <strong>Supporting evidence</strong>
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
                <small>TOP SCORE</small>
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
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{chunk.source}</strong>
                    <em>{formatScore(chunk.score)}</em>
                  </header>
                  <p><HighlightedText text={chunk.text} terms={chunk.matched_terms} /></p>
                  <footer>
                    <span>CHUNK {chunk.chunk_id + 1}</span>
                    <span>RANK {chunk.rank}</span>
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
            <div className="section-kicker"><span /> EVIDENCE DESK · LIVE</div>
            <div className="hero-row">
              <div>
                <h1>Answers with a<br /><em>paper trail.</em></h1>
                <p>Local retrieval, extractive answers, and the source text beside every claim.</p>
              </div>
              <div className="evidence-stamp">
                <small>BUILT FOR</small>
                <strong>PROOF</strong>
                <span>NOT PLAUSIBILITY</span>
              </div>
            </div>
            <div className="metric-strip">
              <div><small>DOCUMENTS</small><strong>{String(documents.length).padStart(2, "0")}</strong><span>readable sources</span></div>
              <div><small>INDEXED CHUNKS</small><strong>{String(health?.chunks_indexed || 0).padStart(2, "0")}</strong><span>in memory</span></div>
              <div><small>CORPUS WORDS</small><strong>{formatNumber(totalWords)}</strong><span>local text</span></div>
              <div className="metric-promise"><ShieldCheck size={21} /><span><strong>Zero outbound calls</strong><small>Deterministic local pipeline</small></span></div>
            </div>
          </section>

          <form className="query-composer" onSubmit={onAsk}>
            <div className="composer-label">
              <span><MessageSquare size={17} /> YOUR QUESTION</span>
              <span className={health?.index_ready ? "ready" : ""}><i />{health?.index_ready ? "INDEX READY" : "INDEX PENDING"}</span>
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
              <span className="keyboard-hint">↵ ASK · ⇧↵ NEW LINE</span>
              <button className="ask-button" type="submit" disabled={isAsking || !question.trim() || !health?.index_ready}>
                {isAsking ? <Loader2 className="spin" size={17} /> : <Search size={17} />}
                {isAsking ? "Searching…" : "Retrieve answer"}
              </button>
            </div>
          </form>

          <div className="example-row">
            <span>TRY</span>
            {exampleQuestions.map((example, index) => (
              <button type="button" key={example} onClick={() => onExample(example)}>
                <small>0{index + 1}</small>{example}<ArrowRight size={14} />
              </button>
            ))}
          </div>

          <section className={`answer-card ${answerState ? "has-answer" : ""}`} aria-live="polite">
            <header>
              <div><Sparkles size={18} /><span>GROUNDED ANSWER</span></div>
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
                <div className="placeholder-index">A/01</div>
                <div><strong>Ask the corpus, not a model.</strong><p>The answer will be assembled from matching source sentences and linked back to exact chunks.</p></div>
              </div>
            )}
          </section>

          {history.length ? (
            <section className="history-section">
              <div className="history-heading"><span><History size={16} /> RECENT QUERIES</span><small>Stored in this browser</small></div>
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
          <div className="section-kicker"><span /> CORPUS LIBRARY · 02</div>
          <h1>Know what the index<br /><em>actually knows.</em></h1>
          <p>A read-only inventory of every plain-text source used to answer questions.</p>
        </div>
        <button className="primary-button" type="button" onClick={onReindex} disabled={isIndexing}>
          {isIndexing ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
          {isIndexing ? "Indexing…" : "Rebuild index"}
        </button>
      </div>

      <div className="library-metrics">
        <div><small>FILES</small><strong>{documents.length}</strong><span>plain-text documents</span></div>
        <div><small>WORDS</small><strong>{formatNumber(totalWords)}</strong><span>searchable terms</span></div>
        <div><small>CHARACTERS</small><strong>{formatNumber(totalCharacters)}</strong><span>source material</span></div>
        <div><small>LAST INDEX</small><strong>{health?.indexed_at ? "READY" : "—"}</strong><span>{formatTime(health?.indexed_at)}</span></div>
      </div>

      <div className="library-toolbar">
        <label><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter source files…" /></label>
        <span>{visibleDocuments.length} / {documents.length} SOURCES</span>
      </div>

      <div className="document-table">
        <div className="document-row table-head">
          <span>SOURCE</span><span>WORDS</span><span>CHUNKS</span><span>SIZE</span><span>STATUS</span>
        </div>
        {visibleDocuments.map((document, index) => (
          <article className="document-row" key={document.source}>
            <div className="document-title"><span>TXT</span><div><strong>{document.source}</strong><small>docs/{document.source}</small></div></div>
            <span>{formatNumber(document.words)}</span>
            <span>{document.chunks}</span>
            <span>{formatNumber(document.characters)} chars</span>
            <span className="document-ready"><i /> INDEXED</span>
            <em>{String(index + 1).padStart(2, "0")}</em>
          </article>
        ))}
      </div>

      <div className="library-guide">
        <div><Terminal size={20} /><span><small>ADD MATERIAL</small><strong>Drop a UTF-8 .txt file into <code>docs/</code></strong></span></div>
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
          <div className="section-kicker"><span /> RETRIEVAL LAB · 03</div>
          <h1>Measure retrieval<br /><em>before trust.</em></h1>
          <p>Four transparent golden questions test whether the right source reaches rank one.</p>
        </div>
        <button className="primary-button" type="button" onClick={onRun} disabled={running || !health?.index_ready}>
          {running ? <Loader2 className="spin" size={17} /> : <FlaskConical size={17} />}
          {running ? "Running cases…" : "Run evaluation"}
        </button>
      </div>

      <div className="evaluation-overview">
        <div className="score-card">
          <div className="score-ring" style={{ "--score-angle": `${(score || 0) * 3.6}deg` }}>
            <span><strong>{score ?? "—"}</strong><small>{score === null ? "NOT RUN" : "/ 100"}</small></span>
          </div>
          <div><small>RETRIEVAL HEALTH</small><h2>{score === null ? "Awaiting a baseline" : score >= 75 ? "Index is healthy" : "Tune the corpus"}</h2><p>Top-1 source accuracy across the built-in golden set.</p></div>
        </div>
        <div className="evaluation-stats">
          <div><BarChart3 size={18} /><span><small>AVG. SCORE</small><strong>{averageScore === null ? "—" : `${averageScore}%`}</strong></span></div>
          <div><Zap size={18} /><span><small>PASSED</small><strong>{completed ? `${passed} / ${completed}` : "—"}</strong></span></div>
          <div><Database size={18} /><span><small>INDEX</small><strong>{health?.chunks_indexed || 0} chunks</strong></span></div>
          <div><ShieldCheck size={18} /><span><small>METHOD</small><strong>Top-1 match</strong></span></div>
        </div>
      </div>

      <div className="evaluation-table">
        <div className="evaluation-row evaluation-head"><span>GOLDEN QUESTION</span><span>EXPECTED SOURCE</span><span>TOP RESULT</span><span>OUTCOME</span></div>
        {evaluationCases.map((testCase, index) => {
          const result = results[index];
          return (
            <article className="evaluation-row" key={testCase.question}>
              <div><small>CASE {String(index + 1).padStart(2, "0")}</small><strong>{testCase.question}</strong></div>
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
        <header><div><small>RETRIEVAL SETTINGS</small><h2>Keep it legible.</h2></div><IconButton label="Close settings" onClick={onClose}><X size={18} /></IconButton></header>
        <div className="settings-explainer"><Layers3 size={20} /><p>This project intentionally exposes one query-time control. Chunking and thresholds stay in code so the assessment remains predictable and easy to explain.</p></div>
        <label className="settings-range">
          <span><strong>Top K evidence chunks</strong><small>Maximum candidates retrieved for each question.</small></span>
          <em>{topK}</em>
          <input type="range" min="1" max="8" value={topK} onChange={(event) => onTopK(Number(event.target.value))} />
        </label>
        <div className="pipeline-settings">
          <div><small>CHUNK SIZE</small><strong>200 words</strong><span>fixed at indexing</span></div>
          <div><small>OVERLAP</small><strong>40 words</strong><span>fixed at indexing</span></div>
          <div><small>MIN SCORE</small><strong>0.12</strong><span>refusal threshold</span></div>
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
      <div className="edition-mark" aria-hidden="true">LOCAL / EXTRACTIVE / 2026</div>
    </div>
  );
}
