'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/lib/auth';

export default function Settings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    checkAuth();
    checkLocationPermission();
  }, []);

  async function checkAuth() {
    const isAuth = await AuthService.isAuthenticated();
    if (!isAuth) {
      router.push('/login');
      return;
    }
    setLoading(false);
  }

  function checkLocationPermission() {
    if ('geolocation' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setLocationEnabled(result.state === 'granted');
      });
    }
  }

  function requestLocation() {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocationEnabled(true);
          setCurrentLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Location error:', error);
          alert('Failed to get location permission');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser');
    }
  }

  if (loading) {
    return <div className="container">Loading...</div>;
  }

  return (
    <>
      <header className="header">
        <div className="header-content">
          <h1>Settings</h1>
          <nav className="nav">
            <a href="/">Dashboard</a>
          </nav>
        </div>
      </header>

      <div className="container">
        <div className="card">
          <h2>Location Services</h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Enable location services to receive reminders when you're near places.
          </p>
          <div style={{ marginBottom: '20px' }}>
            <strong>Status:</strong>{' '}
            <span style={{ color: locationEnabled ? '#0a0' : '#e00' }}>
              {locationEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          {currentLocation && (
            <div style={{ marginBottom: '20px', fontSize: '14px', color: '#666' }}>
              Current: {currentLocation.lat.toFixed(4)}, {currentLocation.lon.toFixed(4)}
            </div>
          )}
          {!locationEnabled && (
            <button onClick={requestLocation} className="button button-primary">
              Enable Location
            </button>
          )}
        </div>

        <div className="card">
          <h2>Notification Preferences</h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Subscribe to SNS topic to receive email/SMS notifications.
          </p>
          <p style={{ fontSize: '14px', color: '#666' }}>
            To receive notifications, subscribe to the SNS topic via AWS Console or CLI.
            Topic ARN is available in CloudFormation outputs.
          </p>
        </div>

        <div className="card">
          <h2>Default Settings</h2>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Default Radius (meters)</label>
            <input type="number" className="input" defaultValue="500" min="50" max="10000" />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Timezone</label>
            <select className="input">
              <option>America/New_York</option>
              <option>America/Chicago</option>
              <option>America/Denver</option>
              <option>America/Los_Angeles</option>
            </select>
          </div>
          <button className="button button-primary">Save Settings</button>
        </div>
      </div>
    </>
  );
}
