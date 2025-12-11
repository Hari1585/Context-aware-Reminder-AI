import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, ListTodo, Calendar, Settings, Bell, Mail } from 'lucide-react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/new', label: 'Notes', icon: FileText },
    { path: '/tasks', label: 'Tasks', icon: ListTodo },
    { path: '/calendar', label: 'Calendar', icon: Calendar },
    { path: '/gmail', label: 'Gmail Sync', icon: Mail },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      {/* Sidebar */}
      <div className="w-64 bg-slate-100 border-r border-slate-200 flex-shrink-0 flex flex-col">
        {/* Logo Area */}
        <div className="p-6 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 leading-tight">Context Aware</h1>
            <p className="text-slate-500 text-xs">Reminder</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 mt-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-slate-200 text-slate-900' 
                    : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-slate-900' : 'text-slate-500'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        
        {/* User Profile Stub */}
        <div className="p-4 border-t border-slate-200">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-xs font-bold text-slate-600">
                    JD
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-900">John Doe</p>
                    <p className="text-xs text-slate-500">john@example.com</p>
                </div>
            </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Top Header Placeholder */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
            <div className="flex items-center text-slate-400 hover:text-slate-600 cursor-pointer">
                {/* Panel toggle icon placeholder */}
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </div>
            <div className="flex items-center gap-4">
                 <button className="text-slate-400 hover:text-slate-600">
                    <Settings className="w-5 h-5" />
                 </button>
            </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
            {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;