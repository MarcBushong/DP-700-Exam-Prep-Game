import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export function StartupError({ error }: { error: unknown }) {
  return (
    <main className="startup">
      <div className="error-page panel">
        <AlertTriangle size={36} aria-hidden="true" />
        <h1>We couldn’t load your challenge.</h1>
        <p>
          The local question bank or application couldn’t be read. No quiz has
          been started. Your saved study data has not been cleared.
        </p>
        <p>
          Try reloading. If this continues, check that the local content files
          are present and run the project’s content validation command.
        </p>
        <details>
          <summary>Technical details</summary>
          <pre>
            {error instanceof Error
              ? error.message
              : 'An unexpected application error occurred.'}
          </pre>
        </details>
        <button
          className="button primary"
          onClick={() => window.location.reload()}
        >
          <RotateCcw size={18} aria-hidden="true" /> Reload application
        </button>
        <p className="small muted">
          Unofficial study aid. Not affiliated with or endorsed by Microsoft
          Certification.
        </p>
      </div>
    </main>
  );
}

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: unknown }
> {
  state: { error: unknown } = { error: null };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <StartupError error={this.state.error} />
    ) : (
      this.props.children
    );
  }
}
