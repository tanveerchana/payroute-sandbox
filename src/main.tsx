import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AccessRoot } from './access/AccessRoot';
import './styles.css';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AccessRoot app="payroute">
      <App />
    </AccessRoot>
  </React.StrictMode>,
);
