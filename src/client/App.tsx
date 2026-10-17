import { Navigate, Route, Routes } from 'react-router-dom';
import { Board } from './routes/Board';
import { Editor } from './routes/Editor';
import { Host } from './routes/Host';
import { Setup } from './routes/Setup';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate replace to="/setup" />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/host" element={<Host />} />
      <Route path="/board" element={<Board />} />
      <Route path="/editor" element={<Editor />} />
      <Route path="*" element={<Navigate replace to="/setup" />} />
    </Routes>
  );
}
