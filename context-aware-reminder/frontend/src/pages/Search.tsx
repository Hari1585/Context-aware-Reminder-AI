import React, { useState } from 'react';
import { api, SearchResult } from '../api';
import { Search as SearchIcon, FileText, CheckSquare } from 'lucide-react';

const Search: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!query) return;
    
    setLoading(true);
    setHasSearched(true);
    try {
      const data = await api.search(query);
      setResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-800">Semantic Search</h2>
        <p className="text-slate-500 mt-2">Find tasks and notes using natural language.</p>
      </div>

      <form onSubmit={handleSearch} className="relative">
        <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. 'What did I need to buy at the pharmacy?'"
            className="w-full p-4 pl-12 rounded-xl border border-slate-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-lg"
        />
        <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
        <button 
            type="submit"
            className="absolute right-2 top-2 bottom-2 bg-blue-600 text-white px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
            {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {hasSearched && (
        <div className="space-y-4">
             <h3 className="text-lg font-semibold text-slate-700">Results</h3>
             {results.length === 0 ? (
                 <p className="text-slate-500">No matching results found.</p>
             ) : (
                 results.map((res) => (
                     <div key={res.id} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm hover:border-blue-300 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                            {res.kind === 'note' ? (
                                <span className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                    <FileText className="w-3 h-3" /> NOTE
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">
                                    <CheckSquare className="w-3 h-3" /> TASK
                                </span>
                            )}
                            <span className="text-xs text-slate-400">Score: {res.score.toFixed(3)}</span>
                        </div>
                        <p className="text-slate-800">{res.text}</p>
                        {res.kind === 'task' && res.metadata.type && (
                            <div className="mt-2 text-xs text-slate-500 uppercase tracking-wider">
                                Type: {res.metadata.type}
                            </div>
                        )}
                     </div>
                 ))
             )}
        </div>
      )}
    </div>
  );
};

export default Search;