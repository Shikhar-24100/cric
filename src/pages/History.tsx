import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useNavigate } from 'react-router-dom';

export default function History() {
  const navigate = useNavigate();
  // We want to list all matches, maybe order by date descending
  const matches = useLiveQuery(() => db.matches.orderBy('date').reverse().toArray());

  if (!matches) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div className="flex flex-col bg-cricket-bg min-h-full">
      <div className="p-4 border-b border-gray-200 sticky top-0 bg-white z-10 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800">Match History</h2>
      </div>

      <div className="p-4 space-y-4">
        {matches.length === 0 && (
          <div className="text-center text-gray-500 mt-10">
            <p>No matches yet.</p>
            <p className="text-sm mt-2">Start a new match to see it here.</p>
          </div>
        )}

        {matches.map(match => (
          <div 
            key={match.id} 
            className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]"
            onClick={() => navigate(`/scorecard/${match.id}`)}
          >
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span>{new Date(match.date).toLocaleDateString()} {new Date(match.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              <span className="font-medium bg-gray-100 px-2 py-0.5 rounded">{match.overs} Over Match</span>
            </div>
            
            <div className="flex items-center justify-between mb-3">
              <div className="text-base font-bold text-gray-800 flex-1 truncate">{match.team_a_name}</div>
              <div className="text-xs font-bold text-gray-400 px-2">VS</div>
              <div className="text-base font-bold text-gray-800 flex-1 text-right truncate">{match.team_b_name}</div>
            </div>

            <div className="text-sm font-medium text-cricket-green bg-green-50 p-2 rounded-lg text-center">
              {match.status === 'in_progress' ? (
                <span>Match In Progress (Tap to resume)</span>
              ) : (
                match.result_winner ? (
                  <span>{match.result_winner === 'team_a' ? match.team_a_name : match.team_b_name} won by {match.result_margin_value} {match.result_margin_type}</span>
                ) : (
                  <span>Tie / Draw</span>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
