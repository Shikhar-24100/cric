import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { createNewMatch } from '../db/matchQueries';

type TeamKey = 'a' | 'b';

export default function NewMatch() {
  const navigate = useNavigate();
  const allPlayers = useLiveQuery(() => db.players.orderBy('name').toArray());

  const [teamAName, setTeamAName] = useState('');
  const [teamBName, setTeamBName] = useState('');
  const [playersPerSide, setPlayersPerSide] = useState(5);
  const [overs, setOvers] = useState(5);
  const [lastManStanding, setLastManStanding] = useState(false);
  const [tossWinner, setTossWinner] = useState<'team_a' | 'team_b'>('team_a');
  const [tossDecision, setTossDecision] = useState<'bat' | 'bowl'>('bat');

  const [teamAPlayers, setTeamAPlayers] = useState<number[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<number[]>([]);

  // Captain / VC
  const [teamACaptain, setTeamACaptain] = useState<number | null>(null);
  const [teamAVC,      setTeamAVC]      = useState<number | null>(null);
  const [teamBCaptain, setTeamBCaptain] = useState<number | null>(null);
  const [teamBVC,      setTeamBVC]      = useState<number | null>(null);

  // Inline add-new-player inputs
  const [newPlayerA, setNewPlayerA] = useState('');
  const [newPlayerB, setNewPlayerB] = useState('');

  const setPlayers   = (team: TeamKey, val: number[]) => team === 'a' ? setTeamAPlayers(val) : setTeamBPlayers(val);
  const getPlayers   = (team: TeamKey) => team === 'a' ? teamAPlayers : teamBPlayers;
  const getOtherIds  = (team: TeamKey) => team === 'a' ? teamBPlayers : teamAPlayers;

  const togglePlayer = (team: TeamKey, pId: number) => {
    const cur = getPlayers(team);
    if (cur.includes(pId)) {
      setPlayers(team, cur.filter(id => id !== pId));
      // Clear captain/VC if deselected
      if (team === 'a') { if (teamACaptain === pId) setTeamACaptain(null); if (teamAVC === pId) setTeamAVC(null); }
      else               { if (teamBCaptain === pId) setTeamBCaptain(null); if (teamBVC === pId) setTeamBVC(null); }
    } else if (cur.length < playersPerSide) {
      setPlayers(team, [...cur, pId]);
    }
  };

  const addNewPlayer = async (team: TeamKey) => {
    const name = (team === 'a' ? newPlayerA : newPlayerB).trim();
    if (!name) return;
    const id = await db.players.add({ name, created_at: Date.now() });
    const numId = id as number;
    const cur = getPlayers(team);
    if (cur.length < playersPerSide) setPlayers(team, [...cur, numId]);
    if (team === 'a') setNewPlayerA(''); else setNewPlayerB('');
  };

  const canStart =
    !!teamAName && !!teamBName &&
    teamAPlayers.length === playersPerSide &&
    teamBPlayers.length === playersPerSide &&
    overs > 0;

  const handleStartMatch = async () => {
    if (!canStart) return;
    const matchId = await createNewMatch({
      team_a_name: teamAName,
      team_b_name: teamBName,
      overs,
      players_per_side: playersPerSide,
      last_man_standing: lastManStanding,
      toss_winner: tossWinner,
      toss_decision: tossDecision,
      team_a_captain_id: teamACaptain ?? undefined,
      team_a_vc_id:      teamAVC      ?? undefined,
      team_b_captain_id: teamBCaptain ?? undefined,
      team_b_vc_id:      teamBVC      ?? undefined,
    }, teamAPlayers, teamBPlayers);
    navigate(`/live-scoring/${matchId}`);
  };

  if (!allPlayers) return <div className="p-4 text-center">Loading...</div>;

  const getName = (id: number | null) => id ? (allPlayers.find(p => p.id === id)?.name ?? '?') : null;

  // ─── Team picker column ─────────────────────────────────────────────────
  const renderTeamPicker = (
    team: TeamKey, label: string,
    selectedIds: number[],
    captainId: number | null, setCaptain: (v: number | null) => void,
    vcId: number | null,      setVC: (v: number | null) => void,
    newName: string,           setNewName: (v: string) => void,
  ) => {
    const otherIds = getOtherIds(team);
    const isFull   = selectedIds.length >= playersPerSide;

    return (
      <div className="flex-1 flex flex-col min-w-0 border border-gray-200 rounded-xl overflow-hidden">
        {/* header */}
        <div className="bg-gray-100 px-2 py-2 text-xs font-bold text-center border-b border-gray-200">
          {label} ({selectedIds.length}/{playersPerSide})
        </div>

        {/* player list */}
        <div className="overflow-y-auto max-h-52">
          {allPlayers.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4 px-2">No players yet. Add one below.</p>
          )}
          {allPlayers.map(p => {
            const isSelected  = selectedIds.includes(p.id!);
            const isOtherTeam = otherIds.includes(p.id!);
            const isDisabled  = isOtherTeam || (!isSelected && isFull);
            const isCap       = captainId === p.id;
            const isVCap      = vcId === p.id;
            return (
              <div key={p.id} className={`flex items-center border-b border-gray-100 ${isDisabled ? 'opacity-30' : ''}`}>
                <button
                  disabled={isDisabled}
                  onClick={() => togglePlayer(team, p.id!)}
                  className={`flex-1 px-2 py-2 text-sm text-left transition-colors truncate
                    ${isSelected ? 'bg-green-50 text-green-800 font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}
                >
                  {p.name}
                  {isCap && <span className="ml-1 text-[10px] text-amber-600 font-bold">(C)</span>}
                  {isVCap && <span className="ml-1 text-[10px] text-blue-600 font-bold">(VC)</span>}
                  {isOtherTeam && <span className="ml-1 text-[10px] text-gray-400">taken</span>}
                </button>
                {/* Captain / VC badges — only if selected */}
                {isSelected && (
                  <div className="flex gap-1 pr-2 shrink-0">
                    <button
                      onClick={() => setCaptain(isCap ? null : p.id!)}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isCap ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-500'}`}
                    >C</button>
                    <button
                      onClick={() => setVC(isVCap ? null : p.id!)}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isVCap ? 'bg-blue-400 text-white' : 'bg-gray-100 text-gray-500'}`}
                    >VC</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Captain / VC summary */}
        {(captainId || vcId) && (
          <div className="px-2 py-1 bg-amber-50 border-t border-amber-100 text-[10px] text-amber-700">
            {captainId && <span>C: {getName(captainId)}</span>}
            {captainId && vcId && <span> · </span>}
            {vcId && <span>VC: {getName(vcId)}</span>}
          </div>
        )}

        {/* inline add new player */}
        <div className="border-t border-gray-200 p-2 bg-white shrink-0">
          <div className="flex gap-1 items-center">
            <input
              type="text"
              placeholder="New player name…"
              className="flex-1 min-w-0 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:border-cricket-green"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addNewPlayer(team)}
            />
            <button
              onClick={() => addNewPlayer(team)}
              disabled={!newName.trim() || isFull}
              className="bg-cricket-green text-white text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-40 shrink-0"
            >Add</button>
          </div>
          {isFull && <p className="text-[10px] text-gray-400 mt-1 text-center">Team full</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col bg-cricket-bg min-h-full">
      <div className="p-4 flex flex-col gap-4">

        {/* Match Setup */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3">
          <h2 className="text-lg font-bold text-gray-800">Match Setup</h2>
          <input type="text" placeholder="Team A Name"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-cricket-green"
            value={teamAName} onChange={e => setTeamAName(e.target.value)} />
          <input type="text" placeholder="Team B Name"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-cricket-green"
            value={teamBName} onChange={e => setTeamBName(e.target.value)} />
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-500 mb-1 block">OVERS</label>
              <input type="number" min="1" max="50"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm"
                value={overs} onChange={e => setOvers(Math.max(1, parseInt(e.target.value) || 1))} />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-500 mb-1 block">PLAYERS/SIDE</label>
              <input type="number" min="2" max="15"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm"
                value={playersPerSide} onChange={e => setPlayersPerSide(Math.min(15, Math.max(2, parseInt(e.target.value) || 2)))} />
            </div>
          </div>
        </div>

        {/* Toss */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3">
          <h2 className="text-sm font-bold text-gray-800">Toss</h2>
          <div className="flex gap-2">
            {(['team_a', 'team_b'] as const).map(t => (
              <button key={t}
                className={`flex-1 py-2 rounded-lg text-sm transition-colors ${tossWinner === t ? 'bg-cricket-green text-white font-medium' : 'bg-gray-100 text-gray-600'}`}
                onClick={() => setTossWinner(t)}>
                {t === 'team_a' ? (teamAName || 'Team A') : (teamBName || 'Team B')} Won
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(['bat', 'bowl'] as const).map(d => (
              <button key={d}
                className={`flex-1 py-2 rounded-lg text-sm transition-colors ${tossDecision === d ? 'bg-cricket-green text-white font-medium' : 'bg-gray-100 text-gray-600'}`}
                onClick={() => setTossDecision(d)}>
                {d === 'bat' ? 'Elected to Bat' : 'Elected to Bowl'}
              </button>
            ))}
          </div>
        </div>

        {/* Last Man Standing */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-800">Last Man Standing</h2>
            <p className="text-xs text-gray-500">Allow single batsman when all others out</p>
          </div>
          <button
            className={`w-12 h-6 rounded-full relative transition-colors ${lastManStanding ? 'bg-cricket-green' : 'bg-gray-300'}`}
            onClick={() => setLastManStanding(!lastManStanding)}>
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow transition-transform ${lastManStanding ? 'translate-x-6' : 'translate-x-[2px]'}`} />
          </button>
        </div>

        {/* Player Selection with Captain/VC */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3 mb-2">
          <div>
            <h2 className="text-sm font-bold text-gray-800">Select Playing XIs</h2>
            <p className="text-xs text-gray-500 mt-0.5">Tap to pick · tap C/VC to set role · type below to add new</p>
          </div>
          <div className="flex gap-3">
            {renderTeamPicker('a', teamAName || 'Team A', teamAPlayers, teamACaptain, setTeamACaptain, teamAVC, setTeamAVC, newPlayerA, setNewPlayerA)}
            {renderTeamPicker('b', teamBName || 'Team B', teamBPlayers, teamBCaptain, setTeamBCaptain, teamBVC, setTeamBVC, newPlayerB, setNewPlayerB)}
          </div>
        </div>

        {/* Validation hint */}
        {!canStart && (teamAName || teamBName) && (
          <p className="text-xs text-gray-400 text-center -mt-2 mb-1">
            {!teamAName || !teamBName
              ? '⚠️ Enter both team names'
              : `⚠️ Need ${playersPerSide} per side — A: ${teamAPlayers.length}  B: ${teamBPlayers.length}`}
          </p>
        )}

        {/* Start button */}
        <button
          onClick={handleStartMatch}
          disabled={!canStart}
          className={`w-full py-4 rounded-xl font-bold text-lg mb-8 transition-colors ${canStart ? 'bg-cricket-green text-white shadow-md' : 'bg-gray-200 text-gray-400'}`}>
          START MATCH
        </button>

      </div>
    </div>
  );
}
