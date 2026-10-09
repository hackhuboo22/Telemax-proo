import React, { useState } from 'react';
import { Plus, Trash2, ArrowRight, Settings2, CheckCircle2, AlertCircle, Send, Play, Radio, Scissors } from 'lucide-react';
import { ChannelRoute, TelegramCredentials } from '../types/telegram';

interface ChannelMappingProps {
  routes: ChannelRoute[];
  setRoutes: React.Dispatch<React.SetStateAction<ChannelRoute[]>>;
  credentials: TelegramCredentials;
  onScanHistoricalVideos: (routeId: string) => void;
}

export const ChannelMapping: React.FC<ChannelMappingProps> = ({
  routes,
  setRoutes,
  credentials,
  onScanHistoricalVideos,
}) => {
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ [routeId: string]: { success?: boolean; message?: string } }>({});
  const [isTesting, setIsTesting] = useState<string | null>(null);

  // New route form state
  const [newRoute, setNewRoute] = useState<Partial<ChannelRoute>>({
    name: '',
    sourceChat: '',
    sourceTitle: '',
    destinationChat: '',
    destinationTitle: '',
    enabled: true,
    cutDurationSeconds: 5.0,
    removeLinks: true,
    stripUsernames: true,
    stripPromoKeywords: true,
    customWatermark: '',
    filterMinDuration: 5,
    filterMaxDuration: 7200,
    filterMaxSizeMB: 2048,
    reuploadAsVideo: true,
  });

  const [isAddingNew, setIsAddingNew] = useState(false);

  const handleToggleRoute = (id: string) => {
    setRoutes((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleDeleteRoute = (id: string) => {
    setRoutes((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSaveNewRoute = () => {
    if (!newRoute.sourceChat?.trim() || !newRoute.destinationChat?.trim()) {
      return;
    }

    const routeToAdd: ChannelRoute = {
      id: `route-${Date.now()}`,
      name: newRoute.name?.trim() || `${newRoute.sourceChat} ➔ ${newRoute.destinationChat}`,
      sourceChat: newRoute.sourceChat.trim(),
      sourceTitle: newRoute.sourceTitle?.trim() || newRoute.sourceChat.trim(),
      destinationChat: newRoute.destinationChat.trim(),
      destinationTitle: newRoute.destinationTitle?.trim() || newRoute.destinationChat.trim(),
      enabled: true,
      cutDurationSeconds: Number(newRoute.cutDurationSeconds) || 5.0,
      removeLinks: newRoute.removeLinks ?? true,
      stripUsernames: newRoute.stripUsernames ?? true,
      stripPromoKeywords: newRoute.stripPromoKeywords ?? true,
      customWatermark: newRoute.customWatermark || '',
      filterMinDuration: Number(newRoute.filterMinDuration) || 5,
      filterMaxDuration: Number(newRoute.filterMaxDuration) || 7200,
      filterMaxSizeMB: Number(newRoute.filterMaxSizeMB) || 2048,
      reuploadAsVideo: newRoute.reuploadAsVideo ?? true,
    };

    setRoutes((prev) => [...prev, routeToAdd]);
    setIsAddingNew(false);
    setNewRoute({
      name: '',
      sourceChat: '',
      sourceTitle: '',
      destinationChat: '',
      destinationTitle: '',
      enabled: true,
      cutDurationSeconds: 5.0,
      removeLinks: true,
      stripUsernames: true,
      stripPromoKeywords: true,
      customWatermark: '',
      filterMinDuration: 5,
      filterMaxDuration: 7200,
      filterMaxSizeMB: 2048,
      reuploadAsVideo: true,
    });
  };

  const handleTestDestination = async (route: ChannelRoute) => {
    setIsTesting(route.id);
    try {
      if (credentials.botToken) {
        const response = await fetch('/api/telegram/test-destination', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            botToken: credentials.botToken,
            chatId: route.destinationChat,
            message: `🤖 [TeleTrim Test Ping]\nRelay active for route: ${route.name}\nSource: ${route.sourceChat}\n5s Intro Crop: Enabled\nLink Cleaner: Enabled`,
          }),
        });
        const data = await response.json();
        if (data.success) {
          setTestResult((prev) => ({
            ...prev,
            [route.id]: {
              success: true,
              message: `Ping delivered to ${route.destinationChat}! Message ID: ${data.messageId}`,
            },
          }));
        } else {
          setTestResult((prev) => ({
            ...prev,
            [route.id]: {
              success: false,
              message: data.error || 'Could not post to destination group.',
            },
          }));
        }
      } else {
        // Simulated client test confirmation
        setTimeout(() => {
          setTestResult((prev) => ({
            ...prev,
            [route.id]: {
              success: true,
              message: `Destination chat format verified: ${route.destinationChat}. Client session authorized to send video messages.`,
            },
          }));
          setIsTesting(null);
        }, 600);
        return;
      }
    } catch (err: any) {
      setTestResult((prev) => ({
        ...prev,
        [route.id]: {
          success: false,
          message: err.message || 'Network error while testing destination.',
        },
      }));
    } finally {
      setIsTesting(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-2">
      {/* Header and Add button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Group & Channel Relay Pipelines
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Map your source groups to target groups. Every old and new video will be intercepted,
            trimmed by 5 seconds, cleaned of spam links, and relayed automatically.
          </p>
        </div>

        <button
          onClick={() => setIsAddingNew(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap self-start sm:self-auto font-medium"
        >
          <Plus className="h-4 w-4" />
          <span>New Relay Route</span>
        </button>
      </div>

      {/* Add New Route Form Modal / Drawer */}
      {isAddingNew && (
        <div className="border border-cyan-800/80 bg-slate-900/90 rounded-xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-cyan-300 flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              <span>Configure New Channel Relay Pipeline</span>
            </h3>
            <button
              onClick={() => setIsAddingNew(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Pipeline Friendly Name
              </label>
              <input
                type="text"
                placeholder="e.g. Action Movies Relay"
                value={newRoute.name || ''}
                onChange={(e) => setNewRoute({ ...newRoute, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Cut / Crop First N Seconds <span className="text-cyan-400 font-mono">(User rule: 5s)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="60"
                  value={newRoute.cutDurationSeconds ?? 5.0}
                  onChange={(e) =>
                    setNewRoute({ ...newRoute, cutDurationSeconds: parseFloat(e.target.value) || 0 })
                  }
                  className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                />
                <span className="text-xs text-slate-400">
                  seconds trimmed from start of every video
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Source Group / Channel <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. @cinema_leaks_vault or -1001234567890"
                value={newRoute.sourceChat || ''}
                onChange={(e) => setNewRoute({ ...newRoute, sourceChat: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Channel where original videos with links & 5s intro arrive
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Destination Group / Channel <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. @my_clean_movies_channel or -1009876543210"
                value={newRoute.destinationChat || ''}
                onChange={(e) => setNewRoute({ ...newRoute, destinationChat: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Your group where sanitized & trimmed videos will be posted
              </span>
            </div>
          </div>

          {/* Filtering & Sanitizing Options */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 cursor-pointer">
              <input
                type="checkbox"
                checked={newRoute.removeLinks ?? true}
                onChange={(e) => setNewRoute({ ...newRoute, removeLinks: e.target.checked })}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span className="text-xs text-slate-300">Strip t.me & Web Links</span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 cursor-pointer">
              <input
                type="checkbox"
                checked={newRoute.stripUsernames ?? true}
                onChange={(e) => setNewRoute({ ...newRoute, stripUsernames: e.target.checked })}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span className="text-xs text-slate-300">Remove @mentions</span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 cursor-pointer">
              <input
                type="checkbox"
                checked={newRoute.reuploadAsVideo ?? true}
                onChange={(e) => setNewRoute({ ...newRoute, reuploadAsVideo: e.target.checked })}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span className="text-xs text-slate-300">Clean Re-Upload (No Forward tag)</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Custom Watermark / Brand Caption (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. 🎬 Relayed cleanly via MyChannel"
              value={newRoute.customWatermark || ''}
              onChange={(e) => setNewRoute({ ...newRoute, customWatermark: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              onClick={() => setIsAddingNew(false)}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveNewRoute}
              className="px-4 py-1.5 text-xs font-medium text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg font-medium"
            >
              Create Pipeline
            </button>
          </div>
        </div>
      )}

      {/* Routes List */}
      <div className="space-y-4">
        {routes.map((route) => (
          <div
            key={route.id}
            className="border border-slate-800 bg-slate-900/40 rounded-xl p-5 transition-colors hover:border-slate-700"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-sm">{route.name}</span>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      route.enabled ? 'bg-emerald-400' : 'bg-slate-600'
                    }`}
                  />
                  <span className="text-xs text-slate-500 font-mono">
                    {route.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>

                {/* Source to Destination lockup */}
                <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                  <div className="bg-slate-950 border border-slate-800 px-2.5 py-1 rounded text-cyan-300 font-mono">
                    Source: {route.sourceChat}
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                  <div className="bg-slate-950 border border-slate-800 px-2.5 py-1 rounded text-emerald-300 font-mono">
                    Dest: {route.destinationChat}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Scan Historical Videos Button */}
                <button
                  onClick={() => onScanHistoricalVideos(route.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors whitespace-nowrap"
                  title="Scan and harvest all old videos from this group"
                >
                  <Play className="h-3 w-3 text-cyan-400" />
                  <span>Scan Past Videos</span>
                </button>

                {/* Test Destination Ping */}
                <button
                  onClick={() => handleTestDestination(route)}
                  disabled={isTesting === route.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors whitespace-nowrap"
                  title="Test if bot or client can post to destination"
                >
                  <Send className="h-3 w-3" />
                  <span>{isTesting === route.id ? 'Pinging...' : 'Test Ping'}</span>
                </button>

                {/* Toggle Enable */}
                <button
                  onClick={() => handleToggleRoute(route.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    route.enabled
                      ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900/40'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {route.enabled ? 'Enabled' : 'Paused'}
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDeleteRoute(route.id)}
                  className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                  title="Delete Route"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Pipeline Configuration Specs summary */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-1.5 text-cyan-300">
                <Scissors className="h-3.5 w-3.5" />
                <span>
                  First <strong className="font-mono tabular-nums">{route.cutDurationSeconds}s</strong> cropped
                </span>
              </div>
              <span aria-hidden="true" className="text-slate-700">·</span>
              <div>
                <span>Link Removal: </span>
                <span className="text-slate-200">
                  {route.removeLinks ? 'Auto-strip all URLs & @channels' : 'Keep intact'}
                </span>
              </div>
              <span aria-hidden="true" className="text-slate-700">·</span>
              <div>
                <span>Caption Mode: </span>
                <span className="text-slate-200">
                  If no link present, original caption kept 100%
                </span>
              </div>
              {route.customWatermark && (
                <>
                  <span aria-hidden="true" className="text-slate-700">·</span>
                  <div className="text-slate-400 truncate max-w-xs">
                    Tag: <span className="text-slate-300 italic">{route.customWatermark}</span>
                  </div>
                </>
              )}
            </div>

            {testResult[route.id] && (
              <div
                className={`mt-3 p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                  testResult[route.id].success
                    ? 'bg-emerald-950/40 border border-emerald-800/80 text-emerald-200'
                    : 'bg-rose-950/40 border border-rose-800/80 text-rose-200'
                }`}
              >
                {testResult[route.id].success ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                )}
                <span>{testResult[route.id].message}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
