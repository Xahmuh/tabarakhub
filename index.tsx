
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  import.meta.env.DEV ? (
    <React.StrictMode>
      <AppErrorBoundary>
        <React.Suspense fallback={null}>
          <App />
        </React.Suspense>
      </AppErrorBoundary>
    </React.StrictMode>
  ) : (
    <AppErrorBoundary>
      <React.Suspense fallback={null}>
        <App />
      </React.Suspense>
    </AppErrorBoundary>
  )
);
