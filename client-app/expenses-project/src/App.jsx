import { Routes, Route } from 'react-router-dom';
import Login from './features/auth/Login';
import Dashboard from './dashboard/Dashboard'; // o donde lo tengas

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  );
}

export default App;