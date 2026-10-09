import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Check,
  Eye,
  Link2,
  AtSign,
  Sparkles,
  Film,
  Image as ImageIcon,
  Layers,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { CaptionConfig } from '../types/telegram';

interface CaptionRulesManagerProps {
  captionConfig: CaptionConfig;
  onUpdateConfig: (config: Partial<CaptionConfig>) => void;
}

export const CaptionRulesManager: React.FC<CaptionRulesManagerProps> = ({
  captionConfig,
  onUpdateConfig,
}) => {
  const [keepFileLine, setKeepFileLine] = useState(
    captionConfig.keepFileLine !== undefined ? captionConfig.keepFileLine : true
  );
  const [replaceFileLink, setReplaceFileLink] = useState(
    captionConfig.replaceFileLink !== undefined ? captionConfig.replaceFileLink : true
  );
  const [myGroupLink, setMyGroupLink] = useState(
    captionConfig.myGroupLink || 'https://t.me/JRov0'
  );
  const [forwardPhotosAndVideosTogether, setForwardPhotosAndVideosTogether] = useState(
    captionConfig.forwardPhotosAndVideosTogether !== undefined
      ? captionConfig.forwardPhotosAndVideosTogether
      : true
  );
  const [enableMD5Deduplication, setEnableMD5Deduplication] = useState(
    captionConfig.enableMD5Deduplication !== undefined
      ? captionConfig.enableMD5Deduplication
      : true
  );
  const [removeLinks, setRemoveLinks] = useState(captionConfig.removeLinks || false);
  const [removeUsernames, setRemoveUsernames] = useState(captionConfig.removeUsernames || false);
  const [customFooter, setCustomFooter] = useState(captionConfig.customFooter || '');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setKeepFileLine(
      captionConfig.keepFileLine !== undefined ? captionConfig.keepFileLine : true
    );
    setReplaceFileLink(
      captionConfig.replaceFileLink !== undefined ? captionConfig.replaceFileLink : true
    );
    setMyGroupLink(captionConfig.myGroupLink || 'https://t.me/JRov0');
    setForwardPhotosAndVideosTogether(
      captionConfig.forwardPhotosAndVideosTogether !== undefined
        ? captionConfig.forwardPhotosAndVideosTogether
        : true
    );
    setEnableMD5Deduplication(
      captionConfig.enableMD5Deduplication !== undefined
        ? captionConfig.enableMD5Deduplication
        : true
    );
    setRemoveLinks(captionConfig.removeLinks || false);
    setRemoveUsernames(captionConfig.removeUsernames || false);
    setCustomFooter(captionConfig.customFooter || '');
  }, [captionConfig]);

  const handleSave = async () => {
    const updated: Partial<CaptionConfig> = {
      keepFileLine,
      replaceFileLink,
      myGroupLink: myGroupLink.trim() || 'https://t.me/JRov0',
      removeFileLine: !keepFileLine,
      forwardPhotosAndVideosTogether,
      enableMD5Deduplication,
      removeLinks,
      removeUsernames,
      keepFileMeta: keepFileLine,
      customFooter,
    };
    try {
      await fetch('/api/telegram/caption-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      onUpdateConfig(updated);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const sampleFilename = 'STc_Eva10069_20261007_2155';

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-semibold text-white">
                Telegram Relay Rules: File Links & Video+SS Album Delivery
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Configure file links (pointing to your Telegram group), keep caption data 100% same-to-same, and deliver Video + Screenshot Photo together as an album.
            </p>
          </div>

          <button
            onClick={handleSave}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 self-start sm:self-auto shadow-md shadow-cyan-900/30"
          >
            {isSaved ? <Check className="w-4 h-4 text-emerald-300" /> : <Sparkles className="w-4 h-4" />}
            <span>{isSaved ? 'Rules Saved' : 'Save Rules'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6">
          {/* Rules Configuration */}
          <div className="space-y-5">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>Delivery & Caption Rules</span>
            </h3>

            {/* Rule 1: Keep File: line */}
            <div className="flex items-start justify-between gap-4 p-3.5 bg-slate-950 border border-cyan-800/60 bg-cyan-950/20 rounded-lg">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-white">
                    Keep "File:" Line (File Wala Add Rakho)
                  </span>
                  <span className="text-[10px] text-cyan-300 font-mono bg-cyan-900/50 px-1.5 py-0.5 rounded">Active</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Keeps the <code>File: {sampleFilename}</code> line intact in the caption just like the original post.
                </p>
              </div>
              <input
                type="checkbox"
                checked={keepFileLine}
                onChange={(e) => setKeepFileLine(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
              />
            </div>

            {/* Rule 2: Replace link on File with My Telegram Group Link */}
            <div className="flex items-start justify-between gap-4 p-3.5 bg-slate-950 border border-emerald-800/60 bg-emerald-950/20 rounded-lg">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-white">
                    Replace File Link With My Telegram Group Link
                  </span>
                  <span className="text-[10px] text-emerald-300 font-mono bg-emerald-900/50 px-1.5 py-0.5 rounded">Requested</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Replaces the original external website or source channel link on the filename (e.g. <code>{sampleFilename}</code>) with your Telegram group link.
                </p>
              </div>
              <input
                type="checkbox"
                checked={replaceFileLink}
                onChange={(e) => setReplaceFileLink(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
            </div>

            {/* Target Group Link Input */}
            <div className="space-y-2 p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>My Telegram Group / Channel Link</span>
                <span className="text-[10px] text-slate-500">Destination link</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={myGroupLink}
                  onChange={(e) => setMyGroupLink(e.target.value)}
                  placeholder="https://t.me/JRov0"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
                <ExternalLink className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5" />
              </div>
              <p className="text-[11px] text-slate-400">
                When users click the filename in your channel, it will open this Telegram group link directly.
              </p>
            </div>

            {/* Rule 3: Share Video + Photo (Screenshot) Together */}
            <div className="flex items-start justify-between gap-4 p-3.5 bg-slate-950 border border-purple-800/60 bg-purple-950/20 rounded-lg">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-semibold text-white">
                    Share Video + Screenshot (SS) Photo Together
                  </span>
                  <span className="text-[10px] text-purple-300 font-mono bg-purple-900/50 px-1.5 py-0.5 rounded">Album Sync</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Automatically pairs the video and its screenshot photo (SS) as an album and shares both together so nothing is missed ("jo jise video ka hai fix properly").
                </p>
              </div>
              <input
                type="checkbox"
                checked={forwardPhotosAndVideosTogether}
                onChange={(e) => setForwardPhotosAndVideosTogether(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
              />
            </div>

            {/* Rule MD5: Advanced MD5 Deduplication */}
            <div className="flex items-start justify-between gap-4 p-3.5 bg-slate-950 border border-orange-800/60 bg-orange-950/20 rounded-lg">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-orange-400" />
                  <span className="text-xs font-semibold text-white">
                    Enable Advanced MD5 Hashing (Deduplication)
                  </span>
                  <span className="text-[10px] text-orange-300 font-mono bg-orange-900/50 px-1.5 py-0.5 rounded">Anti-Duplicate</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Calculates a unique digital fingerprint (MD5) for every video. This prevents the same video from being posted twice, even if it has a different filename or comes from a different group.
                </p>
              </div>
              <input
                type="checkbox"
                checked={enableMD5Deduplication}
                onChange={(e) => setEnableMD5Deduplication(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-700 text-orange-600 focus:ring-orange-500 cursor-pointer"
              />
            </div>

            {/* Rule 4: Strip External Spam Promo Links (other than file link) */}
            <div className="flex items-start justify-between gap-4 p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-medium text-white">Remove Other External Spam URLs</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Strips spam promo links at the bottom (e.g. <code>https://t.me/spam_channel</code>) while preserving the file link.
                </p>
              </div>
              <input
                type="checkbox"
                checked={removeLinks}
                onChange={(e) => setRemoveLinks(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
              />
            </div>

            {/* Rule 5: Strip Handles */}
            <div className="flex items-start justify-between gap-4 p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <AtSign className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-medium text-white">Remove Spam Promoter @Mentions</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Removes promoter bots like <code>@ads_bot</code> while keeping model tags (e.g. <code>#Eva10069</code>) intact.
                </p>
              </div>
              <input
                type="checkbox"
                checked={removeUsernames}
                onChange={(e) => setRemoveUsernames(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
              />
            </div>

            {/* Custom Watermark Footer */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-medium text-slate-300 block">
                Custom Channel Signature / Watermark (Optional)
              </label>
              <input
                type="text"
                value={customFooter}
                onChange={(e) => setCustomFooter(e.target.value)}
                placeholder="e.g. 📢 Join @JRov0 for more"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          {/* Real Telegram Post Preview: Shows Video + Screenshot Photo Album */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <span>Live Channel Post Preview (Album)</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">Target: JRov0</span>
            </div>

            {/* Telegram Message Box replicating exact real post with Video AND Screenshot */}
            <div className="bg-[#182533] border border-[#2b3e54] rounded-xl p-4 shadow-lg space-y-3 max-w-md mx-auto">
              {/* Media Album Container: Video (Left) + Screenshot Photo (Right) */}
              <div className="grid grid-cols-2 gap-1.5 rounded-lg overflow-hidden border border-[#243547] bg-[#0e1621] p-1">
                {/* 1. Video Player Container */}
                <div className="relative aspect-[4/3] bg-gradient-to-br from-slate-900 to-black rounded overflow-hidden flex flex-col justify-between p-2 border border-slate-800/80">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] font-mono font-semibold text-white/90 bg-black/70 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Film className="w-2.5 h-2.5 text-cyan-400" /> Video
                    </span>
                    <span className="text-[9px] font-mono text-cyan-300 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800/50">
                      HD1
                    </span>
                  </div>

                  {/* Play Center icon */}
                  <div className="self-center">
                    <div className="w-9 h-9 rounded-full bg-cyan-600/80 border border-white/30 flex items-center justify-center backdrop-blur-sm shadow-md">
                      <div className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[9px] border-l-white ml-0.5" />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[9px] font-mono text-slate-300 bg-black/70 px-1.5 py-0.5 rounded">
                    <span>00:18:50</span>
                    <span>287 MB</span>
                  </div>
                </div>

                {/* 2. Screenshot Photo (SS) Container */}
                <div className="relative aspect-[4/3] bg-gradient-to-br from-purple-950/40 to-slate-950 rounded overflow-hidden flex flex-col justify-between p-2 border border-purple-800/40">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] font-mono font-semibold text-white/90 bg-black/70 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <ImageIcon className="w-2.5 h-2.5 text-purple-400" /> Screenshot (SS)
                    </span>
                    <span className="text-[9px] font-mono text-purple-300 bg-purple-950/80 px-1.5 py-0.5 rounded border border-purple-800/50">
                      Preview
                    </span>
                  </div>

                  <div className="self-center text-center">
                    <div className="w-8 h-8 rounded-lg bg-purple-900/40 border border-purple-700/40 flex items-center justify-center mx-auto mb-1">
                      <ImageIcon className="w-4 h-4 text-purple-300" />
                    </div>
                    <span className="text-[9px] text-purple-200/90 font-medium">Video Screenshot</span>
                  </div>

                  <div className="text-[8px] font-mono text-center text-purple-300/80 bg-black/70 py-0.5 rounded">
                    Paired With Video
                  </div>
                </div>
              </div>

              {/* Album Synchronized Badge */}
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 px-2 py-1 rounded-md">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Video + Screenshot (SS) delivered together as an Album</span>
              </div>

              {/* Caption Box with blockquote line */}
              <div className="border-l-2 border-[#5288c1] pl-3 py-1 text-xs text-[#e4ecf2] font-mono whitespace-pre-wrap leading-relaxed bg-[#1b2b3a]/50 rounded-r">
                {keepFileLine && (
                  <div className="text-[#8ec5fc] font-semibold flex items-baseline gap-1">
                    <span className="text-[#a8c7ea]">File: </span>
                    {replaceFileLink ? (
                      <span className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300 cursor-pointer flex items-center gap-1">
                        {sampleFilename}
                        <span className="text-[10px] text-emerald-300 no-underline font-sans font-normal bg-emerald-950 px-1 py-0.2 rounded border border-emerald-800/60">
                          → {myGroupLink || 'https://t.me/JRov0'}
                        </span>
                      </span>
                    ) : (
                      <span>{sampleFilename}</span>
                    )}
                  </div>
                )}
                <div className="text-[#a8c7ea]">Username: <span className="text-white font-medium">#Eva10069</span></div>
                <div className="text-[#a8c7ea]">Sid: <span className="text-slate-300">#ID274008920</span></div>
                <div className="text-[#a8c7ea]">Duration: <span className="text-slate-300">00:18:50</span></div>
                <div className="text-[#a8c7ea]">Size: <span className="text-slate-300">287.48 MB</span></div>
                <div className="text-[#a8c7ea]">Label: <span className="text-slate-300">HD1</span></div>
                {customFooter.trim() && (
                  <div className="mt-2 text-cyan-300 font-semibold border-t border-[#374e69] pt-1">
                    {customFooter.trim()}
                  </div>
                )}
              </div>

              {/* Message Footer */}
              <div className="flex items-center justify-between text-[10px] text-[#708499] pt-1 border-t border-[#233547]">
                <div className="flex items-center gap-1">
                  <span>JRov0</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-emerald-400 font-medium">Link: {myGroupLink || 'https://t.me/JRov0'}</span>
                </div>
                <span>Shared Together</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
