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
  const [showAddPlayers,  setShowAddPlayers]  = useState(false);
  const [showEndInningsConfirm, setShowEndInningsConfirm] = useState(false);
  // Inline add-player for mid-match
  const [addMidNewName, setAddMidNewName] = useState('');

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
      // Cricket rule: odd runs on last ball = striker crossed already, no extra swap needed
      // Even runs on last ball = non-striker faces next over, swap once
      if (opts.runs % 2 === 0 && !opts.wicket) swapBatsmen();
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
    <div className="flex flex-col h-screen w-full overflow-hidden relative" style={{ background: '#f2f0eb' }}>

      {/* Header */}
      <header className="shrink-0 z-10" style={{ background: '#1a3a2a' }}>
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button onClick={() => navigate('/')} style={{ color: '#6ee09e', display: 'flex' }}><ArrowLeft size={20} /></button>
          <div className="flex-1 min-w-0 ml-1">
            <p style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }} className="truncate">{match.team_a_name} vs {match.team_b_name}</p>
            <p style={{ fontSize: 9, color: '#6ee09e', marginTop: 1 }}>{battingTeamName} · {inningsLabel}</p>
          </div>
        </div>
      </header>

      {/* Board */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">

        {/* Innings hero block */}
        <div className="rounded-xl p-3" style={{ background: '#1a3a2a' }}>
          <div className="flex items-end justify-between">
            <div>
              <p style={{ fontSize: 9, fontWeight: 600, color: '#6ee09e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{inningsLabel}</p>
              <div className="flex items-end gap-1" style={{ lineHeight: 1 }}>
                <span style={{ fontSize: 36, fontWeight: 700, color: '#6ee09e' }}>{totalRuns}</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>-</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', marginBottom: 2 }}>{totalWickets}</span>
              </div>
            </div>
            <div className="text-right">
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Over</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#ffffff' }}>{fmtOvers(legalDeliveries)}</p>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>CRR {crr}</p>
            </div>
          </div>
          {isSecondInnings && target !== null && (
            <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(110,224,158,0.2)' }}>
              <p style={{ fontSize: 10, color: '#d4f4e2' }}>Need <strong style={{ color: '#6ee09e' }}>{runsNeeded}</strong> off <strong style={{ color: '#6ee09e' }}>{ballsLeft}</strong> balls · RRR <strong style={{ color: '#6ee09e' }}>{rrr}</strong></p>
            </div>
          )}
        </div>

        {/* Batsmen */}
        <div className="ct-card">
          <div className="ct-card-header flex" style={{ gap: 4 }}>
            <div style={{ flex: 1, fontSize: 9, fontWeight: 600, color: '#8a8278', textTransform: 'uppercase', letterSpacing: '0.06em' }}>BATTER</div>
            <div style={{ width: 28, textAlign: 'right', fontSize: 9, fontWeight: 600, color: '#8a8278' }}>R</div>
            <div style={{ width: 28, textAlign: 'right', fontSize: 9, fontWeight: 600, color: '#8a8278' }}>B</div>
            <div style={{ width: 32, textAlign: 'right', fontSize: 9, fontWeight: 600, color: '#8a8278' }}>SR</div>
          </div>
          <div style={{ padding: '4px 12px' }}>
            {[{ id: strikerId, label: 'striker' as const }, { id: nonStrikerId, label: 'nonStriker' as const }].map(({ id, label }, idx) => (
              !id ? (
                <div key={idx} onClick={() => setSelectionModal(label)}
                  className="flex items-center gap-2 cursor-pointer py-2.5"
                  style={{ borderBottom: idx === 0 ? '1px solid #e0ddd4' : 'none' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: '#edf8f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ChevronDown size={14} color="#1a3a2a" />
                  </div>
                  <span style={{ fontSize: 11, color: '#1a3a2a', fontWeight: 500 }}>Select {idx === 0 ? 'Striker' : 'Non-Striker'}</span>
                </div>
              ) : (() => {
                const s = getBatsmanStats(id);
                return (
                  <div key={id} className="flex items-center gap-2 py-2.5"
                    style={{ borderBottom: idx === 0 ? '1px solid #e0ddd4' : 'none' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: id === strikerId ? '#1a3a2a' : '#f2f0eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: id === strikerId ? '#6ee09e' : '#8a8278', flexShrink: 0 }}>
                      {getName(id)?.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: id === strikerId ? 700 : 500, color: id === strikerId ? '#1a3a2a' : '#4a4a4a' }} className="block truncate">
                        {getName(id)}{id === strikerId ? ' *' : ''}
                      </span>
                    </div>
                    <div style={{ width: 28, textAlign: 'right', fontSize: 10, fontWeight: 700, color: '#1a3a2a', flexShrink: 0 }}>{s.r}</div>
                    <div style={{ width: 28, textAlign: 'right', fontSize: 10, color: '#8a8278', flexShrink: 0 }}>{s.b}</div>
                    <div style={{ width: 32, textAlign: 'right', fontSize: 10, color: '#8a8278', flexShrink: 0 }}>{s.sr}</div>
                  </div>
                );
              })()
            ))}
          </div>
        </div>

        {/* Bowler */}
        <div className="ct-card">
          <div className="ct-card-header flex" style={{ gap: 4 }}>
            {['BOWLER','O','R','W','ER'].map((h, i) => (
              <div key={h} style={{ flex: i === 0 ? 1 : undefined, width: i === 0 ? undefined : i === 4 ? 32 : 28, textAlign: i === 0 ? 'left' : 'right', fontSize: 9, fontWeight: 600, color: '#8a8278', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
            ))}
          </div>
          <div style={{ padding: '6px 12px' }}>
            {!bowlerId ? (
              <div onClick={() => setSelectionModal('bowler')} className="flex items-center gap-2 cursor-pointer py-1.5">
                <div style={{ width: 28, height: 28, borderRadius: 7, background: '#edf8f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ChevronDown size={14} color="#1a3a2a" />
                </div>
                <span style={{ fontSize: 11, color: '#1a3a2a', fontWeight: 500 }}>Select Bowler</span>
              </div>
            ) : (() => {
              const st = getBowlerStats(bowlerId);
              return (
                <div className="flex items-center gap-1 py-1.5">
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: '#f2f0eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#1a3a2a', flexShrink: 0 }}>
                    {getName(bowlerId)?.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#1a3a2a' }} className="block truncate">{getName(bowlerId)}</span>
                  </div>
                  <div style={{ width: 28, textAlign: 'right', fontSize: 10, color: '#8a8278', flexShrink: 0 }}>{st.overs}</div>
                  <div style={{ width: 28, textAlign: 'right', fontSize: 10, color: '#8a8278', flexShrink: 0 }}>{st.r}</div>
                  <div style={{ width: 28, textAlign: 'right', fontSize: 10, fontWeight: 700, color: '#1a7a4a', flexShrink: 0 }}>{st.w}</div>
                  <div style={{ width: 32, textAlign: 'right', fontSize: 10, color: '#8a8278', flexShrink: 0 }}>{st.er}</div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* This Over */}
        <div className="ct-card px-3 pt-2 pb-3">
          <p style={{ fontSize: 9, fontWeight: 600, color: '#8a8278', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>THIS OVER ({ballsInOver}/6)</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1 items-center" style={{ minHeight: 36 }}>
            {thisOverBalls.map((b, i) => (
              <div key={i} style={{
                flexShrink: 0, width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
                background: b.is_wicket ? '#c53030' : b.runs_scored === 6 ? '#1a3a2a' : b.runs_scored === 4 ? '#1a2e4a' : '#f2f0eb',
                color: b.is_wicket || b.runs_scored >= 4 ? '#ffffff' : '#1a3a2a',
                border: '1px solid #e0ddd4'
              }}>
                {getBallText(b)}
              </div>
            ))}
            {thisOverBalls.length === 0 && <span style={{ fontSize: 10, color: '#b0aba2', fontStyle: 'italic' }}>No balls yet</span>}
          </div>
        </div>
      </div>

      {/* Input Panel */}
      <div className="shrink-0" style={{ background: '#ffffff', borderTop: '1px solid #e0ddd4', padding: '10px 12px 12px' }}>
        {/* Extras toggles */}
        <div className="grid grid-cols-5 gap-1 mb-2">
          {[
            { label: 'Wide',   short: 'WD', state: isWide,   set: setIsWide   },
            { label: 'No Ball', short: 'NB', state: isNoBall, set: setIsNoBall },
            { label: 'Byes',   short: 'B',  state: isBye,    set: setIsBye    },
            { label: 'Lb',     short: 'LB', state: isLegBye, set: setIsLegBye },
            { label: 'Wicket', short: 'W',  state: isWicket, set: setIsWicket },
          ].map(btn => (
            <button key={btn.label} onClick={() => btn.set(!btn.state)}
              style={{
                padding: '6px 0', borderRadius: 8, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                background: btn.state ? (btn.label === 'Wicket' ? '#c53030' : '#1a3a2a') : '#f2f0eb',
                color: btn.state ? '#ffffff' : '#8a8278',
                border: `1px solid ${btn.state ? 'transparent' : '#e0ddd4'}`,
                cursor: 'pointer', transition: 'all 0.12s'
              }}>
              {btn.short}
            </button>
          ))}
        </div>

        {/* Run buttons */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {[0, 1, 2, 3, 4, 5, 6].map(runs => (
            <button key={runs} onClick={() => handleRun(runs)}
              style={{
                paddingTop: 12, paddingBottom: 12, borderRadius: 10, fontSize: 18, fontWeight: 700,
                background: isWicket ? '#fff5f5' : '#f2f0eb',
                color: isWicket ? '#c53030' : '#1a3a2a',
                border: `1.5px solid ${isWicket ? '#fca5a5' : '#e0ddd4'}`,
                cursor: 'pointer', transition: 'transform 0.08s'
              }}
              onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.93)')}
              onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            >{runs}</button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: 'Undo',     action: () => {}, color: '#8a8278' },
            { label: 'Swap',     action: swapBatsmen, color: '#1a3a2a' },
            { label: '+Players', action: () => setShowAddPlayers(true), color: '#1a5796' },
            { label: 'End Inn.', action: () => setShowEndInningsConfirm(true), color: '#c53030' },
          ].map(btn => (
            <button key={btn.label} onClick={btn.action}
              style={{ padding: '7px 0', borderRadius: 8, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', background: '#f2f0eb', color: btn.color, border: '1px solid #e0ddd4', cursor: 'pointer' }}>
              {btn.label}
            </button>
          ))}
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

      {/* ── Add Late Players modal ──────────────────────────────────────── */}
      {showAddPlayers && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold">Add Late Arrivals</h2>
                <p className="text-xs text-gray-500 mt-0.5">Adds to BOTH teams — one player each</p>
              </div>
              <button onClick={() => setShowAddPlayers(false)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {/* Add to batting team */}
              {[
                { teamKey: currentInnings.batting_team, label: `${battingTeamName} (Batting)` },
                { teamKey: currentInnings.bowling_team, label: `${currentInnings.bowling_team === 'team_a' ? match.team_a_name : match.team_b_name} (Bowling)` },
              ].map(({ teamKey, label }) => {
                const existing = matchPlayers?.filter(mp => mp.team === teamKey).map(mp => allPlayers.find(p => p.id === mp.player_id)).filter(Boolean) ?? [];
                return (
                  <div key={teamKey} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 text-xs font-bold text-gray-600 border-b border-gray-200">{label}</div>
                    <div className="px-3 py-2">
                      <div className="text-xs text-gray-400 mb-2">Current: {existing.map(p => p!.name).join(', ')}</div>
                      {/* Existing players not yet in this team */}
                      <div className="max-h-32 overflow-y-auto mb-2">
                        {allPlayers
                          ?.filter(p => !matchPlayers?.some(mp => mp.player_id === p.id && mp.team === teamKey))
                          .map(p => (
                            <button key={p.id}
                              onClick={async () => {
                                await db.match_players.add({ match_id: mId, player_id: p.id!, team: teamKey as 'team_a' | 'team_b' });
                              }}
                              className="w-full text-left px-3 py-2 text-sm border-b border-gray-100 hover:bg-green-50 text-gray-700 active:bg-green-100">
                              + {p.name}
                            </button>
                          ))}
                      </div>
                      {/* Create brand new player */}
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          placeholder="New player name…"
                          className="flex-1 min-w-0 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:border-cricket-green"
                          value={addMidNewName}
                          onChange={e => setAddMidNewName(e.target.value)}
                          onKeyDown={async e => {
                            if (e.key === 'Enter' && addMidNewName.trim()) {
                              const id = await db.players.add({ name: addMidNewName.trim(), created_at: Date.now() }) as number;
                              await db.match_players.add({ match_id: mId, player_id: id, team: teamKey as 'team_a' | 'team_b' });
                              setAddMidNewName('');
                            }
                          }}
                        />
                        <button
                          onClick={async () => {
                            if (!addMidNewName.trim()) return;
                            const id = await db.players.add({ name: addMidNewName.trim(), created_at: Date.now() }) as number;
                            await db.match_players.add({ match_id: mId, player_id: id, team: teamKey as 'team_a' | 'team_b' });
                            setAddMidNewName('');
                          }}
                          className="bg-cricket-green text-white text-xs font-bold px-3 py-2 rounded-lg shrink-0"
                        >Add</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-3 border-t border-gray-100">
              <button onClick={() => setShowAddPlayers(false)} className="w-full py-3 bg-cricket-green text-white rounded-xl font-bold">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ── End Innings Early confirmation ──────────────────────────────── */}
      {showEndInningsConfirm && (
        <div className="absolute inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-red-500 text-white px-4 py-4 text-center">
              <p className="text-xs uppercase tracking-widest font-bold opacity-80 mb-1">⚠️ Confirm</p>
              <p className="font-black text-xl">End Innings Early?</p>
            </div>
            <div className="p-5 text-center">
              <p className="text-gray-500 text-sm mb-2">Current score:</p>
              <p className="text-3xl font-black text-gray-800 mb-4">{totalRuns}/{totalWickets} <span className="text-gray-400 text-lg font-normal">({fmtOvers(legalDeliveries)} ov)</span></p>
              <p className="text-xs text-gray-400 mb-5">Use this if a player is injured or unable to continue. This will close the current innings.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEndInningsConfirm(false)}
                  className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-600">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowEndInningsConfirm(false);
                    checkInningsEnd(legalDeliveries, totalWickets, totalRuns);
                    // Force-show innings end modal even if conditions not "naturally" met
                    if (!isSecondInnings) {
                      setInningsEndModal({ runs: totalRuns, wickets: totalWickets, overs: fmtOvers(legalDeliveries) });
                    } else {
                      const runDiff = firstInningsRuns - totalRuns;
                      setMatchEndModal({
                        winner: currentInnings.bowling_team === 'team_a' ? match.team_a_name : match.team_b_name,
                        margin: `${Math.max(0, runDiff)} run${runDiff !== 1 ? 's' : ''}`,
                      });
                    }
                  }}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold">
                  End Innings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
