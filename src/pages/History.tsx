import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useNavigate } from 'react-router-dom';

const P = { bg: '#f2f0eb', card: '#ffffff', primary: '#1a3a2a', accent: '#6ee09e', border: '#e0ddd4', label: '#8a8278', muted: '#b0aba2' };

export default function History() {
  const navigate = useNavigate();
  const matches  = useLiveQuery(() => db.matches.orderBy('date').reverse().toArray());

  if (!matches) return <div className="p-4 text-center" style={{ color: P.muted }}>Loading…</div>;

  return (
    <div className="min-h-full p-3 flex flex-col gap-3" style={{ background: P.bg }}>

      {/* Screen title */}
      <div className="pt-1 pb-2">
        <p style={{ fontSize: 13, fontWeight: 600, color: P.primary }}>Match History</p>
      </div>

      {matches.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center py-16 gap-2">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#d4f4e2' }}>
            <span style={{ fontSize: 24 }}>🏏</span>
          </div>
          <p style={{ fontSize: 13, fontWeight: 600, color: P.primary, marginTop: 8 }}>No matches yet</p>
          <p style={{ fontSize: 11, color: P.muted }}>Start a new match to see it here.</p>
        </div>
      )}

      {matches.map(match => {
        const d = new Date(match.date);
        const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isLive = match.status === 'in_progress';

        return (
          <button
            key={match.id}
            onClick={() => navigate(isLive ? `/live-scoring/${match.id}` : `/scorecard/${match.id}`)}
            className="w-full text-left active:scale-[0.99] transition-transform"
          >
            <div className="ct-card p-3">
              {/* Row 1: date + format pill */}
              <div className="flex justify-between items-center mb-2">
                <span style={{ fontSize: 9, fontWeight: 400, color: P.muted }}>{dateStr} · {timeStr}</span>
                <div className="flex gap-2 items-center">
                  {isLive && (
                    <span className="flex items-center gap-1" style={{ fontSize: 9, fontWeight: 600, color: '#c53030' }}>
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />LIVE
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full" style={{ fontSize: 9, fontWeight: 600, color: P.label, background: P.bg, border: `1px solid ${P.border}` }}>
                    {match.overs}ov
                  </span>
                </div>
              </div>

              {/* Row 2: teams */}
              <div className="flex items-center gap-2 mb-3">
                {/* Team A avatar */}
                <div className="ct-avatar" style={{ fontSize: 11 }}>
                  {match.team_a_name.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: P.primary, flex: 1 }} className="truncate">
                  {match.team_a_name}
                </span>
                <span style={{ fontSize: 9, fontWeight: 600, color: P.muted }}>VS</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: P.primary, flex: 1, textAlign: 'right' }} className="truncate">
                  {match.team_b_name}
                </span>
                <div className="ct-avatar" style={{ fontSize: 11 }}>
                  {match.team_b_name.charAt(0).toUpperCase()}
                </div>
              </div>

              {/* Row 3: result */}
              <div className="rounded-lg px-3 py-2 flex items-center justify-between"
                style={{ background: isLive ? '#fff8f8' : '#f7faf9', border: `1px solid ${isLive ? '#fecaca' : P.border}` }}>
                {isLive ? (
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#c53030' }}>In Progress — Tap to resume</span>
                ) : match.result_winner ? (
                  <span style={{ fontSize: 11, fontWeight: 500, color: P.primary }}>
                    <strong>{match.result_winner === 'team_a' ? match.team_a_name : match.team_b_name}</strong>
                    {' '}won by {match.result_margin_value} {match.result_margin_type}
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: P.label }}>No result recorded</span>
                )}
                <span style={{ fontSize: 11, color: P.accent, fontWeight: 600 }}>›</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
