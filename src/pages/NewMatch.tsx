import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { createNewMatch } from '../db/matchQueries';

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

  // Inline add-new-player inputs, one per team column
  const [newPlayerA, setNewPlayerA] = useState('');
  const [newPlayerB, setNewPlayerB] = useState('');

  const togglePlayer = (team: 'a' | 'b', playerId: number) => {
    if (team === 'a') {
      setTeamAPlayers(prev =>
        prev.includes(playerId) ? prev.filter(id => id !== playerId)
          : prev.length < playersPerSide ? [...prev, playerId] : prev
      );
    } else {
      setTeamBPlayers(prev =>
        prev.includes(playerId) ? prev.filter(id => id !== playerId)
          : prev.length < playersPerSide ? [...prev, playerId] : prev
      );
    }
  };

  // Create a brand new player and immediately add them to the requesting team
  const addNewPlayer = async (team: 'a' | 'b') => {
    const name = (team === 'a' ? newPlayerA : newPlayerB).trim();
    if (!name) return;
    const id = await db.players.add({ name, created_at: Date.now() });
    const numId = id as number;
    if (team === 'a') {
      if (teamAPlayers.length < playersPerSide) setTeamAPlayers(prev => [...prev, numId]);
      setNewPlayerA('');
    } else {
      if (teamBPlayers.length < playersPerSide) setTeamBPlayers(prev => [...prev, numId]);
      setNewPlayerB('');
    }
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
    }, teamAPlayers, teamBPlayers);
    navigate(`/live-scoring/${matchId}`);
  };

  if (!allPlayers) return <div className="p-4 text-center">Loading...</div>;

  // ─── Reusable team picker column ─────────────────────────────────────────
  const renderTeamPicker = (
    team: 'a' | 'b',
    label: string,
    selectedIds: number[],
    newName: string,
    setNewName: (v: string) => void,
  ) => {
    const otherIds = team === 'a' ? teamBPlayers : teamAPlayers;
    const isFull = selectedIds.length >= playersPerSide;

    return (
      <div className="flex-1 flex flex-col min-w-0 border border-gray-200 rounded-xl overflow-hidden">
        {/* header */}
        <div className="bg-gray-100 px-2 py-2 text-xs font-bold text-center border-b border-gray-200">
          {label} ({selectedIds.length}/{playersPerSide})
        </div>

        {/* player list */}
        <div className="overflow-y-auto max-h-56">
          {allPlayers.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No players yet.{'\n'}Add one below.</p>
          )}
          {allPlayers.map(p => {
            const isSelected  = selectedIds.includes(p.id!);
            const isOtherTeam = otherIds.includes(p.id!);
            const isDisabled  = isOtherTeam || (!isSelected && isFull);
            return (
              <button
                key={p.id}
                disabled={isDisabled}
                onClick={() => togglePlayer(team, p.id!)}
                className={`w-full px-3 py-2.5 text-sm text-left border-b border-gray-100 transition-colors flex justify-between items-center
                  ${isSelected   ? 'bg-green-50 text-green-800 font-semibold' :
                    isOtherTeam  ? 'text-gray-300 cursor-not-allowed' :
                    isDisabled   ? 'text-gray-300 cursor-not-allowed' :
                    'hover:bg-gray-50 active:bg-gray-100 text-gray-700'}`}
              >
                <span className="truncate">{p.name}</span>
                {isSelected && <span className="text-green-600 ml-1 shrink-0">✓</span>}
                {isOtherTeam && <span className="text-[10px] text-gray-300 ml-1 shrink-0">taken</span>}
              </button>
            );
          })}
        </div>

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
            >
              Add
            </button>
          </div>
          {isFull && (
            <p className="text-[10px] text-gray-400 mt-1 text-center">Team full</p>
          )}
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
          <input
            type="text" placeholder="Team A Name"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-cricket-green"
            value={teamAName} onChange={e => setTeamAName(e.target.value)}
          />
          <input
            type="text" placeholder="Team B Name"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-cricket-green"
            value={teamBName} onChange={e => setTeamBName(e.target.value)}
          />
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-500 mb-1 block">OVERS</label>
              <input type="number" min="1" max="50"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm"
                value={overs} onChange={e => setOvers(Math.max(1, parseInt(e.target.value) || 1))} />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-500 mb-1 block">PLAYERS/SIDE</label>
              <input type="number" min="2" max="11"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm"
                value={playersPerSide} onChange={e => setPlayersPerSide(Math.min(11, Math.max(2, parseInt(e.target.value) || 2)))} />
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

        {/* Player Selection */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3 mb-2">
          <div>
            <h2 className="text-sm font-bold text-gray-800">Select Playing XIs</h2>
            <p className="text-xs text-gray-500 mt-0.5">Tap names to pick · type below to add a new player</p>
          </div>
          <div className="flex gap-3">
            {renderTeamPicker('a', teamAName || 'Team A', teamAPlayers, newPlayerA, setNewPlayerA)}
            {renderTeamPicker('b', teamBName || 'Team B', teamBPlayers, newPlayerB, setNewPlayerB)}
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
