import { useState } from "react";
import { Eye, EyeOff, User, Lock, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from "axios";

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); // empezamos a cargar
    setError(''); // limpiamos errores previos

  try {
    const response = await axios.post("https://localhost:7008/api/Users/login", {
      username,
      password,
    });

    if (response.status === 200) {
      localStorage.setItem("token", response.data.token);
      //alert("Login exitoso");
      window.location.replace("/dashboard");
      console.log("Token guardado: ", response.data.token)
    }
  } catch (err) {
    if (err.response && err.response.status === 401) {
      console.log("Mensaje desde el backend:", err.response.data);
      setError(err.response.data.message);
    } else {
      setError("Error de conexión");
    }
  } finally {
    setLoading(false);
  }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-sky-900 to-slate-900 px-4">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%239C92AC' fillOpacity='0.05'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
      </div>
      
      <div className="relative z-10 w-full max-w-6xl mx-auto">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-12 lg:p-16">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl mb-8">
              <User className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">Bienvenido</h2>
            <p className="text-gray-300 text-lg">Inicia sesión en tu cuenta</p>
          </div>

          <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-8">
            <div className="space-y-3">
              <label htmlFor="username" className="block text-base font-medium text-gray-200">
                Usuario
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-6 w-6 text-gray-400" />
                </div>
                <input
                  id="username"
                  type="text"
                  placeholder="Ingresa tu usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-4 text-lg bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 backdrop-blur-sm"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label htmlFor="password" className="block text-base font-medium text-gray-200">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-6 w-6 text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-14 py-4 text-lg bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 backdrop-blur-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-6 w-6" />
                  ) : (
                    <Eye className="h-6 w-6" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-base">
              <label className="flex items-center text-gray-300">
                <input
                  type="checkbox"
                  className="w-5 h-5 text-blue-600 bg-transparent border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="ml-2">Recordarme</span>
              </label>
              <span
                onClick={() => navigate('/forgot-password')}
                className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
              >
                  ¿Olvidaste tu contraseña?
              </span>

            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 px-6 text-lg rounded-xl font-semibold text-white transition-all duration-300 transform ${
                loading
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                  Ingresando...
                </div>
              ) : (
                "Iniciar Sesión"
              )}
            </button>

            {error && (
              <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl">
                <p className="text-red-200 text-base text-center">{error}</p>
              </div>
            )}
          </form>

          <div className="mt-10 text-center">
            <p className="text-gray-400 text-base">
              ¿No tienes una cuenta?{' '}
              <span
                onClick={() => navigate('/register')}
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors cursor-pointer"
              >
                Regístrate aquí
              </span>
            </p>
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-gray-500 text-xs">
            © 2025 Control Ingresos/Gastos App. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
