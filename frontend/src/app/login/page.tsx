'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/lib/auth';

export default function Login() {
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const isAuth = await AuthService.isAuthenticated();
    if (isAuth) {
      router.push('/');
    }
  }

  function handleLogin() {
    const redirectUri = `${window.location.origin}/callback`;
    const loginUrl = AuthService.getHostedUIUrl(redirectUri);
    window.location.href = loginUrl;
  }

  return (
    <div className="container" style={{ maxWidth: '400px', marginTop: '100px' }}>
      <div className="card" style={{ textAlign: 'center' }}>
        <h1 style={{ marginBottom: '20px' }}>Reminder App</h1>
        <p style={{ color: '#666', marginBottom: '30px' }}>
          Context-aware location-based reminders
        </p>
        <button onClick={handleLogin} className="button button-primary" style={{ width: '100%' }}>
          Sign In with Cognito
        </button>
      </div>
    </div>
  );
}
