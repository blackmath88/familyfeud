import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { GameProvider } from './state/GameContext';
import './styles.css';

const routes = <BrowserRouter><App /></BrowserRouter>;
const boardRoute = location.pathname === '/board' || location.pathname === '/board/';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {boardRoute ? routes : <GameProvider>{routes}</GameProvider>}
  </React.StrictMode>,
);
