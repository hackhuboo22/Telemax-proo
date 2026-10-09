import React from 'react';
import { X, Scissors, ArrowRight, Link2, ShieldCheck, CheckCircle2, Download } from 'lucide-react';
import { VideoJob } from '../types/telegram';

interface JobInspectorModalProps {
  job: VideoJob | null;
  onClose: () => void;
}

export const JobInspectorModal: React.FC<JobInspectorModalProps> = ({ job, onClose }) => {
  if (!job) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Job Inspection: {job.fileName}</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Message ID #{job.messageId} · Processed {job.timestamp}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Pipeline flow bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-500 block mb-0.5">Source Group</span>
              <span className="text-cyan-300 font-mono font-medium">{job.sourceChat}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-500 block mb-0.5">Crop Applied</span>
              <span className="text-rose-400 font-mono font-medium flex items-center gap-1">
                <Scissors className="h-3 w-3" />
                <span>-5.0s Intro Removed</span>
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-500 block mb-0.5">Destination Group</span>
              <span className="text-emerald-400 font-mono font-medium">{job.destinationChat}</span>
            </div>
          </div>

          {/* Media preview player */}
          {job.previewVideoUrl && (
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-black">
              <div className="px-3 py-1.5 bg-slate-950/80 border-b border-slate-800 text-[11px] text-slate-400 font-mono flex items-center justify-between">
                <span>Trimmed Media Stream (Starts at 00:05)</span>
                <span className="text-emerald-400">Duration: {job.trimmedDuration}s</span>
              </div>
              <video
                src={job.previewVideoUrl}
                controls
                className="w-full max-h-56 object-contain"
              />
            </div>
          )}

          {/* Side-by-side Captions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Original Caption */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-400 flex items-center gap-1">
                  <Link2 className="h-3.5 w-3.5" /> Original Caption
                </span>
                <span className="text-[11px] text-slate-500">
                  {job.hasLinks ? `${job.linksRemoved.length} links` : 'Clean'}
                </span>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg text-xs font-mono text-slate-300 whitespace-pre-wrap min-h-[100px] max-h-44 overflow-y-auto leading-relaxed">
                {job.originalCaption}
              </div>
            </div>

            {/* Cleaned Caption */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> Cleaned Destination Caption
                </span>
                <span className="text-[11px] text-emerald-400">
                  {job.hasLinks ? 'Sanitized' : 'Preserved (No Links)'}
                </span>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg text-xs font-mono text-slate-200 whitespace-pre-wrap min-h-[100px] max-h-44 overflow-y-auto leading-relaxed">
                {job.cleanedCaption}
              </div>
            </div>
          </div>

          {/* Scrubbed items list if present */}
          {job.linksRemoved.length > 0 && (
            <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-lg text-xs space-y-1">
              <span className="font-semibold text-rose-300">Spam Links Removed from Title:</span>
              <ul className="list-disc list-inside text-rose-200/90 font-mono text-[11px] space-y-0.5">
                {job.linksRemoved.map((link, idx) => (
                  <li key={idx}>{link}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-mono">
            Lossless Stream Copy: FFmpeg -ss 5.0 -c copy
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
