import React, { useState, useEffect } from 'react';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Radio,
  Tv,
  Layers,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { DestinationChannelConfig, TelegramUserState } from '../types/telegram';

interface DestinationChannelManagerProps {
  destinationConfig: DestinationChannelConfig;
  userState: TelegramUserState;
  onRefreshStatus: () => void;
}

interface UserDialogChannel {
  id: string;
  title: string;
  username?: string;
  isBroadcast: boolean;
  isMegagroup: boolean;
  canPost: boolean;
  participantsCount?: number;
}

export const DestinationChannelManager: React.FC<DestinationChannelManagerProps> = ({
  destinationConfig,
  userState,
  onRefreshStatus,
}) => {
  const [channelInput, setChannelInput] = useState(destinationConfig.channelInput || '');
  const [availableChannels, setAvailableChannels] = useState<UserDialogChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [testingShare, setTestingShare] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    directLink?: string;
    msgId?: number;
  } | null>(null);

  // Sync prop changes
  useEffect(() => {
    if (destinationConfig.channelInput) {
      setChannelInput(destinationConfig.channelInput);
    }
  }, [destinationConfig.channelInput]);

  // Load user's actual channels from Telegram dialogs when logged in
  const loadUserChannels = async () => {
    if (!userState.isLoggedIn) return;
    setLoadingChannels(true);
    try {
      const res = await fetch('/api/telegram/destination/channels');
      const data = await res.json();
      if (data.success && Array.isArray(data.channels)) {
        setAvailableChannels(data.channels);
      }
    } catch (err) {
      console.warn('Could not load user channels', err);
    } finally {
      setLoadingChannels(false);
    }
  };

  useEffect(() => {
    if (userState.isLoggedIn) {
      loadUserChannels();
    }
  }, [userState.isLoggedIn]);

  // Handle Verify Channel
  const handleVerifyChannel = async (targetToVerify?: string) => {
    const target = (targetToVerify || channelInput).trim();
    if (!target) {
      setFeedback({
        type: 'error',
        message: 'Please enter a target channel username (@mychannel) or invite link.',
      });
      return;
    }

    if (!userState.isLoggedIn) {
      setFeedback({
        type: 'error',
        message: 'Please login to your Telegram account first to verify channel access.',
      });
      return;
    }

    setVerifying(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/telegram/destination/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelInput: target }),
      });

      const data = await res.json();
      if (data.success) {
        let msg = data.verifiedCount > 1 
          ? `Verified ${data.verifiedCount} channels!` 
          : `Channel "${data.destination?.channelTitle || target}" verified!`;
        
        if (data.errors && data.errors.length > 0) {
          msg += ` Some failed: ${data.errors.join('; ')}`;
        }

        setFeedback({
          type: data.errors ? 'info' : 'success',
          message: msg,
        });
        onRefreshStatus();
      } else {
        setFeedback({
          type: 'error',
          message: data.error || 'Could not verify channel access.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Verification request failed.',
      });
    } finally {
      setVerifying(false);
    }
  };

  // Select channel from user's dialog list
  const handleSelectChannel = (ch: UserDialogChannel) => {
    const target = ch.username ? `@${ch.username}` : ch.id;
    setChannelInput(target);
    handleVerifyChannel(target);
  };

  // Send Test Video to verify live channel sharing
  const handleTestRelay = async () => {
    const target = channelInput.trim() || destinationConfig.channelInput;
    if (!target) {
      setFeedback({
        type: 'error',
        message: 'Please select or enter a destination channel first.',
      });
      return;
    }

    if (!userState.isLoggedIn) {
      setFeedback({
        type: 'error',
        message: 'Please login to your Telegram account before sending a test video.',
      });
      return;
    }

    setTestingShare(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/telegram/destination/test-relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelInput: target }),
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: 'success',
          message: data.message || `Test video delivered to "${data.channelTitle}"!`,
          directLink: data.directLink,
          msgId: data.messageId,
        });
        onRefreshStatus();
      } else {
        setFeedback({
          type: 'error',
          message: data.error || 'Failed to share test video to channel.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to complete channel test share.',
      });
    } finally {
      setTestingShare(false);
    }
  };

  return (
    <div id="destination-manager-card" className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between scroll-mt-20">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Tv className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-semibold text-white">Target Destination Channel</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Direct account-to-channel sharing (no bot required). Videos forward natively in the Telegram cloud.
            </p>
          </div>

          {destinationConfig.isVerified ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Channel Ready</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Not Configured</span>
            </div>
          )}
        </div>

        {/* Verified Target Channel Summary Card */}
        {destinationConfig.isVerified && destinationConfig.channelTitle && (
          <div className="border border-emerald-900/40 bg-emerald-950/20 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-300">
                {destinationConfig.channelTitle}
              </span>
              {destinationConfig.directLink && (
                <a
                  href={destinationConfig.directLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                >
                  <span>Open Channel</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
              {destinationConfig.channelUsername && (
                <span>@{destinationConfig.channelUsername}</span>
              )}
              {destinationConfig.channelId && (
                <>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="font-mono">ID: {destinationConfig.channelId}</span>
                </>
              )}
              {typeof destinationConfig.memberCount === 'number' && destinationConfig.memberCount > 0 && (
                <>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="font-mono">{destinationConfig.memberCount.toLocaleString()} members</span>
                </>
              )}
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className={destinationConfig.canPost ? 'text-emerald-400' : 'text-amber-400'}>
                {destinationConfig.canPost ? 'Posting Allowed' : 'Post Permission Restricted'}
              </span>
            </div>
          </div>
        )}

        {/* 1-Click Pick from User's Channels */}
        {userState.isLoggedIn && availableChannels.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Select from your Telegram channels</span>
              </label>
              <button
                onClick={loadUserChannels}
                disabled={loadingChannels}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${loadingChannels ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="relative">
              <select
                onChange={(e) => {
                  const selected = availableChannels.find((c) => c.id === e.target.value);
                  if (selected) handleSelectChannel(selected);
                }}
                defaultValue=""
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer"
              >
                <option value="" disabled>
                  -- Choose a channel where you are admin --
                </option>
                {availableChannels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.title} {ch.username ? `(@${ch.username})` : ''} - {ch.isBroadcast ? 'Channel' : 'Group'}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
            </div>

            {availableChannels.filter((c) => c.canPost).length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-500">Quick select:</span>
                {availableChannels
                  .filter((c) => c.canPost)
                  .slice(0, 3)
                  .map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => handleSelectChannel(ch)}
                      className="px-2 py-0.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500 text-slate-300 hover:text-white rounded text-[11px] transition-colors truncate max-w-[150px]"
                    >
                      {ch.title}
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Manual Input for Channel Username or Invite Link */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-300 block">
            Target Channel Link or @Username
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              placeholder="e.g. @Channel1, @Channel2 or t.me/+invite"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
            <button
              onClick={() => handleVerifyChannel()}
              disabled={verifying || !channelInput.trim()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5"
            >
              {verifying && <RefreshCw className="w-3 h-3 animate-spin" />}
              <span>Verify Targets</span>
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Accepts usernames, links, or invite hashes. <strong>Pro tip:</strong> Separate multiple channels with commas or spaces.
          </p>
        </div>

        {/* Feedback message */}
        {feedback && (
          <div
            className={`p-3 rounded-lg text-xs flex flex-col gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/40 border border-emerald-900/60 text-emerald-300'
                : feedback.type === 'error'
                ? 'bg-red-950/40 border border-red-900/60 text-red-300'
                : 'bg-cyan-950/40 border border-cyan-900/60 text-cyan-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>

            {feedback.directLink && (
              <div className="pt-1 border-t border-emerald-900/40 flex items-center justify-between">
                <span className="text-slate-400 font-mono text-[11px]">
                  Telegram Message #{feedback.msgId || 'Live'}
                </span>
                <a
                  href={feedback.directLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-800/40 hover:bg-emerald-700/60 text-emerald-200 rounded font-medium text-[11px] transition-colors"
                >
                  <span>Open Post in Telegram</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Test Video Relay Button (Directly satisfies "check like video properly channel mai share to hora hai") */}
      <div className="pt-5 mt-4 border-t border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-300 block">
              Channel Video Delivery Test
            </span>
            <span className="text-[11px] text-slate-500">
              Sends an immediate verification test video to confirm your channel receives videos properly.
            </span>
          </div>

          <button
            onClick={handleTestRelay}
            disabled={testingShare || !userState.isLoggedIn || !channelInput.trim()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 whitespace-nowrap flex items-center gap-2 shadow-sm"
          >
            {testingShare ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Posting to Telegram...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Test Video Share Now</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
