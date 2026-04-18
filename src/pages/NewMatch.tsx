import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { createNewMatch } from '../db/matchQueries';

type TeamKey = 'a' | 'b';

const P = { primary: '#1a3a2a', bg: '#f2f0eb', card: '#fff', accent: '#6ee09e', border: '#e0ddd4', label: '#8a8278', muted: '#b0aba2' };

const inp: React.CSSProperties = {
  width: '100%', background: P.bg, border: `1.5px solid ${P.border}`,
  borderRadius: 10, padding: '10px 12px', fontSize: 12, color: P.primary, outline: 'none',
};

const ToggleBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} className="flex-1 py-2 transition-all"
    style={{ fontSize: 11, fontWeight: active ? 600 : 400, borderRadius: 8, border: `1.5px solid ${active ? P.primary : P.border}`, background: active ? P.primary : 'transparent', color: active ? '#fff' : P.label }}>
    {children}
  </button>
);

export default function NewMatch() {
  const navigate   = useNavigate();
  const allPlayers = useLiveQuery(() => db.players.orderBy('name').toArray());

  const [teamAName, setTeamAName]           = useState('');
  const [teamBName, setTeamBName]           = useState('');
  const [playersPerSide, setPlayersPerSide] = useState(5);
  const [overs, setOvers]                   = useState(5);
  const [lastManStanding, setLastManStanding] = useState(false);
  const [tossWinner, setTossWinner]         = useState<'team_a' | 'team_b'>('team_a');
  const [tossDecision, setTossDecision]     = useState<'bat' | 'bowl'>('bat');

  const [teamAPlayers, setTeamAPlayers] = useState<number[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<number[]>([]);

  const [teamACaptain, setTeamACaptain] = useState<number | null>(null);
  const [teamAVC,      setTeamAVC]      = useState<number | null>(null);
  const [teamBCaptain, setTeamBCaptain] = useState<number | null>(null);
  const [teamBVC,      setTeamBVC]      = useState<number | null>(null);

  const [newPlayerA, setNewPlayerA] = useState('');
  const [newPlayerB, setNewPlayerB] = useState('');

  const getPlayers  = (t: TeamKey) => t === 'a' ? teamAPlayers : teamBPlayers;
  const setPlayers  = (t: TeamKey, v: number[]) => t === 'a' ? setTeamAPlayers(v) : setTeamBPlayers(v);
  const getOtherIds = (t: TeamKey) => t === 'a' ? teamBPlayers : teamAPlayers;

  const togglePlayer = (team: TeamKey, pId: number) => {
    const cur = getPlayers(team);
    if (cur.includes(pId)) {
      setPlayers(team, cur.filter(id => id !== pId));
      if (team === 'a') { if (teamACaptain === pId) setTeamACaptain(null); if (teamAVC === pId) setTeamAVC(null); }
      else               { if (teamBCaptain === pId) setTeamBCaptain(null); if (teamBVC === pId) setTeamBVC(null); }
    } else if (cur.length < playersPerSide) {
      setPlayers(team, [...cur, pId]);
    }
  };

  const addNewPlayer = async (team: TeamKey) => {
    const raw = team === 'a' ? newPlayerA : newPlayerB;
    const name = raw.trim(); if (!name) return;
    const id = await db.players.add({ name, created_at: Date.now() }) as number;
    const cur = getPlayers(team);
    if (cur.length < playersPerSide) setPlayers(team, [...cur, id]);
    if (team === 'a') setNewPlayerA(''); else setNewPlayerB('');
  };

  const canStart = !!teamAName && !!teamBName
    && teamAPlayers.length === playersPerSide
    && teamBPlayers.length === playersPerSide && overs > 0;

  const handleStartMatch = async () => {
    if (!canStart) return;
    const matchId = await createNewMatch({
      team_a_name: teamAName, team_b_name: teamBName, overs, players_per_side: playersPerSide,
      last_man_standing: lastManStanding, toss_winner: tossWinner, toss_decision: tossDecision,
      team_a_captain_id: teamACaptain ?? undefined, team_a_vc_id: teamAVC ?? undefined,
      team_b_captain_id: teamBCaptain ?? undefined, team_b_vc_id: teamBVC ?? undefined,
    }, teamAPlayers, teamBPlayers);
    navigate(`/live-scoring/${matchId}`);
  };

  if (!allPlayers) return <div className="p-4 text-center" style={{ color: P.muted }}>Loading…</div>;

  const getName = (id: number | null) => id ? (allPlayers.find(p => p.id === id)?.name ?? '?') : null;

  const renderTeamPicker = (
    team: TeamKey, label: string, selectedIds: number[],
    captainId: number | null, setCaptain: (v: number | null) => void,
    vcId: number | null, setVC: (v: number | null) => void,
    newName: string, setNewName: (v: string) => void,
  ) => {
    const otherIds = getOtherIds(team);
    const isFull   = selectedIds.length >= playersPerSide;

    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden"
        style={{ border: `1px solid ${P.border}`, borderRadius: 12 }}>
        {/* header */}
        <div className="px-2 py-2 text-center" style={{ background: '#faf9f7', borderBottom: `1px solid ${P.border}` }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: P.label, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
          <span style={{ fontSize: 9, color: P.muted }}> {selectedIds.length}/{playersPerSide}</span>
        </div>

        {/* list */}
        <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
          {allPlayers.length === 0 && (
            <p style={{ fontSize: 10, color: P.muted, textAlign: 'center', padding: '16px 8px' }}>Add one below</p>
          )}
          {allPlayers.map(p => {
            const isSelected  = selectedIds.includes(p.id!);
            const isOtherTeam = otherIds.includes(p.id!);
            const isDisabled  = isOtherTeam || (!isSelected && isFull);
            const isCap       = captainId === p.id;
            const isVCap      = vcId === p.id;
            return (
              <div key={p.id} className="flex items-center"
                style={{ borderBottom: `1px solid ${P.border}`, opacity: isDisabled ? 0.35 : 1 }}>
                <button disabled={isDisabled} onClick={() => togglePlayer(team, p.id!)}
                  className="flex-1 flex items-center gap-1.5 px-2 py-2 text-left"
                  style={{ background: isSelected ? '#edf8f2' : 'transparent' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 5, background: isSelected ? '#6ee09e33' : P.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: P.primary, flexShrink: 0 }}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: isSelected ? 600 : 400, color: P.primary }} className="truncate">
                    {p.name}
                    {isCap  && <span style={{ marginLeft: 3, fontSize: 9, color: '#c47000' }}>  C</span>}
                    {isVCap && <span style={{ marginLeft: 3, fontSize: 9, color: '#1a5796' }}> VC</span>}
                    {isOtherTeam && <span style={{ marginLeft: 3, fontSize: 9, color: P.muted }}>(taken)</span>}
                  </span>
                </button>
                {isSelected && (
                  <div className="flex gap-1 pr-1.5 shrink-0">
                    <button onClick={() => setCaptain(isCap ? null : p.id!)}
                      style={{ fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 4, background: isCap ? '#c47000' : P.bg, color: isCap ? '#fff' : P.label, border: `1px solid ${P.border}`, cursor: 'pointer' }}>C</button>
                    <button onClick={() => setVC(isVCap ? null : p.id!)}
                      style={{ fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 4, background: isVCap ? '#1a5796' : P.bg, color: isVCap ? '#fff' : P.label, border: `1px solid ${P.border}`, cursor: 'pointer' }}>VC</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* cap/vc summary */}
        {(captainId || vcId) && (
          <div style={{ padding: '3px 8px', background: '#fffbf0', borderTop: '1px solid #eed9a0', fontSize: 9, color: '#8a6520' }}>
            {captainId && <span>C: {getName(captainId)}</span>}
            {captainId && vcId && ' · '}
            {vcId && <span>VC: {getName(vcId)}</span>}
          </div>
        )}

        {/* add new */}
        <div style={{ padding: 8, borderTop: `1px solid ${P.border}`, background: P.card }}>
          <div className="flex gap-1">
            <input type="text" placeholder="New player…" value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addNewPlayer(team)}
              style={{ flex: 1, minWidth: 0, fontSize: 10, background: P.bg, border: `1px solid ${P.border}`, borderRadius: 7, padding: '5px 8px', color: P.primary, outline: 'none' }} />
            <button onClick={() => addNewPlayer(team)} disabled={!newName.trim() || isFull}
              style={{ fontSize: 10, fontWeight: 600, padding: '5px 10px', borderRadius: 7, background: (newName.trim() && !isFull) ? P.primary : P.bg, color: (newName.trim() && !isFull) ? '#fff' : P.muted, border: 'none', flexShrink: 0, cursor: 'pointer' }}>Add</button>
          </div>
          {isFull && <p style={{ fontSize: 9, color: P.muted, textAlign: 'center', marginTop: 3 }}>Team full</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-full p-3 flex flex-col gap-3" style={{ background: P.bg }}>

      <div className="pt-1">
        <p style={{ fontSize: 13, fontWeight: 600, color: P.primary }}>New Match</p>
      </div>

      {/* Teams & Format */}
      <div className="ct-card p-3 flex flex-col gap-3">
        <p style={{ fontSize: 9, fontWeight: 600, color: P.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Teams & Format</p>
        <input type="text" placeholder="Team A name"  value={teamAName} onChange={e => setTeamAName(e.target.value)} style={inp} />
        <input type="text" placeholder="Team B name" value={teamBName} onChange={e => setTeamBName(e.target.value)} style={inp} />
        <div className="flex gap-3">
          <div className="flex-1">
            <p style={{ fontSize: 9, fontWeight: 600, color: P.label, textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.06em' }}>Overs</p>
            <input type="number" min="1" max="50" value={overs}
              onChange={e => setOvers(Math.max(1, parseInt(e.target.value) || 1))} style={{ ...inp, textAlign: 'center' }} />
          </div>
          <div className="flex-1">
            <p style={{ fontSize: 9, fontWeight: 600, color: P.label, textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.06em' }}>Players / Side</p>
            <input type="number" min="2" max="15" value={playersPerSide}
              onChange={e => setPlayersPerSide(Math.min(15, Math.max(2, parseInt(e.target.value) || 2)))} style={{ ...inp, textAlign: 'center' }} />
          </div>
        </div>
      </div>

      {/* Toss */}
      <div className="ct-card p-3 flex flex-col gap-2">
        <p style={{ fontSize: 9, fontWeight: 600, color: P.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Toss</p>
        <div className="flex gap-2">
          <ToggleBtn active={tossWinner === 'team_a'} onClick={() => setTossWinner('team_a')}>{teamAName || 'Team A'} Won</ToggleBtn>
          <ToggleBtn active={tossWinner === 'team_b'} onClick={() => setTossWinner('team_b')}>{teamBName || 'Team B'} Won</ToggleBtn>
        </div>
        <div className="flex gap-2">
          <ToggleBtn active={tossDecision === 'bat'}  onClick={() => setTossDecision('bat')}>Elected to Bat</ToggleBtn>
          <ToggleBtn active={tossDecision === 'bowl'} onClick={() => setTossDecision('bowl')}>Elected to Bowl</ToggleBtn>
        </div>
      </div>

      {/* Last Man Standing */}
      <div className="ct-card px-3 py-2.5 flex items-center justify-between">
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: P.primary }}>Last Man Standing</p>
          <p style={{ fontSize: 9, color: P.muted, marginTop: 2 }}>Allow single batsman when all others are out</p>
        </div>
        <button onClick={() => setLastManStanding(!lastManStanding)}
          style={{ width: 40, height: 22, borderRadius: 11, position: 'relative', background: lastManStanding ? P.primary : P.border, border: 'none', cursor: 'pointer', flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: 2, left: lastManStanding ? 20 : 2, width: 18, height: 18, borderRadius: 9, background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
        </button>
      </div>

      {/* Player Selection */}
      <div className="ct-card p-3 flex flex-col gap-2">
        <div>
          <p style={{ fontSize: 9, fontWeight: 600, color: P.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Playing XIs</p>
          <p style={{ fontSize: 9, color: P.muted, marginTop: 2 }}>Tap to select · C/VC to assign role · type to add new player</p>
        </div>
        <div className="flex gap-2">
          {renderTeamPicker('a', teamAName || 'Team A', teamAPlayers, teamACaptain, setTeamACaptain, teamAVC, setTeamAVC, newPlayerA, setNewPlayerA)}
          {renderTeamPicker('b', teamBName || 'Team B', teamBPlayers, teamBCaptain, setTeamBCaptain, teamBVC, setTeamBVC, newPlayerB, setNewPlayerB)}
        </div>
      </div>

      {/* Hint */}
      {!canStart && (teamAName || teamBName) && (
        <p style={{ fontSize: 10, color: P.muted, textAlign: 'center' }}>
          {!teamAName || !teamBName ? '⚠️ Enter both team names'
            : `Select ${playersPerSide} per side — A: ${teamAPlayers.length}  B: ${teamBPlayers.length}`}
        </p>
      )}

      {/* CTA */}
      <button onClick={handleStartMatch} disabled={!canStart}
        style={{ width: '100%', padding: 14, borderRadius: 12, fontSize: 13, fontWeight: 600, border: 'none', cursor: canStart ? 'pointer' : 'not-allowed', marginBottom: 16, background: canStart ? P.primary : P.border, color: canStart ? '#fff' : P.muted, transition: 'opacity 0.15s' }}>
        Continue →
      </button>

    </div>
  );
}
