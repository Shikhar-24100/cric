import Dexie, { type EntityTable } from 'dexie';

export interface Player {
  id?: number;
  name: string;
  created_at: number;
}

export interface Match {
  id?: number;
  team_a_name: string;
  team_b_name: string;
  overs: number;
  players_per_side: number;
  last_man_standing: boolean;
  toss_winner: 'team_a' | 'team_b';
  toss_decision: 'bat' | 'bowl';
  team_a_captain_id?: number;
  team_a_vc_id?: number;
  team_b_captain_id?: number;
  team_b_vc_id?: number;
  result_winner?: 'team_a' | 'team_b' | 'draw' | 'tie';
  result_margin_type?: 'runs' | 'wickets';
  result_margin_value?: number;
  date: number;
  status: 'setup' | 'in_progress' | 'completed';
}

export interface MatchPlayer {
  id?: number;
  match_id: number;
  player_id: number;
  team: 'team_a' | 'team_b';
}

export interface Innings {
  id?: number;
  match_id: number;
  batting_team: 'team_a' | 'team_b';
  bowling_team: 'team_a' | 'team_b';
  total_runs: number;
  total_wickets: number;
  total_overs_bowled: number; // Stored as a decimal representation e.g. 1.2
  extras_wide: number;
  extras_noball: number;
  extras_bye: number;
  extras_legbye: number;
}

export interface BattingPerformance {
  id?: number;
  innings_id: number;
  player_id: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  dismissal_type?: 'Bowled' | 'Caught' | 'LBW' | 'Run Out' | 'Stumped' | 'Hit Wicket' | 'Retired' | 'Other';
  fielder_player_id?: number | null;
  bowler_player_id?: number | null;
  batting_position: number;
  is_not_out: boolean;
}

export interface BowlingPerformance {
  id?: number;
  innings_id: number;
  player_id: number;
  overs: number; // Stored as decimal e.g. 2.1
  maidens: number;
  runs: number;
  wickets: number;
}

export interface Ball {
  id?: number;
  innings_id: number;
  over_number: number;
  ball_number: number; // Ball in over normally 1-6 but can go higher if extras
  batsman_id: number;
  bowler_id: number;
  runs_scored: number; // Batsman runs
  is_wide: boolean;
  is_no_ball: boolean;
  is_bye: boolean;
  is_leg_bye: boolean;
  is_wicket: boolean;
  wicket_type?: string;
  fielder_id?: number;
}

const db = new Dexie('CricTrackDB') as Dexie & {
  players: EntityTable<Player, 'id'>;
  matches: EntityTable<Match, 'id'>;
  match_players: EntityTable<MatchPlayer, 'id'>;
  innings: EntityTable<Innings, 'id'>;
  batting_performances: EntityTable<BattingPerformance, 'id'>;
  bowling_performances: EntityTable<BowlingPerformance, 'id'>;
  balls: EntityTable<Ball, 'id'>;
};

// Schema declaration
db.version(1).stores({
  players: '++id, name, created_at',
  matches: '++id, status, date',
  match_players: '++id, match_id, player_id, team',
  innings: '++id, match_id',
  batting_performances: '++id, innings_id, player_id',
  bowling_performances: '++id, innings_id, player_id',
  balls: '++id, innings_id, over_number, batsman_id, bowler_id'
});

// v2 — adds captain / vc fields to matches (existing rows get undefined, that's fine)
db.version(2).stores({
  players: '++id, name, created_at',
  matches: '++id, status, date',
  match_players: '++id, match_id, player_id, team',
  innings: '++id, match_id',
  batting_performances: '++id, innings_id, player_id',
  bowling_performances: '++id, innings_id, player_id',
  balls: '++id, innings_id, over_number, batsman_id, bowler_id'
});

export { db };
