import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Copy,
  FilePlus2,
  FileSearch,
  FlaskConical,
  Gauge,
  History,
  Library,
  Loader2,
  MessageSquareText,
  Moon,
  PanelRight,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sun,
  Trash2,
  X,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
const HISTORY_KEY = "groundline.query-history";
const THEME_KEY = "groundline.theme";

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

const navigation = [
  { id: "ask", label: "Query", shortcut: "⌘1", icon: MessageSquareText },
  { id: "library", label: "Corpus", shortcut: "⌘2", icon: Library },
  { id: "evaluate", label: "Checks", shortcut: "⌘3", icon: FlaskConical },
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
    // History is optional when browser storage is unavailable.
  }
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatScore(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function formatDate(value) {
  if (!value) return "Never";
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
    if (Array.isArray(payload.detail)) return payload.detail[0]?.msg || "Request failed.";
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

function IconButton({ label, active = false, onClick, children, danger = false }) {
  return (
    <button
      className={`icon-button ${active ? "is-active" : ""} ${danger ? "is-danger" : ""}`}
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function Status({ health }) {
  const online = Boolean(health);
  const ready = Boolean(health?.index_ready);
  return (
    <span className={`status-label ${online ? "is-online" : ""} ${ready ? "is-ready" : ""}`}>
      <i />
      {!online ? "API offline" : ready ? "Index ready" : "Index empty"}
    </span>
  );
}

function Confidence({ value }) {
  const label = {
    high: "High confidence",
    medium: "Medium confidence",
    low: "Low confidence",
    insufficient: "Insufficient evidence",
  }[value] || "Not run";
  return <span className={`confidence ${value || "idle"}`}><i />{label}</span>;
}

function AnswerText({ answer, evidence, onCitation }) {
  if (!answer) return null;
  return answer.split(/(\[\d+\])/g).map((part, index) => {
    const match = part.match(/^\[(\d+)\]$/);
    const source = match ? evidence[Number(match[1]) - 1] : null;
    return source ? (
      <button
        className="citation"
        type="button"
        key={`${part}-${index}`}
        onClick={() => onCitation(source)}
      >
        {match[1]}
      </button>
    ) : <span key={`${part}-${index}`}>{part}</span>;
  });
}

function Highlight({ text, terms }) {
  const cleanTerms = [...new Set(terms || [])].filter(Boolean);
  if (!cleanTerms.length) return text;
  const escaped = cleanTerms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  return text.split(pattern).map((part, index) => (
    cleanTerms.some((term) => term.toLowerCase() === part.toLowerCase())
      ? <mark key={`${part}-${index}`}>{part}</mark>
      : <span key={`${part}-${index}`}>{part}</span>
  ));
}

function Sidebar({ activeView, documents, health, onNavigate, onSelectDocument }) {
  return (
    <aside className="sidebar">
      <button className="brand" type="button" onClick={() => onNavigate("ask")}>
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
        <span><strong>GROUNDLINE</strong><small>Retrieval console</small></span>
      </button>

      <div className="corpus-switcher">
        <span className="corpus-icon">AQ</span>
        <span><small>ACTIVE CORPUS</small><strong>docs / local</strong></span>
        <ChevronRight size={15} />
      </div>

      <nav className="sidebar-nav" aria-label="Workspace navigation">
        <p>WORKSPACE</p>
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <button
              type="button"
              className={activeView === item.id ? "is-active" : ""}
              key={item.id}
              onClick={() => onNavigate(item.id)}
            >
              <Icon size={16} />
              <span>{item.label}</span>
              <small>{item.shortcut}</small>
            </button>
          );
        })}
      </nav>

      <section className="source-rail">
        <header><span>SOURCES</span><small>{documents.length}</small></header>
        <div>
          {documents.slice(0, 6).map((document) => (
            <button type="button" key={document.source} onClick={() => onSelectDocument(document.source)}>
              <span>TXT</span><strong>{document.source}</strong>
            </button>
          ))}
          {!documents.length ? <p>No text files found.</p> : null}
        </div>
      </section>

      <div className="system-readout">
        <div><Status health={health} /><span>LOCAL</span></div>
        <dl>
          <div><dt>documents</dt><dd>{health?.documents_indexed || 0}</dd></div>
          <div><dt>chunks</dt><dd>{health?.chunks_indexed || 0}</dd></div>
          <div><dt>method</dt><dd>tfidf</dd></div>
        </dl>
        <p><ShieldCheck size={14} /> No model or network call</p>
      </div>
    </aside>
  );
}

