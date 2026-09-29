import React from 'react';

type AppErrorBoundaryState = {
  hasError: boolean;
};

type AppErrorBoundaryProps = {
  children?: React.ReactNode;
};

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  declare readonly props: AppErrorBoundaryProps;
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application render failure', error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <h1 className="text-xl font-black text-slate-950">Something went wrong</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
            Your data was not changed. Reload the workspace to reconnect and continue.
          </p>
          <button
            type="button"
            onClick={this.reload}
            className="mt-6 w-full rounded-xl bg-brand px-4 py-3 text-sm font-black text-white hover:bg-brand-hover"
          >
            Reload workspace
          </button>
        </section>
      </main>
    );
  }
}
