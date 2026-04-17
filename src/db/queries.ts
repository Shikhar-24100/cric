import { db } from './db';
import type { Player } from './db';

// Example utility queries

export async function addPlayer(name: string) {
  return await db.players.add({
    name,
    created_at: Date.now()
  });
}

export async function deletePlayer(id: number) {
  return await db.players.delete(id);
}

export async function getPlayers(): Promise<Player[]> {
  return await db.players.orderBy('created_at').reverse().toArray();
}

export async function updatePlayer(id: number, name: string) {
  return await db.players.update(id, { name });
}
