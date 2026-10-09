import React, { useState } from 'react';
import { Eraser, Link2, Check, ArrowRight, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { sanitizeCaption } from '../utils/captionSanitizer';

export const CaptionSanitizerStudio: React.FC = () => {
  const samplePresets = [
    {
      label: 'Sample with Telegram Group Links',
      text: '🔥 Marvel Avengers Secret Wars (2026) 1080p WebRip Dual Audio.\n\nJoin our VIP group for fast download: https://t.me/joinchat/movie_pirate_hub\nAlso follow @cinema_leaks_2026 for daily movies!\nDirect download: https://bit.ly/4xSecretWars',
    },
    {
      label: 'Sample without Any Links (Preserved 100%)',
      text: 'Deep Ocean Trench Documentary - 4K 60fps HDR.\n\nNarrated by David Attenborough. Exploring Mariana Trench marine ecosystems and underwater hydrothermal vents.',
    },
    {
      label: 'Mixed Hinglish Telegram Caption with Multiple Promos',
      text: 'Bhai full movie aa gayi hai jaldi dekho!!\n👇👇 Join group for new episodes 👇👇\nhttps://t.me/+AbCdEfGhIjKlMnOp\nAur dost log ko bhi share karo @bollywood_hd_movies\nBackup link: https://telegram.me/backup_channel_official',
    },
  ];

  const [inputCaption, setInputCaption] = useState(samplePresets[0].text);
  const [customWatermark, setCustomWatermark] = useState('🎬 Relayed via My Clean Channel');
  const [removeUsernames, setRemoveUsernames] = useState(true);
  const [removeWebUrls, setRemoveWebUrls] = useState(true);

  const result = sanitizeCaption(inputCaption, {
    removeTelegramLinks: true,
    removeWebUrls,
    removeUsernames,
    removePromoPhrases: true,
    customWatermark,
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-2">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Eraser className="h-5 w-5 text-cyan-400" />
          <span>Smart Caption Link Scrubber & Rule Engine</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
          Matches your exact rule: If the video title has links (e.g.{' '}
          <span className="font-mono text-cyan-300">t.me/channel</span>,{' '}
          <span className="font-mono text-cyan-300">@username</span>, or web URLs), they are
          automatically stripped. If there are no links, the title is kept exactly as shared!
        </p>
      </div>

      {/* Preset Pickers */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-medium text-slate-400 mr-1">Load Test Presets:</span>
        {samplePresets.map((preset, idx) => (
          <button
            key={idx}
            onClick={() => setInputCaption(preset.text)}
            className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 hover:border-slate-700 hover:text-white text-slate-300 rounded-lg transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Main Interactive Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Input Raw Caption */}
        <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-5 flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
              <Link2 className="h-4 w-4" />
              <span>Original Caption (From Source Group)</span>
            </label>
            <span className="text-[11px] font-mono text-slate-500">
              {inputCaption.length} chars
            </span>
          </div>

          <textarea
            value={inputCaption}
            onChange={(e) => setInputCaption(e.target.value)}
            rows={8}
            placeholder="Paste any Telegram message caption here..."
            className="w-full flex-1 bg-slate-950 border border-slate-800 focus:border-rose-500/80 rounded-lg p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none transition-colors resize-y font-mono leading-relaxed"
          />

          {/* Links Detected summary */}
          <div className="pt-2 border-t border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400 block mb-1.5">
              Detected Links & Mentions ({result.linksFound.length}):
            </span>
            {result.linksFound.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {result.linksFound.map((link, i) => (
                  <span
                    key={i}
                    className="bg-rose-950/60 border border-rose-800/60 text-rose-300 px-2 py-0.5 rounded text-[11px] font-mono truncate max-w-xs"
                  >
                    {link}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                <Check className="h-3 w-3" /> No links detected. Caption will be shared 100% as is!
              </span>
            )}
          </div>
        </div>

        {/* Right Column: Sanitized Clean Caption */}
        <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-5 flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              <span>Clean Sanitized Caption (Sent to Destination Group)</span>
            </label>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                result.hasLinks
                  ? 'bg-cyan-950/50 text-cyan-300 border border-cyan-800/50'
                  : 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/50'
              }`}
            >
              {result.hasLinks ? `${result.removedCount} Links Stripped` : 'Identical (No Links)'}
            </span>
          </div>

          <div className="w-full flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 font-mono leading-relaxed whitespace-pre-wrap select-all overflow-y-auto min-h-[160px]">
            {result.cleanedCaption || (
              <span className="text-slate-600 italic">Caption is completely empty after cleaning.</span>
            )}
          </div>

          {/* User Rule Explanation banner */}
          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 leading-normal">
            {result.hasLinks ? (
              <div className="flex items-start gap-1.5 text-cyan-300">
                <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Rule Executed: Found {result.removedCount} link(s). Stripped all group invites and promotional references cleanly.
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-1.5 text-emerald-300">
                <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Rule Executed: No group link found in title. Shared identically as original!
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Rules & Watermark Settings */}
      <div className="border border-slate-800 bg-slate-900/40 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
          Scrubber Configuration & Watermarking
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Custom Watermark / Channel Footer (Optional)
            </label>
            <input
              type="text"
              value={customWatermark}
              onChange={(e) => setCustomWatermark(e.target.value)}
              placeholder="e.g. 🎬 Shared by @MyCleanGroup"
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none transition-colors"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Appended to the bottom of the sanitized message. Leave blank for no watermark.
            </span>
          </div>

          <div className="space-y-2 pt-1">
            <span className="block text-xs font-medium text-slate-300">Scrubber Toggles:</span>
            <div className="flex flex-col sm:flex-row gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={removeUsernames}
                  onChange={(e) => setRemoveUsernames(e.target.checked)}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <span>Remove @usernames & channel mentions</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={removeWebUrls}
                  onChange={(e) => setRemoveWebUrls(e.target.checked)}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <span>Remove external https:// & bit.ly links</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
