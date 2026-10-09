import React, { useState } from 'react';
import { X, Clock, Play, CheckCircle2, Search, Scissors, ArrowRight } from 'lucide-react';
import { ChannelRoute, VideoJob } from '../types/telegram';
import { sanitizeCaption } from '../utils/captionSanitizer';

interface ScanHistoricalModalProps {
  isOpen: boolean;
  onClose: () => void;
  routes: ChannelRoute[];
  onAddJobs: (newJobs: VideoJob[]) => void;
}

export const ScanHistoricalModal: React.FC<ScanHistoricalModalProps> = ({
  isOpen,
  onClose,
  routes,
  onAddJobs,
}) => {
  if (!isOpen) return null;

  const [selectedRouteId, setSelectedRouteId] = useState<string>(routes[0]?.id || '');
  const [scanLimit, setScanLimit] = useState<number>(5);
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);

  const activeRoute = routes.find((r) => r.id === selectedRouteId) || routes[0];

  const handleStartScan = () => {
    setIsScanning(true);
    setScanComplete(false);

    setTimeout(() => {
      // Generate realistic discovered past videos from source group
      const sampleTitles = [
        {
          name: 'Blockbuster_Thriller_Trailer_1080p.mp4',
          dur: 65,
          size: 78.4,
          caption: '🔥 Watch new Blockbuster release! Join t.me/movies_unlimited and follow @cine_hub for 4K prints! Direct link: https://bit.ly/3xThriller',
          thumb: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
        },
        {
          name: 'BBC_Planet_Earth_Glacier_Flow.mp4',
          dur: 40,
          size: 52.1,
          caption: 'High resolution timelapse of glacial river movement across Greenland. Filmed in 8K 60fps.',
          thumb: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg',
        },
        {
          name: 'Comedy_Roast_Best_Moments.mp4',
          dur: 90,
          size: 110.2,
          caption: 'Best comedy jokes compilation 😂 Subscribe now 👉 t.me/joinchat/standup_hub and contact @comedy_bot',
          thumb: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerFun.jpg',
        },
        {
          name: 'Marvel_Studio_Fight_Scene_Cut.mp4',
          dur: 50,
          size: 61.8,
          caption: 'Iron Man vs Thor fight scene remaster 4K. Download full pack on t.me/+SecretWars2026',
          thumb: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
        },
        {
          name: 'Tech_Unboxing_Smartwatch_Review.mp4',
          dur: 35,
          size: 42.0,
          caption: 'Apple Watch Ultra 3 comprehensive battery and fitness review. Clean specs analysis.',
          thumb: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerFun.jpg',
        },
      ];

      const count = Math.min(scanLimit, sampleTitles.length);
      const generatedJobs: VideoJob[] = [];

      for (let i = 0; i < count; i++) {
        const item = sampleTitles[i];
        const sanitizeRes = sanitizeCaption(item.caption, {
          removeTelegramLinks: activeRoute.removeLinks,
          removeUsernames: activeRoute.stripUsernames,
          removePromoPhrases: activeRoute.stripPromoKeywords,
          customWatermark: activeRoute.customWatermark,
        });

        const newJob: VideoJob = {
          id: `hist-job-${Date.now()}-${i}`,
          routeId: activeRoute.id,
          sourceChat: activeRoute.sourceChat,
          destinationChat: activeRoute.destinationChat,
          messageId: Math.floor(3000 + Math.random() * 5000),
          fileName: item.name,
          originalDuration: item.dur,
          trimmedDuration: Math.max(1, item.dur - (activeRoute.cutDurationSeconds || 5.0)),
          originalSizeMB: item.size,
          trimmedSizeMB: Number((item.size * 0.92).toFixed(1)),
          thumbnailUrl: item.thumb,
          originalCaption: item.caption,
          cleanedCaption: sanitizeRes.cleanedCaption,
          hasLinks: sanitizeRes.hasLinks,
          linksRemoved: sanitizeRes.linksFound,
          status: 'queued',
          progress: 0,
          timestamp: 'Just scanned',
          previewVideoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        };
        generatedJobs.push(newJob);
      }

      onAddJobs(generatedJobs);
      setIsScanning(false);
      setScanComplete(true);
      setTimeout(() => {
        onClose();
        setScanComplete(false);
      }, 1400);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan-400" />
            <h3 className="text-base font-bold text-white">Scan Historical Channel Videos</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            Scan and harvest all past videos already existing in your source group. The bot will
            batch-read messages, cut the first 5 seconds of each video, clean any group links, and
            relay them into your destination group.
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

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Past Video Messages to Scan:
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[3, 5, 10, 25].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setScanLimit(cnt)}
                  className={`py-2 text-xs font-mono rounded-lg border transition-colors ${
                    scanLimit === cnt
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {cnt} videos
                </button>
              ))}
            </div>
          </div>

          {/* Rules preview */}
          {activeRoute && (
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-cyan-300">
                <Scissors className="h-3 w-3" />
                <span>Each video will have its first {activeRoute.cutDurationSeconds}s cropped</span>
              </div>
              <div>
                <span>Link Cleaner: </span>
                <span className="text-slate-200">
                  {activeRoute.removeLinks ? 'Strip all t.me & URLs from caption' : 'Preserve'}
                </span>
              </div>
              <div>
                <span>Clean Titles: </span>
                <span className="text-slate-200">
                  Videos without links keep original caption intact
                </span>
              </div>
            </div>
          )}

          {scanComplete && (
            <div className="p-3 bg-emerald-950/50 border border-emerald-800/80 rounded-lg text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Historical videos discovered and queued successfully!</span>
            </div>
          )}
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
            onClick={handleStartScan}
            disabled={isScanning || scanComplete}
            className="px-4 py-1.5 text-xs font-medium text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 font-medium"
          >
            <Play className="h-3 w-3" />
            <span>{isScanning ? 'Scanning Telegram Channel...' : 'Scan & Queue Videos'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
