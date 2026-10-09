import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { RealTelegramAuth } from './components/RealTelegramAuth';
import { DestinationChannelManager } from './components/DestinationChannelManager';
import { SourceGroupsManager } from './components/SourceGroupsManager';
import { CaptionRulesManager } from './components/CaptionRulesManager';
import { ChannelVerificationSuite } from './components/ChannelVerificationSuite';
import { LiveRelayedFeed } from './components/LiveRelayedFeed';
import { UptimeModal } from './components/UptimeModal';
import { MasterPasswordGate } from './components/MasterPasswordGate';
import {
  TelegramUserState,
  DestinationChannelConfig,
  CaptionConfig,
  MonitoredGroup,
  RelayedVideoItem,
  PipelineLog,
  QueueStats,
  FirestoreQuotaInfo,
} from './types/telegram';
import { Radio, Zap, ShieldCheck, Film, ArrowRight, CheckCircle2, RotateCcw, Activity, RefreshCw } from 'lucide-react';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    // Strict session-only: refresh or leaving tab clears auth and requires password again
    const token = sessionStorage.getItem('tel_master_auth_token');
    if (localStorage.getItem('tel_master_auth_persistent')) {
      localStorage.removeItem('tel_master_auth_persistent');
    }
    return Boolean(token);
  });

  const [activeTab, setActiveTab] = useState<string>('forwarder');
  const [isUptimeModalOpen, setIsUptimeModalOpen] = useState<boolean>(false);

  // Real backend MTProto state
  const [userState, setUserState] = useState<TelegramUserState>({ isLoggedIn: false });
  const [destinationConfig, setDestinationConfig] = useState<DestinationChannelConfig>({
    channelInput: '',
    canPost: false,
    isVerified: false,
  });
  const [captionConfig, setCaptionConfig] = useState<CaptionConfig>({
    keepFileLine: true,
    replaceFileLink: true,
    myGroupLink: 'https://t.me/JRov0',
    removeFileLine: false,
    removeLinks: false,
    removeUsernames: false,
    keepFileMeta: true,
    customFooter: '',
    forwardPhotosAndVideosTogether: true,
  });

  const [monitoredGroups, setMonitoredGroups] = useState<MonitoredGroup[]>([]);
  const [relayedVideos, setRelayedVideos] = useState<RelayedVideoItem[]>([]);
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [queueLength, setQueueLength] = useState<number>(0);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [lastHealthCheck, setLastHealthCheck] = useState<string>('');
  const [isLiveRelayActive, setIsLiveRelayActive] = useState<boolean>(true);
  const [queueStats, setQueueStats] = useState<QueueStats>({
    pendingCount: 0,
    isProcessing: false,
    totalRelayed: 0,
    totalFailed: 0,
    retryAttempts: 0,
    isRateLimited: false,
    floodWaitSeconds: 0,
    zeroSkipActive: true,
    lastCatchUpAt: '',
    burstCapacity: 100,
    pacingSpeedSec: 0.5,
  });

  const [firestoreQuota, setFirestoreQuota] = useState<FirestoreQuotaInfo | null>(null);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ text, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Fetch real status from backend
  const fetchBackendStatus = async () => {
    try {
      const res = await fetch('/api/telegram/status');
      const data = await res.json();
      if (data.success) {
        setUserState(data.userState || { isLoggedIn: false });
        if (data.destinationConfig) setDestinationConfig(data.destinationConfig);
        if (data.captionConfig) setCaptionConfig(data.captionConfig);
        setMonitoredGroups(data.monitoredGroups || []);
        setRelayedVideos(data.relayedVideos || []);
        setQueueLength(data.queueLength || 0);
        setActiveCount(data.activeCount || 0);
        if (data.queueStats) setQueueStats(data.queueStats);
        if (data.firestore) setFirestoreQuota(data.firestore);
        setLastHealthCheck(data.lastHealthCheck || '');
        setIsListening(Boolean(data.isListening));
        setLogs(data.logs || []);

        // Auto-restore session from localStorage if backend lost connection
        if (!data.userState?.isLoggedIn) {
          const savedSession = localStorage.getItem('telegram_session_string');
          if (savedSession) {
            try {
              const restoreRes = await fetch('/api/telegram/real-auth/restore-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionString: savedSession }),
              });
              const restoreData = await restoreRes.json();
              if (restoreData.success) {
                const refreshRes = await fetch('/api/telegram/status');
                const refreshed = await refreshRes.json();
                if (refreshed.success) {
                  setUserState(refreshed.userState);
                  if (refreshed.destinationConfig) setDestinationConfig(refreshed.destinationConfig);
                  if (refreshed.captionConfig) setCaptionConfig(refreshed.captionConfig);
                  setMonitoredGroups(refreshed.monitoredGroups || []);
                  setRelayedVideos(refreshed.relayedVideos || []);
                  if (refreshed.queueStats) setQueueStats(refreshed.queueStats);
                }
              }
            } catch (restoreErr) {
              console.warn('Auto restore session failed', restoreErr);
            }
          }
        } else if (data.userState?.sessionString) {
          localStorage.setItem('telegram_session_string', data.userState.sessionString);
        }
      }
    } catch (err) {
      // Backend polling error
    }
  };

  useEffect(() => {
    fetchBackendStatus();
    const interval = setInterval(fetchBackendStatus, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const hbInterval = setInterval(async () => {
      try {
        const clientSessionId = sessionStorage.getItem('tel_client_session_id');
        const res = await fetch('/api/auth/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientSessionId }),
        });
        const data = await res.json();
        if (!data.success) {
          sessionStorage.removeItem('tel_master_auth_token');
          setIsAuthenticated(false);
        }
      } catch (e) {}
    }, 20000);
    return () => clearInterval(hbInterval);
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <MasterPasswordGate onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-200">
      {/* Top Bar adhering to strict 3-zone contract */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userState={userState}
        destinationConfig={destinationConfig}
        isLiveRelayActive={isLiveRelayActive}
        setIsLiveRelayActive={setIsLiveRelayActive}
        onOpenUptimeModal={() => setIsUptimeModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 px-4 sm:px-6 py-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Firestore Free Tier Quota Notice if exceeded */}
        {firestoreQuota?.quotaExceeded && (
          <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200 text-xs">
            <div className="space-y-0.5">
              <div className="font-semibold text-amber-100 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-amber-400" />
                Firestore Free Tier Daily Write Limit Reached
              </div>
              <p className="text-amber-300/80 leading-relaxed">
                The bot is operating 100% uninterrupted using high-speed local disk storage. Free daily write quota resets tomorrow.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              <button
                onClick={async () => {
                  try {
                    const res = await fetch('/api/firestore/clear-circuit', { method: 'POST' });
                    const data = await res.json();
                    if (data.success) {
                      showToast('Firestore circuit breaker reset. Retrying cloud sync...', 'success');
                      fetchBackendStatus();
                    }
                  } catch (e) {
                    showToast('Failed to reset circuit breaker.', 'error');
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-xs transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Connection</span>
              </button>
              {firestoreQuota.upgradeUrl && (
                <a
                  href={firestoreQuota.upgradeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg text-xs transition-colors"
                >
                  <span>Upgrade</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Tab 1: Live Forwarder (Core setup) */}
        {activeTab === 'forwarder' && (
          <div className="space-y-6">
            {/* Header Banner - Explains pure cloud relay with Zero-Skip and Zero-Env */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2 flex-wrap">
                    <span>Native Telegram Video Relayer & Channel Sync</span>
                    <span className="text-[11px] font-mono text-emerald-400 font-normal">
                      · 100+ Video Zero-Skip Engine
                    </span>
                    <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60 font-normal">
                      Zero Environment Variables Required
                    </span>
                  </h1>
                  <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                    Burst-protected MTProto pipeline: Even if 10, 20, or 100 videos arrive simultaneously or while the server was asleep, every single video is queued, throttled with adaptive flood-wait backoff, and relayed into your target channel without missing or skipping a single file.
                  </p>
                </div>

                {/* Quick stats without pills */}
                <div className="flex items-center gap-6 text-xs text-slate-400 self-start md:self-auto border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-6">
                  <div>
                    <div className="font-mono tabular-nums text-sm font-bold text-white">
                      {monitoredGroups.length}
                    </div>
                    <div className="text-[11px] text-slate-500">Source Groups</div>
                  </div>
                  <div>
                    <div className="font-mono tabular-nums text-sm font-bold text-emerald-400">
                      {queueStats.totalRelayed || relayedVideos.length}
                    </div>
                    <div className="text-[11px] text-slate-500">Videos Relayed</div>
                  </div>
                  <div>
                    <div className="font-mono tabular-nums text-sm font-bold text-cyan-400">
                      {queueStats.pendingCount || queueLength}
                    </div>
                    <div className="text-[11px] text-slate-500">Queue Buffer</div>
                  </div>
                  <div>
                    <div className="font-mono tabular-nums text-sm font-bold text-cyan-400 flex items-center gap-2">
                      {isListening ? (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Active</span>
                        </>
                      ) : (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                          <span>Offline</span>
                        </>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">Zero-Skip Daemon</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Manual Sync / Recovery Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/50 border border-slate-800/80 px-4 py-2.5 rounded-xl text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>
                  Offline Protection:{' '}
                  {queueStats.lastCatchUpAt
                    ? `Last checked at ${queueStats.lastCatchUpAt}`
                    : 'Auto-scan runs every 40s to sweep any videos posted while offline'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {queueStats.isRateLimited && (
                  <>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/telegram/flood-wait/reset', { method: 'POST' });
                          const data = await res.json();
                          if (data.success) {
                            fetchBackendStatus();
                            showToast('Telegram Flood Wait cleared! 0.5s Turbo resumed.', 'success');
                          }
                        } catch (e) {
                          showToast('Failed to reset flood wait', 'error');
                        }
                      }}
                      className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1.5 transition-colors bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Clear Flood Wait</span>
                    </button>
                    <span className="text-slate-700">|</span>
                  </>
                )}

                <button
                  onClick={() => setIsUptimeModalOpen(true)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Activity className="w-3.5 h-3.5 animate-pulse" />
                  <span>24/7 Always-On (Uptime Setup)</span>
                </button>

                <span className="text-slate-700">|</span>

                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/telegram/catch-up', { method: 'POST' });
                      const data = await res.json();
                      if (data.success) {
                        fetchBackendStatus();
                        showToast(
                          data.count > 0
                            ? `Found ${data.count} missed videos posted while offline! Added to queue.`
                            : 'All source groups checked: zero missed videos!',
                          data.count > 0 ? 'success' : 'info'
                        );
                      }
                    } catch (e) {
                      showToast('Network error during catch-up sweep', 'error');
                    }
                  }}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Sweep Offline Missed Videos</span>
                </button>

                <span className="text-slate-700">|</span>

                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/telegram/listener/restart', { method: 'POST' });
                      const data = await res.json();
                      if (data.success) {
                        fetchBackendStatus();
                        showToast('Cloud Listener restarted successfully!', 'success');
                      } else {
                        showToast('Failed to restart: ' + (data.error || 'Unknown error'), 'error');
                      }
                    } catch (e) {
                      showToast('Network error during restart', 'error');
                    }
                  }}
                  className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Restart Daemon</span>
                </button>
              </div>
            </div>

            {/* In-app Toast Banner */}
            {toast && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-3 border shadow-lg ${
                  toast.type === 'success'
                    ? 'bg-emerald-950/70 border-emerald-800 text-emerald-200'
                    : toast.type === 'error'
                    ? 'bg-red-950/70 border-red-800 text-red-200'
                    : 'bg-cyan-950/70 border-cyan-800 text-cyan-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  {toast.type === 'error' && <Zap className="w-4 h-4 text-red-400 shrink-0" />}
                  {toast.type === 'info' && <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />}
                  <span className="font-medium">{toast.text}</span>
                </div>
                <button
                  onClick={() => setToast(null)}
                  className="text-slate-400 hover:text-white text-[11px] underline ml-auto"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Alert Banner if destination channel is not configured */}
            {!destinationConfig.channelInput && (
              <div className="bg-amber-950/30 border border-amber-800/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start sm:items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0 mt-1 sm:mt-0 animate-ping" />
                  <div>
                    <div className="font-semibold text-white">
                      Action Required: Set Destination Channel
                    </div>
                    <div className="text-slate-400 text-[11px] mt-0.5">
                      Your source group is actively monitored. Select a destination channel in the card below to start forwarding videos immediately.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('destination-manager-card');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg shrink-0 transition-colors self-start sm:self-auto"
                >
                  Configure Channel Now
                </button>
              </div>
            )}

            {/* Step 1 & Step 2 Side-by-Side: User Login + Destination Channel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RealTelegramAuth
                userState={userState}
                onRefreshStatus={fetchBackendStatus}
              />
              <DestinationChannelManager
                destinationConfig={destinationConfig}
                userState={userState}
                onRefreshStatus={fetchBackendStatus}
              />
            </div>

            {/* Step 3: Source Groups to Auto-Relay */}
            <SourceGroupsManager
              groups={monitoredGroups}
              isListening={isListening}
              onRefreshStatus={fetchBackendStatus}
            />

            {/* Relayed Videos Feed Preview */}
            <LiveRelayedFeed
              videos={relayedVideos}
              logs={logs}
              queueStats={queueStats}
              onRefresh={fetchBackendStatus}
            />
          </div>
        )}

        {/* Tab 2: Dedicated Channel Delivery Verification & Diagnostics */}
        {activeTab === 'verification' && (
          <ChannelVerificationSuite
            userState={userState}
            destinationConfig={destinationConfig}
            relayedVideos={relayedVideos}
            isListening={isListening}
            onRefreshStatus={fetchBackendStatus}
          />
        )}

        {/* Tab 3: Caption Rules & Link Cleaning */}
        {activeTab === 'captions' && (
          <CaptionRulesManager
            captionConfig={captionConfig}
            onUpdateConfig={(cfg) => setCaptionConfig((prev) => ({ ...prev, ...cfg }))}
          />
        )}

        {/* Tab 4: Relayed Feed & Event Logs */}
        {activeTab === 'history' && (
          <LiveRelayedFeed
            videos={relayedVideos}
            logs={logs}
            queueStats={queueStats}
            onRefresh={fetchBackendStatus}
          />
        )}
      </main>

      {/* Clean Footer adhering to design constitution */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-xs text-slate-500 mt-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 max-w-7xl mx-auto">
          <span>TeleMax · Native Telegram Group-to-Channel Cloud Forwarder</span>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Direct MTProto User Session</span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span>Zero Environment Config Needed</span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span>100+ Bulk Video Zero-Skip Guarantee</span>
          </div>
        </div>
      </footer>

      {/* 24/7 Always-On & Uptime Monitoring Guide Modal */}
      <UptimeModal
        isOpen={isUptimeModalOpen}
        onClose={() => setIsUptimeModalOpen(false)}
        isListening={isListening}
        isLoggedIn={userState.isLoggedIn}
        monitoredCount={monitoredGroups.length}
        sessionString={userState.sessionString}
      />
    </div>
  );
}

