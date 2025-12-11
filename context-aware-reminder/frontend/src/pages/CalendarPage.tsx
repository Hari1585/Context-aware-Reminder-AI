import React, { useEffect, useState } from 'react';
import { api, CalendarEvent, Task } from '../api';
import { Calendar as CalendarIcon, MapPin, RefreshCw, Briefcase, Plane, ArrowRight, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';

const CalendarPage: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [optimizedTasks, setOptimizedTasks] = useState<Task[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [showOptimizationResults, setShowOptimizationResults] = useState(false);
  const userId = "user123";

  useEffect(() => {
    loadCalendar();
  }, []);

  const loadCalendar = async () => {
    try {
      const data = await api.getCalendarEvents(userId);
      setEvents(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      const result = await api.optimizeSchedule(userId);
      // Filter to only show tasks that were actually changed for the demo
      const changed = result.filter(t => t.is_rescheduled);
      setOptimizedTasks(changed);
      setShowOptimizationResults(true);
    } catch (e) {
      console.error(e);
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <CalendarIcon className="w-8 h-8 text-blue-600" />
            Smart Schedule
          </h2>
          <p className="text-slate-500 mt-2">
            We sync with your Google Calendar to optimize your task list based on your location context.
          </p>
        </div>
        
        <button 
          onClick={handleOptimize}
          disabled={optimizing}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all shadow-md disabled:opacity-70"
        >
          {optimizing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
          {optimizing ? 'Analyzing Context...' : 'Reschedule Tasks via AI'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Col: Calendar Feed */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-800">Google Calendar Events</h3>
          
          {loadingEvents ? (
             <div className="h-40 bg-slate-50 animate-pulse rounded-xl" />
          ) : (
            <div className="space-y-4">
              {events.map(evt => (
                <div key={evt.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex gap-4">
                  <div className={`w-1 rounded-full ${evt.type === 'trip' ? 'bg-purple-500' : 'bg-blue-500'}`} />
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="font-semibold text-slate-900">{evt.summary}</h4>
                      {evt.type === 'trip' && <Plane className="w-4 h-4 text-purple-500" />}
                      {evt.type === 'work' && <Briefcase className="w-4 h-4 text-blue-500" />}
                    </div>
                    <p className="text-slate-500 text-sm mt-1">
                      {new Date(evt.start).toLocaleString([], {weekday: 'short', hour: '2-digit', minute:'2-digit'})} - 
                      {new Date(evt.end).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                    {evt.location && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded w-fit">
                        <MapPin className="w-3 h-3" /> {evt.location}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Optimization Results */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-800">Contextual Adjustments</h3>
          
          {!showOptimizationResults ? (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl h-64 flex flex-col items-center justify-center text-center p-8">
              <RefreshCw className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-slate-600 font-medium">No optimizations running</p>
              <p className="text-slate-400 text-sm mt-1">
                Click "Reschedule Tasks via AI" to detect location overlaps between your trips/meetings and your to-do list.
              </p>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              {optimizedTasks.length > 0 ? optimizedTasks.map(task => (
                <div key={task.id} className="bg-gradient-to-br from-indigo-50 to-white p-5 rounded-xl border border-indigo-100 shadow-sm relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-2 opacity-10">
                      <Sparkles className="w-24 h-24 text-indigo-600" />
                   </div>
                   
                   <div className="relative z-10">
                     <div className="flex items-center gap-2 mb-2">
                        <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">AI Optimized</span>
                        <span className="text-xs text-indigo-700 font-medium flex items-center gap-1">
                           <MapPin className="w-3 h-3" /> Location Match
                        </span>
                     </div>

                     <h4 className="font-bold text-slate-900 text-lg">{task.title}</h4>
                     
                     <div className="mt-4 flex items-center gap-4 text-sm">
                        <div className="opacity-50 line-through decoration-red-400 decoration-2">
                           {task.original_deadline ? new Date(task.original_deadline).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'No time'}
                        </div>
                        <ArrowRight className="w-4 h-4 text-indigo-400" />
                        <div className="font-bold text-indigo-700 bg-indigo-100 px-2 py-1 rounded">
                           {task.deadline ? new Date(task.deadline).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}
                        </div>
                     </div>

                     <div className="mt-4 bg-white bg-opacity-60 p-3 rounded-lg border border-indigo-50 text-sm text-slate-600 italic">
                        "{task.reschedule_reason}"
                     </div>

                     <div className="mt-4 flex gap-2">
                        <button className="flex-1 bg-indigo-600 text-white py-2 rounded text-sm font-medium hover:bg-indigo-700 transition-colors">
                           Confirm Change
                        </button>
                        <button className="px-3 py-2 border border-slate-200 rounded text-sm hover:bg-slate-50">
                           Ignore
                        </button>
                     </div>
                   </div>
                </div>
              )) : (
                <div className="p-6 bg-green-50 border border-green-100 rounded-xl flex items-center gap-3">
                   <CheckCircle2 className="w-6 h-6 text-green-600" />
                   <p className="text-green-800 font-medium">Your schedule is already optimized!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;