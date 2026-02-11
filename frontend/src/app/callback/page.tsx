'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthService } from '@/lib/auth';

export default function Callback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(`Authentication error: ${errorParam}`);
      return;
    }

    if (!code) {
      setError('No authorization code received');
      return;
    }

    try {
      const redirectUri = `${window.location.origin}/callback`;
      await AuthService.exchangeCodeForTokens(code, redirectUri);
      router.push('/');
    } catch (err) {
      console.error('Token exchange failed:', err);
      setError('Failed to complete authentication');
    }
  }

  return (
    <div className="container" style={{ maxWidth: '400px', marginTop: '100px' }}>
      <div className="card" style={{ textAlign: 'center' }}>
        {error ? (
          <>
            <h2 style={{ color: '#e00', marginBottom: '20px' }}>Error</h2>
            <p>{error}</p>
            <button
              onClick={() => router.push('/login')}
              className="button button-primary"
              style={{ marginTop: '20px' }}
            >
              Back to Login
            </button>
          </>
        ) : (
          <>
            <h2>Authenticating...</h2>
            <p style={{ color: '#666', marginTop: '10px' }}>Please wait</p>
          </>
        )}
      </div>
    </div>
  );
}
