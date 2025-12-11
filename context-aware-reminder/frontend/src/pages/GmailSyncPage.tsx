import React, { useEffect, useState } from 'react';
import { api, Email, Task } from '../api';
import { Mail, RefreshCw, ArrowRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const GmailSyncPage: React.FC = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [extractedTasks, setExtractedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const userId = "user123";

  useEffect(() => {
    loadEmails();
  }, []);

  const loadEmails = async () => {
    try {
      const data = await api.getEmails(userId);
      setEmails(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setProcessing(true);
    try {
      const tasks = await api.syncGmailTasks(userId);
      setExtractedTasks(tasks);
    } catch (e) {
      console.error(e);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Mail className="w-8 h-8 text-red-600" />
            Gmail Intelligence
          </h2>
          <p className="text-slate-500 mt-2">
            Auto-detect tasks from your inbox so you never miss a bill or flight.
          </p>
        </div>

        <button 
          onClick={handleSync}
          disabled={processing || extractedTasks.length > 0}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {processing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <RefreshCw className="w-5 h-5" />
          )}
          {processing ? 'Scanning Inbox...' : extractedTasks.length > 0 ? 'Sync Complete' : 'Analyze Inbox'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[600px]">
        {/* Left: Email Feed */}
        <div className="flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
             <h3 className="font-bold text-slate-700">Recent Emails</h3>
             <span className="text-xs font-medium bg-slate-200 text-slate-600 px-2 py-0.5 rounded">3 Unread</span>
          </div>
          
          <div className="overflow-y-auto flex-1 p-4 space-y-3">
             {loading ? (
                <div className="space-y-3">
                    {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-50 animate-pulse rounded-lg"/>)}
                </div>
             ) : (
                emails.map(email => (
                    <div key={email.id} className="p-4 rounded-lg border border-slate-100 hover:border-red-200 hover:bg-red-50 transition-colors group cursor-pointer">
                        <div className="flex justify-between mb-1">
                            <span className="font-bold text-slate-800 text-sm truncate w-2/3">{email.from}</span>
                            <span className="text-xs text-slate-400">{new Date(email.date).toLocaleDateString()}</span>
                        </div>
                        <h4 className="font-medium text-slate-900 text-sm mb-1">{email.subject}</h4>
                        <p className="text-xs text-slate-500 line-clamp-2">{email.snippet}</p>
                    </div>
                ))
             )}
          </div>
        </div>

        {/* Right: Extracted Tasks */}
        <div className="flex flex-col bg-slate-50 rounded-xl border border-dashed border-slate-300 overflow-hidden relative">
           
           {!processing && extractedTasks.length === 0 && (
               <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                   <Mail className="w-12 h-12 mb-3 opacity-20" />
                   <p>Click "Analyze Inbox" to extract tasks</p>
               </div>
           )}

           {processing && (
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10 backdrop-blur-sm">
                   <Loader2 className="w-10 h-10 text-red-600 animate-spin mb-3" />
                   <p className="text-red-600 font-medium animate-pulse">Analyzing email content with AI...</p>
               </div>
           )}

           {extractedTasks.length > 0 && (
               <div className="flex flex-col h-full">
                    <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
                        <h3 className="font-bold text-green-700 flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5" /> Tasks Extracted
                        </h3>
                        <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full">{extractedTasks.length} New</span>
                    </div>
                    <div className="p-4 space-y-4 overflow-y-auto flex-1">
                        {extractedTasks.map(task => (
                            <div key={task.id} className="bg-white p-5 rounded-xl shadow-sm border border-green-100 relative group animate-in slide-in-from-bottom-2 fade-in duration-500">
                                <div className="absolute -left-1 top-5 w-2 h-10 bg-green-500 rounded-r"></div>
                                
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-slate-800">{task.title}</h4>
                                    <span className="text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-600 px-2 py-1 rounded">High Priority</span>
                                </div>
                                
                                <p className="text-sm text-slate-600 mb-3">{task.description}</p>
                                
                                <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 p-2 rounded">
                                    <Mail className="w-3 h-3" />
                                    <span>Extracted from email subject: "{emails.find(e => e.id === task.source_email_id)?.subject}"</span>
                                </div>

                                <div className="mt-4 flex gap-2">
                                    <button className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700">Add to Tasks</button>
                                    <button className="px-3 py-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">Dismiss</button>
                                </div>
                            </div>
                        ))}
                    </div>
               </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default GmailSyncPage;