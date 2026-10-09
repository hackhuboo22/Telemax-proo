import React from 'react';
import { Radio, Send, Tv, Activity } from 'lucide-react';
import { TelegramUserState, DestinationChannelConfig } from '../types/telegram';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userState: TelegramUserState;
  destinationConfig: DestinationChannelConfig;
  isLiveRelayActive: boolean;
  setIsLiveRelayActive: (active: boolean) => void;
  onOpenTestModal?: () => void;
  onOpenUptimeModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  userState,
  destinationConfig,
  isLiveRelayActive,
  setIsLiveRelayActive,
  onOpenUptimeModal,
}) => {
  const navItems = [
    { id: 'forwarder', label: 'Live Forwarder' },
    { id: 'verification', label: 'Channel Verification' },
    { id: 'captions', label: 'Caption Rules' },
    { id: 'history', label: 'Relayed Feed' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6 max-w-7xl mx-auto">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('forwarder')}
            className="text-left font-bold tracking-tight text-white hover:text-cyan-400 transition-colors whitespace-nowrap"
          >
            <span className="text-lg">TeleMax</span>
          </button>

          {/* Quiet connection status */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 pl-4 border-l border-slate-800">
            <span
              className={`h-2 w-2 rounded-full ${
                userState.isLoggedIn ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span className="truncate max-w-[150px]">
              {userState.isLoggedIn
                ? userState.user?.firstName || 'Connected'
                : 'Account Disconnected'}
            </span>

            {destinationConfig.channelTitle && (
              <>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-cyan-300 truncate max-w-[160px]">
                  {destinationConfig.channelTitle}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Zone 2: 4-6 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`transition-colors whitespace-nowrap py-1 ${
                activeTab === item.id
                  ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: 1-2 primary actions */}
        <div className="flex items-center gap-2.5">
          {/* 24/7 Always-On (Uptime) Guide Button */}
          {onOpenUptimeModal && (
            <button
              onClick={onOpenUptimeModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-800/80 text-cyan-300 transition-colors whitespace-nowrap shadow-sm"
              title="24/7 UptimeRobot & Always-On Setup"
            >
              <Activity className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
              <span>24/7 Uptime</span>
            </button>
          )}

          {/* Live Auto-Relay Toggle Button */}
          <button
            onClick={() => setIsLiveRelayActive(!isLiveRelayActive)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap border ${
              isLiveRelayActive
                ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300 hover:bg-emerald-900/50'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isLiveRelayActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            <span>{isLiveRelayActive ? 'Live Sync Active' : 'Sync Paused'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
