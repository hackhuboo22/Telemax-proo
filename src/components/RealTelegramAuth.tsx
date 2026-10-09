import React, { useState } from 'react';
import {
  Smartphone,
  KeyRound,
  Lock,
  CheckCircle2,
  AlertCircle,
  LogOut,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff,
  HelpCircle,
} from 'lucide-react';
import { TelegramUserState } from '../types/telegram';

interface RealTelegramAuthProps {
  userState: TelegramUserState;
  onRefreshStatus: () => void;
}

export const RealTelegramAuth: React.FC<RealTelegramAuthProps> = ({
  userState,
  onRefreshStatus,
}) => {
  const [phoneNumber, setPhoneNumber] = useState(userState.phoneNumber || '');
  const [useCustomApi, setUseCustomApi] = useState(false);
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');

  // Authentication steps
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [passwordHint, setPasswordHint] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Step 1: Send Telegram OTP
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      setFeedback({
        type: 'error',
        message: 'Please enter your Telegram phone number with country code (e.g. +91XXXXXXXXXX).',
      });
      return;
    }

    setLoading(true);
    setFeedback(null);
    setRequires2FA(false);
    setPasswordHint(null);

    try {
      const res = await fetch('/api/telegram/real-auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          apiId: useCustomApi && apiId.trim() ? apiId.trim() : undefined,
          apiHash: useCustomApi && apiHash.trim() ? apiHash.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsCodeSent(true);
        setFeedback({
          type: 'success',
          message: data.message || 'OTP code sent! Check the official "Telegram" chat inside your Telegram app.',
        });
      } else {
        const errorMsg = data.error || 'Failed to send verification code.';
        
        // Handle Telegram Flood Wait specifically
        if (errorMsg.includes('wait of') && errorMsg.includes('seconds is required')) {
          const secondsMatch = errorMsg.match(/wait of (\d+) seconds/i);
          if (secondsMatch && secondsMatch[1]) {
            const seconds = parseInt(secondsMatch[1], 10);
            const minutes = Math.ceil(seconds / 60);
            const hours = (seconds / 3600).toFixed(1);
            
            let timeStr = `${seconds} seconds`;
            if (seconds > 3600) timeStr = `${hours} hours`;
            else if (seconds > 60) timeStr = `${minutes} minutes`;
            
            setFeedback({ 
              type: 'error', 
              message: `Telegram Flood Wait: You must wait ${timeStr} before requesting another code. Please try again later.` 
            });
            return;
          }
        }
        
        setFeedback({ type: 'error', message: errorMsg });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Network error while contacting server.' });
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      setFeedback({ type: 'error', message: 'Please enter the 5-digit verification code.' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/telegram/real-auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: otpCode.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.sessionString) {
          localStorage.setItem('telegram_session_string', data.sessionString);
        }
        setFeedback({ type: 'success', message: 'Telegram account logged in successfully via MTProto!' });
        setIsCodeSent(false);
        setOtpCode('');
        setRequires2FA(false);
        onRefreshStatus();
      } else if (data.requires2FA) {
        setRequires2FA(true);
        if (data.hint) {
          setPasswordHint(data.hint);
        }
        setFeedback({
          type: 'error',
          message: 'Two-Step Verification (2FA) is enabled on this account. Enter your cloud password below.',
        });
      } else {
        setFeedback({ type: 'error', message: data.error || 'Invalid verification code.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Verification failed.' });
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Verify 2FA Cloud Password
  const handleVerify2FAPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorPassword.trim()) {
      setFeedback({
        type: 'error',
        message: 'Please enter your Two-Step Verification (2-Step Setup) password.',
      });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/telegram/real-auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: twoFactorPassword.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.sessionString) {
          localStorage.setItem('telegram_session_string', data.sessionString);
        }
        setFeedback({
          type: 'success',
          message: '2-Step Verification password verified! Successfully logged in!',
        });
        setIsCodeSent(false);
        setRequires2FA(false);
        setTwoFactorPassword('');
        setOtpCode('');
        onRefreshStatus();
      } else {
        setFeedback({
          type: 'error',
          message: data.error || data.message || 'Incorrect 2-step verification password. Please try again.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error communicating with Telegram 2FA service.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    setLoading(true);
    localStorage.removeItem('telegram_session_string');
    try {
      await fetch('/api/telegram/real-auth/logout', { method: 'POST' });
      setFeedback({ type: 'success', message: 'Logged out of Telegram session.' });
      setIsCodeSent(false);
      setRequires2FA(false);
      setTwoFactorPassword('');
      setOtpCode('');
      onRefreshStatus();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-slate-800 bg-slate-900/40 rounded-xl p-5 sm:p-6 space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
            <Smartphone className="h-4 w-4 text-cyan-400" />
            <span>Real Telegram Account Login (MTProto)</span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60 font-normal">
              Zero Env Variables Needed · Built-in Client
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Login directly to your Telegram account. No .env setup required — built-in official Telegram credentials run 100% plug & play.
          </p>
        </div>

        {userState.isLoggedIn && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </span>
            <button
              onClick={handleLogout}
              disabled={loading}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded border border-rose-900/40 transition-colors"
            >
              <LogOut className="h-3 w-3" />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/50 border border-emerald-800/80 text-emerald-200'
              : 'bg-rose-950/50 border border-rose-800/80 text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Logged-in state display */}
      {userState.isLoggedIn && userState.user ? (
        <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-cyan-950 border border-cyan-800/80 flex items-center justify-center text-cyan-300 font-bold text-lg">
              {userState.user.firstName ? userState.user.firstName[0].toUpperCase() : 'T'}
            </div>
            <div>
              <div className="text-sm font-semibold text-white">
                {userState.user.firstName} {userState.user.lastName || ''}
              </div>
              <div className="text-xs text-cyan-400 font-mono">
                @{userState.user.username || 'no_username'}
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                Phone: {userState.user.phone || userState.phoneNumber} · User ID: {userState.user.id}
              </div>
            </div>
          </div>

          <div className="text-right text-xs text-slate-400 sm:border-l sm:border-slate-800 sm:pl-4">
            <div className="text-slate-300 font-medium">Session Status</div>
            <div className="text-emerald-400 font-mono text-[11px] mt-0.5">
              Authorized MTProto Client
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Ready to monitor videos in your groups
            </div>
          </div>
        </div>
      ) : (
        /* Login flow forms */
        <div className="space-y-4">
          {!isCodeSent ? (
            /* Step 1: Phone input */
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Telegram Phone Number <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="+919876543210 (include country code)"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none transition-colors"
                  />
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Example: <code className="text-slate-400">+91XXXXXXXXXX</code> for India, <code className="text-slate-400">+1XXXXXXXXXX</code> for US
                </span>
              </div>

              {/* Optional Custom API ID/Hash toggle */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setUseCustomApi(!useCustomApi)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 underline block"
                >
                  {useCustomApi
                    ? '▼ Use default official Telegram API keys'
                    : '▶ Advanced: Use custom API ID & Hash from my.telegram.org'}
                </button>

                {useCustomApi && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5 p-3 bg-slate-950/80 rounded-lg border border-slate-800">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Custom API ID</label>
                      <input
                        type="text"
                        placeholder="e.g. 2040"
                        value={apiId}
                        onChange={(e) => setApiId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Custom API Hash</label>
                      <input
                        type="text"
                        placeholder="e.g. b18441a1ff607e10a989891a5462e627"
                        value={apiHash}
                        onChange={(e) => setApiHash(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Connecting to Telegram MTProto...</span>
                  </>
                ) : (
                  <>
                    <span>Send Telegram Login Code (OTP)</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>
          ) : requires2FA ? (
            /* Step 3: Two-Step Verification (2FA Cloud Password) */
            <form onSubmit={handleVerify2FAPassword} className="space-y-4">
              <div className="p-3.5 bg-amber-950/40 border border-amber-700/60 rounded-xl text-xs text-amber-200 space-y-1">
                <div className="font-semibold text-amber-100 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-amber-400" />
                  <span>Two-Step Verification (2-Setup Password Required)</span>
                </div>
                <div className="text-[11px] text-amber-300/90 leading-relaxed">
                  Aapke Telegram account par Two-Step Cloud Password set hai. Apna password daal kar login complete kijiye.
                </div>
                {passwordHint && (
                  <div className="pt-1.5 border-t border-amber-800/40 text-[11px] text-amber-300 font-mono">
                    💡 Password Hint from Telegram: <strong className="text-white">"{passwordHint}"</strong>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Enter 2-Step Cloud Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your Telegram 2FA cloud password"
                    value={twoFactorPassword}
                    onChange={(e) => setTwoFactorPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-cyan-500 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder:text-slate-600 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Click the eye icon to verify you typed your password correctly.
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRequires2FA(false);
                    setIsCodeSent(false);
                    setTwoFactorPassword('');
                  }}
                  className="px-3 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                >
                  Change Number
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Verifying 2-Step Password...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit 2-Step Password & Log In</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Step 2: Code Verification */
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="p-3 bg-cyan-950/30 border border-cyan-800/50 rounded-lg text-xs text-cyan-200">
                📲 Telegram verification code has been sent to{' '}
                <strong className="font-mono text-white">{phoneNumber}</strong>.
                Check your Telegram app chat screen!
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Enter 5-Digit Verification Code (OTP) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 12345"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  maxLength={6}
                  className="w-full bg-slate-950 border border-cyan-500 rounded-lg px-3 py-2 text-base text-center font-mono tracking-widest text-cyan-300 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCodeSent(false)}
                  className="px-3 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                >
                  Change Number
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Verifying Code...</span>
                    </>
                  ) : (
                    <span>Submit Verification Code</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
