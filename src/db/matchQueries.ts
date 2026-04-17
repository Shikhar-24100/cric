import { db } from './db';
import type { Match } from './db';

export async function createNewMatch(matchData: Omit<Match, 'id' | 'status' | 'date'>, teamAPlayers: number[], teamBPlayers: number[]) {
  // Add match
  const matchId = await db.matches.add({
    ...matchData,
    status: 'in_progress',
    date: Date.now()
  });

  const numMatchId = matchId as number;

  // Add players
  const matchPlayers = [
    ...teamAPlayers.map(player_id => ({ match_id: numMatchId, player_id, team: 'team_a' as const })),
    ...teamBPlayers.map(player_id => ({ match_id: numMatchId, player_id, team: 'team_b' as const }))
  ];
  await db.match_players.bulkAdd(matchPlayers);

  // Determine initial batting team
  const battingTeam = matchData.toss_decision === 'bat' ? matchData.toss_winner : (matchData.toss_winner === 'team_a' ? 'team_b' : 'team_a');
  const bowlingTeam = battingTeam === 'team_a' ? 'team_b' : 'team_a';

  // Create first innings
  await db.innings.add({
    match_id: numMatchId,
    batting_team: battingTeam,
    bowling_team: bowlingTeam,
    total_runs: 0,
    total_wickets: 0,
    total_overs_bowled: 0,
    extras_wide: 0,
    extras_noball: 0,
    extras_bye: 0,
    extras_legbye: 0
  });

  return matchId;
}
