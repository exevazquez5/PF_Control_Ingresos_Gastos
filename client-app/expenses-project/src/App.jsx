import { Routes, Route } from 'react-router-dom';
import Login from './features/auth/Login';
import Dashboard from './dashboard/Dashboard'; // o donde lo tengas
import Register from './features/auth/Register';
import ForgotPassword from './features/auth/ForgotPassword';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
    </Routes>
  );
}

export default App;