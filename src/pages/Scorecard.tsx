import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ArrowLeft } from 'lucide-react';

// ── Helpers ─────────────────────────────────────────────────────────────────
const fmtOvers = (legal: number) => `${Math.floor(legal / 6)}.${legal % 6}`;

export default function Scorecard() {
  const { matchId } = useParams();
  const navigate    = useNavigate();
  const mId         = parseInt(matchId || '0');

  const match       = useLiveQuery(() => db.matches.get(mId));
  const inningsList = useLiveQuery(() => db.innings.where('match_id').equals(mId).toArray());
  const allPlayers  = useLiveQuery(() => db.players.toArray());
  const matchPlayers = useLiveQuery(() => db.match_players.where('match_id').equals(mId).toArray());
  const allBalls    = useLiveQuery(() => db.balls.toArray());

  if (!match || !inningsList || !allPlayers || !allBalls || !matchPlayers)
    return <div className="h-screen flex items-center justify-center text-gray-500">Loading…</div>;

  const getPlayerName = (id: number | null | undefined) =>
    id ? (allPlayers.find(p => p.id === id)?.name ?? '?') : '—';

  // ── Per-innings computed stats ───────────────────────────────────────────
  const computeInnings = (inningsId: number, battingTeam: 'team_a' | 'team_b') => {
    const balls    = allBalls.filter(b => b.innings_id === inningsId);
    const batters  = matchPlayers.filter(mp => mp.team === battingTeam);
    const bowlers  = matchPlayers.filter(mp => mp.team !== battingTeam);

    // ── Batting ──
    const battingRows = batters.map(mp => {
      const pid = mp.player_id;
      let r = 0, b = 0, fours = 0, sixes = 0;
      let dismissalType: string | undefined;
      let fielder: string | undefined;
      let bowler: string  | undefined;

      balls.forEach(ball => {
        if (ball.batsman_id !== pid) return;
        if (!ball.is_wide) {
          b++;
          if (!ball.is_bye && !ball.is_leg_bye) {
            r += ball.runs_scored;
            if (ball.runs_scored === 4) fours++;
            if (ball.runs_scored === 6) sixes++;
          }
        }
        if (ball.is_wicket && ball.batsman_id === pid) {
          dismissalType = ball.wicket_type;
          if (ball.fielder_id) fielder = getPlayerName(ball.fielder_id);
          if (ball.bowler_id)  bowler  = getPlayerName(ball.bowler_id);
        }
      });

      const hasFaced = b > 0 || dismissalType != null;
      if (!hasFaced) return null; // hasn't batted yet

      const sr = b > 0 ? ((r / b) * 100).toFixed(1) : '0.0';
      let dismissalText = 'not out';
      if (dismissalType) {
        if (dismissalType === 'Bowled')     dismissalText = `b ${bowler}`;
        else if (dismissalType === 'Caught') dismissalText = `c ${fielder} b ${bowler}`;
        else if (dismissalType === 'LBW')   dismissalText = `lbw b ${bowler}`;
        else if (dismissalType === 'Run Out') dismissalText = `run out (${fielder})`;
        else if (dismissalType === 'Stumped') dismissalText = `st b ${bowler}`;
        else dismissalText = dismissalType ?? 'out';
      } else if (mp.is_retired) {
        dismissalText = 'retired not out';
      }
      return { name: getPlayerName(pid), r, b, fours, sixes, sr, dismissalText };
    }).filter(Boolean) as { name: string; r: number; b: number; fours: number; sixes: number; sr: string; dismissalText: string }[];

    // ── Bowling ──
    const bowlingRows = bowlers.map(mp => {
      const pid = mp.player_id;
      let legal = 0, r = 0, w = 0, wides = 0, noBalls = 0;

      balls.forEach(ball => {
        if (ball.bowler_id !== pid) return;
        if (!ball.is_wide && !ball.is_no_ball) legal++;
        if (ball.is_wide) { wides++; r++; }
        if (ball.is_no_ball) { noBalls++; r++; }
        if (!ball.is_bye && !ball.is_leg_bye) r += ball.runs_scored;
        if (ball.is_wicket && ball.wicket_type !== 'Run Out') w++;
      });

      if (legal === 0 && wides === 0 && noBalls === 0) return null;
      return {
        name: getPlayerName(pid),
        overs: fmtOvers(legal), r, w,
        er: legal > 0 ? (r / (legal / 6)).toFixed(1) : '0.0'
      };
    }).filter(Boolean) as { name: string; overs: string; r: number; w: number; er: string }[];

    // ── Totals ──
    let totalRuns = 0, totalWickets = 0, legalBalls = 0;
    let extrasWide = 0, extrasNoBall = 0, extrasBye = 0, extrasLegBye = 0;
    balls.forEach(b => {
      totalRuns += b.runs_scored + (b.is_wide || b.is_no_ball ? 1 : 0);
      if (!b.is_wide && !b.is_no_ball) legalBalls++;
      if (b.is_wicket) totalWickets++;
      if (b.is_wide   && !b.is_no_ball) extrasWide++;
      if (b.is_no_ball) extrasNoBall++;
      if (b.is_bye)     extrasBye += b.runs_scored;
      if (b.is_leg_bye) extrasLegBye += b.runs_scored;
    });

    return { battingRows, bowlingRows, totalRuns, totalWickets, overs: fmtOvers(legalBalls), extrasWide, extrasNoBall, extrasBye, extrasLegBye };
  };

  const innings1 = inningsList[0];
  const innings2 = inningsList[1];
  const data1    = innings1 ? computeInnings(innings1.id!, innings1.batting_team) : null;
  const data2    = innings2 ? computeInnings(innings2.id!, innings2.batting_team) : null;

  return (
    <div className="flex flex-col min-h-screen bg-cricket-bg">
      {/* Header */}
      <header className="bg-cricket-green text-white px-4 py-3 shadow-md flex items-center sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="mr-3"><ArrowLeft size={22} /></button>
        <div>
          <h1 className="text-base font-bold">Match Scorecard</h1>
          <p className="text-xs text-green-100">{match.team_a_name} vs {match.team_b_name}</p>
        </div>
      </header>

      <div className="p-3 flex flex-col gap-4 pb-8">

        {/* Result card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Result</h2>
          <p className="text-cricket-green font-bold text-base">
            {match.status === 'in_progress' ? (
              <span className="text-yellow-600">Match in progress</span>
            ) : match.result_winner ? (
              `${match.result_winner === 'team_a' ? match.team_a_name : match.team_b_name} won by ${match.result_margin_value} ${match.result_margin_type}`
            ) : 'No result yet'}
          </p>
          {match.status === 'in_progress' && (
            <button onClick={() => navigate(`/live-scoring/${match.id}`)}
              className="mt-3 px-5 py-2 bg-cricket-green text-white rounded-xl font-bold text-sm">
              Resume Match
            </button>
          )}
        </div>

        {/* Innings blocks */}
        {[{ label: '1st Innings', innings: innings1, data: data1 }, { label: '2nd Innings', innings: innings2, data: data2 }]
          .filter(x => x.innings)
          .map(({ label, innings, data }) => {
            if (!innings || !data) return null;
            const battingName = innings.batting_team === 'team_a' ? match.team_a_name : match.team_b_name;
            const extra = data.extrasWide + data.extrasNoBall + data.extrasBye + data.extrasLegBye;

            return (
              <div key={innings.id} className="flex flex-col gap-3">
                {/* Innings header */}
                <div className="bg-cricket-green text-white rounded-xl px-4 py-3 flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold opacity-80">{label} • {battingName}</p>
                    <p className="text-2xl font-black">{data.totalRuns}/{data.totalWickets}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-bold">{data.overs} ov</p>
                    <p className="text-green-100 text-xs">Extras: {extra}</p>
                  </div>
                </div>

                {/* Batting scorecard */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 border-b border-gray-100">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Batting</h3>
                  </div>
                  {/* header row */}
                  <div className="flex text-xs text-gray-400 font-bold px-3 py-1 border-b border-gray-100">
                    <div className="flex-1">Batter</div>
                    <div className="w-7 text-right">R</div>
                    <div className="w-7 text-right">B</div>
                    <div className="w-7 text-right">4s</div>
                    <div className="w-7 text-right">6s</div>
                    <div className="w-9 text-right">SR</div>
                  </div>
                  {data.battingRows.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-gray-400 text-center">No batting data yet.</p>
                  ) : data.battingRows.map((row, i) => (
                    <div key={i} className="px-3 py-2 border-b border-gray-50">
                      <div className="flex items-center text-sm">
                        <div className="flex-1 min-w-0 pr-1">
                          <span className="font-bold text-gray-800 block truncate">{row.name}</span>
                          <span className="text-xs text-gray-400 block truncate">{row.dismissalText}</span>
                        </div>
                        <div className="w-7 text-right font-bold text-gray-800 shrink-0">{row.r}</div>
                        <div className="w-7 text-right text-gray-500 shrink-0">{row.b}</div>
                        <div className="w-7 text-right text-gray-500 shrink-0">{row.fours}</div>
                        <div className="w-7 text-right text-gray-500 shrink-0">{row.sixes}</div>
                        <div className="w-9 text-right text-gray-500 shrink-0">{row.sr}</div>
                      </div>
                    </div>
                  ))}
                  {extra > 0 && (
                    <div className="px-3 py-2 flex text-sm text-gray-500 border-t border-gray-100">
                      <div className="flex-1">Extras</div>
                      <div className="font-medium text-gray-700">{extra}</div>
                      <div className="text-xs ml-2 text-gray-400">
                        (wd {data.extrasWide}, nb {data.extrasNoBall}, b {data.extrasBye}, lb {data.extrasLegBye})
                      </div>
                    </div>
                  )}
                </div>

                {/* Bowling scorecard */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 border-b border-gray-100">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Bowling</h3>
                  </div>
                  <div className="flex text-xs text-gray-400 font-bold px-3 py-1 border-b border-gray-100">
                    <div className="flex-1">Bowler</div>
                    <div className="w-9 text-right">O</div>
                    <div className="w-7 text-right">R</div>
                    <div className="w-7 text-right">W</div>
                    <div className="w-9 text-right">ER</div>
                  </div>
                  {data.bowlingRows.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-gray-400 text-center">No bowling data yet.</p>
                  ) : data.bowlingRows.map((row, i) => (
                    <div key={i} className="px-3 py-2 border-b border-gray-50 flex items-center text-sm">
                      <div className="flex-1 min-w-0 pr-1">
                        <span className="font-bold text-gray-800 block truncate">{row.name}</span>
                      </div>
                      <div className="w-9 text-right text-gray-500 shrink-0">{row.overs}</div>
                      <div className="w-7 text-right text-gray-500 shrink-0">{row.r}</div>
                      <div className="w-7 text-right font-bold text-cricket-green shrink-0">{row.w}</div>
                      <div className="w-9 text-right text-gray-500 shrink-0">{row.er}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
