import React, { useState } from 'react';
import {
  Film,
  ExternalLink,
  CheckCircle2,
  Clock,
  ArrowRight,
  Terminal,
  RefreshCw,
  Search,
  Filter,
  Zap,
  ShieldCheck,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { RelayedVideoItem, PipelineLog, QueueStats } from '../types/telegram';

interface LiveRelayedFeedProps {
  videos: RelayedVideoItem[];
  logs: PipelineLog[];
  queueStats?: QueueStats;
  onRefresh: () => void;
}

export const LiveRelayedFeed: React.FC<LiveRelayedFeedProps> = ({
  videos,
  logs,
  queueStats,
  onRefresh,
}) => {
  const [activeView, setActiveView] = useState<'table' | 'cards' | 'logs'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [burstMessage, setBurstMessage] = useState<string | null>(null);

  const handleResetFloodWait = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/telegram/flood-wait/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setBurstMessage('⚡ Flood Wait cleared! Re-engaged 0.5s Turbo Relay mode.');
        onRefresh();
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setActionLoading(false);
      setTimeout(() => setBurstMessage(null), 4000);
    }
  };

  const handleSetPacingSpeed = async (seconds: number) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/telegram/pacing-speed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds }),
      });
      const data = await res.json();
      if (data.success) {
        setBurstMessage(`Relay speed set to ${seconds}s rhythm!`);
        onRefresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
      setTimeout(() => setBurstMessage(null), 4000);
    }
  };

  const handleClearQueue = async () => {
    try {
      await fetch('/api/telegram/queue/clear', { method: 'POST' });
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCatchUpSweep = async () => {
    setActionLoading(true);
    setBurstMessage(null);
    try {
      const res = await fetch('/api/telegram/catch-up', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setBurstMessage(
          data.count > 0
            ? `Discovered ${data.count} missed videos posted while offline! Added to queue.`
            : `All source groups up-to-date! Zero missed videos.`
        );
        onRefresh();
      }
    } catch (e: any) {
      setBurstMessage('Error during catch-up sweep: ' + e?.message);
    } finally {
      setActionLoading(false);
      setTimeout(() => setBurstMessage(null), 5000);
    }
  };

  const handleSimulateBurst = async (count: number) => {
    setActionLoading(true);
    setBurstMessage(null);
    try {
      const res = await fetch('/api/telegram/simulate-burst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      });
      const data = await res.json();
      if (data.success) {
        setBurstMessage(`Injected ${count} concurrent videos into queue! Watch Zero-Skip processing.`);
        onRefresh();
      }
    } catch (e: any) {
      setBurstMessage('Failed to trigger burst simulation');
    } finally {
      setActionLoading(false);
      setTimeout(() => setBurstMessage(null), 6000);
    }
  };

  const filteredVideos = videos.filter((v) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.title.toLowerCase().includes(q) ||
      v.sourceChat.toLowerCase().includes(q) ||
      v.destinationChat.toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
      {/* Zero-Skip Live Queue Status Banner */}
      <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-800/60 flex items-center justify-center text-cyan-400 shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-white flex items-center gap-2 flex-wrap">
              <span>⚡ Ultra-Fast 0.5s Turbo Relay Engine</span>
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800/60 font-semibold">
                Instant ~{queueStats?.pacingSpeedSec || '0.5'}s Relay
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60">
                🔄 1-2s Query Check Active (Zero Flood)
              </span>
            </div>
            <div className="text-slate-400 text-[11px] mt-0.5">
              {queueStats?.isRateLimited ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-amber-400 font-medium">
                    ⏳ Telegram Flood Wait Protection: Auto-resuming in {queueStats.floodWaitSeconds}s. Zero videos lost (stored on disk).
                  </span>
                  <button
                    onClick={handleResetFloodWait}
                    disabled={actionLoading}
                    className="px-2 py-0.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[10px] transition-colors shadow-sm flex items-center gap-1 disabled:opacity-50"
                  >
                    <Zap className="w-3 h-3" />
                    <span>Clear & Resume 0.5s Turbo Now</span>
                  </button>
                </div>
              ) : queueStats?.pendingCount && queueStats.pendingCount > 0 ? (
                <span className="text-cyan-300 font-medium">
                  ⚡ Turbo Mode Active ({queueStats?.pacingSpeedSec || '0.5'}s speed): {queueStats.pendingCount} videos forwarding immediately with file link replaced...
                </span>
              ) : (
                <span className="text-slate-400">
                  ⚡ Video group mai aate he 0.5s mai share hoga (file link replaced). Har 1,2 second mai automatic query check miss hone se bachata hai.
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Pacing Speed Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => handleSetPacingSpeed(0.5)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                Number(queueStats?.pacingSpeedSec) === 0.5
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Instant relay (0.5s)"
            >
              ⚡ 0.5s Turbo
            </button>
            <button
              onClick={() => handleSetPacingSpeed(1.0)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                Number(queueStats?.pacingSpeedSec) === 1.0
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Fast relay (1.0s)"
            >
              🚀 1.0s
            </button>
            <button
              onClick={() => handleSetPacingSpeed(2.5)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                Number(queueStats?.pacingSpeedSec) === 2.5
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Conservative relay (2.5s)"
            >
              🛡️ Safe 2.5s
            </button>
          </div>

          <button
            onClick={handleCatchUpSweep}
            disabled={actionLoading}
            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 rounded-lg transition-colors text-xs flex items-center gap-1.5 disabled:opacity-50"
            title="Scan monitored groups for videos posted while offline"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : 'text-cyan-400'}`} />
            <span>Force Sweep</span>
          </button>

          <button
            onClick={() => handleSimulateBurst(20)}
            disabled={actionLoading}
            className="px-2.5 py-1.5 bg-cyan-950/40 hover:bg-cyan-900/40 text-cyan-300 border border-cyan-800/60 rounded-lg transition-colors text-xs flex items-center gap-1.5 disabled:opacity-50"
            title="Simulate 20 videos arriving at the exact same second"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Test 20 Burst</span>
          </button>
        </div>
      </div>

      {burstMessage && (
        <div className="p-3 bg-cyan-950/40 border border-cyan-800/80 rounded-lg text-xs text-cyan-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{burstMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-white">Relayed Channel Videos Feed</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time feed of all videos intercepted from source groups and forwarded directly to your target channel.
          </p>
        </div>

        {/* View Switcher & Refresh */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Segmented Control */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveView('table')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === 'table'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setActiveView('cards')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === 'cards'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Cards View
            </button>
            <button
              onClick={() => setActiveView('logs')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === 'logs'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Event Console
            </button>
          </div>

          <button
            onClick={handleClearQueue}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-700/60 hover:border-rose-800/60 rounded-lg transition-colors text-xs flex items-center gap-1.5"
            title="Clear any pending or looping items in relay queue"
          >
            <span>Clear Queue</span>
          </button>

          <button
            onClick={onRefresh}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
            title="Refresh feed"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      {activeView !== 'logs' && (
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by video title or channel name..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
            />
          </div>

          <div className="text-xs text-slate-400">
            <span className="font-mono tabular-nums font-semibold text-cyan-300">
              {filteredVideos.length}
            </span>{' '}
            {filteredVideos.length === 1 ? 'video relayed' : 'videos relayed'}
          </div>
        </div>
      )}

      {/* 1. Table View */}
      {activeView === 'table' && (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <th className="py-3 px-4 font-semibold">Video Title & Caption</th>
                <th className="py-3 px-4 font-semibold">Route Flow</th>
                <th className="py-3 px-4 font-semibold text-right">Size (MB)</th>
                <th className="py-3 px-4 font-semibold">Telegram Msg ID</th>
                <th className="py-3 px-4 font-semibold">Relayed At</th>
                <th className="py-3 px-4 font-semibold text-right">Channel Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
              {filteredVideos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    <Film className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                    <span>No videos relayed yet. Listening to source groups 24/7.</span>
                  </td>
                </tr>
              ) : (
                filteredVideos.map((video) => (
                  <tr
                    key={video.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Title */}
                    <td className="py-3 px-4 text-white font-medium max-w-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {video.isAlbum && (
                          <span className="text-[10px] bg-purple-950/80 border border-purple-800 text-purple-300 font-mono px-1.5 py-0.5 rounded">
                            🎬 Video + 📸 SS
                          </span>
                        )}
                        <span className="truncate" title={video.title}>
                          {video.title || 'Telegram Video'}
                        </span>
                      </div>
                    </td>

                    {/* Route */}
                    <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                      <div className="flex items-center gap-1.5 truncate max-w-xs">
                        <span className="text-slate-400 truncate">{video.sourceChat}</span>
                        <ArrowRight className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span className="text-emerald-400 truncate">{video.destinationChat}</span>
                      </div>
                    </td>

                    {/* Size */}
                    <td className="py-3 px-4 font-mono tabular-nums text-right text-slate-300">
                      {video.originalSizeMB > 0 ? `${video.originalSizeMB} MB` : 'Stream'}
                    </td>

                    {/* Msg ID */}
                    <td className="py-3 px-4 font-mono tabular-nums text-cyan-300">
                      #{video.messageId}
                    </td>

                    {/* Time */}
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-400 text-[11px]">
                      {video.relayedAt}
                    </td>

                    {/* Link */}
                    <td className="py-3 px-4 text-right">
                      {video.directLink ? (
                        <a
                          href={video.directLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-600 text-[11px]">Delivered</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 2. Cards View */}
      {activeView === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVideos.length === 0 ? (
            <div className="col-span-full py-10 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg">
              <Film className="w-6 h-6 mx-auto mb-2 text-slate-600" />
              <span>No videos found matching criteria.</span>
            </div>
          ) : (
            filteredVideos.map((video) => (
              <div
                key={video.id}
                className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors flex flex-col justify-between"
              >
                {/* Media frame */}
                <div className="relative aspect-video bg-[#0e1621] flex items-center justify-center overflow-hidden border-b border-slate-800">
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-600 gap-1">
                      <Film className="w-8 h-8" />
                      <span className="text-[10px] font-mono">Telegram Video</span>
                    </div>
                  )}

                  <div className="absolute top-2 left-2 bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-[10px] font-medium px-2 py-0.5 rounded backdrop-blur-sm flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Delivered</span>
                  </div>

                  <div className="absolute bottom-2 right-2 bg-black/80 text-slate-200 text-[10px] font-mono tabular-nums px-2 py-0.5 rounded backdrop-blur-sm">
                    {video.originalSizeMB > 0 ? `${video.originalSizeMB} MB` : 'Full Video'}
                  </div>
                </div>

                {/* Details */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {video.isAlbum && (
                        <span className="text-[10px] bg-purple-950/80 border border-purple-800 text-purple-300 font-mono px-1.5 py-0.5 rounded">
                          🎬 Video + 📸 SS Album
                        </span>
                      )}
                    </div>
                    <h3 className="text-xs font-semibold text-white line-clamp-2 leading-relaxed" title={video.title}>
                      {video.title || 'Telegram Video'}
                    </h3>

                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono text-[11px] truncate">
                      <span className="truncate">{video.sourceChat}</span>
                      <ArrowRight className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span className="text-emerald-400 truncate">{video.destinationChat}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                      {video.relayedAt} · #{video.messageId}
                    </span>

                    {video.directLink && (
                      <a
                        href={video.directLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium text-xs transition-colors"
                      >
                        <span>View Post</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 3. Event Console */}
      {activeView === 'logs' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>Real-Time MTProto Stream Logs</span>
            </span>
            <span className="font-mono text-[11px]">Server Daemon Active</span>
          </div>

          <div className="bg-black border border-slate-800 rounded-xl p-4 font-mono text-xs max-h-80 overflow-y-auto space-y-2">
            {logs.length === 0 ? (
              <div className="text-slate-600 italic">No events logged yet. System waiting for video messages.</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2.5 leading-relaxed">
                  <span className="text-slate-600 text-[11px] shrink-0 tabular-nums">{log.timestamp}</span>
                  <span
                    className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded shrink-0 ${
                      log.type === 'video_detected'
                        ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                        : log.type === 'forwarded'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : log.type === 'error'
                        ? 'bg-red-950 text-red-400 border border-red-800'
                        : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    {log.type}
                  </span>
                  <span
                    className={
                      log.type === 'forwarded'
                        ? 'text-emerald-300'
                        : log.type === 'video_detected'
                        ? 'text-cyan-200 font-medium'
                        : log.type === 'error'
                        ? 'text-red-300'
                        : 'text-slate-300'
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
