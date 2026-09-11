import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { GameProvider } from './features/quiz/GameProvider';
import { Shell } from './components/Shell';
import { HomePage } from './pages/HomePage';
import { SetupPage } from './pages/SetupPage';
import { PlayPage } from './pages/PlayPage';
import { ResultsPage, ReviewPage } from './pages/ResultsPage';
import {
  AboutPage,
  NotFoundPage,
  SettingsPage,
} from './pages/InformationPages';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<HomePage />} />
        <Route path="setup" element={<SetupPage />} />
        <Route path="play" element={<PlayPage />} />
        <Route path="results/:id" element={<ResultsPage />} />
        <Route path="review/:id" element={<ReviewPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </GameProvider>
  );
}
