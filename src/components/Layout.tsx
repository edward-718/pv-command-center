import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { Toaster } from './Toaster';
import { useStore } from '@/store/useStore';

export function Layout() {
  const generateNotifications = useStore((s) => s.generateNotifications);

  useEffect(() => {
    generateNotifications();
    const timer = setInterval(generateNotifications, 60 * 1000);
    return () => clearInterval(timer);
  }, [generateNotifications]);

  return (
    <div className="h-full flex bg-ink-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-[1440px] mx-auto px-8 py-7 animate-fade-up">
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
