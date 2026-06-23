"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import MatchCard from "@/components/MatchCard";

const COMPETITIONS = [
  { code: "FL1", name: "Ligue 1", flag: "🇫🇷" },
  { code: "PL", name: "Premier League", flag: "🏴" },
  { code: "PD", name: "La Liga", flag: "🇪🇸" },
  { code: "SA", name: "Serie A", flag: "🇮🇹" },
  { code: "BL1", name: "Bundesliga", flag: "🇩🇪" },
];

export default function HomePage() {
  const [competition, setCompetition] = useState("FL1");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSelected(null);
    fetch(`/api/matches?competition=${competition}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData({ matches: [], error: true });
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [competition]);

  return (
    <>
      <Header />
      <main className="container">
        {selected ? (
          <MatchDetail match={selected} onBack={() => setSelected(null)} />
        ) : (
          <>
            <div className="tabs">
              {COMPETITIONS.map((c) => (
                <button
                  key={c.code}
                  className={`tab ${competition === c.code ? "active" : ""}`}
                  onClick={() => setCompetition(c.code)}
                >
                  {c.flag} {c.name}
                </button>
              ))}
            </div>

            {data?.demo && (
              <div className="banner">
                <b>Mode démo</b> — données fictives. Ajoute un token{" "}
                <code>FOOTBALL_DATA_TOKEN</code> dans <code>.env.local</code>{" "}
                pour les vrais matchs.
              </div>
            )}

            {loading && <div className="loading">Chargement des matchs…</div>}

            {!loading && (!data?.matches || data.matches.length === 0) && (
              <div className="empty">
                Aucun match à venir pour ce championnat.
              </div>
            )}

            {!loading &&
              data?.matches?.map((m) => (
                <MatchCard key={m.id} match={m} onSelect={setSelected} />
              ))}

            <p className="footer-note">
              Les pronostics sont des estimations probabilistes générées par un
              modèle statistique et une IA. Ils ne garantissent aucun résultat.
              <br />
              Jouer comporte des risques : endettement, dépendance… Appelez le
              09 74 75 13 13 (appel non surtaxé).
            </p>
          </>
        )}
      </main>
    </>
  );
}

function MatchDetail({ match, onBack }) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId: match.id }),
    })
      .then((r) => r.json())
      .then((d) => !cancelled && setResult(d))
      .catch(() => !cancelled && setResult({ error: true }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [match.id]);

  const pred = result?.prediction || match.prediction;

  return (
    <>
      <span className="back" onClick={onBack} role="button">
        ← Retour aux matchs
      </span>

      <div className="detail">
        <h2>
          {match.home.name} vs {match.away.name}
        </h2>

        {pred && (
          <div className="grid-stats">
            <div className="stat-box">
              <div className="v">{pred.probabilities.home}%</div>
              <div className="l">Victoire {match.home.name}</div>
            </div>
            <div className="stat-box">
              <div className="v">{pred.probabilities.draw}%</div>
              <div className="l">Match nul</div>
            </div>
            <div className="stat-box">
              <div className="v">{pred.probabilities.away}%</div>
              <div className="l">Victoire {match.away.name}</div>
            </div>
            <div className="stat-box">
              <div className="v">{pred.topScores[0].score}</div>
              <div className="l">Score probable</div>
            </div>
            <div className="stat-box">
              <div className="v">{pred.markets.over25}%</div>
              <div className="l">+2,5 buts</div>
            </div>
            <div className="stat-box">
              <div className="v">{pred.markets.bttsYes}%</div>
              <div className="l">Les 2 marquent</div>
            </div>
          </div>
        )}
      </div>

      <div className="detail">
        {loading && (
          <div className="loading">
            🧠 L&apos;IA analyse le match…
          </div>
        )}
        {!loading && result?.analysis && (
          <div className="analysis">
            <span className="source-tag">
              {result.source === "claude"
                ? "Analyse IA (Claude + stats)"
                : "Analyse modèle statistique"}
            </span>
            <Markdown text={result.analysis} />
          </div>
        )}
        {!loading && result?.error && (
          <div className="empty">Impossible de générer l&apos;analyse.</div>
        )}
      </div>
    </>
  );
}

// Mini rendu Markdown : gras **...** et sauts de ligne
function Markdown({ text }) {
  const html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
