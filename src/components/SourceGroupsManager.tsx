import React, { useState } from 'react';
import {
  Radio,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Users,
  ShieldCheck,
  ShieldAlert,
  Hash,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';
import { MonitoredGroup } from '../types/telegram';

interface SourceGroupsManagerProps {
  groups: MonitoredGroup[];
  isListening: boolean;
  onRefreshStatus: () => void;
}

export const SourceGroupsManager: React.FC<SourceGroupsManagerProps> = ({
  groups,
  isListening,
  onRefreshStatus,
}) => {
  const [groupLink, setGroupLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupLink.trim()) {
      setFeedback({ type: 'error', message: 'Please enter one or more Telegram group or channel links.' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/telegram/source-groups/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupLink: groupLink.trim() }),
      });

      const data = await res.json();
      if (data.success) {
        let msg = `Successfully added ${data.addedCount} source(s) for strict 24/7 forwarding.`;
        if (data.errors && data.errors.length > 0) {
          msg += ` Some failed: ${data.errors.join(', ')}`;
        }
        setFeedback({
          type: data.errors ? 'info' : 'success',
          message: msg,
        });
        setGroupLink('');
        onRefreshStatus();
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to add groups.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error communicating with server.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveGroup = async (id: string) => {
    try {
      await fetch('/api/telegram/source-groups/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setFeedback({
        type: 'info',
        message: 'Group removed from monitoring. Videos from it will no longer be forwarded.',
      });
      onRefreshStatus();
    } catch (err: any) {
      console.error('Failed to remove group', err);
    }
  };

  const handleClearAllGroups = async () => {
    setClearingAll(true);
    setShowClearConfirm(false);
    try {
      const res = await fetch('/api/telegram/source-groups/clear-all', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: 'success',
          message: `Cleared all source groups (${data.removedCount} removed). TeleRelay will not forward any videos until you add a new group.`,
        });
        onRefreshStatus();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Failed to clear source groups.' });
    } finally {
      setClearingAll(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Radio className={`w-4 h-4 ${isListening ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
            <h2 className="text-base font-semibold text-white">Monitored Source Groups & Channels</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
              Strict Isolation 24/7
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Videos from ONLY the groups added here will be relayed. All other Telegram groups or chats in your account are completely blocked.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Active Sources:</span>
            <span className="font-mono tabular-nums font-semibold text-cyan-300">
              {groups.length} {groups.length === 1 ? 'group' : 'groups'}
            </span>
          </div>

          {groups.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={clearingAll}
              className="text-[11px] px-2.5 py-1 text-slate-400 hover:text-red-400 hover:bg-red-950/30 border border-slate-800 hover:border-red-900/50 rounded-lg transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal / Bar for Clear All */}
      {showClearConfirm && (
        <div className="p-3 bg-red-950/40 border border-red-900/70 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-red-200">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              Are you sure you want to remove ALL {groups.length} source groups? No videos will be forwarded until a new group is added.
            </span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleClearAllGroups}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-medium transition-colors"
            >
              Yes, Clear All
            </button>
          </div>
        </div>
      )}

      {/* Strict Isolation Info Banner */}
      <div className="bg-slate-950/60 border border-cyan-900/30 rounded-lg p-3 flex items-start gap-2.5 text-xs text-slate-300">
        <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-semibold text-white">Strict Group Whitelist Protection Active</span>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Only videos posted in the exact group links below will be shared to your destination channel. Even if you are in 50 other groups or receive private DMs, those videos will <strong className="text-slate-200">never</strong> be shared.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border border-emerald-900/60 text-emerald-300'
              : feedback.type === 'info'
              ? 'bg-cyan-950/40 border border-cyan-900/60 text-cyan-300'
              : 'bg-red-950/40 border border-red-900/60 text-red-300'
          }`}
        >
          {feedback.type === 'success' || feedback.type === 'info' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Add Group Link Form */}
      <form onSubmit={handleAddGroup} className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Paste group link: https://t.me/mygroup, @mygroup, t.me/+hash, or -100..."
            value={groupLink}
            onChange={(e) => setGroupLink(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none transition-colors"
          />
          <div className="text-[10px] text-slate-500 mt-1 pl-1 italic">
            Supports: Public usernames (<code>t.me/group</code>, <code>@group</code>), private invite links (<code>t.me/+hash</code>), internal links (<code>t.me/c/...</code>), or Telegram IDs.
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !groupLink.trim()}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 whitespace-nowrap h-fit mt-0 shadow-sm shadow-cyan-950"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{loading ? 'Resolving...' : 'Add Source Group'}</span>
        </button>
      </form>

      {/* Monitored Groups List */}
      <div className="space-y-2 pt-1">
        {groups.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-800 rounded-lg bg-slate-950/30 text-slate-500 text-xs space-y-1.5">
            <Radio className="w-5 h-5 text-slate-600 mx-auto" />
            <div className="font-medium text-slate-400">No source groups monitored yet</div>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Paste the exact Telegram group link above (e.g. <code>https://t.me/your_video_group</code>) and click Add Source Group to begin 24/7 video forwarding.
            </p>
          </div>
        ) : (
          groups.map((grp) => (
            <div
              key={grp.id}
              className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white text-xs">{grp.title}</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-emerald-400 font-medium">24/7 Live Monitoring</span>
                  {grp.chatId && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300">
                      ID: {grp.chatId}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                  <span className="text-cyan-400 font-mono text-[11px] truncate max-w-xs">{grp.link}</span>
                  {typeof grp.memberCount === 'number' && grp.memberCount > 0 && (
                    <>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="font-mono tabular-nums text-[11px] text-slate-400">
                        {grp.memberCount.toLocaleString()} members
                      </span>
                    </>
                  )}
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-[10px] text-emerald-400/90 font-mono">
                    Strict Whitelist Locked
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto">
                <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                  Added {grp.addedAt}
                </span>
                <button
                  onClick={() => handleRemoveGroup(grp.id)}
                  className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-900 rounded transition-colors"
                  title="Remove group"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
