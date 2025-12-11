import React, { useEffect, useState } from 'react';
import { api, Task, UserProfile, AnalyticsData } from '../api';
import { 
    User, 
    Settings as SettingsIcon, 
    History, 
    BarChart3, 
    CreditCard, 
    LogOut, 
    Plus, 
    Users,
    CheckCircle2,
    TrendingUp,
    DollarSign,
    Calendar,
    MapPin
} from 'lucide-react';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';

const Settings: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'profile' | 'history' | 'analytics'>('profile');
    const [user, setUser] = useState<UserProfile | null>(null);
    const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    const userId = "user123";

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [userData, historyData, analyticsData] = await Promise.all([
                    api.getUserProfile(userId),
                    api.getCompletedTasks(userId),
                    api.getAnalytics(userId)
                ]);
                setUser(userData);
                setCompletedTasks(historyData);
                setAnalytics(analyticsData);
            } catch (err) {
                console.error("Failed to fetch settings data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

    if (loading) {
        return <div className="p-10 text-center text-slate-500">Loading settings...</div>;
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <SettingsIcon className="w-8 h-8 text-slate-800" />
                <h2 className="text-3xl font-bold text-slate-900">Settings & Analytics</h2>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar Navigation */}
                <div className="w-full md:w-64 flex-shrink-0">
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <button 
                            onClick={() => setActiveTab('profile')}
                            className={`w-full flex items-center gap-3 px-6 py-4 text-left font-medium transition-colors ${activeTab === 'profile' ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <Users className="w-5 h-5" />
                            User & Household
                        </button>
                        <button 
                            onClick={() => setActiveTab('history')}
                            className={`w-full flex items-center gap-3 px-6 py-4 text-left font-medium transition-colors ${activeTab === 'history' ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <History className="w-5 h-5" />
                            Completed Tasks
                        </button>
                        <button 
                            onClick={() => setActiveTab('analytics')}
                            className={`w-full flex items-center gap-3 px-6 py-4 text-left font-medium transition-colors ${activeTab === 'analytics' ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <BarChart3 className="w-5 h-5" />
                            Analytics & Spend
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1">
                    {activeTab === 'profile' && user && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            {/* Profile Card */}
                            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm flex items-center gap-6">
                                <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-2xl font-bold">
                                    {user.avatar}
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-900">{user.name}</h3>
                                    <p className="text-slate-500">{user.email}</p>
                                    <span className="inline-block mt-2 px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full uppercase">
                                        {user.role}
                                    </span>
                                </div>
                                <button className="ml-auto text-red-600 hover:bg-red-50 p-3 rounded-lg flex items-center gap-2 font-medium transition-colors">
                                    <LogOut className="w-5 h-5" /> Sign Out
                                </button>
                            </div>

                            {/* Household Members */}
                            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <Users className="w-5 h-5 text-indigo-600" />
                                        Household Members
                                    </h3>
                                    <button className="text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                                        <Plus className="w-4 h-4" /> Add Member
                                    </button>
                                </div>
                                <div className="space-y-4">
                                    {user.household_members.map((member, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-500 font-bold">
                                                    {member.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800">{member.name}</p>
                                                    <p className="text-xs text-slate-500 uppercase">{member.relation}</p>
                                                </div>
                                            </div>
                                            <button className="text-slate-400 hover:text-slate-600">Edit</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    Completed Tasks History
                                </h3>
                                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">
                                    {completedTasks.length} Archived
                                </span>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {completedTasks.map((task) => (
                                    <div key={task.id} className="p-6 hover:bg-slate-50 transition-colors">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-lg line-through decoration-slate-400 decoration-2 opacity-70">{task.title}</h4>
                                                <p className="text-slate-500 text-sm mt-1">{task.summary}</p>
                                                <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                                                    {task.location_name && (
                                                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {task.location_name}</span>
                                                    )}
                                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Due: {new Date(task.deadline!).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold mb-2">
                                                    Completed on {new Date(task.completed_at!).toLocaleDateString()}
                                                </span>
                                                {task.cost && (
                                                    <p className="font-bold text-slate-900 flex items-center justify-end gap-1">
                                                        <DollarSign className="w-3 h-3 text-slate-400" />
                                                        {task.cost.toFixed(2)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {completedTasks.length === 0 && (
                                    <div className="p-10 text-center text-slate-500">No completed tasks history found.</div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'analytics' && analytics && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                            
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <h4 className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">Total Spend (Dec)</h4>
                                    <div className="flex items-center gap-2">
                                        <DollarSign className="w-8 h-8 text-green-500" />
                                        <span className="text-4xl font-bold text-slate-900">$390.00</span>
                                    </div>
                                    <p className="text-xs text-green-600 mt-2 font-medium flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" /> 12% less than last month
                                    </p>
                                </div>
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <h4 className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">Tasks Efficiency</h4>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="w-8 h-8 text-blue-500" />
                                        <span className="text-4xl font-bold text-slate-900">85%</span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2 font-medium">Completion rate this week</p>
                                </div>
                            </div>

                            {/* Charts Row */}
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                {/* Bar Chart: Weekly Activity */}
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <h4 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-indigo-600" />
                                        Task Completion Trend
                                    </h4>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={analytics.task_completion_trend}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                                <YAxis axisLine={false} tickLine={false} />
                                                <Tooltip 
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                />
                                                <Bar dataKey="completed" name="Completed" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                                                <Bar dataKey="pending" name="Pending" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Pie Chart: Spending Categories */}
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <h4 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                        <CreditCard className="w-5 h-5 text-green-600" />
                                        Spending by Category
                                    </h4>
                                    <div className="h-64 flex">
                                        <ResponsiveContainer width="60%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={analytics.top_expenses}
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="amount"
                                                >
                                                    {analytics.top_expenses.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="flex-1 flex flex-col justify-center space-y-3">
                                            {analytics.top_expenses.map((entry, index) => (
                                                <div key={index} className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                                    <div className="text-sm">
                                                        <p className="font-bold text-slate-700">{entry.category}</p>
                                                        <p className="text-xs text-slate-500">${entry.amount}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Monthly Spending Trend */}
                             <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h4 className="font-bold text-slate-800 mb-6">Monthly Purchase History</h4>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={analytics.monthly_spending}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                            <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                                            <Tooltip formatter={(value) => [`$${value}`, 'Amount']} />
                                            <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Settings;