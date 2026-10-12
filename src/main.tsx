import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/plink/index.css';
import './styles/fonts.css';
import './styles/global.css';
import { App } from './App';
import { I18nProvider } from './i18n';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);