function Topbar({ activeView, health, theme, evidenceOpen, onTheme, onSettings, onEvidence }) {
  const titles = {
    ask: ["QUERY", "New retrieval run"],
    library: ["CORPUS", "Source manager"],
    evaluate: ["CHECKS", "Golden set"],
  };
  return (
    <header className="topbar">
      <div className="breadcrumb"><span>{titles[activeView][0]}</span><i>/</i><strong>{titles[activeView][1]}</strong></div>
      <div className="topbar-actions">
        <Status health={health} />
        <span className="command-key">⌘ K</span>
        <IconButton label="Retrieval settings" onClick={onSettings}><Settings2 size={16} /></IconButton>
        <IconButton label={theme === "dark" ? "Use light theme" : "Use dark theme"} onClick={onTheme}>
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </IconButton>
        {activeView === "ask" ? (
          <IconButton label="Toggle evidence inspector" active={evidenceOpen} onClick={onEvidence}><PanelRight size={16} /></IconButton>
        ) : null}
      </div>
    </header>
  );
}

function QueryWorkspace({
  question,
  topK,
  health,
  documents,
  answer,
  elapsed,
  history,
  isAsking,
  evidenceOpen,
  selectedEvidence,
  onQuestion,
  onTopK,
  onAsk,
  onExample,
  onCitation,
  onSelectEvidence,
  onHistory,
  onCopy,
}) {
  const evidence = answer?.chunks || answer?.sources || [];
  const wordCount = documents.reduce((total, document) => total + document.words, 0);
  return (
    <div className={`query-layout ${evidenceOpen ? "with-inspector" : ""}`}>
      <main className="query-canvas">
        <div className="query-scroll">
          <section className="query-intro">
            <div className="eyebrow"><span>RUN / NEW</span><i />Local extractive retrieval</div>
            <h1>Interrogate the corpus.</h1>
            <p>Ask a narrow question. Groundline ranks the local text, extracts matching sentences, and leaves the evidence visible.</p>
            <dl>
              <div><dt>SOURCES</dt><dd>{documents.length}</dd></div>
              <div><dt>WORDS</dt><dd>{formatNumber(wordCount)}</dd></div>
              <div><dt>CHUNKS</dt><dd>{health?.chunks_indexed || 0}</dd></div>
              <div><dt>INDEXED</dt><dd>{formatDate(health?.indexed_at)}</dd></div>
            </dl>
          </section>

          <form className="query-composer" onSubmit={onAsk}>
            <div className="composer-topline"><label htmlFor="question">QUESTION</label><span>ENTER TO RUN</span></div>
            <textarea
              id="question"
              value={question}
              onChange={(event) => onQuestion(event.target.value)}
              placeholder="Ask something that should be in docs/*.txt"
              rows={3}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <footer>
              <label className="top-k"><span>TOP K</span><input type="range" min="1" max="8" value={topK} onChange={(event) => onTopK(Number(event.target.value))} /><strong>{topK}</strong></label>
              <button type="submit" disabled={isAsking || !question.trim() || !health?.index_ready}>
                {isAsking ? <Loader2 className="spin" size={16} /> : <Search size={16} />}
                {isAsking ? "Running" : "Run retrieval"}
              </button>
            </footer>
          </form>

          <div className="prompt-strip">
            <span>TRY</span>
            {exampleQuestions.map((example) => <button type="button" key={example} onClick={() => onExample(example)}>{example}<ArrowRight size={13} /></button>)}
          </div>

          <section className="run-panel" aria-live="polite">
            <header className="run-header">
              <div><span className="run-number">01</span><span><small>OUTPUT</small><strong>Extractive answer</strong></span></div>
              <div>{answer ? <Confidence value={answer.confidence} /> : <span className="awaiting">AWAITING RUN</span>}{answer ? <IconButton label="Copy answer" onClick={onCopy}><Copy size={15} /></IconButton> : null}</div>
            </header>
            {answer ? (
              <>
                <div className="answer-body"><AnswerText answer={answer.answer} evidence={evidence} onCitation={onCitation} /></div>
                <div className="trace-line">
                  <span><i>01</i> tokenize <b>{answer.query_terms?.length || 0} terms</b></span>
                  <em />
                  <span><i>02</i> vectorize <b>TF-IDF</b></span>
                  <em />
                  <span><i>03</i> rank <b>{answer.retrieval_ms} ms</b></span>
                  <em />
                  <span><i>04</i> extract <b>{evidence.length} chunks</b></span>
                </div>
                <footer className="run-meta"><span><Clock3 size={13} /> {elapsed} ms round trip</span><span><Gauge size={13} /> threshold {health?.min_score ?? 0.12}</span><span><ShieldCheck size={13} /> extractive only</span></footer>
              </>
            ) : (
              <div className="run-empty"><span><FileSearch size={22} /></span><div><strong>No run selected</strong><p>The answer, timings, refusal state, and exact citations will appear here.</p></div></div>
            )}
          </section>

          <section className="ranked-results">
            <header><span>RANKED PASSAGES</span><small>{evidence.length ? `${evidence.length} returned` : "No result"}</small></header>
            {evidence.length ? evidence.map((chunk, index) => (
              <button type="button" key={`${chunk.source}-${chunk.chunk_id}`} className={selectedEvidence === chunk ? "is-selected" : ""} onClick={() => onSelectEvidence(chunk)}>
                <span className="result-rank">{String(index + 1).padStart(2, "0")}</span>
                <span className="result-source"><strong>{chunk.source}</strong><small>chunk {chunk.chunk_id + 1}</small></span>
                <span className="result-excerpt">{chunk.text}</span>
                <span className="result-score">{formatScore(chunk.score)}</span>
                <ChevronRight size={15} />
              </button>
            )) : <div className="results-empty">Run a question to populate the retrieval ledger.</div>}
          </section>

          {history.length ? (
            <section className="recent-runs">
              <header><span><History size={14} /> RECENT RUNS</span><small>browser local</small></header>
              {history.slice(0, 4).map((item, index) => (
                <button type="button" key={item.id} onClick={() => onHistory(item)}>
                  <span>{String(index + 1).padStart(2, "0")}</span><strong>{item.question}</strong><small>{item.response.confidence} / {item.elapsed} ms</small><ChevronRight size={14} />
                </button>
              ))}
            </section>
          ) : null}
        </div>
      </main>

      {evidenceOpen ? <EvidenceInspector evidence={evidence} selected={selectedEvidence} onSelect={onSelectEvidence} /> : null}
    </div>
  );
}

