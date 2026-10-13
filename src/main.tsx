import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/plink/index.css';
import './styles/fonts.css';
import './styles/global.css';
import { App } from './App';
import { I18nProvider } from './i18n';
import { registerServiceWorker } from './offline/register';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);

// Offline use and updates (#9), for the built app only: in development every
// change should show at once, not wait for a reload.
if (import.meta.env.PROD) registerServiceWorker();
