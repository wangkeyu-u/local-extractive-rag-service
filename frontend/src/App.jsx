import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Archive,
  BookOpenText,
  Check,
  Clock3,
  Database,
  FileSearch,
  FileText,
  Gauge,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  Server,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

const exampleQuestions = [
  "What is the refund policy?",
  "How long does standard shipping take?",
  "Does the company sell customer data?",
  "When is support available?",
  "What is AquaNote?",
];

function formatScore(score) {
  return `${Math.round(score * 100)}%`;
}

function formatWords(words) {
  return `${words.toLocaleString()} words`;
}

async function readApiError(response) {
  try {
    const payload = await response.json();
    return payload.detail || "Request failed.";
  } catch {
    return "Request failed.";
  }
}

export default function App() {
  const [question, setQuestion] = useState(exampleQuestions[0]);
  const [topK, setTopK] = useState(3);
  const [documents, setDocuments] = useState([]);
  const [health, setHealth] = useState(null);
  const [indexState, setIndexState] = useState(null);
  const [answerState, setAnswerState] = useState(null);
  const [responseMs, setResponseMs] = useState(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState("");

  const evidence = answerState?.chunks || answerState?.sources || [];
  const indexedSources = indexState?.sources || [];
  const sourceNames = useMemo(() => {
    const fromIndex = new Set(indexedSources);
    documents.forEach((document) => fromIndex.add(document.source));
    return [...fromIndex];
  }, [documents, indexedSources]);

  const totalWords = documents.reduce((total, document) => total + document.words, 0);
  const indexReady = Boolean(health?.index_ready || indexState);

  async function refreshSystem({ quiet = false } = {}) {
    if (!quiet) {
      setIsBooting(true);
    }
    setError("");

    try {
      const [healthResponse, documentsResponse] = await Promise.all([
        fetch(`${API_BASE}/health`),
        fetch(`${API_BASE}/documents`),
      ]);

      if (!healthResponse.ok) {
        throw new Error(await readApiError(healthResponse));
      }
      if (!documentsResponse.ok) {
        throw new Error(await readApiError(documentsResponse));
      }

      const nextHealth = await healthResponse.json();
      const nextDocuments = await documentsResponse.json();
      setHealth(nextHealth);
      setDocuments(nextDocuments.documents || []);
    } catch (requestError) {
      setHealth(null);
      setDocuments([]);
      if (!quiet) {
        setError(requestError.message);
      }
    } finally {
      setIsBooting(false);
    }
  }

  async function handleIndex() {
    setIsIndexing(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/index`, { method: "POST" });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      const nextIndexState = await response.json();
      setIndexState(nextIndexState);
      setAnswerState(null);
      setResponseMs(null);
      await refreshSystem({ quiet: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsIndexing(false);
    }
  }

  async function handleAsk(event) {
    event.preventDefault();
    setIsAsking(true);
    setError("");
    setResponseMs(null);

    try {
      const startedAt = performance.now();
      const response = await fetch(`${API_BASE}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, top_k: Number(topK) }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      const nextAnswerState = await response.json();
      setAnswerState(nextAnswerState);
      setResponseMs(Math.round(performance.now() - startedAt));
      await refreshSystem({ quiet: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsAsking(false);
    }
  }

  useEffect(() => {
    refreshSystem();
  }, []);

  return (
    <main className="app-shell">
      <section className="workspace">
        <aside className="rail" aria-label="System controls">
          <div className="brand-lockup">
            <div className="brand-mark">
              <Archive size={25} aria-hidden="true" />
            </div>
            <div>
              <p className="eyebrow">Local RAG</p>
              <h1>Evidence Console</h1>
            </div>
          </div>

          <div className="connection-card">
            <div className="connection-topline">
              <Server size={18} aria-hidden="true" />
              <span>{health ? "API online" : "API offline"}</span>
            </div>
            <strong>{indexReady ? "Index ready" : "Index pending"}</strong>
            <small>{health ? `${health.chunks_indexed} indexed chunks` : "Start FastAPI on port 8000"}</small>
          </div>

          <button className="primary-action" onClick={handleIndex} disabled={isIndexing || isBooting}>
            {isIndexing ? <Loader2 className="spin" size={18} /> : <Database size={18} />}
            <span>{isIndexing ? "Indexing" : "Index Documents"}</span>
          </button>

          <div className="metric-grid" aria-label="Index summary">
            <div>
              <span>Documents</span>
              <strong>{indexState?.documents_indexed ?? (documents.length || "-")}</strong>
            </div>
            <div>
              <span>Words</span>
              <strong>{totalWords || "-"}</strong>
            </div>
          </div>

          <section className="panel sources-panel">
            <div className="panel-heading">
              <BookOpenText size={18} aria-hidden="true" />
              <h2>Corpus</h2>
            </div>
            {sourceNames.length > 0 ? (
              <ul className="source-list">
                {sourceNames.map((source) => {
                  const document = documents.find((item) => item.source === source);
                  return (
                    <li key={source}>
                      <FileText size={16} aria-hidden="true" />
                      <span>{source}</span>
                      {document ? <small>{document.words}</small> : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted">No readable documents found.</p>
            )}
          </section>
        </aside>

        <section className="query-stage" aria-label="Question and answer workspace">
          <div className="stage-header">
            <div>
              <p className="eyebrow">Grounded answers only</p>
              <h2>Ask the indexed documents</h2>
            </div>
            <button className="icon-button" type="button" onClick={() => refreshSystem()} title="Refresh status">
              {isBooting ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
            </button>
          </div>

          <div className="signal-row" aria-label="System status">
            <div className="signal-card" data-ready={Boolean(health)}>
              {health ? <Check size={17} /> : <AlertCircle size={17} />}
              <span>{health ? "Backend connected" : "Backend unavailable"}</span>
            </div>
            <div className="signal-card" data-ready={indexReady}>
              {indexReady ? <Check size={17} /> : <AlertCircle size={17} />}
              <span>{indexReady ? "Retrieval ready" : "Needs indexing"}</span>
            </div>
            <div className="signal-card">
              <Gauge size={17} />
              <span>{responseMs ? `${responseMs} ms` : "No query yet"}</span>
            </div>
          </div>

          <form className="ask-form" onSubmit={handleAsk}>
            <label className="input-label" htmlFor="question">
              <MessageSquareText size={17} aria-hidden="true" />
              Question
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask something covered by docs/*.txt"
              rows={4}
            />

            <div className="form-footer">
              <label className="range-control" htmlFor="top-k">
                <span>
                  <SlidersHorizontal size={16} aria-hidden="true" />
                  Top K
                </span>
                <input
                  id="top-k"
                  type="range"
                  min="1"
                  max="10"
                  value={topK}
                  onChange={(event) => setTopK(event.target.value)}
                />
                <strong>{topK}</strong>
              </label>

              <button className="ask-button" disabled={isAsking || !question.trim()}>
                {isAsking ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
                <span>{isAsking ? "Asking" : "Ask"}</span>
              </button>
            </div>
          </form>

          <div className="question-strip" aria-label="Example questions">
            {exampleQuestions.map((example) => (
              <button key={example} type="button" onClick={() => setQuestion(example)}>
                <Search size={14} aria-hidden="true" />
                <span>{example}</span>
              </button>
            ))}
          </div>

          {error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <section className="answer-area" aria-live="polite">
            <div className="answer-block">
              <div className="answer-heading">
                <div className="panel-heading">
                  <Sparkles size={18} aria-hidden="true" />
                  <h2>Answer</h2>
                </div>
                {responseMs ? (
                  <span className="response-time">
                    <Clock3 size={15} aria-hidden="true" />
                    {responseMs} ms
                  </span>
                ) : null}
              </div>
              <p>{answerState?.answer || "Results from the backend will appear here."}</p>
            </div>

            <div className="evidence-grid">
              {evidence.length > 0 ? (
                evidence.map((chunk) => (
                  <article className="evidence-card" key={`${chunk.source}-${chunk.chunk_id}`}>
                    <header>
                      <span>{chunk.source}</span>
                      <strong>{formatScore(chunk.score)}</strong>
                    </header>
                    <p>{chunk.text}</p>
                    <footer>Chunk {chunk.chunk_id}</footer>
                  </article>
                ))
              ) : (
                <article className="empty-evidence">
                  <FileSearch size={22} aria-hidden="true" />
                  <span>No evidence chunks returned yet.</span>
                </article>
              )}
            </div>
          </section>

          <div className="document-strip" aria-label="Document inventory">
            {documents.map((document) => (
              <article key={document.source}>
                <strong>{document.source}</strong>
                <span>{formatWords(document.words)}</span>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
