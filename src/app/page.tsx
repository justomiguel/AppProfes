'use client';

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from '../components/LoginForm';
import RegisterForm from '../components/RegisterForm';
import MainPage from '../components/MainPage';

export default function Home() {
  const { user, login, isLoading } = useAuth();
  const [showRegister, setShowRegister] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (showSuccessMessage) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full text-center">
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
              ¡Cuenta creada exitosamente! Ahora puedes iniciar sesión.
            </div>
            <button
              onClick={() => {
                setShowSuccessMessage(false);
                setShowRegister(false);
              }}
              className="text-blue-600 hover:text-blue-500"
            >
              Ir al login
            </button>
          </div>
        </div>
      );
    }

    if (showRegister) {
      return (
        <RegisterForm
          onSuccess={() => setShowSuccessMessage(true)}
          onSwitchToLogin={() => setShowRegister(false)}
        />
      );
    }

    return (
      <LoginForm
        onSuccess={(userData, token) => {
          login(userData, token);
        }}
        onSwitchToRegister={() => setShowRegister(true)}
      />
    );
  }

  return <MainPage />;
}
