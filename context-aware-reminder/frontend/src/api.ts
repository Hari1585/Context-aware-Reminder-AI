import axios from 'axios';

const API_BASE = 'http://localhost:8000';

export interface Task {
  id: string;
  title: string;
  description: string;
  summary: string;
  deadline: string | null;
  location_name: string | null;
  priority: 'low' | 'medium' | 'high';
  type: 'time_based' | 'location_based' | 'recurring';
}

export interface SearchResult {
    kind: string;
    id: string;
    text: string;
    score: number;
    metadata: any;
}

export interface GraphStats {
    user_count: number;
    note_count: number;
    task_count: number;
    location_count: number;
    media_count: number;
}

// Mock Data for Fallback
const MOCK_TASKS: Task[] = [
  {
    id: '1',
    title: 'Return Amazon package',
    description: 'Return the package to UPS.',
    summary: 'Return Amazon package',
    deadline: '2025-12-09T10:00:00',
    location_name: 'UPS Store, Main St',
    priority: 'high',
    type: 'location_based'
  },
  {
    id: '2',
    title: 'Pick up prescription',
    description: 'Pick up meds from CVS.',
    summary: 'Pick up prescription',
    deadline: '2025-12-10T14:00:00',
    location_name: 'CVS Pharmacy, Oak St',
    priority: 'medium',
    type: 'location_based'
  },
  {
    id: '3',
    title: 'Pay electricity bill',
    description: 'Pay before Friday.',
    summary: 'Pay electricity bill',
    deadline: '2025-12-12T09:00:00',
    location_name: null,
    priority: 'medium',
    type: 'time_based'
  },
  {
    id: '4',
    title: 'Weekly team sync',
    description: 'Sync with the engineering team.',
    summary: 'Weekly team sync',
    deadline: null,
    location_name: 'Meeting Room A',
    priority: 'low',
    type: 'recurring'
  }
];

const MOCK_STATS: GraphStats = {
    user_count: 1,
    note_count: 12,
    task_count: 5,
    location_count: 3,
    media_count: 4
};

const MOCK_SEARCH_RESULTS: SearchResult[] = [
    {
        kind: 'task',
        id: '1',
        text: 'Return Amazon package at UPS Store',
        score: 0.89,
        metadata: { type: 'location_based' }
    },
    {
        kind: 'note',
        id: 'note-1',
        text: 'Reminder to return amazon items and buy milk.',
        score: 0.75,
        metadata: {}
    }
];

// Helper to handle requests with mock fallback
async function fetchWithFallback<T>(fn: () => Promise<any>, fallback: T): Promise<T> {
    try {
        const res = await fn();
        return res.data;
    } catch (error) {
        console.warn('Backend connection failed, using mock data.', error);
        return fallback;
    }
}

export const api = {
  getOverview: async () => {
    return fetchWithFallback(() => axios.get<GraphStats>(`${API_BASE}/graph/overview`), MOCK_STATS);
  },

  getTasks: async (userId: string, type: string = 'all', priority: string = 'all') => {
    return fetchWithFallback(
        () => axios.get<Task[]>(`${API_BASE}/tasks`, { params: { user_id: userId, type, priority } }),
        MOCK_TASKS.filter(t => 
            (type === 'all' || t.type === type) && 
            (priority === 'all' || t.priority === priority)
        )
    );
  },

  search: async (query: string) => {
    // Artificial delay for realism
    await new Promise(r => setTimeout(r, 600));
    return fetchWithFallback(
        () => axios.post<SearchResult[]>(`${API_BASE}/search/semantic`, { query, top_k: 5 }),
        MOCK_SEARCH_RESULTS
    );
  },

  createNoteText: async (userId: string, content: string) => {
    await new Promise(r => setTimeout(r, 1000));
    return fetchWithFallback(
        () => axios.post(`${API_BASE}/notes/text`, { user_id: userId, content }),
        { note_id: 'mock-note-id', tasks: [MOCK_TASKS[0], MOCK_TASKS[2]] }
    );
  },

  uploadFile: async (userId: string, file: File, type: 'image' | 'audio' | 'video') => {
    await new Promise(r => setTimeout(r, 1500));
    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('file', file);
    
    return fetchWithFallback(
        () => axios.post(`${API_BASE}/notes/${type}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }),
        { note_id: 'mock-media-note-id', tasks: [MOCK_TASKS[1]] }
    );
  }
};