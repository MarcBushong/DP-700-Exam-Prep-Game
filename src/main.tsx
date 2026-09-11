import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary, StartupError } from './components/ErrorBoundary';
import './styles/app.css';

const element = document.getElementById('root');
if (!element) throw new Error('The application root is missing.');
const root = createRoot(element);

root.render(
  <div className="startup" role="status">
    Preparing your challenge…
  </div>,
);

void import('./App')
  .then(({ default: App }) => {
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    root.render(<StartupError error={error} />);
  });
