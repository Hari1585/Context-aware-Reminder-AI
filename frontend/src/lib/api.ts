import axios, { AxiosInstance } from 'axios';
import { AuthService } from './auth';

export interface Reminder {
  id: string;
  user_id: string;
  task: string;
  location_query: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  radius_meters: number;
  status: 'active' | 'completed' | 'snoozed' | 'triggered';
  priority: 'low' | 'medium' | 'high';
  time_constraints?: string;
  created_at: string;
  updated_at: string;
  triggered_at?: string;
  last_notification_at?: string;
}

export interface CreateReminderRequest {
  text: string;
  override_location?: {
    latitude: number;
    longitude: number;
  };
  override_radius?: number;
}

export interface UpdateReminderRequest {
  status?: 'active' | 'completed' | 'snoozed' | 'triggered';
  location?: {
    latitude: number;
    longitude: number;
  };
  radius_meters?: number;
}

export interface LocationEventRequest {
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  timestamp?: string;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL,
      timeout: 30000,
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config) => {
        try {
          const token = await AuthService.getIdToken();
          config.headers.Authorization = `Bearer ${token}`;
        } catch (error) {
          console.error('Failed to get auth token:', error);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Redirect to login
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  async createReminder(request: CreateReminderRequest): Promise<Reminder> {
    const response = await this.client.post<Reminder>('/reminders', request);
    return response.data;
  }

  async listReminders(status?: string): Promise<Reminder[]> {
    const response = await this.client.get<Reminder[]>('/reminders', {
      params: status ? { status } : undefined,
    });
    return response.data;
  }

  async getReminder(id: string): Promise<Reminder> {
    const response = await this.client.get<Reminder>(`/reminders/${id}`);
    return response.data;
  }

  async updateReminder(id: string, request: UpdateReminderRequest): Promise<Reminder> {
    const response = await this.client.patch<Reminder>(`/reminders/${id}`, request);
    return response.data;
  }

  async deleteReminder(id: string): Promise<void> {
    await this.client.delete(`/reminders/${id}`);
  }

  async postLocationEvent(request: LocationEventRequest): Promise<void> {
    await this.client.post('/location-events', request);
  }

  async healthCheck(): Promise<{ status: string; env: string }> {
    const response = await this.client.get('/health');
    return response.data;
  }
}

export const apiClient = new ApiClient();
