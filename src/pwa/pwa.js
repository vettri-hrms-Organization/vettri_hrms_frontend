/**
 * PWA client glue: service-worker registration (production only), update detection and
 * the install prompt. State lives at module level because `beforeinstallprompt` can fire
 * before any React component mounts; components subscribe via usePwa().
 */
import { useEffect, useState } from 'react';

const listeners = new Set();
const state = {
  installPrompt: null, // deferred BeforeInstallPromptEvent
  installed: false,
  waitingWorker: null, // ServiceWorker ready to take over
};

function emit() {
  listeners.forEach((listener) => listener({ ...state }));
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
}

export function isIosSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.installPrompt = event;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    state.installPrompt = null;
    state.installed = true;
    emit();
  });
}

/** Shows the browser install dialog. Resolves to 'accepted' | 'dismissed' | 'unavailable'. */
export async function promptInstall() {
  const prompt = state.installPrompt;
  if (!prompt) return 'unavailable';
  prompt.prompt();
  const choice = await prompt.userChoice.catch(() => ({ outcome: 'dismissed' }));
  state.installPrompt = null;
  emit();
  return choice?.outcome || 'dismissed';
}

/** Tells the waiting worker to activate; the page reloads once it takes control. */
export function applyUpdate() {
  const worker = state.waitingWorker;
  if (!worker) {
    window.location.reload();
    return;
  }
  worker.postMessage({ type: 'SKIP_WAITING' });
}

function trackWaiting(registration) {
  const markWaiting = (worker) => {
    // Only an *update* when a controller already exists; first install needs no prompt.
    if (worker && navigator.serviceWorker.controller) {
      state.waitingWorker = worker;
      emit();
    }
  };
  if (registration.waiting) markWaiting(registration.waiting);
  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed') markWaiting(installing);
    });
  });
}

/** Registers /sw.js. Call only in production builds (import.meta.env.PROD). */
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !state.waitingWorker) return;
    reloading = true;
    window.location.reload();
  });
  const register = () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        trackWaiting(registration);
        // Look for a new deploy hourly while the app stays open.
        setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
      })
      .catch(() => { /* PWA is progressive: the app works without a service worker */ });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

export function usePwa() {
  const [snapshot, setSnapshot] = useState(() => ({ ...state }));
  useEffect(() => {
    listeners.add(setSnapshot);
    setSnapshot({ ...state });
    return () => listeners.delete(setSnapshot);
  }, []);
  return {
    canInstall: !!snapshot.installPrompt && !isStandalone(),
    showIosHint: !snapshot.installPrompt && isIosSafari() && !isStandalone(),
    updateAvailable: !!snapshot.waitingWorker,
    installed: snapshot.installed || isStandalone(),
  };
}
