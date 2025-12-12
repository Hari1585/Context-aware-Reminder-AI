import React, { useState, useEffect, useRef } from 'react';
import { api, Task } from '../api';
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
  X,
  Send,
  Loader2,
  StopCircle,
  Volume2,
  Car,
  ShoppingBag,
  Package,
  CheckCircle2,
  Home,
  Recycle,
  CloudRain,
  Navigation,
  CalendarDays,
  Truck,
  Filter
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

const MOCK_TASKS_DATA = [
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
  },
  {
    id: '3',
    title: 'Buy Groceries for week',
    priority: 'medium',
    date: 'Dec 9, 2025',
    location: 'Whole Foods Market',
    completed: false
  },
  {
    id: '4',
    title: 'Water the plants',
    priority: 'low',
    date: 'Dec 9, 2025',
    location: 'Home',
    completed: false
  }
];

type FilterType = 'all' | 'today' | 'high' | 'location';

const Dashboard: React.FC = () => {
  const [showToast, setShowToast] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  
  // Voice & Quick Note State
  const [quickNote, setQuickNote] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Location Simulation State
  const [locationState, setLocationState] = useState<'Home' | 'Away'>('Home');

  // Departure/Arrival Logic State
  const [showDepartureModal, setShowDepartureModal] = useState(false);
  const [departureItems, setDepartureItems] = useState<{item: string, type: 'return' | 'bag' | 'weather' | 'other'}[]>([]);
  
  const [showArrivalModal, setShowArrivalModal] = useState(false);
  // Added 'missed_grocery' type
  const [arrivalItems, setArrivalItems] = useState<{item: string, type: 'trash' | 'recycle' | 'task' | 'missed_grocery'}[]>([]);

  const userId = "user123";

  // Browser Speech Recognition Setup
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            handleVoiceCommand(transcript);
        };

        recognitionRef.current.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current.onerror = (event: any) => {
            console.error('Speech recognition error', event.error);
            setIsListening(false);
        };
    }
  }, []);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
        setIsListening(true);
        recognitionRef.current.start();
    } else {
        alert("Voice input not supported in this browser.");
    }
  };

  const stopListening = () => {
      if (recognitionRef.current && isListening) {
          recognitionRef.current.stop();
          setIsListening(false);
      }
  };

  const speak = (text: string) => {
      setIsSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
  };

  const handleVoiceCommand = async (transcript: string) => {
      setQuickNote(transcript);
      const lowerText = transcript.toLowerCase();

      // INTENT 1: User asks for priority/tasks (Driving Mode)
      if (lowerText.includes('priority') || lowerText.includes('priorities') || lowerText.includes('what do i have')) {
          const highPriority = MOCK_TASKS_DATA.filter(t => t.priority === 'high');
          let responseText = "";

          if (highPriority.length === 0) {
              responseText = "You have no high priority tasks for today. You are free to relax.";
          } else {
              const taskTitles = highPriority.map(t => t.title).join(' and ');
              responseText = `You have ${highPriority.length} high priority tasks today. They are: ${taskTitles}. Drive safely!`;
          }
          speak(responseText);
          return;
      }

      // INTENT 2: User wants to save a note
      handleQuickSubmit(new Event('submit') as any, transcript);
      speak("I've saved that note for you.");
  };

  const handleQuickSubmit = async (e: React.FormEvent, overrideText?: string) => {
      if (e) e.preventDefault();
      const textToSubmit = overrideText || quickNote;
      if (!textToSubmit.trim()) return;

      setIsProcessing(true);
      try {
          await api.createNoteText(userId, textToSubmit);
          setQuickNote('');
          // In a real app, we would refresh the notes list here
      } catch (err) {
          console.error(err);
      } finally {
          setIsProcessing(false);
      }
  };

  const toggleLocationSimulation = () => {
      if (locationState === 'Home') {
          // Logic: Moving FROM Home TO Away
          setLocationState('Away');
          handleLeavingHome();
      } else {
          // Logic: Moving FROM Away TO Home
          setLocationState('Home');
          handleReturningHome();
      }
  };

  const handleLeavingHome = () => {
      const itemsToCheck: {item: string, type: 'return' | 'bag' | 'weather' | 'other'}[] = [];

      // 1. Check for items to return
      const returnTasks = MOCK_TASKS_DATA.filter(t => 
          t.title.toLowerCase().includes('return') || 
          t.title.toLowerCase().includes('deliver')
      );
      
      returnTasks.forEach(t => {
          const item = t.title.replace(/return/i, '').trim();
          itemsToCheck.push({ item: item || "Package for return", type: 'return' });
      });

      // 2. Check for Grocery/Shopping tasks for Bags
      const shoppingTasks = MOCK_TASKS_DATA.filter(t => 
          t.title.toLowerCase().includes('grocery') || 
          t.title.toLowerCase().includes('shop') ||
          t.location?.toLowerCase().includes('market') || 
          t.location?.toLowerCase().includes('store') ||
          t.location?.toLowerCase().includes('mall')
      );

      if (shoppingTasks.length > 0) {
          itemsToCheck.push({ item: "Reusable Grocery Bags", type: 'bag' });
      }

      // 3. Weather Context (Mock)
      const isRaining = true; 
      if (isRaining) {
          itemsToCheck.push({ item: "Umbrella (Rain Forecast)", type: 'weather' });
      }

      setDepartureItems(itemsToCheck);
      setShowDepartureModal(true);

      // Voice Alert
      if (itemsToCheck.length > 0) {
          const itemNames = itemsToCheck.map(i => i.item).join(', ');
          speak(`Wait! Before you drive off, please check if you have: ${itemNames}.`);
      } else {
          speak("I don't see any physical items you need to bring. Have a safe drive!");
      }
  };

  const handleReturningHome = () => {
    const itemsToCheck: {item: string, type: 'trash' | 'recycle' | 'task' | 'missed_grocery'}[] = [];
    const today = new Date(); 
    const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });

    // 1. Trash/Recycle Logic (Schedule Based)
    const isTrashDay = true; 
    const isRecycleDay = true;

    if (isTrashDay) {
        itemsToCheck.push({ item: `Take out Garbage (It's ${dayName})`, type: 'trash' });
    }
    if (isRecycleDay) {
        itemsToCheck.push({ item: "Take out Recycling (Bi-weekly)", type: 'recycle' });
    }

    // 2. Home Tasks
    const homeTasks = MOCK_TASKS_DATA.filter(t => 
        t.location?.toLowerCase().includes('home') || 
        t.title.toLowerCase().includes('home')
    );

    homeTasks.forEach(t => {
        itemsToCheck.push({ item: t.title, type: 'task' });
    });

    // 3. Check for Missed Groceries (Incomplete tasks with "Grocery" in title)
    // Logic: If user is returning home and has an INCOMPLETE grocery task, they likely forgot.
    const missedGroceries = MOCK_TASKS_DATA.filter(t => 
        !t.completed && 
        (t.title.toLowerCase().includes('grocery') || t.title.toLowerCase().includes('groceries'))
    );

    missedGroceries.forEach(t => {
        itemsToCheck.push({ item: `Forgot: ${t.title}`, type: 'missed_grocery' });
    });

    setArrivalItems(itemsToCheck);
    setShowArrivalModal(true);

    // Voice Alert Logic
    const hasMissedGroceries = missedGroceries.length > 0;
    
    if (hasMissedGroceries) {
        speak(`Welcome back. It looks like you missed the groceries. I've found some low cost delivery options for you.`);
    } else if (itemsToCheck.length > 0) {
        const itemNames = itemsToCheck.map(i => i.item).join(', ');
        speak(`Welcome back! You have arrived home. Please remember to: ${itemNames}.`);
    } else {
        speak("Welcome home! No immediate tasks for now.");
    }
  };

  // Filter Tasks based on selection
  const filteredTasks = MOCK_TASKS_DATA.filter(task => {
    if (activeFilter === 'today') return task.date === 'Dec 9, 2025';
    if (activeFilter === 'high') return task.priority === 'high';
    if (activeFilter === 'location') return task.location && !task.location.includes('Home');
    return true;
  });

  const toggleFilter = (filter: FilterType) => {
    setActiveFilter(prev => prev === filter ? 'all' : filter);
  };

  return (
    <div className="space-y-8 relative">
      
      {/* --- QUICK ACTION BAR (Voice & Text) --- */}
      <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 p-2 flex items-center gap-2 sticky top-0 z-20">
         <button 
            onClick={isListening ? stopListening : startListening}
            className={`p-3 rounded-xl transition-all duration-300 flex items-center justify-center ${
                isListening 
                ? 'bg-red-500 text-white shadow-red-200 shadow-lg animate-pulse' 
                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
            }`}
            title="Voice Assistant"
         >
             {isListening ? <StopCircle className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
         </button>

         <form onSubmit={(e) => handleQuickSubmit(e)} className="flex-1 flex items-center">
            <input 
                type="text" 
                value={quickNote}
                onChange={(e) => setQuickNote(e.target.value)}
                placeholder={isListening ? "Listening..." : "Type a note, or ask 'What are my priorities?'..."}
                className="w-full bg-transparent border-none outline-none text-lg text-slate-700 placeholder-slate-400 px-2"
            />
            <button 
                type="submit" 
                disabled={isProcessing || !quickNote}
                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-50"
            >
                {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
            </button>
         </form>

         {isSpeaking && (
             <div className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center gap-1 animate-pulse">
                 <Volume2 className="w-3 h-3" /> Speaking
             </div>
         )}
         
         <div className="w-px h-8 bg-slate-200 mx-1"></div>
         
         {/* Location Simulation Toggle */}
         <div 
           onClick={toggleLocationSimulation}
           className={`cursor-pointer px-4 py-2 rounded-xl flex items-center gap-3 font-medium transition-all shadow-sm hover:shadow-md select-none ${
             locationState === 'Home' 
               ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
               : 'bg-blue-50 text-blue-700 border border-blue-200'
           }`}
           title="Click to simulate movement"
         >
           <div className={`p-1.5 rounded-full ${locationState === 'Home' ? 'bg-emerald-200' : 'bg-blue-200'}`}>
             {locationState === 'Home' ? <Home className="w-4 h-4"/> : <Car className="w-4 h-4"/>}
           </div>
           <div className="flex flex-col">
              <span className="text-xs opacity-70 uppercase tracking-wider font-bold">Current Location</span>
              <span className="text-sm font-bold flex items-center gap-1">
                 {locationState === 'Home' ? 'Home' : 'Driving'}
                 <Navigation className="w-3 h-3 ml-1 animate-pulse" />
              </span>
           </div>
         </div>
      </div>

      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-slate-500 mt-1">Welcome back! Click the cards below to filter your tasks.</p>
      </div>

      {/* Stats Cards - Interactive */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Due Today */}
        <div 
          onClick={() => toggleFilter('today')}
          className={`cursor-pointer p-6 rounded-xl border transition-all flex items-center justify-between group ${
            activeFilter === 'today' 
            ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200' 
            : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'
          }`}
        >
          <div>
            <p className={`text-sm font-medium ${activeFilter === 'today' ? 'text-blue-700' : 'text-slate-500'}`}>Tasks Due Today</p>
            <p className="text-4xl font-bold text-slate-900 mt-2">3</p>
            <p className="text-slate-400 text-xs mt-1 group-hover:text-blue-500 transition-colors">Click to view</p>
          </div>
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
            activeFilter === 'today' ? 'bg-blue-200 text-blue-700' : 'bg-blue-50 text-blue-600'
          }`}>
            <CheckSquare className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: High Priority */}
        <div 
          onClick={() => toggleFilter('high')}
          className={`cursor-pointer p-6 rounded-xl border transition-all flex items-center justify-between group ${
            activeFilter === 'high' 
            ? 'bg-orange-50 border-orange-400 ring-2 ring-orange-200' 
            : 'bg-white border-slate-200 hover:border-orange-300 hover:shadow-md'
          }`}
        >
          <div>
            <p className={`text-sm font-medium ${activeFilter === 'high' ? 'text-orange-700' : 'text-slate-500'}`}>High Priority Tasks</p>
            <p className="text-4xl font-bold text-slate-900 mt-2">1</p>
            <p className="text-slate-400 text-xs mt-1 group-hover:text-orange-500 transition-colors">Needs attention</p>
          </div>
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
            activeFilter === 'high' ? 'bg-orange-200 text-orange-700' : 'bg-orange-50 text-orange-500'
          }`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Location Based */}
        <div 
          onClick={() => toggleFilter('location')}
          className={`cursor-pointer p-6 rounded-xl border transition-all flex items-center justify-between group ${
            activeFilter === 'location' 
            ? 'bg-green-50 border-green-400 ring-2 ring-green-200' 
            : 'bg-white border-slate-200 hover:border-green-300 hover:shadow-md'
          }`}
        >
          <div>
            <p className={`text-sm font-medium ${activeFilter === 'location' ? 'text-green-700' : 'text-slate-500'}`}>Tasks with Locations</p>
            <p className="text-4xl font-bold text-slate-900 mt-2">3</p>
            <p className="text-slate-400 text-xs mt-1 group-hover:text-green-500 transition-colors">Location active</p>
          </div>
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
            activeFilter === 'location' ? 'bg-green-200 text-green-700' : 'bg-green-50 text-green-600'
          }`}>
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
          
          {/* Smart Home Context Widget */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 text-white shadow-lg animate-in fade-in slide-in-from-right-4">
             <div className="flex items-center gap-2 mb-4">
                <Home className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-lg">Home Schedules</h3>
             </div>
             <div className="space-y-3">
                <div className="flex items-center justify-between bg-white/10 p-3 rounded-lg">
                   <div className="flex items-center gap-3">
                      <Trash2 className="w-5 h-5 text-slate-300" />
                      <div>
                         <p className="text-sm font-medium text-slate-200">Garbage Pickup</p>
                         <p className="text-xs text-slate-400">Mon, Thu nights</p>
                      </div>
                   </div>
                   <span className="text-xs font-bold bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded">Tonight</span>
                </div>
                
                <div className="flex items-center justify-between bg-white/10 p-3 rounded-lg">
                   <div className="flex items-center gap-3">
                      <Recycle className="w-5 h-5 text-green-400" />
                      <div>
                         <p className="text-sm font-medium text-slate-200">Recycling</p>
                         <p className="text-xs text-slate-400">Every other Mon</p>
                      </div>
                   </div>
                   <span className="text-xs font-bold bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded">Tonight</span>
                </div>
             </div>
          </div>

          <div className="flex items-center justify-between mt-6">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                {activeFilter === 'location' && <MapPin className="w-5 h-5" />}
                {activeFilter === 'high' && <AlertTriangle className="w-5 h-5" />}
                {activeFilter === 'today' && <CalendarDays className="w-5 h-5" />}
                {activeFilter === 'all' && <CheckSquare className="w-5 h-5" />}
                {activeFilter === 'all' ? 'Upcoming Tasks' : 
                 activeFilter === 'today' ? 'Tasks Due Today' :
                 activeFilter === 'high' ? 'High Priority Tasks' : 'Location Tasks'}
            </h3>
            {activeFilter !== 'all' && (
                <button 
                    onClick={() => setActiveFilter('all')}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                    <X className="w-3 h-3" /> Clear Filter
                </button>
            )}
          </div>

          <div className="space-y-3 min-h-[300px]">
            {filteredTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500">
                    <Filter className="w-8 h-8 mb-2 opacity-50" />
                    <p>No tasks match this filter</p>
                </div>
            ) : (
                filteredTasks.map(task => (
                <div key={task.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-right-2 duration-300">
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
                            <CalendarDays className="w-3.5 h-3.5" />
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
                ))
            )}
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

      {/* Departure Checklist Modal */}
      {showDepartureModal && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-300">
                  <div className="p-6 bg-indigo-600 text-white flex justify-between items-start">
                      <div>
                          <h3 className="text-2xl font-bold flex items-center gap-2">
                              <Car className="w-8 h-8" />
                              Leaving Home?
                          </h3>
                          <p className="text-indigo-100 mt-1 text-sm">
                              Don't forget these items for your trip!
                          </p>
                      </div>
                      <button 
                        onClick={() => setShowDepartureModal(false)}
                        className="text-white/80 hover:text-white"
                      >
                          <X className="w-6 h-6" />
                      </button>
                  </div>
                  
                  <div className="p-6 space-y-4">
                      {departureItems.length === 0 ? (
                          <div className="text-center py-8 text-slate-500">
                              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
                              <p>No special items needed. Have a safe drive!</p>
                          </div>
                      ) : (
                          <div className="space-y-3">
                              {departureItems.map((item, idx) => (
                                  <label key={idx} className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors group">
                                      <input type="checkbox" className="w-6 h-6 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                      <div className="flex-1">
                                          <p className="font-bold text-slate-800 text-lg group-hover:text-indigo-700">{item.item}</p>
                                          <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mt-1">
                                            {item.type === 'bag' ? 'Shopping Requirement' : item.type === 'weather' ? 'Weather Alert' : 'Return Item'}
                                          </p>
                                      </div>
                                      {item.type === 'bag' ? (
                                          <ShoppingBag className="w-6 h-6 text-orange-500" />
                                      ) : item.type === 'weather' ? (
                                          <CloudRain className="w-6 h-6 text-blue-400" />
                                      ) : (
                                          <Package className="w-6 h-6 text-indigo-500" />
                                      )}
                                  </label>
                              ))}
                          </div>
                      )}
                      
                      <button 
                        onClick={() => setShowDepartureModal(false)}
                        className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-colors mt-4"
                      >
                          I have everything. Let's go!
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Arrival Checklist Modal */}
      {showArrivalModal && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-300">
                  <div className="p-6 bg-emerald-600 text-white flex justify-between items-start">
                      <div>
                          <h3 className="text-2xl font-bold flex items-center gap-2">
                              <Home className="w-8 h-8" />
                              Welcome Home!
                          </h3>
                          <p className="text-emerald-100 mt-1 text-sm">
                              Quick checklist for your arrival.
                          </p>
                      </div>
                      <button 
                        onClick={() => setShowArrivalModal(false)}
                        className="text-white/80 hover:text-white"
                      >
                          <X className="w-6 h-6" />
                      </button>
                  </div>
                  
                  <div className="p-6 space-y-4">
                      {arrivalItems.length === 0 ? (
                          <div className="text-center py-8 text-slate-500">
                              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
                              <p>No home tasks for today. Relax!</p>
                          </div>
                      ) : (
                          <div className="space-y-3">
                              {arrivalItems.map((item, idx) => (
                                  <div key={idx} className={`p-4 rounded-xl border transition-colors ${
                                      item.type === 'missed_grocery' 
                                      ? 'border-orange-200 bg-orange-50' 
                                      : 'border-slate-200 hover:bg-slate-50'
                                  }`}>
                                      <label className="flex items-center gap-4 cursor-pointer">
                                          <input type="checkbox" className={`w-6 h-6 rounded border-slate-300 focus:ring-emerald-500 ${item.type === 'missed_grocery' ? 'text-orange-600' : 'text-emerald-600'}`} />
                                          <div className="flex-1">
                                              <p className={`font-bold text-lg ${item.type === 'missed_grocery' ? 'text-orange-800' : 'text-slate-800 group-hover:text-emerald-700'}`}>{item.item}</p>
                                              <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mt-1">
                                                {item.type === 'trash' ? 'Garbage Schedule' : 
                                                 item.type === 'recycle' ? 'Recycling Schedule' : 
                                                 item.type === 'missed_grocery' ? 'Missed Task Alert' : 'Home Task'}
                                              </p>
                                          </div>
                                          {item.type === 'trash' ? (
                                              <Trash2 className="w-6 h-6 text-slate-600" />
                                          ) : item.type === 'recycle' ? (
                                              <Recycle className="w-6 h-6 text-green-500" />
                                          ) : item.type === 'missed_grocery' ? (
                                              <AlertTriangle className="w-6 h-6 text-orange-500" />
                                          ) : (
                                              <Home className="w-6 h-6 text-blue-500" />
                                          )}
                                      </label>

                                      {/* Delivery Suggestions for Missed Groceries */}
                                      {item.type === 'missed_grocery' && (
                                          <div className="mt-3 pl-10">
                                              <p className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-1">
                                                  <Truck className="w-4 h-4" /> Low Cost Delivery Options:
                                              </p>
                                              <div className="flex gap-2">
                                                  <button className="flex-1 bg-white border border-slate-200 text-slate-700 py-1.5 px-3 rounded-lg text-xs font-bold hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-colors">
                                                      Instacart
                                                  </button>
                                                  <button className="flex-1 bg-white border border-slate-200 text-slate-700 py-1.5 px-3 rounded-lg text-xs font-bold hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors">
                                                      Walmart+
                                                  </button>
                                                  <button className="flex-1 bg-white border border-slate-200 text-slate-700 py-1.5 px-3 rounded-lg text-xs font-bold hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 transition-colors">
                                                      Amazon Fresh
                                                  </button>
                                              </div>
                                          </div>
                                      )}
                                  </div>
                              ))}
                          </div>
                      )}
                      
                      <button 
                        onClick={() => setShowArrivalModal(false)}
                        className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-colors mt-4"
                      >
                          All done. I'm home!
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Dashboard;