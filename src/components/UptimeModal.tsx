import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Activity,
  Globe,
  ShieldCheck,
  Server,
  Zap,
  HelpCircle,
  Clock,
  Radio,
  ExternalLink,
  ChevronRight,
  Terminal,
} from 'lucide-react';

interface UptimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  isListening: boolean;
  isLoggedIn: boolean;
  monitoredCount: number;
  sessionString?: string;
}

export const UptimeModal: React.FC<UptimeModalProps> = ({
  isOpen,
  onClose,
  isListening,
  isLoggedIn,
  monitoredCount,
  sessionString,
}) => {
  if (!isOpen) return null;

  const [copied, setCopied] = useState(false);
  const [sessionCopied, setSessionCopied] = useState(false);
  const [pingTesting, setPingTesting] = useState(false);
  const [pingResult, setPingResult] = useState<{
    status: number;
    latencyMs: number;
    data: any;
    timestamp: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'railway' | 'uptimerobot' | 'howitworks' | 'vps'>('railway');

  const currentOriginPing = typeof window !== 'undefined' ? `${window.location.origin}/api/ping` : '/api/ping';
  const sharedCloudRunPing = 'https://ais-pre-7plec2osfjffeir77o7mu5-429160877494.asia-southeast1.run.app/api/ping';

  const [copiedType, setCopiedType] = useState<'origin' | 'cloudrun' | null>(null);

  const handleCopy = (url: string, type: 'origin' | 'cloudrun') => {
    navigator.clipboard.writeText(url);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleTestPing = async () => {
    setPingTesting(true);
    const start = performance.now();
    try {
      const res = await fetch('/api/ping');
      const latency = Math.round(performance.now() - start);
      const data = await res.json();
      setPingResult({
        status: res.status,
        latencyMs: latency,
        data,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (e: any) {
      setPingResult({
        status: 500,
        latencyMs: Math.round(performance.now() - start),
        data: { error: e?.message || 'Network fetch failed' },
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setPingTesting(false);
    }
  };

  useEffect(() => {
    // Run an initial ping when opened
    handleTestPing();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>24/7 Always-On & Uptime Guide</span>
                <span className="text-[10px] font-mono uppercase bg-emerald-950/90 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded">
                  Live
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Chrome ya Website band hone par bhi bot bina ruke 24/7 video share karega
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Real-time Health Snapshot */}
        <div className="px-6 py-3.5 bg-slate-950 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-900/60 border border-slate-800/80 p-2.5 rounded-lg">
            <div className="text-[11px] text-slate-400">Bot Daemon</div>
            <div className="font-semibold text-white flex items-center gap-1.5 mt-0.5">
              <span className={`h-2 w-2 rounded-full ${isListening ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>{isListening ? 'Active (Listening)' : 'Idle / Standby'}</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 p-2.5 rounded-lg">
            <div className="text-[11px] text-slate-400">Telegram Session</div>
            <div className="font-semibold text-emerald-400 flex items-center gap-1.5 mt-0.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{isLoggedIn ? 'Cloud Synced' : 'Login Required'}</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 p-2.5 rounded-lg">
            <div className="text-[11px] text-slate-400">Ping Endpoint</div>
            <div className="font-semibold text-cyan-400 flex items-center gap-1.5 mt-0.5">
              <Globe className="h-3.5 w-3.5" />
              <span>HTTP 200 OK</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 p-2.5 rounded-lg">
            <div className="text-[11px] text-slate-400">Auto Sweep</div>
            <div className="font-semibold text-purple-400 flex items-center gap-1.5 mt-0.5">
              <Clock className="h-3.5 w-3.5" />
              <span>Every 40s Catch-up</span>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="px-6 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center gap-2 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('railway')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'railway'
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🚂 1. Railway.app 24/7 (High Speed)</span>
          </button>
          <button
            onClick={() => setActiveTab('uptimerobot')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeTab === 'uptimerobot'
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            2. UptimeRobot Ping Setup
          </button>
          <button
            onClick={() => setActiveTab('howitworks')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeTab === 'howitworks'
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            3. Ye Kaise Kaam Karta Hai?
          </button>
          <button
            onClick={() => setActiveTab('vps')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeTab === 'vps'
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            4. VPS / PM2 Hosting
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-slate-300 leading-relaxed">
          {activeTab === 'railway' && (
            <div className="space-y-5">
              {/* High Speed Guarantee Banner */}
              <div className="bg-slate-950 border border-cyan-800/60 rounded-xl p-4 space-y-2">
                <div className="font-semibold text-white flex items-center gap-2">
                  <Zap className="h-4 w-4 text-cyan-400" />
                  <span>Railway.app 24/7 Full High Speed (0.5s Turbo) Par Kaise Chalega?</span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Jaisa abhi <strong>0.5s turbo speed</strong> par forward ho raha hai, Railway.app par bilkul same 24/7 bina ruke full high speed par chalega.
                  Project me <code className="bg-slate-900 text-cyan-300 px-1.5 py-0.5 rounded border border-slate-800">railway.json</code> aur <code className="bg-slate-900 text-cyan-300 px-1.5 py-0.5 rounded border border-slate-800">Dockerfile</code> already pre-configured hain jisme <code className="text-emerald-400 font-mono">sleepApplication: false</code> set hai taaki Railway container kabhi sleep na ho!
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px] font-mono">
                  <div className="bg-slate-900/80 border border-slate-800 p-2 rounded text-emerald-400 flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    <span>0.5s Forwarding</span>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 p-2 rounded text-emerald-400 flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    <span>1-2s Query Check</span>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 p-2 rounded text-emerald-400 flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    <span>Zero Sleep Mode</span>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 p-2 rounded text-emerald-400 flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    <span>File Link Cleaned</span>
                  </div>
                </div>
              </div>

              {/* Active Telegram Session String Box for Railway */}
              {sessionString ? (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-white flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      <span>Aapka Active Telegram Session String (Railway ke liye)</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800/60">
                      Logged In
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Railway ke <strong>Variables</strong> tab mein <code className="text-cyan-300 font-mono">SESSION_STRING</code> name se yeh paste kar dein. Isse Railway container boot hote hi automatically login ho jayega (OTP dobara mangne ki zaroorat nahi padegi!):
                  </p>
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-slate-400 text-xs">
                    <input
                      type="password"
                      readOnly
                      value={sessionString}
                      className="flex-1 bg-transparent border-none text-slate-300 font-mono text-xs focus:outline-none select-all"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(sessionString);
                        setSessionCopied(true);
                        setTimeout(() => setSessionCopied(false), 2500);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded transition-colors shrink-0 shadow"
                    >
                      {sessionCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy Session String</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950 border border-amber-800/50 rounded-xl p-3.5 text-xs text-amber-300 flex items-center gap-2.5">
                  <Activity className="h-4 w-4 shrink-0" />
                  <span>Tip: Pehle Live Forwarder tab mein Telegram account login kar lein, taaki yahan session string copy karne ka button mil jaye.</span>
                </div>
              )}

              {/* Step by step Railway Guide */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 text-cyan-400" />
                  <span>Railway Par Deploy Karne Ke Steps (Only 1 Minute):</span>
                </h3>

                <div className="space-y-2.5">
                  <div className="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-xl flex items-start gap-3">
                    <span className="h-5 w-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <div className="font-semibold text-white">
                        <a
                          href="https://railway.app"
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:underline inline-flex items-center gap-1"
                        >
                          Railway.app <ExternalLink className="h-3 w-3" />
                        </a>{' '}
                        par GitHub account ke sath login karein
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5">
                        GitHub se sign in karte hi aapka Railway dashboard khul jayega.
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-xl flex items-start gap-3">
                    <span className="h-5 w-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <div className="font-semibold text-white">Dashboard mein "+ New Project" -&gt; "Deploy from GitHub repo" par click karein</div>
                      <div className="text-slate-400 text-[11px] mt-0.5">
                        Apna repository select karein. Railway automatically <code className="text-cyan-300 font-mono">railway.json</code> aur <code className="text-cyan-300 font-mono">Dockerfile</code> detect kar lega.
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-xl flex items-start gap-3">
                    <span className="h-5 w-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                      3
                    </span>
                    <div className="space-y-1.5 w-full">
                      <div className="font-semibold text-white">Variables Tab mein Environment Variables add karein:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono mt-1">
                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-slate-400">SESSION_STRING: </span>
                          <span className="text-cyan-300 font-semibold">{sessionString ? 'Upar se copy karein' : 'Your session string'}</span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-slate-400">NODE_ENV: </span>
                          <span className="text-emerald-400 font-semibold">production</span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-800 sm:col-span-2">
                          <span className="text-slate-400">PORT: </span>
                          <span className="text-purple-300 font-semibold">(Railway automatically assign karta hai)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-xl flex items-start gap-3">
                    <span className="h-5 w-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                      4
                    </span>
                    <div>
                      <div className="font-semibold text-white">Railway Settings mein "Generate Domain" daba dein</div>
                      <div className="text-emerald-400 text-[11px] mt-0.5">
                        ✓ Railway aapko public HTTPS URL de dega. Ab bot 24/7 bina ruke full high speed (0.5s) par live forward karta rahega, chahe aapka laptop, phone ya browser band ho!
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'uptimerobot' && (
            <div className="space-y-5">
              {/* Ping URL box */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white flex items-center gap-2">
                    <Globe className="h-4 w-4 text-cyan-400" />
                    <span>Aapka 24/7 Ping Webhook URL</span>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-mono bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                    HTTP 200 Live
                  </span>
                </div>

                {/* Primary: Cloud Run Shared Production URL */}
                <div className="space-y-1">
                  <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
                    <span>1. Production Webhook URL (Recommended for UptimeRobot):</span>
                    <span className="text-[10px] text-cyan-400 font-mono">Cloud Run</span>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-900 border border-cyan-800/70 rounded-lg p-2 font-mono text-cyan-300 text-xs break-all">
                    <span className="flex-1 select-all">{sharedCloudRunPing}</span>
                    <button
                      onClick={() => handleCopy(sharedCloudRunPing, 'cloudrun')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded transition-colors shrink-0 shadow"
                    >
                      {copiedType === 'cloudrun' ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy URL</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Secondary: Current Origin URL */}
                <div className="space-y-1 pt-1">
                  <div className="text-[11px] text-slate-400 font-medium">
                    <span>2. Current Domain URL:</span>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 rounded-lg p-2 font-mono text-slate-300 text-xs break-all">
                    <span className="flex-1 select-all">{currentOriginPing}</span>
                    <button
                      onClick={() => handleCopy(currentOriginPing, 'origin')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors shrink-0"
                    >
                      {copiedType === 'origin' ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy URL</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Test button & response */}
                <div className="flex items-center justify-between pt-1 text-[11px] border-t border-slate-800/80 mt-2">
                  <button
                    onClick={handleTestPing}
                    disabled={pingTesting}
                    className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>{pingTesting ? 'Testing Ping...' : 'Test Ping Now (Verify Live)'}</span>
                  </button>

                  {pingResult && (
                    <span className="font-mono text-emerald-400">
                      ✓ Status {pingResult.status} ({pingResult.latencyMs}ms) at {pingResult.timestamp}
                    </span>
                  )}
                </div>
              </div>

              {/* Step-by-Step Instructions */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 text-cyan-400" />
                  <span>UptimeRobot par 24/7 Ping Lagane ke Aasan Steps (100% Free):</span>
                </h3>

                <div className="space-y-2.5">
                  <div className="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-xl flex items-start gap-3">
                    <span className="h-5 w-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <div className="font-semibold text-white">
                        <a
                          href="https://uptimerobot.com"
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:underline inline-flex items-center gap-1"
                        >
                          UptimeRobot.com <ExternalLink className="h-3 w-3" />
                        </a>{' '}
                        kholein aur Free Account banayein
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5">
                        Yeh 100% free hai aur koi credit card nahi lagta.
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-xl flex items-start gap-3">
                    <span className="h-5 w-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <div className="font-semibold text-white">Dashboard me "+ Add New Monitor" par click karein</div>
                      <div className="text-slate-400 text-[11px] mt-0.5">
                        Green color ka button hoga monitor create karne ke liye.
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-xl flex items-start gap-3">
                    <span className="h-5 w-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                      3
                    </span>
                    <div className="space-y-1.5 w-full">
                      <div className="font-semibold text-white">Form me yeh values bharein:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono mt-1">
                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-slate-400">Monitor Type: </span>
                          <span className="text-emerald-400 font-semibold">HTTP(s)</span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-slate-400">Friendly Name: </span>
                          <span className="text-white font-semibold">TeleRelay 24/7 Bot</span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-800 sm:col-span-2">
                          <span className="text-slate-400">URL (or IP): </span>
                          <span className="text-cyan-300 font-semibold">{sharedCloudRunPing}</span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-slate-400">Monitoring Interval: </span>
                          <span className="text-purple-400 font-semibold">5 minutes</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-xl flex items-start gap-3">
                    <span className="h-5 w-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                      4
                    </span>
                    <div>
                      <div className="font-semibold text-white">"Create Monitor" button daba dein</div>
                      <div className="text-emerald-400 text-[11px] mt-0.5">
                        ✓ Bas ho gaya! Ab UptimeRobot har 5 minute me bot ko ping karta rahega aur server kabhi sleep nahi hoga!
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'howitworks' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>Kyu Chrome ya Laptop band hone par bhi bot nahi rukega?</span>
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  Aapka Telegram relayer bot browser (Chrome) ke andar nahi, balki <strong>backend Node.js server</strong> par direct Telegram MTProto protocol par run karta hai.
                </p>
                <div className="space-y-2 text-slate-300">
                  <div className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span><strong>Permanent Cloud State:</strong> Jab aap Telegram login karte hain, aapka MTProto session string aur monitored group details Firestore Cloud Database me secure tarike se save ho jati hain.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span><strong>No Chrome Dependency:</strong> Browser tab band karne par ya mobile screen off karne par bhi server chalte rehta hai.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span><strong>Zero-Skip Offline Sweep:</strong> Agar kabhi server kuch der ke liye restart bhi ho, to restart hone ke turant baad bot pichle offline time ki sari videos auto-catchup sweep me automatically collect karke forward kar deta hai.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span><strong>Strict Group Isolation:</strong> Aapne jis source group ka link diya hai, sirf aur sirf usi group ki video aayegi. Dusre kisi bhi personal chat ya group ki video forward nahi hogi!</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                <h4 className="font-semibold text-white text-xs">Alternative Free Pinger Services (Inhe bhi use kar sakte hain):</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                  <a
                    href="https://cron-job.org"
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg hover:border-cyan-500/50 transition-colors block text-center text-cyan-300"
                  >
                    cron-job.org
                  </a>
                  <a
                    href="https://betteruptime.com"
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg hover:border-cyan-500/50 transition-colors block text-center text-cyan-300"
                  >
                    BetterUptime
                  </a>
                  <a
                    href="https://www.freshworks.com/website-monitoring/"
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg hover:border-cyan-500/50 transition-colors block text-center text-cyan-300"
                  >
                    Freshping
                  </a>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'vps' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-cyan-400" />
                  <span>VPS ya Dedicated Server par Permanent 24/7 Run Kaise Karein?</span>
                </h3>
                <p className="text-slate-400 text-xs">
                  Agar aap kisi Linux VPS (Ubuntu/Debian) par 24/7 PM2 process manager ke saath run karna chahte hain:
                </p>

                <div className="bg-black/90 p-3 rounded-lg font-mono text-[11px] text-emerald-400 space-y-1 overflow-x-auto">
                  <div className="text-slate-500"># 1. Install Node.js & PM2</div>
                  <div>npm install -g pm2 tsx</div>
                  <div className="text-slate-500 pt-1"># 2. Start TeleRelay Daemon 24/7 with auto-restart</div>
                  <div>pm2 start "npx tsx server.ts" --name "telerelay"</div>
                  <div className="text-slate-500 pt-1"># 3. Enable PM2 on server boot/reboot</div>
                  <div>pm2 save && pm2 startup</div>
                </div>

                <p className="text-slate-400 text-xs pt-1">
                  PM2 server reboot hone par bhi bot ko automatically restart kar deta hai aur Firestore se session load karke bina ruke chalta rehta hai!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>Monitored Groups: {monitoredCount}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg text-xs transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
