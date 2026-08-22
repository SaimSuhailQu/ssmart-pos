/* eslint-disable @typescript-eslint/ban-ts-comment */
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// @ts-ignore
import './index.css';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
