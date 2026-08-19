import { useEffect, useState } from "react";
import { AlertCircle, Archive, BrainCircuit, Check, Database, Download, FileText, Gauge, Loader2, Network, Search, Send, Server, Sparkles } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
const examples = ["What is the refund policy?", "How long does standard shipping take?", "Are customer notes private?", "Explain refunds and compare shipping"];
const percent = value => `${Math.round((value || 0) * 100)}%`;

async function errorMessage(response) {
  try { return (await response.json()).detail || "Request failed"; } catch { return "Request failed"; }
}

export default function App() {
  const [question, setQuestion] = useState(examples[0]);
  const [topK, setTopK] = useState(5);
  const [health, setHealth] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [answer, setAnswer] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [quiz, setQuiz] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const [h, d] = await Promise.all([fetch(`${API_BASE}/health`), fetch(`${API_BASE}/documents`)]);
      setHealth(await h.json()); setDocuments((await d.json()).documents || []);
    } catch { setHealth(null); }
  }
  useEffect(() => { refresh(); }, []);

  async function run(path, options, label) {
    setBusy(label); setError("");
    try {
      const response = await fetch(`${API_BASE}${path}`, options);
      if (!response.ok) throw new Error(await errorMessage(response));
      const data = await response.json(); await refresh(); return data;
    } catch (cause) { setError(cause.message); return null; }
    finally { setBusy(""); }
  }
  async function index() { await run("/index", { method: "POST" }, "index"); setAnswer(null); }
  async function ask(event) {
    event.preventDefault();
    const data = await run("/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, top_k: Number(topK), session_id: sessionId }) }, "ask");
    if (data) { setAnswer(data); setSessionId(data.session_id); }
  }
  async function makeQuiz() {
    const data = await run("/quiz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: question, count: 3 }) }, "quiz");
    if (data) setQuiz(data.cards);
  }

  return <main className="app-shell"><section className="workspace">
    <aside className="rail">
      <div className="brand-lockup"><div className="brand-mark"><Archive /></div><div><p className="eyebrow">Local RAG</p><h1>Evidence Console</h1></div></div>
      <div className="connection-card"><div className="connection-topline"><Server size={18}/>{health ? "API online" : "API offline"}</div><strong>{health?.index_ready ? "Hybrid index ready" : "Index pending"}</strong><small>ChromaDB × SQLite FTS5</small></div>
      <button className="primary-action" onClick={index} disabled={busy}><Database size={18}/>{busy === "index" ? "Indexing…" : "Index PDF + text"}</button>
      <div className="metric-grid"><div><span>Documents</span><strong>{documents.length || "—"}</strong></div><div><span>Chunks</span><strong>{health?.chunks_indexed || "—"}</strong></div></div>
      <section className="panel"><div className="panel-heading"><FileText size={18}/><h2>Corpus</h2></div><ul className="source-list">{documents.map(doc => <li key={doc.source}><FileText size={15}/><span>{doc.source}</span><small>{doc.pages}p</small></li>)}</ul></section>
      <nav className="lab-links"><a href={`${API_BASE}/graph/view`} target="_blank" rel="noreferrer"><Network size={17}/>Evidence graph</a><a href={`${API_BASE}/anki?topic=${encodeURIComponent(question)}`}><Download size={17}/>Export .apkg</a></nav>
    </aside>
    <section className="query-stage">
      <header className="stage-header"><div><p className="eyebrow">Research desk · deterministic offline mode</p><h2>Trace the answer back to the page.</h2></div></header>
      <div className="signal-row"><div className="signal-card" data-ready={!!health}><Check size={17}/>Backend</div><div className="signal-card" data-ready={health?.index_ready}><Check size={17}/>Hybrid retrieval</div><div className="signal-card"><Gauge size={17}/>{answer ? `${percent(answer.confidence)} confidence` : "No query yet"}</div></div>
      <form className="ask-form" onSubmit={ask}><label>Question</label><textarea value={question} onChange={event => setQuestion(event.target.value)} rows="3" placeholder="Ask across docs/*.pdf and docs/*.txt"/><div className="form-footer"><label className="range-control">Top K <input type="range" min="1" max="10" value={topK} onChange={e=>setTopK(e.target.value)}/><strong>{topK}</strong></label><button className="ask-button" disabled={busy}><Send size={18}/>{busy === "ask" ? "Tracing…" : "Ask"}</button></div></form>
      <div className="question-strip">{examples.map(item => <button key={item} onClick={()=>setQuestion(item)}><Search size={14}/>{item}</button>)}</div>
      {error && <div className="error-banner"><AlertCircle size={18}/>{error}</div>}
      <section className="answer-area"><article className="answer-block"><div className="panel-heading"><Sparkles size={18}/><h2>Grounded answer</h2></div><p>{answer?.answer || "Index the corpus, then ask a question."}</p>{answer && <div className="trace"><span>{answer.grounded ? "grounded" : "gated"}</span><span>{percent(answer.confidence)}</span><span>{answer.subqueries.length} retrieval path(s)</span></div>}</article>
        <div className="evidence-grid">{answer?.results?.map(hit => <article className="evidence-card" key={hit.id}><header><span>{hit.citation}</span><strong>RRF {hit.score.toFixed(4)}</strong></header><p>{hit.text}</p><footer>rerank {hit.rerank_score.toFixed(4)} · vector #{hit.explanation.vector_rank ?? "—"} · FTS #{hit.explanation.keyword_rank ?? "—"}</footer></article>) || <article className="empty-evidence">No evidence traced yet.</article>}</div></section>
      <section className="study-panel"><div><BrainCircuit/><strong>Grounded recall</strong><span>Cards stay tied to cited evidence.</span></div><button onClick={makeQuiz}>{busy === "quiz" ? <Loader2 className="spin"/> : "Generate quiz"}</button>{quiz.map(card => <article key={card.id}><p>{card.question}</p><details><summary>Reveal</summary><strong>{card.answer}</strong> · {card.citation}</details></article>)}</section>
    </section>
  </section></main>;
}
