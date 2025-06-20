import { Routes, Route } from 'react-router-dom';
import Login from './features/auth/Login';
import Dashboard from './dashboard/Dashboard';
import Register from './features/auth/Register';
import ForgotPassword from './features/auth/ForgotPassword';
import Incomes from './features/dashboard/Incomes';
import Expenses from './features/dashboard/Expenses';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/incomes" element={<Incomes />} />
      <Route path="/expenses" element={<Expenses />} />
    </Routes>
  );
}

export default App;