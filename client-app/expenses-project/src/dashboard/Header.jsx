// src/components/Header.jsx
import React from 'react';
import ThemeToggle from './ThemeToggle';

/**
 * Header component for the GastAr App
 * Shows logo/title, a theme toggle button, and a greeting with user name.
 *
 * Props:
 * - userName: string, name of the logged-in user
 */
export default function Header({ userName }) {
  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace('/login');
  };

  return (
    <header className="bg-amber-500 dark:bg-gray-900 shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        {/* Logo or App name */}
        <div className="flex items-center space-x-3">
          <img
            src="public\expenses-app-logo.svg"
            alt="GastAr App Logo"
            className="h-8 w-auto"
          />
          <span className="text-xl font-bold text-gray-800 dark:text-gray-100">
            GastAr App
          </span>
        </div>

        {/* Greeting, theme switch, and logout */}
        <div className="flex items-center space-x-4">
          <span className="text-gray-800 dark:text-gray-200">Hola, {userName}</span>
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="ml-2 bg-red-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-600 transition-all duration-200 shadow-lg"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    </header>
  );
}
