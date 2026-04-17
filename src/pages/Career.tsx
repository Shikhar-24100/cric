import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

export default function Career() {
  const allPlayers = useLiveQuery(() => db.players.toArray());
  const allBalls = useLiveQuery(() => db.balls.toArray());
  
  const [filter, setFilter] = useState('All Time');

  const stats = useMemo(() => {
    if (!allPlayers || !allBalls) return [];

    return allPlayers.map(p => {
       const bStats = { runs: 0, balls: 0, fours: 0, sixes: 0 };
       const oStats = { runsConceded: 0, wickets: 0, ballsBowled: 0 };

       allBalls.forEach(b => {
          if (b.batsman_id === p.id) {
             if (!b.is_wide) bStats.balls++;
             if (!b.is_bye && !b.is_leg_bye) {
               bStats.runs += b.runs_scored;
               if (b.runs_scored === 4) bStats.fours++;
               if (b.runs_scored === 6) bStats.sixes++;
             }
          }
          if (b.bowler_id === p.id) {
             if (!b.is_wide && !b.is_no_ball) oStats.ballsBowled++;
             if (!b.is_bye && !b.is_leg_bye) oStats.runsConceded += b.runs_scored;
             if (b.is_wide || b.is_no_ball) oStats.runsConceded += 1;
             if (b.is_wicket && b.wicket_type !== 'Run Out') oStats.wickets++;
          }
       });

       return {
         ...p,
         bStats,
         oStats,
         sr: bStats.balls > 0 ? ((bStats.runs / bStats.balls) * 100).toFixed(0) : '0',
         er: oStats.ballsBowled > 0 ? (oStats.runsConceded / (oStats.ballsBowled / 6)).toFixed(1) : '0.0'
       };
    }).sort((a,b) => b.bStats.runs - a.bStats.runs); // Default sort by most runs
  }, [allPlayers, allBalls]);

  if (!allPlayers || !allBalls) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div className="flex flex-col bg-cricket-bg min-h-full">
      <div className="p-4 border-b border-gray-200 sticky top-0 bg-white z-10 shadow-sm overflow-x-auto whitespace-nowrap">
        <h2 className="text-lg font-semibold text-gray-800 inline-block mr-4">Career Stats</h2>
        <div className="inline-flex gap-2 text-sm pb-1">
           {['All Time', 'Last 30 Days', 'This Year'].map(f => (
             <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-full font-medium ${filter === f ? 'bg-cricket-green text-white' : 'bg-gray-100 text-gray-600'}`}>{f}</button>
           ))}
        </div>
      </div>

      <div className="p-3 space-y-4 pb-safe-area">
        
        {/* Leaderboards highlights */}
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
           <div className="bg-gradient-to-br from-green-500 to-cricket-green text-white p-4 rounded-xl min-w-[160px] snap-center shadow-md">
              <h3 className="text-xs font-bold opacity-80 uppercase tracking-wider mb-1">Most Runs</h3>
              <div className="text-xl font-black mb-1 truncate">{stats[0]?.name || '-'}</div>
              <div className="text-2xl font-black">{stats[0]?.bStats.runs || 0}</div>
           </div>
           {(() => {
              const b = [...stats].sort((a,b) => b.oStats.wickets - a.oStats.wickets)[0];
              return (
                 <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-4 rounded-xl min-w-[160px] snap-center shadow-md">
                    <h3 className="text-xs font-bold opacity-80 uppercase tracking-wider mb-1">Most Wickets</h3>
                    <div className="text-xl font-black mb-1 truncate">{b?.name || '-'}</div>
                    <div className="text-2xl font-black">{b?.oStats.wickets || 0}</div>
                 </div>
              );
           })()}
        </div>

        {/* Batting Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 p-3 font-bold text-gray-800 border-b border-gray-100 flex items-center">
             <span className="flex-1">Batting</span>
             <span className="text-xs text-gray-400 font-normal">Sorted by Runs</span>
          </div>
          <div className="overflow-x-auto">
             <table className="w-full text-sm text-left">
               <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold text-xs">
                 <tr>
                   <th className="p-2 py-3">Player</th>
                   <th className="p-2 py-3 text-right">R</th>
                   <th className="p-2 py-3 text-right">B</th>
                   <th className="p-2 py-3 text-right">SR</th>
                   <th className="p-2 py-3 text-right">4s</th>
                   <th className="p-2 py-3 text-right">6s</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {stats.map(s => (
                   <tr key={s.id}>
                     <td className="p-2 font-medium text-gray-800 max-w-[100px] truncate">{s.name}</td>
                     <td className="p-2 text-right font-bold text-gray-800">{s.bStats.runs}</td>
                     <td className="p-2 text-right text-gray-500">{s.bStats.balls}</td>
                     <td className="p-2 text-right text-gray-600">{s.sr}</td>
                     <td className="p-2 text-right text-gray-500">{s.bStats.fours}</td>
                     <td className="p-2 text-right text-gray-500">{s.bStats.sixes}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>
        </div>

        {/* Bowling Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 p-3 font-bold text-gray-800 border-b border-gray-100 flex items-center">
             <span className="flex-1">Bowling</span>
             <span className="text-xs text-gray-400 font-normal">Sorted by Wickets</span>
          </div>
          <div className="overflow-x-auto">
             <table className="w-full text-sm text-left">
               <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold text-xs">
                 <tr>
                   <th className="p-2 py-3">Player</th>
                   <th className="p-2 py-3 text-right">W</th>
                   <th className="p-2 py-3 text-right">O</th>
                   <th className="p-2 py-3 text-right">R</th>
                   <th className="p-2 py-3 text-right">ER</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {[...stats].sort((a,b) => b.oStats.wickets - a.oStats.wickets).map(s => (
                   <tr key={s.id}>
                     <td className="p-2 font-medium text-gray-800 max-w-[100px] truncate">{s.name}</td>
                     <td className="p-2 text-right font-bold text-gray-800">{s.oStats.wickets}</td>
                     <td className="p-2 text-right text-gray-500">{Math.floor(s.oStats.ballsBowled / 6) + (s.oStats.ballsBowled % 6) / 10}</td>
                     <td className="p-2 text-right text-gray-500">{s.oStats.runsConceded}</td>
                     <td className="p-2 text-right text-gray-600">{s.er}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>
        </div>

      </div>
    </div>
  );
}