function EvidenceInspector({ evidence, selected, onSelect }) {
  const active = selected || evidence[0];
  return (
    <aside className="evidence-inspector">
      <header><div><small>INSPECTOR</small><strong>Evidence trace</strong></div><span>{evidence.length}</span></header>
      {!active ? (
        <div className="inspector-empty"><span><FileSearch size={20} /></span><strong>Nothing to inspect</strong><p>Select a ranked passage after running a query.</p></div>
      ) : (
        <>
          <div className="evidence-tabs">
            {evidence.map((chunk, index) => (
              <button type="button" key={`${chunk.source}-${chunk.chunk_id}`} className={active === chunk ? "is-active" : ""} onClick={() => onSelect(chunk)}>{index + 1}</button>
            ))}
          </div>
          <div className="inspector-scroll">
            <section className="evidence-identity">
              <div className="file-stamp">TXT</div>
              <div><small>SOURCE</small><strong>{active.source}</strong><span>chunk {active.chunk_id + 1} / rank {active.rank}</span></div>
            </section>
            <section className="similarity-meter">
              <header><span>SIMILARITY</span><strong>{formatScore(active.score)}</strong></header>
              <div><i style={{ width: formatScore(active.score) }} /></div>
            </section>
            <section className="evidence-copy">
              <header><span>PASSAGE</span><small>{active.text.split(/\s+/).length} words</small></header>
              <p><Highlight text={active.text} terms={active.matched_terms} /></p>
            </section>
            <section className="term-ledger">
              <header>MATCHED TERMS</header>
              <div>{active.matched_terms?.length ? active.matched_terms.map((term) => <span key={term}>{term}</span>) : <small>No exact query term match</small>}</div>
            </section>
            <section className="evidence-note"><ShieldCheck size={15} /><p>This passage is stored and ranked locally. Highlighted terms overlap with the normalized query.</p></section>
          </div>
        </>
      )}
    </aside>
  );
}

