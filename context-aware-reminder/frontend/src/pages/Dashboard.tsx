import React, { useState } from 'react';
import { 
  CheckSquare, 
  AlertTriangle, 
  MapPin, 
  Mic, 
  Image as ImageIcon, 
  FileText, 
  Edit2, 
  Trash2, 
  ExternalLink,
  Clock,
  X
} from 'lucide-react';

// Mock data to match the image
const MOCK_NOTES = [
  {
    id: '1',
    date: 'Dec 8, 2025 at 10:07 PM',
    type: 'audio',
    taskCount: 2,
    content: 'Tomorrow morning return the Amazon package at UPS store near Main St and pay electricity bill before Friday.'
  },
  {
    id: '2',
    date: 'Dec 8, 2025 at 9:07 PM',
    type: 'image',
    taskCount: 2,
    content: 'Schedule dentist appointment for next week. Also need to pick up prescription from CVS pharmacy on Oak Street.'
  },
  {
    id: '3',
    date: 'Dec 7, 2025 at 11:07 PM',
    type: 'text',
    taskCount: 2,
    content: 'Book flight tickets for the conference in March. Hotel reservation needed too.'
  }
];

const MOCK_TASKS = [
  {
    id: '1',
    title: 'Return Amazon package',
    priority: 'high',
    date: 'Dec 9, 2025',
    location: 'UPS Store, Main St',
    completed: false
  },
  {
    id: '2',
    title: 'Pick up prescription',
    priority: 'medium',
    date: 'Dec 10, 2025',
    location: 'CVS Pharmacy, Oak St',
    completed: false
  }
];

const Dashboard: React.FC = () => {
  const [showToast, setShowToast] = useState(true);

  return (
    <div className="space-y-8 relative">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-slate-500 mt-1">Welcome back! Here's your overview.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1 */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-sm font-medium">Tasks Due Today</p>
            <p className="text-4xl font-bold text-slate-900 mt-2">5</p>
            <p className="text-slate-400 text-xs mt-1">3 high priority</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
            <CheckSquare className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-sm font-medium">Overdue Tasks</p>
            <p className="text-4xl font-bold text-slate-900 mt-2">2</p>
            <p className="text-slate-400 text-xs mt-1">Needs attention</p>
          </div>
          <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center text-orange-500">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-sm font-medium">Tasks with Locations</p>
            <p className="text-4xl font-bold text-slate-900 mt-2">8</p>
            <p className="text-slate-400 text-xs mt-1">Location reminders active</p>
          </div>
          <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center text-green-600">
            <MapPin className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Recent Notes */}
        <div className="lg:col-span-7 space-y-4">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5" /> Recent Notes
          </h3>
          
          <div className="space-y-4">
            {MOCK_NOTES.map(note => (
              <div key={note.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <p className="text-sm text-slate-500">{note.date}</p>
                  <div className="flex items-center gap-2">
                    {note.type === 'audio' && <Mic className="w-4 h-4 text-slate-400" />}
                    {note.type === 'image' && <ImageIcon className="w-4 h-4 text-slate-400" />}
                    {note.type === 'text' && <FileText className="w-4 h-4 text-slate-400" />}
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded font-medium">
                      {note.taskCount} tasks
                    </span>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {note.type === 'audio' ? <Mic className="w-5 h-5 text-slate-400" /> :
                     note.type === 'image' ? <ImageIcon className="w-5 h-5 text-slate-400" /> :
                     <FileText className="w-5 h-5 text-slate-400" />}
                  </div>
                  <p className="text-slate-800 leading-relaxed text-sm">
                    {note.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Upcoming Tasks */}
        <div className="lg:col-span-5 space-y-4">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5" /> Upcoming Location Tasks
          </h3>

          <div className="space-y-3">
            {MOCK_TASKS.map(task => (
              <div key={task.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="pt-1">
                    <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{task.title}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                          task.priority === 'high' ? 'bg-red-100 text-red-600' : 
                          task.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' : 
                          'bg-green-100 text-green-600'
                        }`}>
                          {task.priority}
                        </span>
                      </div>
                      <div className="flex gap-2 text-slate-400">
                        <Edit2 className="w-4 h-4 cursor-pointer hover:text-slate-600" />
                        <Trash2 className="w-4 h-4 cursor-pointer hover:text-red-500" />
                      </div>
                    </div>
                    
                    <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {task.date}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {task.location}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {showToast && (
        <div className="fixed bottom-8 right-8 w-96 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden animate-bounce-in z-50">
          <div className="p-4 relative">
             <button 
                onClick={() => setShowToast(false)}
                className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
             >
               <X className="w-4 h-4" />
             </button>
             <div className="flex gap-4">
               <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
                 <MapPin className="w-5 h-5 text-blue-600" />
               </div>
               <div>
                 <h4 className="font-bold text-slate-900 text-sm">You're near UPS Store</h4>
                 <p className="text-slate-500 text-xs mt-1">Task: Return Amazon package</p>
                 
                 <div className="flex gap-2 mt-3">
                   <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1 font-medium transition-colors">
                     <ExternalLink className="w-3 h-3" /> View Task
                   </button>
                   <button className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs px-3 py-1.5 rounded flex items-center gap-1 font-medium transition-colors">
                     <Clock className="w-3 h-3" /> Snooze 1h
                   </button>
                 </div>
               </div>
             </div>
          </div>
          <div className="h-1 bg-blue-600 w-full" />
        </div>
      )}
    </div>
  );
};

// Helper component for Calendar icon in list (Lucide Calendar is already imported)
const Calendar = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
)

export default Dashboard;