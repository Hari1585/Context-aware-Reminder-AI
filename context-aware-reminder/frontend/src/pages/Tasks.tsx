import React, { useEffect, useState } from 'react';
import { api, Task } from '../api';
import { Filter } from 'lucide-react';

const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const userId = "user123";

  useEffect(() => {
    fetchTasks();
  }, [typeFilter, priorityFilter]);

  const fetchTasks = async () => {
    const data = await api.getTasks(userId, typeFilter, priorityFilter);
    setTasks(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-800">My Tasks</h2>
        
        <div className="flex gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center px-2 text-slate-400">
                <Filter className="w-4 h-4" />
            </div>
            <select 
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-transparent text-sm font-medium text-slate-600 outline-none cursor-pointer"
            >
                <option value="all">All Types</option>
                <option value="time_based">Time Based</option>
                <option value="location_based">Location Based</option>
                <option value="recurring">Recurring</option>
            </select>
            <div className="w-px bg-slate-200"></div>
            <select 
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-transparent text-sm font-medium text-slate-600 outline-none cursor-pointer"
            >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
            </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {tasks.map((task) => (
          <div key={task.id} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-semibold text-lg text-slate-800">{task.title}</h3>
                    <p className="text-slate-500 mt-1">{task.summary}</p>
                    
                    <div className="flex gap-2 mt-4">
                         {task.location_name && (
                             <span className="inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded bg-purple-100 text-purple-800">
                                {task.location_name}
                             </span>
                         )}
                         <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded capitalize
                            ${task.priority === 'high' ? 'bg-red-100 text-red-800' : 
                              task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' : 
                              'bg-green-100 text-green-800'}`}>
                            {task.priority} Priority
                         </span>
                    </div>
                </div>
                
                {task.deadline && (
                    <div className="text-right">
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Due</p>
                        <p className="text-blue-600 font-medium">{new Date(task.deadline).toLocaleDateString()}</p>
                        <p className="text-blue-600 text-sm">{new Date(task.deadline).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                )}
            </div>
          </div>
        ))}

        {tasks.length === 0 && (
            <div className="text-center py-20 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                <p className="text-slate-500">No tasks found for these filters.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default Tasks;