function CorpusWorkspace({ documents, health, selectedSource, documentDetail, isIndexing, onSelect, onUpload, onDelete, onReindex }) {
  const [filter, setFilter] = useState("");
  const inputRef = useRef(null);
  const visible = documents.filter((document) => document.source.toLowerCase().includes(filter.toLowerCase()));
  return (
    <section className="corpus-workspace">
      <header className="workspace-heading">
        <div><span className="section-code">02 / CORPUS</span><h1>Source manager</h1><p>Add, inspect, and remove the text files behind the index.</p></div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".txt,text/plain"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
              event.target.value = "";
            }}
          />
          <button className="secondary-action" type="button" onClick={() => onReindex()} disabled={isIndexing}><RefreshCw className={isIndexing ? "spin" : ""} size={15} />{isIndexing ? "Indexing" : "Rebuild"}</button>
          <button className="primary-action" type="button" onClick={() => inputRef.current?.click()}><FilePlus2 size={15} />Add .txt</button>
        </div>
      </header>

      <div className="corpus-stats">
        <div><span>FILES</span><strong>{documents.length}</strong></div>
        <div><span>INDEX CHUNKS</span><strong>{health?.chunks_indexed || 0}</strong></div>
        <div><span>CHUNK SIZE</span><strong>{health?.chunk_size || 200}<small>w</small></strong></div>
        <div><span>OVERLAP</span><strong>{health?.chunk_overlap ?? 40}<small>w</small></strong></div>
        <div><span>LAST BUILD</span><strong className="date-value">{formatDate(health?.indexed_at)}</strong></div>
      </div>

      <div className="corpus-grid">
        <section className="document-ledger">
          <header><label><Search size={14} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter sources" /></label><span>{visible.length} shown</span></header>
          <div className="document-head"><span>FILE</span><span>WORDS</span><span>CHUNKS</span><span>UPDATED</span></div>
          <div className="document-list">
            {visible.map((document) => (
              <button type="button" key={document.source} className={selectedSource === document.source ? "is-selected" : ""} onClick={() => onSelect(document.source)}>
                <span className="doc-name"><i>TXT</i><strong>{document.source}</strong></span>
                <span>{formatNumber(document.words)}</span>
                <span>{document.chunks}</span>
                <span>{formatDate(document.updated_at)}</span>
              </button>
            ))}
            {!visible.length ? <div className="document-empty">No matching .txt sources.</div> : null}
          </div>
        </section>

        <aside className="document-preview">
          {documentDetail ? (
            <>
              <header><div><small>DOCUMENT</small><strong>{documentDetail.source}</strong></div><IconButton danger label="Delete document" onClick={() => onDelete(documentDetail.source)}><Trash2 size={15} /></IconButton></header>
              <dl>
                <div><dt>WORDS</dt><dd>{formatNumber(documentDetail.words)}</dd></div>
                <div><dt>CHUNKS</dt><dd>{documentDetail.chunks}</dd></div>
                <div><dt>CHARACTERS</dt><dd>{formatNumber(documentDetail.characters)}</dd></div>
              </dl>
              <div className="document-content"><div><span>RAW TEXT</span><small>UTF-8</small></div><p>{documentDetail.text}</p></div>
            </>
          ) : <div className="preview-empty"><BookOpen size={22} /><strong>Select a source</strong><p>Its raw local text and index footprint will appear here.</p></div>}
        </aside>
      </div>
    </section>
  );
}

