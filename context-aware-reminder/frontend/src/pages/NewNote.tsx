import React, { useState } from 'react';
import { api, Task } from '../api';
import { Upload, Type, Mic, Video, Image as ImageIcon, Loader2 } from 'lucide-react';

const NewNote: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'text' | 'image' | 'audio' | 'video'>('text');
  const [textContent, setTextContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [createdTasks, setCreatedTasks] = useState<Task[]>([]);
  const userId = "user123"; 

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setCreatedTasks([]);
    try {
      let response;
      if (activeTab === 'text') {
        response = await api.createNoteText(userId, textContent);
      } else if (file) {
        response = await api.uploadFile(userId, file, activeTab);
      }
      if (response && response.tasks) {
        setCreatedTasks(response.tasks);
        setTextContent('');
        setFile(null);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to process note');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'text', label: 'Text Note', icon: Type },
    { id: 'image', label: 'Image', icon: ImageIcon },
    { id: 'audio', label: 'Voice', icon: Mic },
    { id: 'video', label: 'Video', icon: Video },
  ] as const;

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Create Context Note</h2>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setFile(null); }}
              className={`flex-1 py-4 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                activeTab === tab.id 
                  ? 'bg-white text-blue-600 border-t-2 border-blue-600' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form Content */}
        <div className="p-6">
          <form onSubmit={handleSubmit}>
            {activeTab === 'text' ? (
              <textarea
                className="w-full h-40 p-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                placeholder="What's on your mind? (e.g., 'Need to stop by CVS...')"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                required
              />
            ) : (
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-10 text-center hover:bg-slate-50 transition-colors relative">
                <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                    accept={activeTab === 'image' ? 'image/*' : activeTab === 'audio' ? 'audio/*' : 'video/*'}
                    required
                />
                <div className="pointer-events-none">
                    <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-600 font-medium">
                        {file ? file.name : `Click to upload ${activeTab}`}
                    </p>
                    <p className="text-slate-400 text-sm mt-1">Supports common formats</p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (activeTab === 'text' && !textContent) || (activeTab !== 'text' && !file)}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Process Note & Extract Tasks'}
            </button>
          </form>
        </div>
      </div>

      {/* Results Section */}
      {createdTasks.length > 0 && (
        <div className="mt-8">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Extracted Tasks</h3>
            <div className="space-y-4">
                {createdTasks.map((task) => (
                    <div key={task.id} className="bg-green-50 border border-green-200 p-4 rounded-lg flex justify-between items-center animate-in fade-in slide-in-from-bottom-4">
                        <div>
                            <h4 className="font-bold text-green-800">{task.title}</h4>
                            <p className="text-green-700 text-sm">{task.summary}</p>
                            <div className="flex gap-2 mt-2">
                                <span className="text-xs bg-white bg-opacity-50 px-2 py-0.5 rounded text-green-800 uppercase tracking-wide">{task.type}</span>
                                <span className="text-xs bg-white bg-opacity-50 px-2 py-0.5 rounded text-green-800 uppercase tracking-wide">{task.priority}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default NewNote;