import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthGate } from './components/AuthGate';
import { CLOUD } from './lib/supabase';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {CLOUD ? <AuthGate>{(cloud) => <App key={cloud.profile.user_id} cloud={cloud} />}</AuthGate> : <App />}
  </StrictMode>,
);
