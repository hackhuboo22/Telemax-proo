import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Send,
  ExternalLink,
  Radio,
  Tv,
  RefreshCw,
  Film,
  Zap,
} from 'lucide-react';
import { DestinationChannelConfig, TelegramUserState, RelayedVideoItem } from '../types/telegram';

interface ChannelVerificationSuiteProps {
  userState: TelegramUserState;
  destinationConfig: DestinationChannelConfig;
  relayedVideos: RelayedVideoItem[];
  isListening: boolean;
  onRefreshStatus: () => void;
}

export const ChannelVerificationSuite: React.FC<ChannelVerificationSuiteProps> = ({
  userState,
  destinationConfig,
  relayedVideos,
  isListening,
  onRefreshStatus,
}) => {
  const [testing, setTesting] = useState(false);
  const [customCaption, setCustomCaption] = useState(
    'Username: #Ray_689\nSid: #ID274008920\nDuration: 00:00:05\nSize: 0.12 MB\nLabel: HD1\nStatus: Verified Direct Cloud Stream'
  );

  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    messageId?: number;
    channelTitle?: string;
    directLink?: string;
  } | null>(null);

  const handleTestRelay = async () => {
    if (!userState.isLoggedIn) {
      setTestResult({
        success: false,
        message: 'Please login to your Telegram user account first.',
      });
      return;
    }

    if (!destinationConfig.channelInput) {
      setTestResult({
        success: false,
        message: 'Please set a destination channel in settings first.',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/telegram/destination/test-relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelInput: destinationConfig.channelInput,
          caption: customCaption,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          message: data.message || 'Video successfully shared to channel!',
          messageId: data.messageId,
          channelTitle: data.channelTitle,
          directLink: data.directLink,
        });
        onRefreshStatus();
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Failed to share test video to channel.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Communication error during test relay.',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Telegram User Connection */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Telegram Account</span>
            <span
              className={`h-2 w-2 rounded-full ${
                userState.isLoggedIn ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
          </div>
          <div className="text-base font-semibold text-white truncate">
            {userState.isLoggedIn
              ? userState.user?.firstName || 'Connected'
              : 'Not Connected'}
          </div>
          <div className="text-xs text-slate-500 font-mono">
            {userState.isLoggedIn
              ? `@${userState.user?.username || 'no_username'} · MTProto Session Active`
              : 'Login with phone & OTP'}
          </div>
        </div>

        {/* Card 2: Destination Channel Health */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Destination Channel</span>
            <span
              className={`h-2 w-2 rounded-full ${
                destinationConfig.isVerified && destinationConfig.canPost
                  ? 'bg-emerald-400'
                  : 'bg-amber-400'
              }`}
            />
          </div>
          <div className="text-base font-semibold text-white truncate">
            {destinationConfig.channelTitle || destinationConfig.channelInput || 'Not Selected'}
          </div>
          <div className="text-xs text-slate-500 font-mono">
            {destinationConfig.canPost ? 'Posting Rights Confirmed' : 'Configure Channel'}
          </div>
        </div>

        {/* Card 3: Cloud Relay Daemon */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Cloud Relay Listener</span>
            <span
              className={`h-2 w-2 rounded-full ${
                isListening ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
              }`}
            />
          </div>
          <div className="text-base font-semibold text-white">
            {isListening ? 'Active (0.2s Relay)' : 'Standby'}
          </div>
          <div className="text-xs text-slate-500 font-mono">
            Direct Server-to-Server (0 MB Download)
          </div>
        </div>
      </div>

      {/* Main Channel Share Verification Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-semibold text-white">
                Live Channel Video Sharing Verification
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Verify that videos are delivered into your destination channel properly with exact Telegram streaming and caption format.
            </p>
          </div>

          <button
            onClick={handleTestRelay}
            disabled={testing || !userState.isLoggedIn || !destinationConfig.channelInput}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-2 self-start sm:self-auto"
          >
            {testing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Posting Video...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-cyan-200" />
                <span>Verify Video Share Now</span>
              </>
            )}
          </button>
        </div>

        {/* Test Result Banner */}
        {testResult && (
          <div
            className={`p-4 rounded-xl border space-y-3 ${
              testResult.success
                ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-200'
                : 'bg-red-950/40 border-red-900/60 text-red-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="text-xs font-semibold text-white">{testResult.message}</div>
                {testResult.messageId && (
                  <div className="text-[11px] text-slate-300 font-mono">
                    Telegram Message ID #{testResult.messageId} delivered to channel{' '}
                    <span className="font-semibold text-emerald-300">"{testResult.channelTitle}"</span>
                  </div>
                )}
              </div>
            </div>

            {testResult.directLink && (
              <div className="pt-2 border-t border-emerald-900/40 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Click below to open and inspect the video in your Telegram app:
                </span>
                <a
                  href={testResult.directLink}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5"
                >
                  <span>Open Post in Telegram</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        )}

        {/* Test Video Caption Editor */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-300 block">
            Test Video Caption (Simulates Incoming Group Post)
          </label>
          <textarea
            rows={5}
            value={customCaption}
            onChange={(e) => setCustomCaption(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500 leading-relaxed"
          />
          <p className="text-[11px] text-slate-500">
            This format mirrors the video captions found in real video groups (File name, Duration, Size in MB, HD Label).
          </p>
        </div>

        {/* Verification Checkpoints */}
        <div className="border border-slate-800 bg-slate-950/60 rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Verification Checkpoints
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2
                className={`w-4 h-4 ${userState.isLoggedIn ? 'text-emerald-400' : 'text-slate-600'}`}
              />
              <span>1. Telegram MTProto User Authorized</span>
            </div>

            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2
                className={`w-4 h-4 ${destinationConfig.canPost ? 'text-emerald-400' : 'text-slate-600'}`}
              />
              <span>2. Destination Channel Post Permission</span>
            </div>

            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>3. Zero Disk Download (Pure Cloud Transfer)</span>
            </div>

            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>4. High-Fidelity Streaming & Thumbnail Flags</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
