'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, memo } from 'react';

interface NavigationProps {
  onExportClick?: () => void;
}

const Navigation = memo(function Navigation({ onExportClick }: NavigationProps) {
  const pathname = usePathname();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  
  // Update current date/time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);
  
  return (
    <nav className="bg-white shadow-sm sticky top-0 z-10 backdrop-blur-sm bg-opacity-90 transition-all duration-300">
      <div className="max-w-6xl mx-auto px-3 py-0.5">
        <div className="flex justify-between items-center">
          <div className="font-bold text-lg text-purple-700 tracking-tight hover:text-purple-600 transition-colors">
            V4U Lead Funnel CRM
          </div>
          
          <div className="flex space-x-3">
            <Link 
              href="/"
              className={`px-3 py-1.5 rounded-md font-medium transition-all duration-300 text-sm ${pathname === '/' 
                ? 'bg-purple-100 text-purple-700 shadow-sm' 
                : 'text-gray-600 hover:text-purple-700 hover:bg-purple-50'}`}
            >
              Home
            </Link>
            <Link 
              href="/dashboard"
              className={`px-3 py-1.5 rounded-md font-medium transition-all duration-300 text-sm ${pathname === '/dashboard' 
                ? 'bg-purple-100 text-purple-700 shadow-sm' 
                : 'text-gray-600 hover:text-purple-700 hover:bg-purple-50'}`}
            >
              Dashboard
            </Link>
            <Link 
              href="/add-lead"
              className={`px-3 py-1.5 rounded-md font-medium transition-all duration-300 text-sm ${pathname === '/add-lead' 
                ? 'bg-purple-100 text-purple-700 shadow-sm' 
                : 'text-gray-600 hover:text-purple-700 hover:bg-purple-50'}`}
            >
              Add Lead
            </Link>
          </div>
          
          {/* Controls and Clock */}
          <div className="flex items-center space-x-2">
            {/* Perfect Real-time Date & Time */}
            {/* Modern Clock Container */}
            <div className="relative bg-white border border-gray-200 rounded-md p-1.5 shadow-lg backdrop-blur-sm">
              {/* Animated Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-white to-blue-50 rounded-xl opacity-80"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-transparent to-blue-500/10 rounded-xl"></div>
              
              {/* Content */}
              <div className="relative flex items-center space-x-1.5">
                {/* Clock Icon */}
                <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-blue-600 rounded-md flex items-center justify-center shadow-md">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                
                {/* Time and Date */}
                <div className="text-center flex-1">
                  <div className="flex items-center justify-center space-x-1">
                    <div className="text-sm font-bold text-gray-800 tracking-wider">
                      {currentDateTime.toLocaleTimeString('en-US', {
                        hour12: true,
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                    <div className="text-xs text-gray-500 font-normal">
                      {currentDateTime.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
});

export default Navigation;
