import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

const P = { bg: '#f2f0eb', card: '#ffffff', primary: '#1a3a2a', accent: '#6ee09e', navy: '#1a2e4a', border: '#e0ddd4', label: '#8a8278', muted: '#b0aba2' };

const fmtOvers = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`;

const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={`py-2 px-2 ${right ? 'text-right' : ''}`}
    style={{ fontSize: 9, fontWeight: 600, color: P.label, background: '#faf9f7', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
    {children}
  </th>
);

export default function Career() {
  const allPlayers   = useLiveQuery(() => db.players.toArray());
  const allBalls     = useLiveQuery(() => db.balls.toArray());
  const allMatchPlayers = useLiveQuery(() => db.match_players.toArray());
  const allInnings   = useLiveQuery(() => db.innings.toArray());
  const [filter, setFilter]   = useState('All Time');
  const [batSort, setBatSort] = useState<'runs' | 'avg' | 'sr' | 'mat'>('runs');
  const [bowlSort, setBowlSort] = useState<'wickets' | 'bsr' | 'er'>('wickets');

  const stats = useMemo(() => {
    if (!allPlayers || !allBalls || !allMatchPlayers || !allInnings) return [];

    // Build lookup: inningsId → matchId
    const inningsMatchMap = new Map<number, number>();
    allInnings.forEach(i => inningsMatchMap.set(i.id!, i.match_id));

    return allPlayers.map(p => {
      const bat  = { runs: 0, balls: 0, fours: 0, sixes: 0, dismissals: 0 };
      const bowl = { runs: 0, wickets: 0, balls: 0 };
      const batInningsSet  = new Set<number>(); // distinct innings player batted in
      const bowlInningsSet = new Set<number>(); // distinct innings player bowled in

      allBalls.forEach(b => {
        if (b.batsman_id === p.id) {
          batInningsSet.add(b.innings_id);
          if (!b.is_wide) bat.balls++;
          if (!b.is_bye && !b.is_leg_bye) {
            bat.runs += b.runs_scored;
            if (b.runs_scored === 4) bat.fours++;
            if (b.runs_scored === 6) bat.sixes++;
          }
          if (b.is_wicket) bat.dismissals++;
        }
        if (b.bowler_id === p.id) {
          bowlInningsSet.add(b.innings_id);
          if (!b.is_wide && !b.is_no_ball) bowl.balls++;
          if (!b.is_bye && !b.is_leg_bye) bowl.runs += b.runs_scored;
          if (b.is_wide || b.is_no_ball) bowl.runs++;
          if (b.is_wicket && b.wicket_type !== 'Run Out') bowl.wickets++;
        }
      });

      // Matches played = distinct matches the player was in the squad for
      const matchesInSquad = new Set(allMatchPlayers.filter(mp => mp.player_id === p.id).map(mp => mp.match_id));
      const mat = matchesInSquad.size;

      // Innings batted / bowled
      const innBat  = batInningsSet.size;
      const innBowl = bowlInningsSet.size;

      // Stats
      const avg = bat.dismissals > 0 ? (bat.runs / bat.dismissals).toFixed(1) : bat.runs > 0 ? '\u221e' : '\u2014';
      const sr  = bat.balls > 0 ? ((bat.runs / bat.balls) * 100).toFixed(0) : '\u2014';
      const er  = bowl.balls > 0 ? (bowl.runs / (bowl.balls / 6)).toFixed(1) : '\u2014';
      const bsr = bowl.wickets > 0 ? (bowl.balls / bowl.wickets).toFixed(1) : '\u2014';

      return { ...p, bat, bowl, avg, sr, er, bsr, mat, innBat, innBowl };
    });
  }, [allPlayers, allBalls, allMatchPlayers, allInnings]);

  const avgNum = (v: string) => v === '\u221e' ? 9999 : v === '\u2014' ? -1 : parseFloat(v);
  const battingSorted = [...stats].sort((a, b) =>
    batSort === 'runs' ? b.bat.runs - a.bat.runs :
    batSort === 'avg'  ? avgNum(b.avg) - avgNum(a.avg) :
    batSort === 'mat'  ? b.mat - a.mat :
    avgNum(b.sr) - avgNum(a.sr)
  );
  const bowlingSorted = [...stats].sort((a, b) =>
    bowlSort === 'wickets' ? b.bowl.wickets - a.bowl.wickets :
    bowlSort === 'bsr'     ? (a.bsr === '\u2014' ? 9999 : parseFloat(a.bsr)) - (b.bsr === '\u2014' ? 9999 : parseFloat(b.bsr)) :
    (a.er === '\u2014' ? 9999 : parseFloat(a.er)) - (b.er === '\u2014' ? 9999 : parseFloat(b.er))
  );
  const topBat  = battingSorted[0];
  const topBowl = [...stats].sort((a, b) => b.bowl.wickets - a.bowl.wickets)[0];

  if (!allPlayers || !allBalls) return <div className="p-4 text-center" style={{ color: P.muted }}>Loading…</div>;

  return (
    <div className="min-h-full p-3 flex flex-col gap-3" style={{ background: P.bg }}>

      {/* Screen title + filter */}
      <div className="flex items-center justify-between pt-1">
        <p style={{ fontSize: 13, fontWeight: 600, color: P.primary }}>Career Stats</p>
        <div className="flex gap-1">
          {['All Time', '30 Days'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="ct-btn-outline px-2 py-1 text-[10px]"
              style={filter === f ? { background: P.primary, color: '#fff', border: `1.5px solid ${P.primary}` } : {}}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Hero leaderboard cards */}
      <div className="flex gap-3">

        {/* Most Runs */}
        <div className="flex-1 rounded-xl p-3 flex flex-col gap-1" style={{ background: P.primary }}>
          <p style={{ fontSize: 9, fontWeight: 600, color: P.accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Most Runs</p>
          <div className="ct-avatar" style={{ background: 'rgba(110,224,158,0.2)', color: P.accent }}>
            {topBat?.name.charAt(0).toUpperCase() ?? '?'}
          </div>
          <p style={{ fontSize: 11, fontWeight: 500, color: '#e8f5ee' }} className="truncate">{topBat?.name ?? '—'}</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: P.accent, lineHeight: 1 }}>{topBat?.bat.runs ?? 0}</p>
        </div>

        {/* Most Wickets */}
        <div className="flex-1 rounded-xl p-3 flex flex-col gap-1" style={{ background: P.navy }}>
          <p style={{ fontSize: 9, fontWeight: 600, color: '#90b4d8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Most Wickets</p>
          <div className="ct-avatar" style={{ background: 'rgba(144,180,216,0.2)', color: '#90b4d8' }}>
            {topBowl?.name.charAt(0).toUpperCase() ?? '?'}
          </div>
          <p style={{ fontSize: 11, fontWeight: 500, color: '#d0e4f4' }} className="truncate">{topBowl?.name ?? '—'}</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#90b4d8', lineHeight: 1 }}>{topBowl?.bowl.wickets ?? 0}</p>
        </div>
      </div>

      {/* Batting table */}
      <div className="ct-card">
        <div className="ct-card-header flex items-center justify-between">
          <span style={{ fontSize: 10, fontWeight: 600, color: P.primary }}>BATTING</span>
          <div className="flex gap-1">
            {(['runs', 'avg', 'sr', 'mat'] as const).map(s => (
              <button key={s} onClick={() => setBatSort(s)}
                className="px-2 py-0.5 rounded-full"
                style={{ fontSize: 9, fontWeight: 600, background: batSort === s ? P.primary : P.bg, color: batSort === s ? '#fff' : P.label, border: `1px solid ${P.border}` }}>
                {s === 'runs' ? 'Runs' : s === 'avg' ? 'Avg' : s === 'sr' ? 'SR' : 'Mat'}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: `1px solid ${P.border}` }}>
                <Th>Player</Th><Th right>Mat</Th><Th right>Inn</Th><Th right>R</Th><Th right>Avg</Th><Th right>SR</Th><Th right>4s</Th><Th right>6s</Th>
              </tr>
            </thead>
            <tbody>
              {battingSorted.map((s, i) => (
                <tr key={s.id} style={{ borderBottom: i < battingSorted.length - 1 ? `1px solid ${P.border}` : 'none' }}>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1.5">
                      <div className="ct-avatar" style={{ width: 22, height: 22, fontSize: 9, borderRadius: 5 }}>
                        {s.name.charAt(0)}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 500, color: P.primary }} className="truncate max-w-[60px]">{s.name}</span>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right" style={{ fontSize: 10, color: P.label }}>{s.mat}</td>
                  <td className="py-2 px-2 text-right" style={{ fontSize: 10, color: P.label }}>{s.innBat}</td>
                  <td className="py-2 px-2 text-right" style={{ fontSize: 10, fontWeight: 700, color: P.primary }}>{s.bat.runs}</td>
                  <td className="py-2 px-2 text-right" style={{ fontSize: 10, fontWeight: 600, color: '#1a5796' }}>{s.avg}</td>
                  <td className="py-2 px-2 text-right" style={{ fontSize: 10, fontWeight: 600, color: '#1a7a4a' }}>{s.sr}</td>
                  <td className="py-2 px-2 text-right" style={{ fontSize: 10, color: P.label }}>{s.bat.fours}</td>
                  <td className="py-2 px-2 text-right" style={{ fontSize: 10, color: P.label }}>{s.bat.sixes}</td>
                </tr>
              ))}
              {battingSorted.length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center" style={{ fontSize: 11, color: P.muted }}>No data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bowling table */}
      <div className="ct-card mb-4">
        <div className="ct-card-header flex items-center justify-between">
          <span style={{ fontSize: 10, fontWeight: 600, color: P.primary }}>BOWLING</span>
          <div className="flex gap-1">
            {(['wickets', 'bsr', 'er'] as const).map(s => (
              <button key={s} onClick={() => setBowlSort(s)}
                className="px-2 py-0.5 rounded-full"
                style={{ fontSize: 9, fontWeight: 600, background: bowlSort === s ? P.primary : P.bg, color: bowlSort === s ? '#fff' : P.label, border: `1px solid ${P.border}` }}>
                {s === 'wickets' ? 'Wkts' : s === 'bsr' ? 'SR' : 'ER'}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: `1px solid ${P.border}` }}>
                <Th>Player</Th><Th right>Mat</Th><Th right>Inn</Th><Th right>W</Th><Th right>SR</Th><Th right>O</Th><Th right>R</Th><Th right>ER</Th>
              </tr>
            </thead>
            <tbody>
              {bowlingSorted.map((s, i) => (
                <tr key={s.id} style={{ borderBottom: i < bowlingSorted.length - 1 ? `1px solid ${P.border}` : 'none' }}>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1.5">
                      <div className="ct-avatar" style={{ width: 22, height: 22, fontSize: 9, borderRadius: 5 }}>
                        {s.name.charAt(0)}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 500, color: P.primary }} className="truncate max-w-[60px]">{s.name}</span>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right" style={{ fontSize: 10, color: P.label }}>{s.mat}</td>
                  <td className="py-2 px-2 text-right" style={{ fontSize: 10, color: P.label }}>{s.innBowl}</td>
                  <td className="py-2 px-2 text-right" style={{ fontSize: 10, fontWeight: 700, color: '#1a7a4a' }}>{s.bowl.wickets}</td>
                  <td className="py-2 px-2 text-right" style={{ fontSize: 10, fontWeight: 600, color: '#1a5796' }}>{s.bsr}</td>
                  <td className="py-2 px-2 text-right" style={{ fontSize: 10, color: P.label }}>{fmtOvers(s.bowl.balls)}</td>
                  <td className="py-2 px-2 text-right" style={{ fontSize: 10, color: P.label }}>{s.bowl.runs}</td>
                  <td className="py-2 px-2 text-right" style={{ fontSize: 10, fontWeight: 600, color: P.primary }}>{s.er}</td>
                </tr>
              ))}
              {bowlingSorted.length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center" style={{ fontSize: 11, color: P.muted }}>No data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
