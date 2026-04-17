import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Player } from '../db/db';
import { addPlayer, deletePlayer, updatePlayer } from '../db/queries';
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react';

export default function Teams() {
  const players = useLiveQuery(() => db.players.orderBy('created_at').reverse().toArray());
  const [newPlayerName, setNewPlayerName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return;
    await addPlayer(newPlayerName.trim());
    setNewPlayerName('');
  };

  const startEditing = (p: Player) => {
    setEditingId(p.id!);
    setEditName(p.name);
  };

  const saveEdit = async () => {
    if (editingId && editName.trim()) {
      await updatePlayer(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-gray-200 sticky top-0 bg-white z-10 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Player Roster</h2>
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-gray-100 border-none rounded-lg px-4 py-2 focus:ring-2 focus:ring-cricket-green focus:outline-none"
            placeholder="Add new player..."
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer()}
          />
          <button
            onClick={handleAddPlayer}
            disabled={!newPlayerName.trim()}
            className="bg-cricket-green text-white p-2 rounded-lg disabled:opacity-50"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {players?.length === 0 && (
          <div className="text-center text-gray-500 mt-10">
            <p>No players added yet.</p>
            <p className="text-sm mt-2">Add some players to start building your teams.</p>
          </div>
        )}
        
        {players?.map(player => (
          <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
            {editingId === player.id ? (
              <div className="flex flex-1 items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  className="flex-1 border-b-2 border-cricket-green bg-transparent px-1 focus:outline-none"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                />
                <button onClick={saveEdit} className="text-green-600 p-1">
                  <Check size={20} />
                </button>
                <button onClick={() => setEditingId(null)} className="text-gray-400 p-1">
                  <X size={20} />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-cricket-light text-white flex items-center justify-center font-bold text-lg">
                    {getInitial(player.name)}
                  </div>
                  <span className="font-medium text-gray-800 text-lg">{player.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEditing(player)} className="text-gray-400 hover:text-cricket-dark p-2 rounded-full">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => deletePlayer(player.id!)} className="text-gray-400 hover:text-red-500 p-2 rounded-full">
                    <Trash2 size={18} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
