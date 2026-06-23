"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import MatchCard from "@/components/MatchCard";

function isWorldCup(c) {
  return (
    c.leagueId === 1 ||
    c.code === "WC" ||
    /coupe du monde|world cup/i.test(c.name)
  );
}

export default function HomePage() {
  const [competitions, setCompetitions] = useState([]);
  const [provider, setProvider] = useState(null);
  const [selected, setSelected] = useState(null); // code compétition
  const [query, setQuery] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [match, setMatch] = useState(null); // match ouvert en détail

  // Charge la liste des compétitions
  useEffect(() => {
    fetch("/api/competitions")
      .then((r) => r.json())
      .then((d) => {
        const comps = d.competitions || [];
        setCompetitions(comps);
        setProvider(d.provider);
        const wc = comps.find(isWorldCup);
        setSelected(wc ? wc.code : comps[0]?.code || null);
      })
      .catch(() => setCompetitions([]));
  }, []);

  // Charge les matchs de la compétition sélectionnée
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoading(true);
    setMatch(null);
    fetch(`/api/matches?competition=${encodeURIComponent(selected)}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setData({ matches: [], error: true }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const worldCup = useMemo(
    () => competitions.find(isWorldCup),
    [competitions]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = competitions;
    if (q) {
      list = competitions.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.country || "").toLowerCase().includes(q)
      );
    }
    return list.slice(0, 80); // limite l'affichage pour rester fluide
  }, [competitions, query]);

  const selectedComp = competitions.find((c) => c.code === selected);

  if (match) {
    return (
      <>
        <Header />
        <main className="container">
          <MatchDetail match={match} onBack={() => setMatch(null)} />
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="container">
        {/* Sélecteur de compétition */}
        <div className="selector">
          <input
            className="search"
            type="text"
            placeholder="🔍 Rechercher un championnat, une coupe, un pays…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {worldCup && !query && (
            <button
              className={`comp-row featured ${
                selected === worldCup.code ? "active" : ""
              }`}
              onClick={() => setSelected(worldCup.code)}
            >
              <span className="comp-emoji">🌍</span>
              <span className="comp-name">
                {worldCup.name}
                <small>Coupe du Monde — à la une</small>
              </span>
            </button>
          )}

          <div className="comp-list">
            {competitions.length === 0 && (
              <div className="loading">Chargement des compétitions…</div>
            )}
            {filtered.map((c) => (
              <button
                key={c.code}
                className={`comp-row ${selected === c.code ? "active" : ""}`}
                onClick={() => setSelected(c.code)}
              >
                {c.flag ? (
                  <img className="comp-flag" src={c.flag} alt="" />
                ) : (
                  <span className="comp-emoji">
                    {c.type === "Cup" ? "🏆" : "⚽"}
                  </span>
                )}
                <span className="comp-name">
                  {c.name}
                  <small>
                    {c.country}
                    {c.type === "Cup" ? " · Coupe" : ""}
                  </small>
                </span>
              </button>
            ))}
            {query && filtered.length === 0 && (
              <div className="empty">Aucune compétition trouvée.</div>
            )}
          </div>
        </div>

        {/* Matchs de la compétition sélectionnée */}
        <h2 className="section-title">
          {selectedComp ? selectedComp.name : "Matchs à venir"}
        </h2>

        {data?.demo && (
          <div className="banner">
            <b>Mode démo</b> — données fictives. Configure une clé API pour les
            vrais matchs.
          </div>
        )}

        {loading && <div className="loading">Chargement des matchs…</div>}

        {!loading && (!data?.matches || data.matches.length === 0) && (
          <div className="empty">
            Aucun match à venir pour cette compétition (hors saison ou phase
            non programmée).
          </div>
        )}

        {!loading &&
          data?.matches?.map((m) => (
            <MatchCard key={m.id} match={m} onSelect={setMatch} />
          ))}

        <p className="footer-note">
          Les pronostics sont des estimations probabilistes générées par un
          modèle statistique et une IA. Ils ne garantissent aucun résultat.
          <br />
          Jouer comporte des risques : endettement, dépendance… Appelez le 09 74
          75 13 13 (appel non surtaxé).
        </p>
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
        {match.round && <p className="muted-line">{match.round}</p>}

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

      {!loading && result?.scorers && (
        <div className="detail">
          <h3 className="scorers-title">⚽ Buteurs probables</h3>
          <div className="scorers-cols">
            <ScorerColumn team={match.home.name} players={result.scorers.home} />
            <ScorerColumn team={match.away.name} players={result.scorers.away} />
          </div>
          <p className="muted-line scorers-warn">
            Les buteurs sont l&apos;élément le plus incertain d&apos;un
            pronostic (compositions, blessures, hasard).
          </p>
        </div>
      )}

      <div className="detail">
        {loading && (
          <div className="loading">🧠 L&apos;IA analyse le match…</div>
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

function ScorerColumn({ team, players }) {
  return (
    <div className="scorer-col">
      <div className="scorer-team">{team}</div>
      {players && players.length > 0 ? (
        players.map((p) => (
          <div className="scorer-row" key={p.name}>
            <span className="scorer-name">{p.name}</span>
            <span className="scorer-prob">{p.prob}%</span>
          </div>
        ))
      ) : (
        <div className="scorer-row scorer-empty">
          Pas de données buteurs
        </div>
      )}
    </div>
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
