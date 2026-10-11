import axios from "axios";

// Crear instancia de axios con URL base de tu API
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
});

// Agregar interceptor para inyectar el token en cada petición
api.interceptors.request.use(config => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor para detectar token expirado
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.log("Tu sesión ha expirado. Redirigiendo a login...");
      
      // Limpiar token
      localStorage.removeItem("token");
      
      // Disparar evento personalizado para que App.jsx lo escuche
      window.dispatchEvent(new CustomEvent('tokenExpired'));
    }
    
    return Promise.reject(error);
  }
);

export default api;