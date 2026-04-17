import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { addBall } from '../db/scoringQueries';

type DismissalType = 'Bowled' | 'Caught' | 'LBW' | 'Run Out' | 'Stumped' | 'Hit Wicket' | 'Other';

interface WicketState {
  step: 'who' | 'how' | 'fielder' | 'next';
  runsOnBall: number;
  outBatsmanId: number | null;
  dismissalType: DismissalType | null;
  fielderId: number | null;
}

const DISMISSAL_TYPES: DismissalType[] = ['Bowled', 'Caught', 'LBW', 'Run Out', 'Stumped', 'Hit Wicket', 'Other'];
const NEEDS_FIELDER: DismissalType[] = ['Caught', 'Run Out'];
const BOWLER_WICKET: DismissalType[] = ['Bowled', 'Caught', 'LBW', 'Stumped', 'Hit Wicket'];

// ─── Helper: overs display ───────────────────────────────────────────────────
const fmtOvers = (legal: number) =>
  `${Math.floor(legal / 6)}.${legal % 6}`;

export default function LiveScoring() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const mId = parseInt(matchId || '0');

  // DB queries
  const match      = useLiveQuery(() => db.matches.get(mId));
  const inningsList = useLiveQuery(() => db.innings.where('match_id').equals(mId).toArray());
  const allPlayers  = useLiveQuery(() => db.players.toArray());
  const matchPlayers = useLiveQuery(() => db.match_players.where('match_id').equals(mId).toArray());
  const balls        = useLiveQuery(() => db.balls.toArray());

  const currentInnings = inningsList?.[inningsList.length - 1];
  const isSecondInnings = (inningsList?.length ?? 0) >= 2;
  const currentInningsBalls = balls?.filter(b => b.innings_id === currentInnings?.id) ?? [];

  // 1st innings total for target calculation
  const firstInningsId = inningsList?.[0]?.id;
  const firstInningsBalls = balls?.filter(b => b.innings_id === firstInningsId) ?? [];
  const firstInningsRuns = firstInningsBalls.reduce((acc, b) => acc + b.runs_scored + (b.is_wide || b.is_no_ball ? 1 : 0), 0);

  // ─── Crease / bowler state ───────────────────────────────────────────────
  const [strikerId, setStrikerId]     = useState<number | null>(null);
  const [nonStrikerId, setNonStrikerId] = useState<number | null>(null);
  const [bowlerId, setBowlerId]       = useState<number | null>(null);
  const [dismissedIds, setDismissedIds] = useState<number[]>([]);

  // Modals
  const [selectionModal, setSelectionModal] = useState<'striker' | 'nonStriker' | 'bowler' | null>(null);
  const [wicketFlow,     setWicketFlow]     = useState<WicketState | null>(null);
  const [inningsEndModal, setInningsEndModal] = useState<{ runs: number; wickets: number; overs: string } | null>(null);
  const [matchEndModal,   setMatchEndModal]   = useState<{ winner: string; margin: string } | null>(null);
  const [endOfOverModal,  setEndOfOverModal]  = useState(false);

  // Extras toggles
  const [isWide,   setIsWide]   = useState(false);
  const [isNoBall, setIsNoBall] = useState(false);
  const [isBye,    setIsBye]    = useState(false);
  const [isLegBye, setIsLegBye] = useState(false);
  const [isWicket, setIsWicket] = useState(false);

  // ─── Computed stats ──────────────────────────────────────────────────────
  const { totalRuns, totalWickets, legalDeliveries } = useMemo(() => {
    let r = 0, w = 0, l = 0;
    currentInningsBalls.forEach(b => {
      r += b.runs_scored + (b.is_wide || b.is_no_ball ? 1 : 0);
      if (!b.is_wide && !b.is_no_ball) l++;
      if (b.is_wicket) w++;
    });
    return { totalRuns: r, totalWickets: w, legalDeliveries: l };
  }, [currentInningsBalls]);

  const crr            = legalDeliveries > 0 ? (totalRuns / (legalDeliveries / 6)).toFixed(2) : '0.00';
  const currentOverNum = Math.floor(legalDeliveries / 6) + 1;
  const ballsInOver    = legalDeliveries % 6;
  const thisOverBalls  = currentInningsBalls.filter(b => b.over_number === currentOverNum);

  // Target / RRR for 2nd innings
  const target       = isSecondInnings ? firstInningsRuns + 1 : null;
  const runsNeeded   = target ? target - totalRuns : null;
  const ballsLeft    = match ? match.overs * 6 - legalDeliveries : 0;
  const rrr          = (isSecondInnings && ballsLeft > 0 && runsNeeded !== null)
    ? (runsNeeded / (ballsLeft / 6)).toFixed(2)
    : null;

  // ─── Per-player stats ─────────────────────────────────────────────────────
  const getBatsmanStats = (pId: number) => {
    let r = 0, b = 0, fours = 0, sixes = 0;
    currentInningsBalls.forEach(ball => {
      if (ball.batsman_id !== pId) return;
      if (!ball.is_wide) {
        b++;
        if (!ball.is_bye && !ball.is_leg_bye) {
          r += ball.runs_scored;
          if (ball.runs_scored === 4) fours++;
          if (ball.runs_scored === 6) sixes++;
        }
      }
    });
    return { r, b, fours, sixes, sr: b > 0 ? ((r / b) * 100).toFixed(0) : '0' };
  };

  const getBowlerStats = (pId: number) => {
    let balls = 0, r = 0, w = 0;
    currentInningsBalls.forEach(ball => {
      if (ball.bowler_id !== pId) return;
      if (!ball.is_bye && !ball.is_leg_bye) r += ball.runs_scored;
      if (ball.is_wide || ball.is_no_ball) r += 1;
      else balls++;
      if (ball.is_wicket && ball.wicket_type !== 'Run Out') w++;
    });
    return {
      overs: fmtOvers(balls), r, w, maidens: 0,
      er: balls > 0 ? (r / (balls / 6)).toFixed(1) : '0.0',
    };
  };

  const getName = (pId: number | null) =>
    pId ? (allPlayers?.find(p => p.id === pId)?.name ?? 'Unknown') : '—';

  // ─── Innings / match end check ─────────────────────────────────────────────
  const checkInningsEnd = (newLegal: number, newWickets: number, newRuns: number): boolean => {
    if (!match) return false;
    const maxWickets = match.last_man_standing
      ? match.players_per_side          // all out including last man
      : match.players_per_side - 1;     // 9 wickets for 11-a-side (standard)

    const oversComplete = newLegal >= match.overs * 6;
    const allOut        = newWickets >= maxWickets;

    // 2nd innings: chasing team wins
    if (isSecondInnings && target !== null && newRuns >= target) {
      const wicketsLeft = match.players_per_side - newWickets;
      setMatchEndModal({
        winner: currentInnings!.batting_team === 'team_a' ? match.team_a_name : match.team_b_name,
        margin: `${wicketsLeft} wicket${wicketsLeft !== 1 ? 's' : ''}`,
      });
      return true;
    }

    if (oversComplete || allOut) {
      if (isSecondInnings) {
        // 2nd innings done — defending team wins
        const runDiff = (firstInningsRuns) - newRuns;
        setMatchEndModal({
          winner: currentInnings!.bowling_team === 'team_a' ? match.team_a_name : match.team_b_name,
          margin: `${runDiff} run${runDiff !== 1 ? 's' : ''}`,
        });
      } else {
        setInningsEndModal({ runs: newRuns, wickets: newWickets, overs: fmtOvers(newLegal) });
      }
      return true;
    }
    return false;
  };

  // ─── Start 2nd innings ────────────────────────────────────────────────────
  const startSecondInnings = async () => {
    if (!currentInnings || !match) return;
    const newBattingTeam  = currentInnings.bowling_team;
    const newBowlingTeam  = currentInnings.batting_team;
    await db.innings.add({
      match_id: mId,
      batting_team: newBattingTeam,
      bowling_team: newBowlingTeam,
      total_runs: 0, total_wickets: 0, total_overs_bowled: 0,
      extras_wide: 0, extras_noball: 0, extras_bye: 0, extras_legbye: 0,
    });
    // Reset all crease state for fresh innings
    setStrikerId(null);
    setNonStrikerId(null);
    setBowlerId(null);
    setDismissedIds([]);
    resetControls();
    setInningsEndModal(null);
  };

  // ─── End match in DB ──────────────────────────────────────────────────────
  const finaliseMatch = async () => {
    if (!matchEndModal || !match) return;
    const winnerKey = matchEndModal.winner === match.team_a_name ? 'team_a' : 'team_b';
    const isRuns    = matchEndModal.margin.includes('run');
    await db.matches.update(mId, {
      status: 'completed',
      result_winner: winnerKey,
      result_margin_type: isRuns ? 'runs' : 'wickets',
      result_margin_value: parseInt(matchEndModal.margin),
    });
    navigate(`/scorecard/${mId}`);
  };

  // ─── Commit ball ──────────────────────────────────────────────────────────
  const commitBall = async (opts: {
    runs: number;
    wicket: boolean;
    outBatsmanId: number | null;
    dismissalType: DismissalType | null;
    fielderId: number | null;
    extraWide?: boolean;
    extraNoBall?: boolean;
    extraBye?: boolean;
    extraLegBye?: boolean;
  }) => {
    if (!currentInnings || !strikerId || !bowlerId) return;

    const wide   = opts.extraWide   ?? isWide;
    const noBall = opts.extraNoBall ?? isNoBall;
    const bye    = opts.extraBye    ?? isBye;
    const legBye = opts.extraLegBye ?? isLegBye;

    await addBall({
      innings_id:  currentInnings.id!,
      over_number: currentOverNum,
      ball_number: thisOverBalls.length + 1,
      batsman_id:  strikerId,
      bowler_id:   bowlerId,
      runs_scored: opts.runs,
      is_wide:     wide,
      is_no_ball:  noBall,
      is_bye:      bye,
      is_leg_bye:  legBye,
      is_wicket:   opts.wicket,
      wicket_type: opts.dismissalType ?? undefined,
      fielder_id:  opts.fielderId ?? undefined,
    });

    // Snapshot BEFORE the live query re-fires and updates these values
    const snapLegal   = legalDeliveries;
    const snapWickets = totalWickets;
    const snapRuns    = totalRuns;

    const isLegal    = !wide && !noBall;
    const newLegal   = snapLegal + (isLegal ? 1 : 0);
    const newWickets = snapWickets + (opts.wicket ? 1 : 0);
    const newRuns    = snapRuns + opts.runs + (wide || noBall ? 1 : 0);

    const ended = checkInningsEnd(newLegal, newWickets, newRuns);
    if (ended) { resetControls(); return; }

    // End of over
    if (isLegal && newLegal % 6 === 0) {
      swapBatsmen();
      setBowlerId(null);
      setEndOfOverModal(true);
      resetControls();
      return;
    }

    // Odd runs rotate strike (not on wicket ball)
    if (opts.runs % 2 !== 0 && !opts.wicket) swapBatsmen();

    resetControls();
  };

  // ─── Wicket flow ──────────────────────────────────────────────────────────
  const handleRun = async (runs: number) => {
    if (!currentInnings || !strikerId || !bowlerId) {
      alert('Select striker, non-striker, and bowler first.'); return;
    }
    if (isWicket) {
      setWicketFlow({ step: 'who', runsOnBall: runs, outBatsmanId: null, dismissalType: null, fielderId: null });
    } else {
      await commitBall({ runs, wicket: false, outBatsmanId: null, dismissalType: null, fielderId: null });
    }
  };

  const wicketSelectWho = (id: number) =>
    setWicketFlow(p => p ? { ...p, step: 'how', outBatsmanId: id } : null);

  const wicketSelectHow = (type: DismissalType) =>
    setWicketFlow(p => p ? { ...p, dismissalType: type, step: NEEDS_FIELDER.includes(type) ? 'fielder' : 'next' } : null);

  const wicketSelectFielder = (fId: number) =>
    setWicketFlow(p => p ? { ...p, fielderId: fId, step: 'next' } : null);

  const wicketSelectNext = async (nextBatsmanId: number) => {
    if (!wicketFlow) return;
    const { runsOnBall, outBatsmanId, dismissalType, fielderId } = wicketFlow;

    await commitBall({ runs: runsOnBall, wicket: true, outBatsmanId, dismissalType, fielderId });

    // Update crease — replace dismissed batter
    if (outBatsmanId) {
      setDismissedIds(p => [...p, outBatsmanId]);
      if (nextBatsmanId > 0) {
        if (outBatsmanId === strikerId) setStrikerId(nextBatsmanId);
        else setNonStrikerId(nextBatsmanId);
      } else {
        // Last man: set to null
        if (outBatsmanId === strikerId) setStrikerId(null);
        else setNonStrikerId(null);
      }
    }
    setWicketFlow(null);
  };

  const cancelWicketFlow = () => { setWicketFlow(null); setIsWicket(false); };

  const swapBatsmen = () => {
    setStrikerId(prev => { setNonStrikerId(prev); return nonStrikerId; });
  };

  const resetControls = () => {
    setIsWide(false); setIsNoBall(false); setIsBye(false); setIsLegBye(false); setIsWicket(false);
  };

  const getBallText = (b: any) => {
    if (b.is_wicket) return 'W';
    if (b.is_wide) return b.runs_scored > 0 ? `${b.runs_scored + 1}wd` : 'wd';
    if (b.is_no_ball) return b.runs_scored > 0 ? `${b.runs_scored + 1}nb` : 'nb';
    if (b.is_bye) return `${b.runs_scored}b`;
    if (b.is_leg_bye) return `${b.runs_scored}lb`;
    return b.runs_scored.toString();
  };

  // ─── Render guard ─────────────────────────────────────────────────────────
  if (!match || !currentInnings || !allPlayers) return (
    <div className="h-screen flex items-center justify-center text-gray-500">Loading…</div>
  );

  const battingTeamName = currentInnings.batting_team === 'team_a' ? match.team_a_name : match.team_b_name;
  const inningsLabel    = isSecondInnings ? '2nd Innings' : '1st Innings';

  const battingMPs  = matchPlayers?.filter(mp => mp.team === currentInnings.batting_team) ?? [];
  const bowlingMPs  = matchPlayers?.filter(mp => mp.team === currentInnings.bowling_team) ?? [];
  const fielders    = bowlingMPs.map(mp => allPlayers.find(p => p.id === mp.player_id)).filter(Boolean);
  const availableBatsmen = battingMPs
    .map(mp => allPlayers.find(p => p.id === mp.player_id))
    .filter(p => p && p.id !== strikerId && p.id !== nonStrikerId && !dismissedIds.includes(p.id!));

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-screen bg-cricket-bg w-full overflow-hidden relative">

      {/* Header */}
      <header className="bg-cricket-green text-white px-4 py-3 flex items-center shrink-0 shadow-md z-10">
        <button onClick={() => navigate('/')} className="mr-3"><ArrowLeft size={22} /></button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold truncate">{match.team_a_name} vs {match.team_b_name}</h1>
          <p className="text-xs text-green-100">{battingTeamName} • {inningsLabel}</p>
        </div>
      </header>

      {/* Scrollable board */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">

        {/* Score card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <div className="text-5xl font-black text-gray-800 tracking-tight">
            {totalRuns}<span className="text-gray-400 text-3xl font-bold mx-1">-</span>{totalWickets}
          </div>
          <div className="text-gray-500 font-medium mt-1 text-sm bg-gray-50 rounded-full inline-block px-4 py-1">
            Over <span className="font-bold text-gray-800">{fmtOvers(legalDeliveries)}</span>
            <span className="mx-2">•</span>
            CRR: <span className="font-bold text-gray-800">{crr}</span>
          </div>
          {isSecondInnings && target !== null && (
            <div className="mt-2 text-sm font-medium text-cricket-dark">
              Need <strong>{runsNeeded}</strong> off <strong>{ballsLeft}</strong> balls • RRR: <strong>{rrr}</strong>
            </div>
          )}
        </div>

        {/* Batsmen */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex text-xs font-bold text-gray-400 bg-gray-50 px-3 py-2 border-b border-gray-100">
            <div className="flex-1">BATTER</div>
            <div className="w-7 text-right">R</div>
            <div className="w-7 text-right">B</div>
            <div className="w-9 text-right">SR</div>
          </div>
          <div className="px-3 py-2 space-y-3">
            {[{ id: strikerId, label: 'striker' as const }, { id: nonStrikerId, label: 'nonStriker' as const }].map(({ id, label }, idx) => (
              !id ? (
                <div key={idx} onClick={() => setSelectionModal(label)}
                  className="flex text-sm cursor-pointer text-cricket-green font-medium">
                  <div className="flex-1 flex justify-between items-center bg-green-50 px-3 py-2 rounded-lg">
                    Select {idx === 0 ? 'Striker' : 'Non-Striker'} <ChevronDown size={16} />
                  </div>
                </div>
              ) : (() => {
                const s = getBatsmanStats(id);
                return (
                  <div key={id} className={`flex items-center text-sm ${id === strikerId ? 'font-bold text-cricket-green' : 'text-gray-700'}`}>
                    <div className="flex-1 min-w-0 pr-1">
                      <span className="block truncate">{getName(id)}{id === strikerId ? ' *' : ''}</span>
                    </div>
                    <div className="w-7 text-right font-medium shrink-0">{s.r}</div>
                    <div className="w-7 text-right text-gray-500 font-normal shrink-0">{s.b}</div>
                    <div className="w-9 text-right text-gray-500 font-normal shrink-0">{s.sr}</div>
                  </div>
                );
              })()
            ))}
          </div>
        </div>

        {/* Bowler */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex text-xs font-bold text-gray-400 bg-gray-50 px-3 py-2 border-b border-gray-100">
            <div className="flex-1">BOWLER</div>
            <div className="w-8 text-right">O</div>
            <div className="w-8 text-right">M</div>
            <div className="w-8 text-right">R</div>
            <div className="w-8 text-right">W</div>
            <div className="w-10 text-right">ER</div>
          </div>
          <div className="px-3 py-2">
            {!bowlerId ? (
              <div onClick={() => setSelectionModal('bowler')}
                className="flex text-sm py-1 cursor-pointer text-cricket-green font-medium">
                <div className="flex-1 flex justify-between items-center bg-green-50 px-3 py-2 rounded-lg">
                  Select Bowler <ChevronDown size={16} />
                </div>
              </div>
            ) : (() => {
              const st = getBowlerStats(bowlerId);
              return (
                <div className="flex items-center text-sm py-1 font-bold text-gray-800">
                  <div className="flex-1 truncate">{getName(bowlerId)}</div>
                  <div className="w-8 text-right">{st.overs}</div>
                  <div className="w-8 text-right text-gray-500 font-normal">{st.maidens}</div>
                  <div className="w-8 text-right">{st.r}</div>
                  <div className="w-8 text-right text-cricket-green">{st.w}</div>
                  <div className="w-10 text-right text-gray-500 font-normal">{st.er}</div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* This Over */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-3 pt-2 pb-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-gray-400">THIS OVER ({ballsInOver}/6)</h3>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 items-center min-h-[40px]">
            {thisOverBalls.map((b, i) => (
              <div key={i} className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                b.is_wicket ? 'bg-red-500 text-white' :
                b.runs_scored === 4 ? 'bg-blue-500 text-white' :
                b.runs_scored === 6 ? 'bg-purple-500 text-white' :
                'bg-gray-100 text-gray-700'}`}>
                {getBallText(b)}
              </div>
            ))}
            {thisOverBalls.length === 0 && <span className="text-sm text-gray-400 italic">No balls yet.</span>}
          </div>
        </div>
      </div>

      {/* Input Panel */}
      <div className="bg-white border-t border-gray-200 px-3 pt-2 pb-3 shrink-0 rounded-t-2xl shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
        <div className="grid grid-cols-5 gap-1 mb-2">
          {[
            { label: 'Wide',     state: isWide,   set: setIsWide   },
            { label: 'No Ball',  state: isNoBall, set: setIsNoBall },
            { label: 'Byes',     state: isBye,    set: setIsBye    },
            { label: 'Leg Byes', state: isLegBye, set: setIsLegBye },
            { label: 'Wicket',   state: isWicket, set: setIsWicket },
          ].map(btn => (
            <button key={btn.label} onClick={() => btn.set(!btn.state)}
              className={`py-2 rounded-lg text-[10px] font-bold uppercase transition-colors ${
                btn.state
                  ? btn.label === 'Wicket' ? 'bg-red-500 text-white' : 'bg-cricket-green text-white'
                  : 'bg-gray-100 text-gray-600'}`}>
              {btn.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {[0, 1, 2, 3, 4, 5, 6].map(runs => (
            <button key={runs} onClick={() => handleRun(runs)}
              className={`py-3 rounded-xl font-black text-xl text-gray-800 transition-transform active:scale-95 ${
                isWicket ? 'bg-red-50 border-2 border-red-300' : 'bg-gray-100 active:bg-gray-200'}`}>
              {runs}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 mt-2">
          <button className="bg-gray-50 text-gray-600 text-xs font-bold py-2 rounded-lg border border-gray-200">Undo</button>
          <button onClick={swapBatsmen} className="bg-gray-50 text-gray-600 text-xs font-bold py-2 rounded-lg border border-gray-200">Swap</button>
          <button className="bg-gray-50 text-gray-600 text-xs font-bold py-2 rounded-lg border border-gray-200">Retire</button>
        </div>
      </div>

      {/* ═══════════════════ MODALS ════════════════════════════════ */}

      {/* Simple selection (batsman / bowler) */}
      {selectionModal && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-2xl max-h-[75vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-base font-bold">
                Select {selectionModal === 'striker' ? 'Striker' : selectionModal === 'nonStriker' ? 'Non-Striker' : 'Bowler'}
              </h2>
              <button onClick={() => setSelectionModal(null)} className="text-gray-400 text-2xl">×</button>
            </div>
            <div className="overflow-y-auto flex-1">
              {matchPlayers
                ?.filter(mp => mp.team === (selectionModal === 'bowler' ? currentInnings.bowling_team : currentInnings.batting_team))
                .map(mp => {
                  const p = allPlayers.find(p => p.id === mp.player_id);
                  if (!p) return null;
                  if (selectionModal === 'striker' && p.id === nonStrikerId) return null;
                  if (selectionModal === 'nonStriker' && p.id === strikerId) return null;
                  if (selectionModal !== 'bowler' && dismissedIds.includes(p.id!)) return null;
                  return (
                    <button key={mp.player_id}
                      onClick={() => {
                        if (selectionModal === 'striker') setStrikerId(p.id!);
                        else if (selectionModal === 'nonStriker') setNonStrikerId(p.id!);
                        else setBowlerId(p.id!);
                        setSelectionModal(null);
                      }}
                      className="w-full text-left px-4 py-3 border-b border-gray-100 font-medium active:bg-gray-50">
                      {p.name}
                    </button>
                  );
                })}
            </div>
            <div className="p-3">
              <button onClick={() => setSelectionModal(null)} className="w-full py-3 bg-gray-100 rounded-xl font-bold text-gray-600">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* End of Over modal */}
      {endOfOverModal && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden">
            <div className="bg-cricket-green text-white px-4 py-3 text-center">
              <p className="font-black text-lg">Over {currentOverNum - 1} Complete!</p>
            </div>
            <div className="p-5 text-center">
              <p className="text-gray-600 text-sm mb-1">Score after over {currentOverNum - 1}:</p>
              <p className="text-3xl font-black text-gray-800 mb-4">{totalRuns}/{totalWickets}</p>
              <p className="text-sm text-cricket-dark font-medium mb-4">Select the next bowler to continue.</p>
              <button onClick={() => { setEndOfOverModal(false); setSelectionModal('bowler'); }}
                className="w-full py-3 bg-cricket-green text-white rounded-xl font-bold">
                Select Next Bowler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Innings End Modal */}
      {inningsEndModal && (
        <div className="absolute inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-cricket-green text-white px-4 py-4 text-center">
              <p className="text-xs uppercase tracking-widest font-bold opacity-80 mb-1">Innings Complete</p>
              <p className="font-black text-2xl">{battingTeamName}</p>
            </div>
            <div className="p-5 text-center">
              <div className="text-5xl font-black text-gray-800 mb-1">
                {inningsEndModal.runs}<span className="text-gray-400 text-3xl">/{inningsEndModal.wickets}</span>
              </div>
              <p className="text-gray-500 text-sm mb-6">in {inningsEndModal.overs} overs</p>

              <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-5 text-sm">
                <p className="font-bold text-cricket-dark">
                  {currentInnings.bowling_team === 'team_a' ? match.team_a_name : match.team_b_name} needs{' '}
                  <span className="text-xl font-black">{inningsEndModal.runs + 1}</span> to win
                </p>
                <p className="text-gray-500 mt-1">in {match.overs} overs</p>
              </div>

              <button onClick={startSecondInnings}
                className="w-full py-4 bg-cricket-green text-white rounded-xl font-bold text-base">
                Start 2nd Innings →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match End Modal */}
      {matchEndModal && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-br from-yellow-400 to-orange-500 text-white px-4 py-6 text-center">
              <p className="text-xs uppercase tracking-widest font-bold opacity-80 mb-2">🏆 Match Result</p>
              <p className="font-black text-2xl">{matchEndModal.winner}</p>
              <p className="text-white/90 font-medium mt-1">wins by {matchEndModal.margin}!</p>
            </div>
            <div className="p-5 text-center">
              <p className="text-gray-500 text-sm mb-5">Congratulations! The match has ended.</p>
              <button onClick={finaliseMatch}
                className="w-full py-4 bg-cricket-green text-white rounded-xl font-bold text-base">
                View Full Scorecard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wicket multi-step modal */}
      {wicketFlow && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-2xl max-h-[82vh] flex flex-col">
            <div className="bg-red-500 text-white px-4 py-3 rounded-t-2xl flex items-center justify-between">
              <span className="font-bold uppercase tracking-wide text-sm">
                {wicketFlow.step === 'who'    && '🏏 Who is Out?'}
                {wicketFlow.step === 'how'    && `How is ${getName(wicketFlow.outBatsmanId)} Out?`}
                {wicketFlow.step === 'fielder' && (wicketFlow.dismissalType === 'Caught' ? '🤲 Caught By?' : '🏃 Run Out By?')}
                {wicketFlow.step === 'next'   && '👟 Next Batsman?'}
              </span>
              <button onClick={cancelWicketFlow} className="text-white/80 text-2xl leading-none">×</button>
            </div>

            <div className="overflow-y-auto flex-1">

              {/* Step 1: Who */}
              {wicketFlow.step === 'who' && (
                <div className="p-4 space-y-2">
                  <p className="text-sm text-gray-500 mb-3">Select the dismissed batsman:</p>
                  {[strikerId, nonStrikerId].map(bId => {
                    if (!bId) return null;
                    const s = getBatsmanStats(bId);
                    return (
                      <button key={bId} onClick={() => wicketSelectWho(bId)}
                        className="w-full text-left px-4 py-3 rounded-xl border-2 border-gray-100 active:border-red-300 active:bg-red-50 flex justify-between items-center">
                        <div>
                          <span className="font-bold text-gray-800">{getName(bId)}</span>
                          {bId === strikerId && <span className="ml-2 text-xs bg-cricket-green text-white px-2 py-0.5 rounded-full">Striker</span>}
                        </div>
                        <span className="text-gray-500 text-sm">{s.r} ({s.b}b)</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Step 2: How */}
              {wicketFlow.step === 'how' && (
                <div className="p-4">
                  <p className="text-sm text-gray-500 mb-1">Bowler: <strong>{getName(bowlerId)}</strong></p>
                  <p className="text-sm text-gray-500 mb-3">Select dismissal type:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {DISMISSAL_TYPES.map(type => (
                      <button key={type} onClick={() => wicketSelectHow(type)}
                        className="py-3 px-3 rounded-xl border-2 border-gray-100 active:border-red-400 active:bg-red-50 text-center">
                        <div className="font-bold text-gray-800">{type}</div>
                        <div className="text-xs mt-0.5 text-gray-400">
                          {BOWLER_WICKET.includes(type) ? <span className="text-cricket-green">Bowler credited</span> : 'No bowler credit'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Fielder */}
              {wicketFlow.step === 'fielder' && (
                <div className="p-4">
                  <p className="text-sm text-gray-500 mb-3">
                    {wicketFlow.dismissalType === 'Caught' ? 'Who took the catch?' : 'Which fielder ran them out?'}
                  </p>
                  {fielders.map(p => p && (
                    <button key={p.id} onClick={() => wicketSelectFielder(p.id!)}
                      className="w-full text-left px-4 py-3 border-b border-gray-100 font-medium active:bg-red-50">
                      {p.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Step 4: Next batsman */}
              {wicketFlow.step === 'next' && (
                <div className="p-4">
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4 text-sm text-red-800">
                    <strong>{getName(wicketFlow.outBatsmanId)}</strong>
                    {' '}<em>{wicketFlow.dismissalType}</em>
                    {wicketFlow.fielderId && wicketFlow.dismissalType === 'Caught' && ` by ${getName(wicketFlow.fielderId)}`}
                    {wicketFlow.fielderId && wicketFlow.dismissalType === 'Run Out'  && ` (${getName(wicketFlow.fielderId)})`}
                    {BOWLER_WICKET.includes(wicketFlow.dismissalType!) && <> b <strong>{getName(bowlerId)}</strong></>}
                  </div>

                  <p className="text-sm text-gray-500 mb-3">Who is coming in next?</p>

                  {availableBatsmen.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="font-bold text-gray-700">No more batsmen left.</p>
                      <button onClick={() => wicketSelectNext(-1)}
                        className="mt-3 px-5 py-2 bg-red-500 text-white rounded-xl font-bold">
                        End Innings
                      </button>
                    </div>
                  ) : (
                    availableBatsmen.map(p => p && (
                      <button key={p.id} onClick={() => wicketSelectNext(p.id!)}
                        className="w-full text-left px-4 py-3 border-b border-gray-100 font-medium active:bg-green-50 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-cricket-light text-white flex items-center justify-center font-bold shrink-0">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        {p.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-gray-100">
              <button onClick={cancelWicketFlow}
                className="w-full py-3 bg-gray-100 rounded-xl font-bold text-gray-600">
                Cancel Wicket
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
