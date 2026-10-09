import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { relayManager } from './server/telegramManager.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== PROCESS CRASH SHIELDS ====================
process.on('unhandledRejection', (reason: any) => {
  const msg = reason?.message || String(reason);
  if (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded')
  ) {
    relayManager.triggerFirestoreCircuitBreaker();
    console.warn('[TeleRelay Handled Network/Quota Warning]', msg);
  } else if (
    msg.includes('TIMEOUT') ||
    msg.includes('Cannot send requests while disconnected') ||
    msg.includes('AUTH_KEY_DUPLICATED') ||
    msg.includes('connection closed')
  ) {
    console.warn('[TeleRelay Handled Network/Quota Warning]', msg);
    // If it's a persistent timeout or connection issue, let the manager check health
    if (msg.includes('TIMEOUT') || msg.includes('disconnected')) {
      (relayManager as any).checkConnectionHealth?.().catch(() => {});
    }
  } else {
    console.error('[TeleRelay Unhandled Rejection]', reason);
  }
});

process.on('uncaughtException', (err: any) => {
  const msg = err?.message || String(err);
  console.error('[TeleRelay Handled Uncaught Exception]', msg);
});

process.on('SIGTERM', () => {
  console.log('[TeleRelay Server] SIGTERM signal received. Graceful shutdown...');
  process.exit(0);
});

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // Mount static thumbnails directory
  const thumbnailsDir = path.join(process.cwd(), 'data', 'thumbnails');
  if (!fs.existsSync(thumbnailsDir)) {
    fs.mkdirSync(thumbnailsDir, { recursive: true });
  }
  app.use('/thumbnails', express.static(thumbnailsDir));

  // ==================== PING / HEALTH CHECK FOR 24/7 UPTIME ====================

  app.all(['/api/ping', '/ping', '/health'], (_req: Request, res: Response) => {
    const queueStats = relayManager.getQueueStats();
    const dest = relayManager.getDestinationConfig();
    const user = relayManager.getUserState();
    return res.json({
      success: true,
      service: 'TeleRelay 24/7 MTProto Cloud Forwarder',
      status: 'active',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      listenerActive: relayManager.isListenerActive(),
      isReconnecting: Boolean((relayManager as any).isReconnecting),
      isLoggedIn: user.isLoggedIn,
      user: user.user?.firstName || (user.isLoggedIn ? 'Connected' : 'Disconnected'),
      monitoredGroupsCount: relayManager.getMonitoredGroups().length,
      destinationChannel: dest.channelTitle || dest.channelInput || 'Unset',
      queueStats: {
        totalRelayed: queueStats.totalRelayed,
        pendingCount: queueStats.pendingCount,
        isProcessing: queueStats.isProcessing,
      },
      firestore: {
        quotaExceeded: relayManager.isQuotaExceeded(),
        storageMode: relayManager.isQuotaExceeded() ? 'local_disk' : 'cloud_firestore',
        quotaInfo: relayManager.getQuotaInfo(),
      },
    });
  });

  // ==================== MASTER PASSWORD & SINGLE-USER SESSION ====================
  let activeMasterSessionId: string | null = null;
  let lastMasterHeartbeat: number = 0;

  app.post('/api/auth/verify-password', (req: Request, res: Response) => {
    const { password, clientSessionId } = req.body;
    if (password !== 'satishproo816') {
      return res.status(401).json({ success: false, error: 'Incorrect Master Password! Access Denied.' });
    }

    const now = Date.now();
    if (activeMasterSessionId && activeMasterSessionId !== clientSessionId && (now - lastMasterHeartbeat < 40000)) {
      return res.status(403).json({
        success: false,
        error: '⚠️ Another user is already logged in! Single user access only. Please wait until their active session disconnects.'
      });
    }

    activeMasterSessionId = clientSessionId || Math.random().toString(36).substring(2);
    lastMasterHeartbeat = now;
    return res.json({ success: true, sessionId: activeMasterSessionId });
  });

  app.post('/api/auth/heartbeat', (req: Request, res: Response) => {
    const { clientSessionId } = req.body;
    const now = Date.now();
    if (activeMasterSessionId && clientSessionId && activeMasterSessionId === clientSessionId) {
      lastMasterHeartbeat = now;
      return res.json({ success: true });
    }
    return res.json({ success: false, error: 'Session expired or overridden' });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const { clientSessionId } = req.body;
    if (!clientSessionId || clientSessionId === activeMasterSessionId) {
      activeMasterSessionId = null;
      lastMasterHeartbeat = 0;
    }
    return res.json({ success: true });
  });

  // ==================== REAL TELEGRAM USER AUTH ENDPOINTS ====================

  // 1. Send OTP Code to user's real Telegram phone number
  app.post('/api/telegram/real-auth/send-code', async (req: Request, res: Response) => {
    try {
      const { phoneNumber, apiId, apiHash } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ success: false, error: 'Phone number is required' });
      }

      const result = await relayManager.sendLoginCode(
        phoneNumber,
        apiId ? Number(apiId) : undefined,
        apiHash
      );

      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Verify OTP Code and login
  app.post('/api/telegram/real-auth/verify-code', async (req: Request, res: Response) => {
    try {
      const { code, twoFactorPassword } = req.body;
      if (!code && twoFactorPassword) {
        const result = await relayManager.verify2FAPassword(twoFactorPassword);
        return res.json(result);
      }

      if (!code) {
        return res.status(400).json({ success: false, error: 'Verification code is required' });
      }

      const result = await relayManager.verifyLoginCode(code, twoFactorPassword);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2b. Two-Step Verification (2FA) Password submission
  app.post('/api/telegram/real-auth/verify-2fa', async (req: Request, res: Response) => {
    try {
      const { password } = req.body;
      if (!password || typeof password !== 'string') {
        return res.status(400).json({ success: false, error: '2-step password is required' });
      }

      const result = await relayManager.verify2FAPassword(password);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2c. Restore session from saved session string
  app.post('/api/telegram/real-auth/restore-session', async (req: Request, res: Response) => {
    try {
      const { sessionString } = req.body;
      if (!sessionString || typeof sessionString !== 'string') {
        return res.status(400).json({ success: false, error: 'sessionString is required' });
      }

      const result = await relayManager.reconnectFromSessionString(sessionString);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Logout
  app.post('/api/telegram/real-auth/logout', async (_req: Request, res: Response) => {
    try {
      const result = await relayManager.logout();
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Get overall status
  app.get('/api/telegram/status', async (_req: Request, res: Response) => {
    return res.json({
      success: true,
      userState: relayManager.getUserState(),
      destinationConfig: relayManager.getDestinationConfig(),
      captionConfig: relayManager.getCaptionConfig(),
      monitoredGroups: relayManager.getMonitoredGroups(),
      isListening: relayManager.isListenerActive(),
      relayedVideos: relayManager.getRelayedVideos(),
      queueLength: relayManager.getQueueLength(),
      activeCount: relayManager.getActiveCount(),
      queueStats: relayManager.getQueueStats(),
      lastHealthCheck: (relayManager as any).lastHealthCheck,
      firestore: relayManager.getQuotaInfo(),
      logs: relayManager.getLogs().slice(0, 40),
    });
  });

  // 4b. Catch-up sweep: scans monitored groups for videos posted while offline
  app.post('/api/telegram/catch-up', async (_req: Request, res: Response) => {
    try {
      const result = await relayManager.catchUpMissedMessages();
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4c. Simulate burst upload (10, 20, 100 videos) to test zero-skip queue
  app.post('/api/telegram/simulate-burst', async (req: Request, res: Response) => {
    try {
      const { count = 10 } = req.body;
      const result = await relayManager.simulateBurstUpload(Number(count));
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4d. Configure Anti-Flood pacing rhythm
  app.post('/api/telegram/pacing-speed', (req: Request, res: Response) => {
    try {
      const { seconds } = req.body;
      const updated = relayManager.setPacingSpeed(Number(seconds));
      return res.json({ success: true, pacingSpeedSec: updated });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  // 4e. Reset Telegram Flood Wait Protection & Re-engage 0.5s Turbo
  app.post('/api/telegram/flood-wait/reset', (_req: Request, res: Response) => {
    try {
      const result = relayManager.resetFloodWait();
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4b. Get relayed videos history
  app.get('/api/telegram/relayed-videos', (_req: Request, res: Response) => {
    return res.json({
      success: true,
      videos: relayManager.getRelayedVideos(),
    });
  });

  // ==================== DESTINATION CHANNEL (NO BOT) ====================

  // Fetch user's channels from Telegram dialogs for 1-click selection
  app.get('/api/telegram/destination/channels', async (_req: Request, res: Response) => {
    try {
      const channels = await relayManager.getUserChannels();
      return res.json({ success: true, channels });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Verify destination channel permissions
  app.post('/api/telegram/destination/verify', async (req: Request, res: Response) => {
    try {
      const { channelInput } = req.body;
      if (!channelInput) {
        return res.status(400).json({ success: false, error: 'Channel link or username is required' });
      }

      const result = await relayManager.verifyDestinationChannel(channelInput);
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  // Test video relay: checks like video properly channel mai share to hora hai
  app.post('/api/telegram/destination/test-relay', async (req: Request, res: Response) => {
    try {
      const { channelInput, caption } = req.body;
      const result = await relayManager.testRelayToChannel(channelInput, caption);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==================== CAPTION RULES CONFIGURATION ====================

  app.get('/api/telegram/caption-config', (_req: Request, res: Response) => {
    return res.json({ success: true, config: relayManager.getCaptionConfig() });
  });

  app.post('/api/telegram/caption-config', (req: Request, res: Response) => {
    try {
      const config = relayManager.setCaptionConfig(req.body);
      return res.json({ success: true, config });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  // ==================== SOURCE GROUPS MANAGEMENT ====================

  app.post('/api/telegram/source-groups/add', async (req: Request, res: Response) => {
    try {
      const { groupLink } = req.body;
      if (!groupLink) {
        return res.status(400).json({ success: false, error: 'Group link is required' });
      }

      const result = await relayManager.addSourceGroup(groupLink);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/telegram/source-groups/remove', async (req: Request, res: Response) => {
    try {
      const { id } = req.body;
      const result = relayManager.removeSourceGroup(id);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/telegram/source-groups/clear-all', async (_req: Request, res: Response) => {
    try {
      const result = relayManager.clearAllSourceGroups();
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==================== FIRESTORE CIRCUIT BREAKER MANAGEMENT ====================

  app.post('/api/firestore/clear-circuit', (_req: Request, res: Response) => {
    relayManager.clearFirestoreCircuitBreaker();
    return res.json({ success: true, message: 'Firestore circuit breaker reset.' });
  });

  // ==================== QUEUE CLEAR ENDPOINT ====================

  app.post('/api/telegram/queue/clear', (_req: Request, res: Response) => {
    const result = relayManager.clearQueue();
    return res.json(result);
  });

  // ==================== FORCE RESTART LISTENER ====================

  app.post('/api/telegram/listener/restart', async (_req: Request, res: Response) => {
    try {
      const state = relayManager.getUserState();
      if (!state.sessionString) {
        return res.status(400).json({ success: false, error: 'No active session to restart' });
      }
      const result = await relayManager.reconnectFromSessionString(state.sessionString);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==================== LOGS ENDPOINT ====================

  app.get('/api/telegram/pipeline/logs', (_req: Request, res: Response) => {
    return res.json({ success: true, logs: relayManager.getLogs() });
  });

  // Mount Vite development middlewares or serve static assets
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TeleRelay server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
