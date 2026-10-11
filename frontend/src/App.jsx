import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login          from './features/auth/Login';
import Dashboard      from './dashboard/Dashboard';
import Register       from './features/auth/Register';
import ForgotPassword from './features/auth/ForgotPassword';
import ResetPassword  from './features/auth/ResetPassword';
import Incomes        from './features/Incomes';
import Expenses       from './features/Expenses';
import Header         from './dashboard/Header';
import { parseJwt }   from './utils/jwt';

export default function App() {
  // Convertir a estado para que se pueda actualizar reactivamente
  const [token, setToken] = useState(localStorage.getItem('token'));
  
  // Función para verificar autenticación
  const getAuthStatus = (currentToken) => {
    const payload = parseJwt(currentToken) || {};
    return !!payload.exp && Date.now() < payload.exp * 1000;
  };
  
  const isAuthenticated = getAuthStatus(token);
  const payload = parseJwt(token) || {};
  const userName = payload.unique_name || payload.name || '';

  useEffect(() => {
    // Escuchar el evento de token expirado que dispara el interceptor de axios
    const handleTokenExpired = () => {
      console.log("Token expirado detectado, actualizando estado...");
      setToken(null); // Esto forzará un re-render y isAuthenticated será false
    };

    // Escuchar cambios en localStorage (por si el token se actualiza desde otro lugar)
    const handleStorageChange = () => {
      const newToken = localStorage.getItem('token');
      setToken(newToken);
    };

    // Agregar listeners
    window.addEventListener('tokenExpired', handleTokenExpired);
    window.addEventListener('storage', handleStorageChange);

    // Cleanup al desmontar
    return () => {
      window.removeEventListener('tokenExpired', handleTokenExpired);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Función helper para actualizar el token desde componentes hijos (como Login)
  const updateToken = (newToken) => {
    setToken(newToken);
  };

  return (
    <>
      {/* Solo muestro el Header si está autenticado */}
      {isAuthenticated && <Header userName={userName} />}

      <Routes>
        {/* Ruta pública: si ya estás logueado, te mando al dashboard */}
        <Route
          path="/login"
          element={
            isAuthenticated
              ? <Navigate to="/dashboard" replace />
              : <Login updateToken={updateToken} />
          }
        />

        {/* Resto de públicas */}
        <Route
          path="/register"
          element={
            isAuthenticated
              ? <Navigate to="/dashboard" replace />
              : <Register />
          }
        />
        <Route
          path="/forgot-password"
          element={
            isAuthenticated
              ? <Navigate to="/dashboard" replace />
              : <ForgotPassword />
          }
        />
        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />

        {/* Rutas protegidas: si no estás logueado, te mando a login */}
        <Route
          path="/dashboard"
          element={
            isAuthenticated
              ? <Dashboard />
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/incomes"
          element={
            isAuthenticated
              ? <Incomes />
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/expenses"
          element={
            isAuthenticated
              ? <Expenses />
              : <Navigate to="/login" replace />
          }
        />

        {/* Cualquier otra ruta va al login o al dashboard */}
        <Route
          path="*"
          element={
            isAuthenticated
              ? <Navigate to="/dashboard" replace />
              : <Navigate to="/login" replace />
          }
        />
      </Routes>
    </>
  );
}