function ChecksWorkspace({ health, results, running, onRun }) {
  const passed = results.filter((result) => result.passed).length;
  const score = results.length ? Math.round((passed / results.length) * 100) : null;
  return (
    <section className="checks-workspace">
      <header className="workspace-heading">
        <div><span className="section-code">03 / CHECKS</span><h1>Retrieval checks</h1><p>Four small golden cases make ranking quality visible before you trust an answer.</p></div>
        <button className="primary-action" type="button" onClick={onRun} disabled={running || !health?.index_ready}>{running ? <Loader2 className="spin" size={15} /> : <FlaskConical size={15} />}{running ? "Running" : "Run all cases"}</button>
      </header>

      <div className="check-summary">
        <div className="check-score"><span>TOP-1 ACCURACY</span><strong>{score === null ? "--" : score}<small>{score === null ? "" : "%"}</small></strong><p>{score === null ? "No baseline yet" : `${passed} of ${results.length} expected sources ranked first`}</p></div>
        <div className="check-method"><ClipboardCheck size={20} /><div><span>METHOD</span><strong>Expected source vs. rank 1</strong><p>This checks retrieval on the included demo corpus. It is intentionally small and does not claim general model quality.</p></div></div>
      </div>

      <section className="check-table">
        <header><span>CASE</span><span>QUESTION</span><span>EXPECTED</span><span>ACTUAL / SCORE</span><span>RESULT</span></header>
        {evaluationCases.map((testCase, index) => {
          const result = results[index];
          return (
            <div key={testCase.question}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{testCase.question}</strong>
              <code>{testCase.expected}</code>
              <span>{result ? <><code>{result.actual}</code><small>{formatScore(result.topScore)}</small></> : "Not run"}</span>
              <span className={`case-result ${result ? (result.passed ? "pass" : "review") : "pending"}`}>{running && !result ? <Loader2 className="spin" size={13} /> : result?.passed ? <Check size={13} /> : result ? <CircleAlert size={13} /> : <i />}{result ? (result.passed ? "PASS" : "REVIEW") : "PENDING"}</span>
            </div>
          );
        })}
      </section>
    </section>
  );
}

function SettingsDialog({ topK, chunkSize, chunkOverlap, health, onTopK, onApply, onClose, isIndexing }) {
  const [nextChunkSize, setNextChunkSize] = useState(chunkSize);
  const [nextOverlap, setNextOverlap] = useState(chunkOverlap);
  const valid = nextChunkSize >= 20 && nextChunkSize <= 2000 && nextOverlap >= 0 && nextOverlap < nextChunkSize;
  useEffect(() => {
    const close = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-label="Retrieval settings" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><small>INDEX CONFIGURATION</small><h2>Retrieval settings</h2></div><IconButton label="Close" onClick={onClose}><X size={17} /></IconButton></header>
        <p className="dialog-copy">Query depth changes immediately. Chunk settings rebuild the in-memory index so the displayed configuration always matches retrieval.</p>
        <label className="range-setting"><span><strong>Top K</strong><small>Maximum passages returned per query</small></span><em>{topK}</em><input type="range" min="1" max="8" value={topK} onChange={(event) => onTopK(Number(event.target.value))} /></label>
        <div className="number-settings">
          <label><span>CHUNK SIZE</span><input type="number" min="20" max="2000" value={nextChunkSize} onChange={(event) => setNextChunkSize(Number(event.target.value))} /><small>words</small></label>
          <label><span>OVERLAP</span><input type="number" min="0" max="500" value={nextOverlap} onChange={(event) => setNextOverlap(Number(event.target.value))} /><small>words</small></label>
        </div>
        {!valid ? <p className="setting-error">Overlap must be smaller than chunk size. Chunk size must be between 20 and 2000.</p> : null}
        <div className="settings-readout"><span><i /> ACTIVE INDEX</span><code>{health?.retrieval_method || "tfidf-cosine"}</code><code>min {health?.min_score ?? 0.12}</code></div>
        <footer><button type="button" className="secondary-action" onClick={onClose}>Cancel</button><button type="button" className="primary-action" disabled={!valid || isIndexing} onClick={() => onApply(nextChunkSize, nextOverlap)}>{isIndexing ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}Apply and rebuild</button></footer>
      </section>
    </div>
  );
}

function ConfirmDialog({ source, onConfirm, onClose, busy }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="confirm-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <span className="danger-symbol"><Trash2 size={19} /></span>
        <h2>Remove this source?</h2>
        <p><code>{source}</code> will be deleted from <code>docs/</code>. Groundline will rebuild the remaining index immediately.</p>
        <footer><button className="secondary-action" type="button" onClick={onClose}>Cancel</button><button className="danger-action" type="button" onClick={onConfirm} disabled={busy}>{busy ? <Loader2 className="spin" size={15} /> : <Trash2 size={15} />}Delete source</button></footer>
      </section>
    </div>
  );
}

