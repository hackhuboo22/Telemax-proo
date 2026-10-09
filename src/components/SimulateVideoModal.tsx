import React, { useState } from 'react';
import { X, Play, Scissors, ArrowRight, CheckCircle2, Video } from 'lucide-react';
import { ChannelRoute, VideoJob } from '../types/telegram';
import { sanitizeCaption } from '../utils/captionSanitizer';

interface SimulateVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  routes: ChannelRoute[];
  onAddJob: (job: VideoJob) => void;
}

export const SimulateVideoModal: React.FC<SimulateVideoModalProps> = ({
  isOpen,
  onClose,
  routes,
  onAddJob,
}) => {
  if (!isOpen) return null;

  const [selectedRouteId, setSelectedRouteId] = useState<string>(routes[0]?.id || '');
  const [videoName, setVideoName] = useState('Avatar_Fire_Nation_Trailer_1080p.mp4');
  const [videoDuration, setVideoDuration] = useState(48);
  const [rawCaption, setRawCaption] = useState(
    '🔥 New Avatar Fire & Ash 1080p HD Trailer! Join group for full movies 👉 https://t.me/joinchat/movie_pirates_vip and follow @cinema_leaks2026. Backup: https://t.me/avatar_backup'
  );
  const [hasNoLinksTest, setHasNoLinksTest] = useState(false);

  const activeRoute = routes.find((r) => r.id === selectedRouteId) || routes[0];

  const handleToggleNoLinks = (checked: boolean) => {
    setHasNoLinksTest(checked);
    if (checked) {
      setRawCaption('Avatar Fire & Ash Exclusive Cinema Trailer in Ultra HD 60fps. Official Warner segment.');
    } else {
      setRawCaption(
        '🔥 New Avatar Fire & Ash 1080p HD Trailer! Join group for full movies 👉 https://t.me/joinchat/movie_pirates_vip and follow @cinema_leaks2026. Backup: https://t.me/avatar_backup'
      );
    }
  };

  const handleSimulate = () => {
    const sanitizeResult = sanitizeCaption(rawCaption, {
      removeTelegramLinks: activeRoute.removeLinks,
      removeUsernames: activeRoute.stripUsernames,
      removePromoPhrases: activeRoute.stripPromoKeywords,
      customWatermark: activeRoute.customWatermark,
    });

    const newJob: VideoJob = {
      id: `live-job-${Date.now()}`,
      routeId: activeRoute.id,
      sourceChat: activeRoute.sourceChat,
      destinationChat: activeRoute.destinationChat,
      messageId: Math.floor(5000 + Math.random() * 4000),
      fileName: videoName,
      originalDuration: videoDuration,
      trimmedDuration: Math.max(1, videoDuration - (activeRoute.cutDurationSeconds || 5.0)),
      originalSizeMB: 54.2,
      trimmedSizeMB: 48.6,
      thumbnailUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
      originalCaption: rawCaption,
      cleanedCaption: sanitizeResult.cleanedCaption,
      hasLinks: sanitizeResult.hasLinks,
      linksRemoved: sanitizeResult.linksFound,
      status: 'trimming',
      progress: 35,
      timestamp: 'Just now',
      previewVideoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    };

    onAddJob(newJob);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4 text-cyan-400" />
            <h3 className="text-base font-bold text-white">Simulate Incoming Telegram Video</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            Test the live forwarding daemon. Simulate a video being posted into your source group,
            watch it crop the first 5 seconds, clean the title links, and relay to your destination group.
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Select Pipeline Route:
            </label>
            <select
              value={selectedRouteId}
              onChange={(e) => setSelectedRouteId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
            >
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.sourceChat} ➔ {r.destinationChat})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">Video File Name</label>
              <input
                type="text"
                value={videoName}
                onChange={(e) => setVideoName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Duration (sec)</label>
              <input
                type="number"
                value={videoDuration}
                onChange={(e) => setVideoDuration(parseInt(e.target.value) || 30)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-cyan-300 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300">Video Caption</label>
              <label className="flex items-center gap-1.5 text-[11px] text-cyan-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasNoLinksTest}
                  onChange={(e) => handleToggleNoLinks(e.target.checked)}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <span>Test "No Links" Case (Keep Intact)</span>
              </label>
            </div>
            <textarea
              rows={3}
              value={rawCaption}
              onChange={(e) => setRawCaption(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono resize-none leading-relaxed"
            />
          </div>

          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-rose-400">
              <Scissors className="h-3 w-3" />
              <span>
                Trim result: {videoDuration}s will become {Math.max(1, videoDuration - 5)}s (First 5 seconds removed)
              </span>
            </div>
            <div>
              Caption Result:{' '}
              <span className="text-emerald-300">
                {hasNoLinksTest ? 'Will be shared 100% identically' : 'Group links & promos will be stripped'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSimulate}
            className="px-4 py-1.5 text-xs font-medium text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors flex items-center gap-1.5 font-medium"
          >
            <Play className="h-3 w-3" />
            <span>Send to Harvester Pipeline</span>
          </button>
        </div>
      </div>
    </div>
  );
};
