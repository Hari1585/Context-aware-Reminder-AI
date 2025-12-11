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
  // New fields for optimization
  is_rescheduled?: boolean;
  reschedule_reason?: string;
  original_deadline?: string | null;
  // New fields for email source
  source_email_id?: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  location: string | null;
  type: 'work' | 'trip' | 'personal';
}

export interface Email {
    id: string;
    from: string;
    subject: string;
    snippet: string;
    date: string;
    is_processed: boolean;
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
    deadline: '2025-12-09T17:00:00', // Originally 5 PM
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

const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [
    {
        id: 'evt1',
        summary: 'Client Meeting at TechPark',
        start: '2025-12-09T13:00:00',
        end: '2025-12-09T14:30:00',
        location: 'TechPark, Main St', // Near UPS Store (Task 1)
        type: 'work'
    },
    {
        id: 'evt2',
        summary: 'Business Trip to NYC',
        start: '2025-12-15T08:00:00',
        end: '2025-12-17T18:00:00',
        location: 'New York, NY',
        type: 'trip'
    }
];

const MOCK_EMAILS: Email[] = [
    {
        id: 'email1',
        from: 'billing@electric-company.com',
        subject: 'Your Electricity Bill is Ready',
        snippet: 'Dear Customer, your bill for November is $124.50. Please pay by Dec 12 to avoid late fees.',
        date: '2025-12-08T09:15:00',
        is_processed: false
    },
    {
        id: 'email2',
        from: 'noreply@airlines.com',
        subject: 'Flight Confirmation: SFO to JFK',
        snippet: 'Your flight UA452 departs on Dec 15 at 8:00 AM. Please arrive at the airport 2 hours early.',
        date: '2025-12-07T14:30:00',
        is_processed: false
    },
    {
        id: 'email3',
        from: 'newsletter@tech-weekly.com',
        subject: 'Top Tech News This Week',
        snippet: 'Here are the top stories: AI takes over task management...',
        date: '2025-12-08T10:00:00',
        is_processed: true // Already handled or ignored
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

  getCalendarEvents: async (userId: string) => {
      // Simulate API call
      await new Promise(r => setTimeout(r, 800));
      return fetchWithFallback(
          () => axios.get<CalendarEvent[]>(`${API_BASE}/calendar`),
          MOCK_CALENDAR_EVENTS
      );
  },
  
  getEmails: async (userId: string) => {
      await new Promise(r => setTimeout(r, 600));
      return fetchWithFallback(
          () => axios.get<Email[]>(`${API_BASE}/gmail`),
          MOCK_EMAILS
      );
  },

  syncGmailTasks: async (userId: string) => {
      await new Promise(r => setTimeout(r, 2500)); // Simulate AI processing
      
      // Simulate extraction from emails
      const extractedTasks: Task[] = [
          {
            id: 'task-email-1',
            title: 'Pay Electricity Bill',
            description: 'Bill amount $124.50 due by Dec 12.',
            summary: 'Pay electricity bill',
            deadline: '2025-12-12T17:00:00',
            location_name: null,
            priority: 'high',
            type: 'time_based',
            source_email_id: 'email1'
          },
          {
            id: 'task-email-2',
            title: 'Check-in for Flight UA452',
            description: 'Flight to NYC departs Dec 15 at 8:00 AM.',
            summary: 'Flight check-in',
            deadline: '2025-12-14T08:00:00', // 24h before
            location_name: 'SFO Airport',
            priority: 'high',
            type: 'location_based',
            source_email_id: 'email2'
          }
      ];
      return extractedTasks;
  },

  // The AI Agent simulation
  optimizeSchedule: async (userId: string) => {
      await new Promise(r => setTimeout(r, 2000)); // Simulate processing time
      
      // Logic: Task 1 is at "UPS Store, Main St". Event 1 is at "TechPark, Main St".
      // The AI detects "Main St" proximity and moves Task 1 to after the meeting.
      
      const optimizedTasks = [...MOCK_TASKS];
      
      // Modify Task 1
      optimizedTasks[0] = {
          ...optimizedTasks[0],
          is_rescheduled: true,
          original_deadline: optimizedTasks[0].deadline,
          deadline: '2025-12-09T14:45:00', // 15 mins after meeting ends
          reschedule_reason: "Detected you are at 'Main St' for 'Client Meeting'. Rescheduled to save travel time."
      };

      return optimizedTasks;
  },

  search: async (query: string) => {
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