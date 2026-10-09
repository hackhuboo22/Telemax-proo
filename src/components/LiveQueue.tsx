import React, { useState } from 'react';
import { Play, Pause, RefreshCw, Scissors, Link2, CheckCircle2, AlertCircle, Eye, ArrowRight, Clock, HardDrive, Radio, Plus, Filter } from 'lucide-react';
import { VideoJob, ChannelRoute } from '../types/telegram';

interface LiveQueueProps {
  jobs: VideoJob[];
  setJobs: React.Dispatch<React.SetStateAction<VideoJob[]>>;
  routes: ChannelRoute[];
  isLiveRelayActive: boolean;
  setIsLiveRelayActive: (active: boolean) => void;
  onScanHistorical: () => void;
  onSimulateIncomingVideo: () => void;
  onSelectJobForPreview: (job: VideoJob) => void;
}

export const LiveQueue: React.FC<LiveQueueProps> = ({
  jobs,
  setJobs,
  routes,
  isLiveRelayActive,
  setIsLiveRelayActive,
  onScanHistorical,
  onSimulateIncomingVideo,
  onSelectJobForPreview,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate live stats
  const totalCompleted = jobs.filter((j) => j.status === 'completed').length;
  const totalSecondsTrimmed = totalCompleted * 5.0;
  const totalLinksStripped = jobs.reduce((acc, curr) => acc + curr.linksRemoved.length, 0);
  const totalMBRelayed = jobs
    .filter((j) => j.status === 'completed')
    .reduce((acc, curr) => acc + curr.trimmedSizeMB, 0);

  const filteredJobs = jobs.filter((job) => {
    if (filterStatus !== 'all' && job.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        job.fileName.toLowerCase().includes(q) ||
        job.sourceChat.toLowerCase().includes(q) ||
        job.originalCaption.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleClearCompleted = () => {
    setJobs((prev) => prev.filter((j) => j.status !== 'completed'));
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      {/* Top Banner & Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Video Harvesting & Relay Queue</span>
            {isLiveRelayActive ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-normal">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Listening Active
              </span>
            ) : (
              <span className="text-xs text-slate-500 font-normal">Daemon Paused</span>
            )}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time queue monitoring video downloads from source channels, 5-second intro
            trimming, caption link scrubbing, and destination group uploads.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Scan Historical Videos */}
          <button
            onClick={onScanHistorical}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-200 rounded-lg transition-colors whitespace-nowrap"
            title="Scan source group for historical video posts"
          >
            <Clock className="h-3.5 w-3.5 text-cyan-400" />
            <span>Scan Past Videos</span>
          </button>

          {/* Simulate New Incoming Video */}
          <button
            onClick={onSimulateIncomingVideo}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap font-medium"
            title="Simulate a new video dropping into source group"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Simulate Incoming Video</span>
          </button>
        </div>
      </div>

      {/* Live Stats Row with Tabular Figures and Zero Pills */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border border-slate-800 bg-slate-900/40 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-400">Videos Processed</div>
          <div className="text-2xl font-bold text-white mt-1 font-mono tabular-nums">
            {totalCompleted}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {jobs.length - totalCompleted} pending / active
          </div>
        </div>

        <div className="border border-slate-800 bg-slate-900/40 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-400">Intro Video Trimmed</div>
          <div className="text-2xl font-bold text-cyan-400 mt-1 font-mono tabular-nums">
            {totalSecondsTrimmed.toFixed(1)}s
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            5.0s cut per video
          </div>
        </div>

        <div className="border border-slate-800 bg-slate-900/40 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-400">Spam Links Scrubbed</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono tabular-nums">
            {totalLinksStripped}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            t.me, @channels, web links
          </div>
        </div>

        <div className="border border-slate-800 bg-slate-900/40 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-400">Data Relayed</div>
          <div className="text-2xl font-bold text-white mt-1 font-mono tabular-nums">
            {totalMBRelayed.toFixed(1)} MB
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Streamed to target channels
          </div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        {/* Status segmented buttons */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/90 border border-slate-800 rounded-lg self-start">
          {[
            { id: 'all', label: 'All Jobs' },
            { id: 'completed', label: 'Completed' },
            { id: 'trimming', label: 'Trimming' },
            { id: 'queued', label: 'Queued' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                filterStatus === tab.id
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search filename or channel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 w-56"
          />

          {totalCompleted > 0 && (
            <button
              onClick={handleClearCompleted}
              className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors whitespace-nowrap"
            >
              Clear Completed
            </button>
          )}
        </div>
      </div>

      {/* Jobs List / Table */}
      <div className="border border-slate-800 bg-slate-900/40 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4 font-semibold">Video Media</th>
                <th className="py-3 px-4 font-semibold">Route (Source ➔ Dest)</th>
                <th className="py-3 px-4 font-semibold">5s Trim Delta</th>
                <th className="py-3 px-4 font-semibold">Caption Link Status</th>
                <th className="py-3 px-4 font-semibold">Status / Progress</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No video jobs match current filter. Click "Simulate Incoming Video" or "Scan Past Videos" above.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Media Thumbnail + Name */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={job.thumbnailUrl}
                          alt="thumbnail"
                          className="w-12 h-9 object-cover rounded bg-slate-800 border border-slate-700/60 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="max-w-[200px]">
                          <div className="font-medium text-white truncate" title={job.fileName}>
                            {job.fileName}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            Msg #{job.messageId} · {job.originalSizeMB.toFixed(1)} MB
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Route */}
                    <td className="py-3 px-4">
                      <div className="text-slate-300 font-mono text-[11px] truncate max-w-[170px]">
                        {job.sourceChat}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono truncate max-w-[170px]">
                        <ArrowRight className="h-3 w-3 shrink-0" />
                        <span>{job.destinationChat}</span>
                      </div>
                    </td>

                    {/* Trim Delta */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="text-slate-400 line-through">
                          {job.originalDuration}s
                        </span>
                        <ArrowRight className="h-3 w-3 text-slate-600" />
                        <span className="text-cyan-300 font-bold">
                          {job.trimmedDuration}s
                        </span>
                      </div>
                      <div className="text-[10px] text-rose-400 font-mono mt-0.5">
                        -5.0s intro cropped
                      </div>
                    </td>

                    {/* Caption Link Status */}
                    <td className="py-3 px-4">
                      {job.hasLinks ? (
                        <div className="space-y-0.5">
                          <span className="text-rose-400 font-medium">
                            {job.linksRemoved.length} Link(s) Stripped
                          </span>
                          <div className="text-[10px] text-slate-500 truncate max-w-[160px]">
                            {job.linksRemoved.join(', ')}
                          </div>
                        </div>
                      ) : (
                        <div className="text-emerald-400 font-medium">
                          Preserved 100% (No Links)
                        </div>
                      )}
                    </td>

                    {/* Status & Progress */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          {job.status === 'completed' && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          )}
                          {job.status === 'trimming' && (
                            <Scissors className="h-3.5 w-3.5 text-cyan-400 animate-spin" />
                          )}
                          {job.status === 'uploading' && (
                            <Radio className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                          )}
                          {job.status === 'queued' && (
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                          )}
                          <span className="capitalize font-medium text-slate-200">
                            {job.status === 'trimming' ? 'Cutting first 5s' : job.status}
                          </span>
                        </div>

                        {job.status !== 'completed' && (
                          <div className="w-24 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-cyan-400 h-full transition-all duration-300"
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onSelectJobForPreview(job)}
                        className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition-colors inline-flex items-center gap-1"
                        title="Inspect captions before/after and media"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