export default function App() {
  const booted = useRef(false);
  const [activeView, setActiveView] = useState("ask");
  const [theme, setTheme] = useState(() => window.localStorage.getItem(THEME_KEY) || "dark");
  const [question, setQuestion] = useState(exampleQuestions[0]);
  const [topK, setTopK] = useState(3);
  const [chunkSize, setChunkSize] = useState(200);
  const [chunkOverlap, setChunkOverlap] = useState(40);
  const [health, setHealth] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedSource, setSelectedSource] = useState("");
  const [documentDetail, setDocumentDetail] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [elapsed, setElapsed] = useState(null);
  const [history, setHistory] = useState(readHistory);
  const [evaluationResults, setEvaluationResults] = useState([]);
  const [evidenceOpen, setEvidenceOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteSource, setDeleteSource] = useState("");
  const [isBooting, setIsBooting] = useState(true);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const evidence = useMemo(() => answer?.chunks || answer?.sources || [], [answer]);

  async function loadSnapshot({ autoIndex = false } = {}) {
    setError("");
    try {
      const [nextHealth, payload] = await Promise.all([api("/health"), api("/documents")]);
      setHealth(nextHealth);
      setDocuments(payload.documents || []);
      setChunkSize(nextHealth.chunk_size || 200);
      setChunkOverlap(nextHealth.chunk_overlap ?? 40);
      setSelectedSource((current) => current || payload.documents?.[0]?.source || "");
      if (autoIndex && !nextHealth.index_ready && payload.documents?.length) {
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

  async function loadDocument(source) {
    if (!source) {
      setDocumentDetail(null);
      return;
    }
    try {
      setDocumentDetail(await api(`/documents/${encodeURIComponent(source)}`));
    } catch (requestError) {
      setDocumentDetail(null);
      setError(requestError.message);
    }
  }

  async function rebuildIndex({ quiet = false, nextChunkSize = chunkSize, nextOverlap = chunkOverlap } = {}) {
    setIsIndexing(true);
    setError("");
    try {
      await api("/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunk_size: Number(nextChunkSize), chunk_overlap: Number(nextOverlap) }),
      });
      setChunkSize(Number(nextChunkSize));
      setChunkOverlap(Number(nextOverlap));
      const [nextHealth, payload] = await Promise.all([api("/health"), api("/documents")]);
      setHealth(nextHealth);
      setDocuments(payload.documents || []);
      setEvaluationResults([]);
      if (!quiet) setNotice(`Index rebuilt: ${nextHealth.chunks_indexed} chunks ready.`);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    } finally {
      setIsIndexing(false);
    }
  }

  async function askQuestion(event, override) {
    event?.preventDefault();
    const cleanQuestion = (override || question).trim();
    if (!cleanQuestion || isAsking) return;
    setQuestion(cleanQuestion);
    setIsAsking(true);
    setError("");
    const started = performance.now();
    try {
      const response = await api("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: cleanQuestion, top_k: Number(topK) }),
      });
      const duration = Math.max(1, Math.round(performance.now() - started));
      setAnswer(response);
      setElapsed(duration);
      setSelectedEvidence(response.chunks?.[0] || null);
      setEvidenceOpen(true);
      const item = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, question: cleanQuestion, response, elapsed: duration };
      setHistory((current) => {
        const next = [item, ...current.filter((entry) => entry.question !== cleanQuestion)].slice(0, 12);
        saveHistory(next);
        return next;
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsAsking(false);
    }
  }

  async function uploadDocument(file) {
    if (!file.name.toLowerCase().endsWith(".txt")) {
      setError("Only UTF-8 .txt files are supported.");
      return;
    }
    try {
      const text = await file.text();
      let replace = false;
      if (documents.some((document) => document.source === file.name)) {
        replace = window.confirm(`${file.name} already exists. Replace it and rebuild the index?`);
        if (!replace) return;
      }
      await api("/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: file.name, text, replace, reindex: true }),
      });
      await loadSnapshot();
      setSelectedSource(file.name);
      setNotice(`${file.name} added and indexed.`);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function deleteDocument() {
    if (!deleteSource) return;
    setIsDeleting(true);
    setError("");
    try {
      await api(`/documents/${encodeURIComponent(deleteSource)}`, { method: "DELETE" });
      const removed = deleteSource;
      setDeleteSource("");
      setSelectedSource("");
      setDocumentDetail(null);
      await loadSnapshot();
      setNotice(`${removed} removed. Index rebuilt.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsDeleting(false);
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
        results.push({ actual: first?.source || "No evidence", topScore: first?.score || 0, passed: first?.source === testCase.expected });
        setEvaluationResults([...results]);
      }
      setNotice(`Checks complete: ${results.filter((result) => result.passed).length}/${results.length} passed.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsEvaluating(false);
    }
  }

  function openHistory(item) {
    setQuestion(item.question);
    setAnswer(item.response);
    setElapsed(item.elapsed);
    setSelectedEvidence(item.response.chunks?.[0] || null);
    setEvidenceOpen(true);
  }

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    loadSnapshot({ autoIndex: true });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (activeView === "library" && selectedSource) loadDocument(selectedSource);
  }, [activeView, selectedSource, documents]);

  useEffect(() => {
    const shortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && ["1", "2", "3"].includes(event.key)) {
        event.preventDefault();
        setActiveView(["ask", "library", "evaluate"][Number(event.key) - 1]);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function selectDocument(source) {
    setSelectedSource(source);
    setActiveView("library");
  }

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} documents={documents} health={health} onNavigate={setActiveView} onSelectDocument={selectDocument} />
      <section className="main-shell">
        <Topbar activeView={activeView} health={health} theme={theme} evidenceOpen={evidenceOpen} onTheme={() => setTheme((current) => current === "dark" ? "light" : "dark")} onSettings={() => setSettingsOpen(true)} onEvidence={() => setEvidenceOpen((current) => !current)} />
        {error ? <div className="error-banner" role="alert"><CircleAlert size={15} /><span>{error}</span><button type="button" onClick={() => loadSnapshot()}><RefreshCw size={14} />Retry</button><IconButton label="Dismiss error" onClick={() => setError("")}><X size={14} /></IconButton></div> : null}
        {activeView === "ask" ? <QueryWorkspace question={question} topK={topK} health={health} documents={documents} answer={answer} elapsed={elapsed} history={history} isAsking={isAsking || isBooting} evidenceOpen={evidenceOpen} selectedEvidence={selectedEvidence} onQuestion={setQuestion} onTopK={setTopK} onAsk={askQuestion} onExample={(example) => askQuestion(null, example)} onCitation={(chunk) => { setSelectedEvidence(chunk); setEvidenceOpen(true); }} onSelectEvidence={setSelectedEvidence} onHistory={openHistory} onCopy={() => { navigator.clipboard.writeText(answer?.answer || ""); setNotice("Answer copied."); }} /> : null}
        {activeView === "library" ? <CorpusWorkspace documents={documents} health={health} selectedSource={selectedSource} documentDetail={documentDetail} isIndexing={isIndexing} onSelect={setSelectedSource} onUpload={uploadDocument} onDelete={setDeleteSource} onReindex={() => rebuildIndex()} /> : null}
        {activeView === "evaluate" ? <ChecksWorkspace health={health} results={evaluationResults} running={isEvaluating} onRun={runEvaluation} /> : null}
      </section>
      {settingsOpen ? <SettingsDialog topK={topK} chunkSize={chunkSize} chunkOverlap={chunkOverlap} health={health} onTopK={setTopK} isIndexing={isIndexing} onClose={() => setSettingsOpen(false)} onApply={async (nextChunkSize, nextOverlap) => { const applied = await rebuildIndex({ nextChunkSize, nextOverlap }); if (applied) setSettingsOpen(false); }} /> : null}
      {deleteSource ? <ConfirmDialog source={deleteSource} busy={isDeleting} onClose={() => setDeleteSource("")} onConfirm={deleteDocument} /> : null}
      {notice ? <div className="toast"><Check size={14} />{notice}</div> : null}
    </div>
  );
}
