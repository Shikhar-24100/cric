import { db } from './db';
import type { Ball } from './db';

// Helper to calculate score directly from balls and innings extras
export async function getInningsScore(inningsId: number) {
  const balls = await db.balls.where('innings_id').equals(inningsId).toArray();
  const innings = await db.innings.get(inningsId);
  
  if (!innings) return null;

  let totalRuns = 0;
  let totalWickets = 0;
  let legalDeliveries = 0;

  for (const ball of balls) {
    totalRuns += ball.runs_scored;
    if (ball.is_wide || ball.is_no_ball) {
      totalRuns += 1; // standard penalty, extra runs handled differently if needed
    } else {
      legalDeliveries++;
    }
    if (ball.is_wicket) totalWickets++;
  }

  const overs = Math.floor(legalDeliveries / 6) + (legalDeliveries % 6) / 10;

  return { totalRuns, totalWickets, overs, balls };
}

export async function addBall(ballData: Omit<Ball, 'id'>) {
    return await db.transaction('rw', db.balls, db.batting_performances, db.bowling_performances, db.innings, async () => {
        const ballId = await db.balls.add(ballData as Ball);
        // We will compute performance live using queries instead of keeping separate tallies for now to avoid consistency issues,
        // or we can update tallies here if needed for speed. Given Dexie is local, live summing is fast enough for < 300 balls.
        return ballId;
    });
}
