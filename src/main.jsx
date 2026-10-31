import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import '@fontsource-variable/manrope';

// Order matters: customized Bootstrap first, then design tokens (so token
// values can be referenced by anything after), then global resets/utilities.
import './design-system/styles/custom.scss';
import './design-system/styles/tokens.css';
import './design-system/styles/global.css';
import './components/ui/components.css';
import './design-system/styles/assistant.css';
import './design-system/styles/hrms-product.css';
import './design-system/styles/vettri-ui.css';
import './design-system/styles/mobile.css';
// Marketing-site brand layer (gradients, aurora, glass) - keep last so it wins.
import './design-system/styles/aurora.css';
// Visual hierarchy for every page (titles, tabs, table headers). Loaded last on purpose.
import './design-system/styles/clarity.css';
import './design-system/styles/dark-mode.css';

import { queryClient } from './api/queryClient';
import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { ConfirmProvider } from './components/ui/ConfirmDialog';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './i18n/LanguageContext';
import App from './App.jsx';
import PwaUpdatePrompt from './pwa/PwaUpdatePrompt';
import { registerServiceWorker } from './pwa/pwa';

// Installable PWA: the service worker is registered in production builds only, so dev
// (Vite HMR) never serves stale bundles from cache.
if (import.meta.env.PROD) {
  registerServiceWorker();
}

// After a deploy, a tab still running the previous build asks for page bundles whose
// hashed names no longer exist. Reload once to pick up the new build instead of
// showing an error; the timestamp guard stops a reload loop if the server is broken.
const CHUNK_RELOAD_KEY = 'vettri-chunk-reload-at';
const isChunkLoadError = (error) => /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Expected a JavaScript-or-Wasm module script/i
  .test(String(error?.message || error || ''));

function reloadForNewBuild() {
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    // storage blocked: still try one reload
  }
  window.location.reload();
  return true;
}

window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewBuild()) event.preventDefault();
});

class AppErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    if (isChunkLoadError(error)) reloadForNewBuild();
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="hz-page-loader p-4">
        <div className="hz-state" style={{ maxWidth: 460 }}>
          <div className="hz-state__icon-wrap" aria-hidden="true">!</div>
          <h1 className="hz-state__title">Something went wrong</h1>
          <p className="hz-state__description">The workspace could not render this screen. Reload to try again.</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload workspace</button>
        </div>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ThemeProvider>
              <LanguageProvider>
              <ToastProvider>
                <ConfirmProvider>
                  <App />
                  <PwaUpdatePrompt />
                </ConfirmProvider>
              </ToastProvider>
              </LanguageProvider>
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);
