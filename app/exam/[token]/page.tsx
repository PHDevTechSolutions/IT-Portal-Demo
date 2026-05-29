"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertTriangle, ChevronRight } from "lucide-react";

interface Question {
  id:       number;
  type:     "multiple_choice" | "true_false" | "short_answer";
  question: string;
  choices?: string[];
  points:   number;
}

const C = {
  bg:     "#080d12",
  panel:  "#0d1117",
  border: "#1a2535",
  muted:  "#253040",
  dim:    "#4a6070",
  text:   "#c8d8e8",
  accent: "#e8630a",
  font:   "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
};

export default function ExamPage() {
  const params = useParams();
  const token  = params?.token as string;

  const [jobTitle,    setJobTitle]    = useState("");
  const [questions,   setQuestions]   = useState<Question[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [answers,     setAnswers]     = useState<Record<number, string>>({});
  const [name,        setName]        = useState("");
  const [email,       setEmail]       = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [result,      setResult]      = useState<any>(null);
  const [current,     setCurrent]     = useState(0);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/recruitment/exam/fetch?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(json => {
        if (!json.success) { setError(json.error || "Exam not found"); return; }
        setJobTitle(json.jobTitle);
        setQuestions(json.questions ?? []);
      })
      .catch(() => setError("Failed to load exam"))
      .finally(() => setLoading(false));
  }, [token]);

  const setAnswer = (id: number, val: string) =>
    setAnswers(prev => ({ ...prev, [id]: val }));

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) {
      alert("Please enter your name and email before submitting."); return;
    }
    const unanswered = questions.filter(q => !answers[q.id]?.trim());
    if (unanswered.length > 0) {
      if (!confirm(`You have ${unanswered.length} unanswered question(s). Submit anyway?`)) return;
    }
    setSubmitting(true);
    try {
      const res  = await fetch("/api/recruitment/exam/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, applicantName: name, applicantEmail: email, answers }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setResult(json);
      setSubmitted(true);
    } catch (err: any) {
      alert("Submission failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.bg, fontFamily: C.font }}>
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="size-8 animate-spin" style={{ color: C.accent }} />
        <p className="text-[12px] uppercase tracking-widest" style={{ color: C.muted }}>Loading exam…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.bg, fontFamily: C.font }}>
      <div className="text-center space-y-3">
        <AlertTriangle className="size-10 mx-auto" style={{ color: "#f87171" }} />
        <p className="text-[14px] font-bold" style={{ color: "#f87171" }}>{error}</p>
        <p className="text-[11px]" style={{ color: C.muted }}>This exam link may be invalid or expired.</p>
      </div>
    </div>
  );

  if (submitted && result) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: C.bg, fontFamily: C.font }}>
      <div className="w-full max-w-md border p-8 text-center space-y-5" style={{ borderColor: C.border, backgroundColor: C.panel }}>
        <CheckCircle2 className="size-12 mx-auto" style={{ color: "#34d399" }} />
        <div>
          <h1 className="text-lg font-bold uppercase tracking-widest" style={{ color: "#34d399" }}>Exam Submitted</h1>
          <p className="text-[11px] mt-1" style={{ color: C.muted }}>Thank you, {name}!</p>
        </div>
        <div className="border p-4 space-y-2" style={{ borderColor: C.border, backgroundColor: C.bg }}>
          <p className="text-[11px]" style={{ color: C.text }}>
            Auto-scored: <span className="font-bold" style={{ color: C.accent }}>{result.earnedPoints}</span>
            <span style={{ color: C.muted }}> / {result.autoScoredTotal} pts</span>
          </p>
          <p className="text-[11px]" style={{ color: C.text }}>
            Score: <span className="font-bold text-lg" style={{ color: result.percentage >= 70 ? "#34d399" : result.percentage >= 50 ? "#fbbf24" : "#f87171" }}>
              {result.percentage}%
            </span>
          </p>
          {result.shortAnswerCount > 0 && (
            <p className="text-[10px]" style={{ color: "#fbbf24" }}>
              {result.shortAnswerCount} short answer(s) pending manual review
            </p>
          )}
        </div>
        <p className="text-[10px]" style={{ color: C.muted }}>
          Your results have been submitted to the HR team. You will be contacted regarding the next steps.
        </p>
      </div>
    </div>
  );

  const q = questions[current];
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);
  const answered    = Object.keys(answers).length;

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.bg, fontFamily: C.font, color: C.text }}>
      {/* Header */}
      <div className="border-b px-6 py-4" style={{ borderColor: C.border, backgroundColor: C.panel }}>
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-[13px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>Pre-Employment Exam</h1>
            <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>{jobTitle} · {questions.length} questions · {totalPoints} pts</p>
          </div>
          <div className="text-right">
            <p className="text-[10px]" style={{ color: C.muted }}>Progress</p>
            <p className="text-[13px] font-bold" style={{ color: C.accent }}>{answered}/{questions.length}</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="max-w-2xl mx-auto mt-3 h-1 rounded-full" style={{ backgroundColor: C.muted }}>
          <div className="h-1 rounded-full transition-all" style={{ width: `${(answered / questions.length) * 100}%`, backgroundColor: C.accent }} />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Applicant info (shown on first question) */}
        {current === 0 && (
          <div className="border p-4 space-y-3" style={{ borderColor: C.border, backgroundColor: C.panel }}>
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>Your Information</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-widest" style={{ color: C.dim }}>Full Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name"
                  className="w-full h-8 px-2 text-[11px] focus:outline-none"
                  style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                  onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                  onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-widest" style={{ color: C.dim }}>Email *</label>
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" type="email"
                  className="w-full h-8 px-2 text-[11px] focus:outline-none"
                  style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                  onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                  onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
              </div>
            </div>
          </div>
        )}

        {/* Question card */}
        {q && (
          <div className="border p-6 space-y-5" style={{ borderColor: C.border, backgroundColor: C.panel }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold uppercase px-2 py-0.5 border"
                  style={{ borderColor: C.accent + "40", color: C.accent, backgroundColor: C.accent + "10" }}>
                  Q{q.id}
                </span>
                <span className="text-[9px] uppercase" style={{ color: C.dim }}>
                  {q.type.replace("_", " ")} · {q.points} pt{q.points !== 1 ? "s" : ""}
                </span>
              </div>
              <span className="text-[9px]" style={{ color: C.muted }}>{current + 1} / {questions.length}</span>
            </div>

            <p className="text-[13px] leading-relaxed font-medium" style={{ color: C.text }}>{q.question}</p>

            {/* Multiple choice / True-False */}
            {(q.type === "multiple_choice" || q.type === "true_false") && q.choices && (
              <div className="space-y-2">
                {q.choices.map((choice, ci) => {
                  const isSelected = answers[q.id] === choice;
                  return (
                    <button key={ci} onClick={() => setAnswer(q.id, choice)}
                      className="w-full text-left px-4 py-3 border transition-colors text-[12px]"
                      style={{
                        borderColor:     isSelected ? C.accent : C.border,
                        backgroundColor: isSelected ? C.accent + "15" : C.bg,
                        color:           isSelected ? C.accent : C.text,
                      }}>
                      {choice}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Short answer */}
            {q.type === "short_answer" && (
              <textarea
                value={answers[q.id] ?? ""}
                onChange={e => setAnswer(q.id, e.target.value)}
                placeholder="Type your answer here…"
                rows={4}
                className="w-full px-3 py-2 text-[12px] focus:outline-none resize-none"
                style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
              />
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button onClick={() => setCurrent(p => Math.max(0, p - 1))} disabled={current === 0}
            className="h-9 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-30"
            style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
            onMouseEnter={e => { if (current > 0) { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
            ← Previous
          </button>

          {/* Question dots */}
          <div className="flex items-center gap-1 flex-wrap justify-center max-w-xs">
            {questions.map((_, qi) => (
              <button key={qi} onClick={() => setCurrent(qi)}
                className="h-5 w-5 text-[8px] font-bold border transition-colors"
                style={{
                  borderColor:     qi === current ? C.accent : answers[questions[qi].id] ? "#34d39940" : C.border,
                  backgroundColor: qi === current ? C.accent + "20" : answers[questions[qi].id] ? "rgba(52,211,153,0.1)" : "transparent",
                  color:           qi === current ? C.accent : answers[questions[qi].id] ? "#34d399" : C.dim,
                }}>
                {qi + 1}
              </button>
            ))}
          </div>

          {current < questions.length - 1 ? (
            <button onClick={() => setCurrent(p => Math.min(questions.length - 1, p + 1))}
              className="flex items-center gap-1 h-9 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors"
              style={{ borderColor: C.accent, color: C.accent, backgroundColor: C.accent + "10" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = C.accent + "20"; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = C.accent + "10"; }}>
              Next <ChevronRight className="size-3" />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting}
              className="flex items-center gap-1.5 h-9 px-5 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
              style={{ borderColor: C.accent, color: "#fff", backgroundColor: C.accent }}>
              {submitting ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
              {submitting ? "Submitting…" : "Submit Exam"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
