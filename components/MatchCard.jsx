"use client";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function MatchCard({ match, onSelect }) {
  const { home, away, prediction, utcDate } = match;
  const p = prediction.probabilities;

  return (
    <div className="match-card" onClick={() => onSelect(match)}>
      <div className="match-top">
        <span className="match-date">{formatDate(utcDate)}</span>
        <span className="match-pick">
          Prono : {prediction.pick.outcome} · {prediction.pick.confidence}%
        </span>
      </div>

      <div className="teams">
        <div className="team">
          {home.crest && (
            <img className="crest" src={home.crest} alt="" />
          )}
          <span>{home.name}</span>
        </div>
        <span className="vs">VS</span>
        <div className="team away">
          <span>{away.name}</span>
          {away.crest && (
            <img className="crest" src={away.crest} alt="" />
          )}
        </div>
      </div>

      <div className="prob-bar">
        <div className="seg-home" style={{ width: `${p.home}%` }} />
        <div className="seg-draw" style={{ width: `${p.draw}%` }} />
        <div className="seg-away" style={{ width: `${p.away}%` }} />
      </div>
      <div className="prob-legend">
        <span>1 · {p.home}%</span>
        <span>N · {p.draw}%</span>
        <span>2 · {p.away}%</span>
      </div>
    </div>
  );
}
