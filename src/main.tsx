import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
import './ai-option.css';
import './ai-settings.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
