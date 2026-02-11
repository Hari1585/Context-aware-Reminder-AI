'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/lib/auth';
import { apiClient, Reminder } from '@/lib/api';

export default function Dashboard() {
  const router = useRouter();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [newReminderText, setNewReminderText] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const isAuth = await AuthService.isAuthenticated();
    if (!isAuth) {
      router.push('/login');
      return;
    }
    loadReminders();
  }

  async function loadReminders() {
    try {
      const data = await apiClient.listReminders();
      setReminders(data);
    } catch (err) {
      console.error('Failed to load reminders:', err);
      setError('Failed to load reminders');
    } finally {
      setLoading(false);
    }
  }

  async function createReminder() {
    if (!newReminderText.trim()) return;

    setCreating(true);
    setError('');

    try {
      await apiClient.createReminder({ text: newReminderText });
      setNewReminderText('');
      await loadReminders();
    } catch (err) {
      console.error('Failed to create reminder:', err);
      setError('Failed to create reminder');
    } finally {
      setCreating(false);
    }
  }

  async function deleteReminder(id: string) {
    try {
      await apiClient.deleteReminder(id);
      await loadReminders();
    } catch (err) {
      console.error('Failed to delete reminder:', err);
    }
  }

  async function completeReminder(id: string) {
    try {
      await apiClient.updateReminder(id, { status: 'completed' });
      await loadReminders();
    } catch (err) {
      console.error('Failed to complete reminder:', err);
    }
  }

  function handleLogout() {
    AuthService.signOut();
    router.push('/login');
  }

  if (loading) {
    return <div className="container">Loading...</div>;
  }

  return (
    <>
      <header className="header">
        <div className="header-content">
          <h1>Reminder App</h1>
          <nav className="nav">
            <a href="/settings">Settings</a>
            <button onClick={handleLogout} className="button button-secondary">
              Logout
            </button>
          </nav>
        </div>
      </header>

      <div className="container">
        <div className="card">
          <h2>Create Reminder</h2>
          <p style={{ color: '#666', marginBottom: '10px' }}>
            Use natural language: "Remind me to buy milk when I'm near Walmart"
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              className="input"
              placeholder="Enter reminder..."
              value={newReminderText}
              onChange={(e) => setNewReminderText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createReminder()}
              disabled={creating}
            />
            <button
              onClick={createReminder}
              disabled={creating || !newReminderText.trim()}
              className="button button-primary"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
          {error && <p style={{ color: '#e00', marginTop: '10px' }}>{error}</p>}
        </div>

        <div className="card">
          <h2>Your Reminders ({reminders.length})</h2>
          {reminders.length === 0 ? (
            <p style={{ color: '#666' }}>No reminders yet. Create one above!</p>
          ) : (
            <div className="reminder-list">
              {reminders.map((reminder) => (
                <div key={reminder.id} className={`reminder-item ${reminder.status}`}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                      <strong>{reminder.task}</strong>
                      <span className={`status-badge status-${reminder.status}`}>
                        {reminder.status}
                      </span>
                      <span className={`priority-${reminder.priority}`}>
                        {reminder.priority}
                      </span>
                    </div>
                    <div style={{ color: '#666', fontSize: '14px' }}>
                      📍 {reminder.location_query} ({reminder.radius_meters}m)
                    </div>
                    <div style={{ color: '#999', fontSize: '12px', marginTop: '5px' }}>
                      Created: {new Date(reminder.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {reminder.status === 'active' && (
                      <button
                        onClick={() => completeReminder(reminder.id)}
                        className="button button-secondary"
                      >
                        Complete
                      </button>
                    )}
                    <button
                      onClick={() => deleteReminder(reminder.id)}
                      className="button button-danger"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
