import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import Teams from './pages/Teams';
import NewMatch from './pages/NewMatch';
import LiveScoring from './pages/LiveScoring';
import History from './pages/History';
import Scorecard from './pages/Scorecard';
import Career from './pages/Career';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<NewMatch />} />
          <Route path="teams" element={<Teams />} />
          <Route path="history" element={<History />} />
          <Route path="career" element={<Career />} />
        </Route>
        {/* Modals / Full Screen overlays */}
        <Route path="/live-scoring/:matchId" element={<LiveScoring />} />
        <Route path="/scorecard/:matchId" element={<Scorecard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
