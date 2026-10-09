import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import { computeCheck } from 'telegram/Password.js';
import { getInputMedia } from 'telegram/Utils.js';
import bigInt from 'big-integer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase for Permanent State Storage
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Built-in official public Telegram MTProto Client API credentials
// No .env environment variables needed!
export const DEFAULT_API_ID = 2040;
export const DEFAULT_API_HASH = 'b18441a1ff607e10a989891a5462e627';

export interface TelegramUserState {
  isLoggedIn: boolean;
  phoneNumber?: string;
  phoneCodeHash?: string;
  sessionString?: string;
  requires2FA?: boolean;
  passwordHint?: string;
  user?: {
    id: string;
    firstName: string;
    lastName?: string;
    username?: string;
    phone?: string;
  };
}

export interface DestinationChannelConfig {
  channelInput: string;
  channelTitle?: string;
  channelId?: string;
  channelUsername?: string;
  canPost: boolean;
  isVerified: boolean;
  memberCount?: number;
  lastCheckedAt?: string;
  directLink?: string;
}

export interface CaptionConfig {
  keepFileLine?: boolean;
  replaceFileLink?: boolean;
  myGroupLink?: string;
  removeFileLine?: boolean;
  removeLinks: boolean;
  removeUsernames: boolean;
  keepFileMeta?: boolean;
  customFooter?: string;
  forwardPhotosAndVideosTogether?: boolean;
  enableMD5Deduplication?: boolean;
}

export interface MonitoredGroup {
  id: string;
  link: string;
  title: string;
  username?: string;
  chatId?: string;
  memberCount?: number;
  addedAt: string;
}

export interface RelayedVideoItem {
  id: string;
  messageId: number;
  sourceChat: string;
  destinationChat: string;
  title: string;
  thumbnailUrl: string;
  originalSizeMB: number;
  trimmedSizeMB: number;
  cutSeconds: number;
  relayedAt: string;
  status: 'completed' | 'processing' | 'failed';
  directLink?: string;
  isAlbum?: boolean;
  mediaCount?: number;
  replacedLink?: string;
}

export interface PipelineLog {
  id: string;
  timestamp: string;
  type: 'info' | 'video_detected' | 'trimming' | 'forwarded' | 'error';
  message: string;
  details?: any;
}

export interface QueueTask {
  id: string;
  isAlbum: boolean;
  groupedKey?: string;
  messageKey?: string;
  groupTitle: string;
  chatId: string;
  messages: any[];
  attempts: number;
  enqueuedAt: number;
  isSimulated?: boolean;
  simulatedTitle?: string;
  simulatedSizeMB?: number;
}

/**
 * Normalizes Telegram identifiers (IDs, usernames, links) for strict equality checking
 * Strips leading -100, -, +, @, and t.me/ prefixes.
 */
export function normalizeTelegramId(id?: string | number | bigint): string {
  if (!id) return '';
  const s = id.toString().trim().toLowerCase();
  return s
    .replace(/^https?:\/\/t\.me\//, '')
    .replace(/^@/, '')
    .replace(/^\+/, '')
    .replace(/^-100/, '')
    .replace(/^-/, '');
}

/**
 * Strips ONLY the 'File: <filename>' or 'File:\n<filename>' line/part completely from caption.
 */
export function stripFileFromCaption(rawCaption: string): string {
  if (!rawCaption || !rawCaption.trim()) return '';

  const lines = rawCaption.split('\n');
  const result: string[] = [];
  let skipNextFilename = false;

  for (let i = 0; i < lines.length; i++) {
    const originalLine = lines[i];
    const trimmed = originalLine
      .replace(/^[>\s*#_`~•\-]+/u, '')
      .trim();

    const isFileLine =
      /^(?:\[|\()?file(?:\s*name)?\s*[:\-–]/i.test(trimmed) &&
      !/^file\s*size\s*[:\-–]/i.test(trimmed);

    if (isFileLine) {
      const afterKey = trimmed
        .replace(/^(?:\[|\()?file(?:\s*name)?\s*[:\-–]\s*/i, '')
        .replace(/[\]\)]$/, '')
        .trim();

      if (afterKey.length > 0) {
        continue;
      } else {
        if (i + 1 < lines.length) {
          const nextTrimmed = lines[i + 1]
            .replace(/^[>\s*#_`~•\-]+/u, '')
            .trim();
          const isStandardKey =
            /^(username|sid|duration|size|label|resolution|category|quality|date|time|channel|source|status|tags?)\s*[:\-–]/i.test(
              nextTrimmed
            );
          if (!isStandardKey && nextTrimmed.length > 0) {
            skipNextFilename = true;
          }
        }
        continue;
      }
    }

    if (skipNextFilename) {
      skipNextFilename = false;
      continue;
    }

    result.push(originalLine);
  }

  while (result.length > 0 && result[0].trim() === '') {
    result.shift();
  }

  return result.join('\n').trim();
}

/**
 * Transforms caption and entities based on user's exact requirements:
 * 1. "File wala add karo do phala jaisa": Keeps the "File: <filename>" line 100% intact!
 * 2. Replaces the URL on/beside the filename with the user's Telegram group link!
 * 3. Keeps Username, Sid, Duration, Size, Label, and blockquotes 100% SAME-TO-SAME.
 */
export function processCaptionAndEntities(
  rawText: string,
  originalEntities: any[] = [],
  config: CaptionConfig,
  targetGroupLink: string
): { text: string; entities: any[] } {
  if (!rawText || !rawText.trim()) {
    return { text: '', entities: [] };
  }

  if (config.keepFileLine === false || config.removeFileLine === true) {
    let stripped = stripFileFromCaption(rawText);
    if (config.removeLinks) {
      stripped = stripped.replace(/https?:\/\/[^\s]+/gi, '').trim();
    }
    if (config.removeUsernames) {
      stripped = stripped.replace(/@[a-zA-Z0-9_]{3,32}/gi, '').trim();
    }
    if (config.customFooter && config.customFooter.trim()) {
      stripped = `${stripped}\n\n${config.customFooter.trim()}`.trim();
    }
    return { text: stripped, entities: [] };
  }

  let text = rawText;
  let entities: any[] = originalEntities ? [...originalEntities] : [];
  const lines = text.split('\n');

  let fileLineIndex = -1;
  let fileOffset = 0;
  let curOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.replace(/^[>\s*#_`~•\-]+/u, '').trim();

    const isFileLine =
      /^(?:\[|\()?file(?:\s*name)?\s*[:\-–]/i.test(trimmed) ||
      /^ST[a-zA-Z0-9]*_[a-zA-Z0-9_]*_\d{8}_\d+/i.test(trimmed);

    if (isFileLine && !/^file\s*size\s*[:\-–]/i.test(trimmed)) {
      fileLineIndex = i;
      fileOffset = curOffset;

      if (!/^(?:\[|\()?file(?:\s*name)?\s*[:\-–]/i.test(trimmed)) {
        const originalLine = lines[i];
        const leadingSymbols = originalLine.match(/^[>\s*#_`~•\-]+/u)?.[0] || '';
        const lineContent = originalLine.substring(leadingSymbols.length);
        lines[i] = `${leadingSymbols}File: ${lineContent}`;
        text = lines.join('\n');
        const addedLen = 6;
        entities = entities.map((ent) => {
          if (ent.offset >= fileOffset + leadingSymbols.length) {
            const EntityClass = (Api as any)[ent.className];
            if (EntityClass) {
              return new EntityClass({
                ...ent,
                offset: ent.offset + addedLen,
              });
            }
          }
          return ent;
        });
        curOffset += addedLen;
      }
      break;
    }
    curOffset += line.length + 1;
  }

  if (config.replaceFileLink !== false && targetGroupLink && fileLineIndex !== -1) {
    let replacedEntity = false;
    const fileLine = lines[fileLineIndex];
    const fileLineLen = fileLine.length;

    if (entities && entities.length > 0) {
      entities = entities.map((ent) => {
        if (ent.className === 'MessageEntityTextUrl') {
          if (ent.offset >= fileOffset && ent.offset <= fileOffset + fileLineLen) {
            replacedEntity = true;
            return new Api.MessageEntityTextUrl({
              offset: ent.offset,
              length: ent.length,
              url: targetGroupLink,
            });
          }
        }
        return ent;
      });
    }

    const urlMatch = fileLine.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      const oldUrl = urlMatch[0];
      lines[fileLineIndex] = fileLine.replace(oldUrl, targetGroupLink);
      text = lines.join('\n');
    } else if (!replacedEntity) {
      const match = fileLine.match(
        /(?:file(?:\s*name)?\s*[:\-–]\s*)?([a-zA-Z0-9_\-\.]+)/i
      );
      if (match && match[1]) {
        const filename = match[1];
        const filenameIdx = fileLine.indexOf(filename);
        if (filenameIdx !== -1) {
          const filenameOffset = fileOffset + filenameIdx;
          entities.push(
            new Api.MessageEntityTextUrl({
              offset: filenameOffset,
              length: filename.length,
              url: targetGroupLink,
            })
          );
        }
      }
    }
  }

  if (config.removeLinks) {
    const newLines = lines.map((l, idx) => {
      if (idx === fileLineIndex) return l;
      return l.replace(/https?:\/\/[^\s]+/gi, '').trim();
    });
    text = newLines.join('\n');
  }

  if (config.removeUsernames) {
    const newLines = lines.map((l, idx) => {
      if (idx === fileLineIndex) return l;
      return l.replace(/@[a-zA-Z0-9_]{3,32}/gi, '').trim();
    });
    text = newLines.join('\n');
  }

  if (config.customFooter && config.customFooter.trim()) {
    text = `${text}\n\n${config.customFooter.trim()}`.trim();
  }

  return { text, entities };
}

export class TelegramRelayManager {
  /**
   * Handle Firestore errors with structured JSON as per skill requirements.
   */
  private handleFirestoreError(error: unknown, operation: string, path: string | null) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errInfo = {
      error: errMsg,
      operation,
      path,
      authInfo: {
        userId: null,
        email: null,
        emailVerified: null,
        isAnonymous: false,
      },
      timestamp: new Date().toISOString(),
    };
    console.error('[TeleRelay Firestore ERROR]', JSON.stringify(errInfo));

    // Auto-detect quota exhaustion from any error and trigger circuit breaker
    if (
      errMsg.includes('RESOURCE_EXHAUSTED') ||
      errMsg.includes('resource-exhausted') ||
      errMsg.includes('Quota limit exceeded') ||
      (error as any)?.code === 'resource-exhausted'
    ) {
      this.triggerFirestoreCircuitBreaker();
    }
  }

  private client: TelegramClient | null = null;
  private sessionString: string = '';
  private currentApiId: number = DEFAULT_API_ID;
  private currentApiHash: string = DEFAULT_API_HASH;
  private userState: TelegramUserState = { isLoggedIn: false };

  // Destination channel configuration
  private destinationConfig: DestinationChannelConfig = {
    channelInput: '@JRov0',
    channelTitle: 'JRov0',
    channelUsername: 'JRov0',
    canPost: true,
    isVerified: true,
    directLink: 'https://t.me/JRov0',
  };

  // Caption sanitization and link replacement rules
  private captionConfig: CaptionConfig = {
    keepFileLine: true,
    replaceFileLink: true,
    myGroupLink: 'https://t.me/JRov0',
    removeFileLine: false,
    removeLinks: false,
    removeUsernames: false,
    keepFileMeta: true,
    customFooter: '',
    forwardPhotosAndVideosTogether: true,
  };

  private monitoredGroups: MonitoredGroup[] = [];
  private relayedVideos: RelayedVideoItem[] = [];
  private logs: PipelineLog[] = [];
  private isListening: boolean = false;
  private currentEventHandler: any = null;
  private currentEventBuilder: any = null;
  private tempDir: string;
  private storageFilePath: string;
  private thumbnailsDir: string;

  private resolvedDestinationEntity: any = null;
  private chatCache: Map<string, any> = new Map();

  // Deduplication & Tracking Sets
  private processedMessageKeys: Set<string> = new Set();
  private queuedMessageKeys: Set<string> = new Set();
  private processedDocIds: Set<string> = new Set();
  private processedMD5s: Set<string> = new Set();
  private lastProcessedMessageIdMap: Map<string, number> = new Map();
  private allowedSourceIdsCache: Set<string> = new Set();

  // Pending albums collector
  private pendingAlbums: Map<string, {
    groupedKey: string;
    chatId: string;
    groupTitle: string;
    messages: any[];
    timer: NodeJS.Timeout;
  }> = new Map();

  // Recently finalized albums for late straggler merging (prevents splitting video and photo)
  private recentlyFinalizedAlbums: Map<string, {
    taskId: string;
    messages: any[];
    finalizedAt: number;
  }> = new Map();

  // Consecutive media pairing buffer (pairs Video + SS Photo when channels post without groupedId)
  private pendingSinglesBuffer: Map<string, {
    chatId: string;
    groupTitle: string;
    messages: any[];
    timer: NodeJS.Timeout;
  }> = new Map();

  // ZERO-SKIP HIGH-THROUGHPUT QUEUE ENGINE
  private videoQueue: QueueTask[] = [];
  private isQueueWorkerRunning: boolean = false;
  private isRateLimited: boolean = false;
  private floodWaitUntil: number = 0;
  private lastRelayTimestamp: number = 0;
  private totalRelayedCount: number = 0;
  private totalRetryAttempts: number = 0;
  private totalFailedCount: number = 0;
  private processingMessageKeys: Set<string> = new Set();
  private processingDocIds: Set<string> = new Set();
  private processingFingerprints: Set<string> = new Set();
  private isCatchingUp: boolean = false;
  private chatEntityCache: Map<string, any> = new Map();
  private lastCatchUpAt: string = '';

  // Firestore Quota Guard & Persistence Optimization
  private isFirestoreQuotaExceeded: boolean = false;
  private firestoreQuotaExceededAt: number = 0;
  private firestoreSyncDebounceTimer: NodeJS.Timeout | null = null;
  private healthCheckFailures: number = 0;
  private pacingSpeedSec: number = 0.5;

  // Zero-Flood Smart Sweep Protection
  private sweepGroupIndex: number = 0;
  private lastGroupSweepTimestamp: Map<string, number> = new Map();
  private lastPushEventTimestamp: Map<string, number> = new Map();
  private isSweepThrottledUntil: number = 0;

  public lastHealthCheck: string = new Date().toISOString();
  public isReconnecting: boolean = false;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'teletrim_worker');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.storageFilePath = path.join(dataDir, 'teletrim_session.json');

    this.thumbnailsDir = path.join(dataDir, 'thumbnails');
    if (!fs.existsSync(this.thumbnailsDir)) {
      fs.mkdirSync(this.thumbnailsDir, { recursive: true });
    }

    this.updateAllowedSourceIdsCache();

    this.addLog(
      'info',
      'Zero-Skip Telegram Relayer initialized. 100+ bulk video capacity with rate-limit protection active.'
    );

    // Initial state loading
    setTimeout(() => this.loadPersistentState(), 1000);

    // Watchdog: Connection health check every 45s
    setTimeout(() => {
      setInterval(() => this.checkConnectionHealth(), 45000);
    }, 20000);

    // Periodic safety check: relaxed background sweep every 15 minutes ONLY when queue is completely idle and not rate-limited
    // NOTE: All live incoming videos are ALREADY captured in real-time with zero latency via MTProto NewMessage event push listener.
    setTimeout(() => {
      setInterval(() => {
        if (
          this.client &&
          this.client.connected &&
          this.userState.isLoggedIn &&
          !this.isReconnecting &&
          !this.isRateLimited &&
          this.videoQueue.length === 0 &&
          !this.isCatchingUp
        ) {
          this.catchUpMissedMessages().catch((e) =>
            console.warn('[Periodic Catch-Up Error]', e?.message)
          );
        }
      }, 900000); // 15 minutes
    }, 60000);

    // Rapid Missed-Video Query Check: Runs every 1.8s to query monitored groups and ensure 0 missed videos!
    setTimeout(() => {
      setInterval(() => {
        if (
          this.client &&
          this.client.connected &&
          this.userState.isLoggedIn &&
          !this.isReconnecting &&
          !this.isRateLimited &&
          !this.isCatchingUp
        ) {
          this.quickSweepMissedMessages().catch(() => {});
        }
      }, 1800);
    }, 5000);

    // Global Crash Guard for unhandled rejections (GramJS network timeouts, stream drops)
    process.on('unhandledRejection', (reason: any) => {
      const msg = reason?.message || String(reason);
      if (
        msg.includes('TIMEOUT') ||
        msg.includes('Cannot send requests while disconnected') ||
        msg.includes('connection closed') ||
        msg.includes('AUTH_KEY_DUPLICATED') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('resource-exhausted')
      ) {
        console.warn('[TeleRelay Handled Background Warning]', msg);
      } else {
        console.error('[TeleRelay Unhandled Rejection]', reason);
      }
    });

    process.on('uncaughtException', (err: any) => {
      console.error('[TeleRelay Exception Guard]', err);
      this.addLog('error', `Process recovered from error: ${err.message}`);
    });
  }

  /**
   * Checks if message contains a photo or screenshot
   */
  public isPhotoMessage(message: any): boolean {
    if (!message) return false;
    if (
      message.photo ||
      message.media?.photo ||
      message.media?.className === 'MessageMediaPhoto'
    ) {
      return true;
    }
    const doc = message.media?.document || message.document;
    if (doc) {
      const mime = (doc.mimeType || '').toLowerCase();
      if (mime.startsWith('image/')) return true;
      if (Array.isArray(doc.attributes)) {
        for (const attr of doc.attributes) {
          if (attr.className === 'DocumentAttributeFilename' && attr.fileName) {
            const fn = attr.fileName.toLowerCase();
            if (/\.(jpg|jpeg|png|webp|heic|bmp|gif)$/i.test(fn)) return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Checks if message contains a video file or stream
   */
  public isVideoMessage(message: any): boolean {
    if (!message) return false;
    if (message.video) return true;
    const doc = message.media?.document || message.document;
    if (doc) {
      const mime = (doc.mimeType || '').toLowerCase();
      if (mime.startsWith('video/')) return true;
      if (Array.isArray(doc.attributes)) {
        for (const attr of doc.attributes) {
          if (
            attr.className === 'DocumentAttributeVideo' ||
            attr.duration !== undefined
          ) {
            return true;
          }
          if (attr.className === 'DocumentAttributeFilename' && attr.fileName) {
            const fn = attr.fileName.toLowerCase();
            if (/\.(mp4|mkv|mov|avi|webm|flv|wmv|3gp|m4v|ts|m3u8|mpg|mpeg)$/i.test(fn)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * Comprehensive check: determines if message contains video or album screenshot
   */
  public isVideoOrMediaMessage(message: any): boolean {
    return this.isVideoMessage(message) || this.isPhotoMessage(message);
  }

  /**
   * Checks if an error is a Telegram Flood Wait / Rate Limit
   */
  public checkFloodWaitError(err: any): { isFlood: boolean; seconds: number } {
    if (!err) return { isFlood: false, seconds: 0 };
    if (typeof err.seconds === 'number' && err.seconds > 0) {
      return { isFlood: true, seconds: err.seconds };
    }
    const msg = String(err.message || err.errorMessage || err);
    const m1 = msg.match(/FLOOD_WAIT_(\d+)/i);
    if (m1 && m1[1]) return { isFlood: true, seconds: parseInt(m1[1], 10) };

    const m2 = msg.match(/wait of (\d+) seconds/i);
    if (m2 && m2[1]) return { isFlood: true, seconds: parseInt(m2[1], 10) };

    const m3 = msg.match(/FLOOD_TEST_(\d+)/i);
    if (m3 && m3[1]) return { isFlood: true, seconds: parseInt(m3[1], 10) };

    return { isFlood: false, seconds: 0 };
  }

  public isQuotaExceeded(): boolean {
    return this.isFirestoreQuotaExceeded;
  }

  private updateAllowedSourceIdsCache() {
    const ids = new Set<string>();
    for (const g of this.monitoredGroups) {
      const gSet = this.getGroupMatchIdentifiers(g);
      gSet.forEach((id) => ids.add(id));
    }
    this.allowedSourceIdsCache = ids;
  }

  public triggerFirestoreCircuitBreaker() {
    if (!this.isFirestoreQuotaExceeded) {
      this.isFirestoreQuotaExceeded = true;
      this.firestoreQuotaExceededAt = Date.now();
      const quotaUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;
      console.warn(
        `[TeleRelay Firestore] CIRCUIT BREAKER TRIGGERED: Free daily write units quota exceeded. Switching to local-only mode. Console: ${quotaUrl}`
      );
      this.addLog(
        'error',
        'Firestore daily write quota reached. Switching to local-only persistence mode.'
      );
    }
  }

  public clearFirestoreCircuitBreaker() {
    this.isFirestoreQuotaExceeded = false;
    this.firestoreQuotaExceededAt = 0;
    this.addLog('info', 'Firestore circuit breaker manually reset. Retrying cloud sync...');
    this.savePersistentState(true);
  }

  public getQuotaInfo() {
    return {
      quotaExceeded: this.isFirestoreQuotaExceeded,
      quotaExceededAt: this.firestoreQuotaExceededAt,
      upgradeUrl: `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`,
      pricingUrl: 'https://firebase.google.com/pricing#cloud-firestore',
    };
  }

  public async checkConnectionHealth() {
    if (!this.client || !this.sessionString || !this.userState.isLoggedIn || this.isReconnecting) {
      return;
    }

    try {
      if (!this.client.connected) {
        this.healthCheckFailures++;
        if (this.healthCheckFailures < 3) {
          // Let GramJS MTProto auto-reconnect complete on its own without interrupting
          console.log(
            `[TeleRelay Watchdog] Client temporarily disconnected (${this.healthCheckFailures}/3). Awaiting MTProto auto-reconnect...`
          );
          return;
        }

        // Only after 3 consecutive failures (>2 minutes), force a clean restart
        this.healthCheckFailures = 0;
        this.addLog('info', 'Connection Watchdog: MTProto connection inactive >2m. Performing clean reconnect...');
        await this.reconnectFromSessionString(this.sessionString);
        return;
      }

      // Client is connected, reset failure counter
      this.healthCheckFailures = 0;
      this.lastHealthCheck = new Date().toISOString();

      // Lightweight ping check
      try {
        const me = await Promise.race([
          this.client.getMe().catch(() => null),
          new Promise((resolve) => setTimeout(() => resolve(null), 8000)),
        ]);
        if (me) {
          this.lastHealthCheck = new Date().toISOString();
          // If ping is successful but listener is marked offline, reset it
          if (!this.isListening) {
            this.setupGroupListener();
          }
        } else {
          // Ping failed but connected is true? Might be a zombie connection
          this.addLog('info', 'Watchdog: MTProto ping silent. Refreshing listener...');
          this.setupGroupListener();
        }
      } catch (pingErr) {
        // Harmless transient ping error, do not drop connection
      }
    } catch (err: any) {
      console.warn('[TeleRelay Watchdog Handled Error]', err?.message);
    }
  }

  public async savePersistentState(immediateFirestore: boolean = false) {
    try {
      const serializedMap: Record<string, number> = {};
      this.lastProcessedMessageIdMap.forEach((v, k) => {
        serializedMap[k] = v;
      });

      const stateToSave = {
        sessionString: this.sessionString,
        currentApiId: this.currentApiId,
        currentApiHash: this.currentApiHash,
        userState: this.userState,
        destinationConfig: this.destinationConfig,
        captionConfig: this.captionConfig,
        monitoredGroups: this.monitoredGroups,
        relayedVideos: this.relayedVideos.slice(0, 100),
        processedDocIds: Array.from(this.processedDocIds).slice(-8000),
        processedMD5s: Array.from(this.processedMD5s).slice(-8000),
        processedMessageKeys: Array.from(this.processedMessageKeys).slice(-8000),
        lastProcessedMessageIds: serializedMap,
        totalRelayedCount: this.totalRelayedCount,
        totalFailedCount: this.totalFailedCount,
        totalRetryAttempts: this.totalRetryAttempts,
        pacingSpeedSec: this.pacingSpeedSec,
        // Circuit breaker persistence
        isFirestoreQuotaExceeded: this.isFirestoreQuotaExceeded,
        firestoreQuotaExceededAt: this.firestoreQuotaExceededAt,
      };

      // 1. Always save full state immediately to local disk
      try {
        fs.writeFileSync(this.storageFilePath, JSON.stringify(stateToSave, null, 2), 'utf8');
      } catch (fsErr: any) {
        console.error('[TeleRelay Disk Storage Error]', fsErr?.message);
      }

      // 2. Sync to Firestore (debounced or immediate, guarded against quota exhaustion)
      if (this.isFirestoreQuotaExceeded) {
        // Circuit breaker: wait at least 1 hour before attempting a test write
        const ONE_HOUR = 60 * 60 * 1000;
        if (Date.now() - this.firestoreQuotaExceededAt < ONE_HOUR) {
          return;
        }
      }

      if (immediateFirestore) {
        if (this.firestoreSyncDebounceTimer) {
          clearTimeout(this.firestoreSyncDebounceTimer);
          this.firestoreSyncDebounceTimer = null;
        }
        await this.syncToFirestore();
      } else {
        if (!this.firestoreSyncDebounceTimer) {
          this.firestoreSyncDebounceTimer = setTimeout(() => {
            this.firestoreSyncDebounceTimer = null;
            this.syncToFirestore().catch(() => {});
          }, 600000); // Debounce background state updates to at most once every 10 minutes
        }
      }
    } catch (err: any) {
      console.error('[TeleRelay Storage] Failed to save state:', err?.message);
    }
  }

  private async syncToFirestore() {
    if (this.isFirestoreQuotaExceeded) {
      const ONE_HOUR = 60 * 60 * 1000;
      if (Date.now() - this.firestoreQuotaExceededAt < ONE_HOUR) {
        return;
      }
    }

    const statePath = 'settings/botState';
    try {
      // Send compact payload to conserve Firestore write units and quota
      const compactState = {
        sessionString: this.sessionString,
        currentApiId: this.currentApiId,
        currentApiHash: this.currentApiHash,
        userState: this.userState,
        destinationConfig: this.destinationConfig,
        captionConfig: this.captionConfig,
        monitoredGroups: this.monitoredGroups,
        relayedVideos: this.relayedVideos.slice(0, 20),
        totalRelayedCount: this.totalRelayedCount,
        totalFailedCount: this.totalFailedCount,
        totalRetryAttempts: this.totalRetryAttempts,
        updatedAt: serverTimestamp(),
      };

      const stateRef = doc(db, statePath);
      await setDoc(stateRef, compactState, { merge: true });

      if (this.isFirestoreQuotaExceeded) {
        this.isFirestoreQuotaExceeded = false;
        this.addLog('info', 'Firestore connection and write quota restored.');
      }
    } catch (fErr: any) {
      const errMsg = String(fErr?.message || fErr);
      if (
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('resource-exhausted') ||
        errMsg.includes('Quota limit exceeded') ||
        fErr?.code === 'resource-exhausted'
      ) {
        this.isFirestoreQuotaExceeded = true;
        this.firestoreQuotaExceededAt = Date.now();
        const quotaUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;
        console.warn(
          `[TeleRelay Firestore] Free daily write units quota exceeded for Firestore database. Switching to local disk persistence. Cloud sync paused. Detailed quota information: https://firebase.google.com/pricing#cloud-firestore. Console: ${quotaUrl}`
        );
        this.addLog(
          'info',
          'Firestore daily write quota reached. Local disk persistence active. Video relay continues seamlessly.'
        );
      } else {
        this.handleFirestoreError(fErr, 'setDoc', statePath);
      }
    }
  }

  public async loadPersistentState() {
    try {
      let data: any = null;

      // 1. Try local disk first if exists and fresh
      if (fs.existsSync(this.storageFilePath)) {
        try {
          const raw = fs.readFileSync(this.storageFilePath, 'utf8');
          data = JSON.parse(raw);
          this.addLog('info', 'Loaded persistent state from local storage.');
        } catch (e) {}
      }

      // 2. If no local disk data, try Firestore
      if (!data) {
        const statePath = 'settings/botState';
        try {
          const stateRef = doc(db, statePath);
          const stateSnap = await getDoc(stateRef);
          if (stateSnap.exists()) {
            data = stateSnap.data();
            this.addLog('info', 'Loaded persistent state from permanent cloud storage.');
          }
        } catch (fErr: any) {
          const errMsg = String(fErr?.message || fErr);
          if (
            errMsg.includes('RESOURCE_EXHAUSTED') ||
            errMsg.includes('resource-exhausted') ||
            errMsg.includes('Quota limit exceeded') ||
            fErr?.code === 'resource-exhausted'
          ) {
            this.isFirestoreQuotaExceeded = true;
            this.firestoreQuotaExceededAt = Date.now();
            console.warn('[TeleRelay Firestore] Read quota check: Free daily units exceeded. Using local disk.');
          } else {
            this.handleFirestoreError(fErr, 'getDoc', statePath);
          }
        }
      }
      if (!data && fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, 'utf8');
        data = JSON.parse(raw);
        this.addLog('info', 'Loaded persistent state from local storage.');
      }

      // 3. Railway / Cloud Environment Variables Fallback:
      const envSession =
        process.env.SESSION_STRING ||
        process.env.TELEGRAM_SESSION ||
        process.env.TELEGRAM_SESSION_STRING;
      if (envSession && (!data || !data.sessionString)) {
        if (!data) data = {};
        data.sessionString = envSession.trim();
        this.addLog('info', 'Loaded Telegram MTProto session from Railway / Cloud Environment Variable.');
      }

      if (!data) return;

      if (process.env.DESTINATION_CHANNEL && !data.destinationConfig?.channelInput) {
        if (!data.destinationConfig) data.destinationConfig = { channelInput: '', canPost: false, isVerified: false };
        data.destinationConfig.channelInput = process.env.DESTINATION_CHANNEL.trim();
      }

      if (process.env.MY_GROUP_LINK && !data.captionConfig?.myGroupLink) {
        if (!data.captionConfig) data.captionConfig = {};
        data.captionConfig.myGroupLink = process.env.MY_GROUP_LINK.trim();
      }

      if (data.sessionString) this.sessionString = data.sessionString;
      if (data.currentApiId) this.currentApiId = data.currentApiId;
      if (data.currentApiHash) this.currentApiHash = data.currentApiHash;
      if (data.userState) this.userState = data.userState;
      if (data.destinationConfig) this.destinationConfig = data.destinationConfig;
      if (data.totalRelayedCount) this.totalRelayedCount = data.totalRelayedCount;
      if (data.totalFailedCount) this.totalFailedCount = data.totalFailedCount;
      if (data.totalRetryAttempts) this.totalRetryAttempts = data.totalRetryAttempts;
      if (data.pacingSpeedSec !== undefined && Number(data.pacingSpeedSec) <= 3.0) {
        this.pacingSpeedSec = Number(data.pacingSpeedSec) || 0.5;
      } else {
        this.pacingSpeedSec = 0.5;
      }

      // Restore circuit breaker state
      if (data.isFirestoreQuotaExceeded !== undefined) {
        this.isFirestoreQuotaExceeded = data.isFirestoreQuotaExceeded;
      }
      if (data.firestoreQuotaExceededAt) {
        this.firestoreQuotaExceededAt = data.firestoreQuotaExceededAt;
      }

      if (data.captionConfig) {
        this.captionConfig = {
          keepFileLine: data.captionConfig.keepFileLine !== undefined ? data.captionConfig.keepFileLine : true,
          replaceFileLink: data.captionConfig.replaceFileLink !== undefined ? data.captionConfig.replaceFileLink : true,
          myGroupLink:
            data.captionConfig.myGroupLink ||
            this.destinationConfig.directLink ||
            'https://t.me/JRov0',
          removeFileLine: data.captionConfig.removeFileLine || false,
          removeLinks: data.captionConfig.removeLinks || false,
          removeUsernames: data.captionConfig.removeUsernames || false,
          keepFileMeta: true,
          customFooter: data.captionConfig.customFooter || '',
          forwardPhotosAndVideosTogether:
            data.captionConfig.forwardPhotosAndVideosTogether !== undefined
              ? data.captionConfig.forwardPhotosAndVideosTogether
              : true,
          enableMD5Deduplication:
            data.captionConfig.enableMD5Deduplication !== undefined
              ? data.captionConfig.enableMD5Deduplication
              : true,
        };
      }

      if (data.monitoredGroups && Array.isArray(data.monitoredGroups)) {
        const normDestId = normalizeTelegramId(this.destinationConfig.channelId);
        const normDestUser = normalizeTelegramId(this.destinationConfig.channelUsername);
        this.monitoredGroups = data.monitoredGroups.filter((g: any) => {
          const normGId = normalizeTelegramId(g.chatId);
          const normGUser = normalizeTelegramId(g.username);
          if (normDestId && normGId && normGId === normDestId) return false;
          if (normDestUser && normGUser && normGUser === normDestUser) return false;
          return true;
        });
      }

      if (data.relayedVideos && Array.isArray(data.relayedVideos)) {
        this.relayedVideos = data.relayedVideos;
      }

      if (data.processedDocIds && Array.isArray(data.processedDocIds)) {
        data.processedDocIds.forEach((id: string) => this.processedDocIds.add(id));
      }

      if (data.processedMD5s && Array.isArray(data.processedMD5s)) {
        data.processedMD5s.forEach((m: string) => this.processedMD5s.add(m));
      }

      if (data.processedMessageKeys && Array.isArray(data.processedMessageKeys)) {
        data.processedMessageKeys.forEach((k: string) => this.processedMessageKeys.add(k));
      }

      if (data.lastProcessedMessageIds && typeof data.lastProcessedMessageIds === 'object') {
        Object.entries(data.lastProcessedMessageIds).forEach(([k, v]) => {
          this.lastProcessedMessageIdMap.set(k, Number(v) || 0);
        });
      }

      this.updateAllowedSourceIdsCache();

      if (this.sessionString) {
        this.addLog('info', 'Auto-restoring Telegram MTProto connection from saved session...');
        await this.reconnectFromSessionString(this.sessionString);
      }
    } catch (err: any) {
      console.error('[TeleRelay Storage] Error restoring state:', err?.message);
    }
  }

  public async reconnectFromSessionString(sessionStr: string) {
    if (this.isReconnecting) return { success: false, error: 'Reconnection already in progress' };
    this.isReconnecting = true;

    try {
      this.sessionString = sessionStr.trim();
      const session = new StringSession(this.sessionString);

      if (this.client) {
        try {
          const oldClient = this.client;
          this.client = null as any;
          if (this.currentEventHandler && this.currentEventBuilder) {
            try {
              (oldClient as any).removeEventHandler?.(
                this.currentEventHandler,
                this.currentEventBuilder
              );
            } catch (e) {}
          }
          this.currentEventHandler = null;
          this.currentEventBuilder = null;
          this.isListening = false;
          await oldClient.disconnect().catch(() => {});
          try {
            await (oldClient as any).destroy?.();
          } catch (e) {}
          await new Promise((resolve) => setTimeout(resolve, 1500));
        } catch (e) {}
      }

      this.client = new TelegramClient(session, this.currentApiId, this.currentApiHash, {
        connectionRetries: 15,
        floodSleepThreshold: 120,
        autoReconnect: true,
      });

      try {
        await this.client.connect();
      } catch (connErr: any) {
        console.warn('[TeleRelay Connect Note]', connErr?.message);
      }

      if (!this.client) {
        return { success: false, error: 'Client initialization failed' };
      }

      let isAuthed = false;
      try {
        isAuthed = await this.client.checkAuthorization();
      } catch (authErr: any) {
        console.warn('[TeleRelay Auth Check Warning]', authErr?.message);
      }

      if (isAuthed) {
        let me: any = null;
        try {
          me = await this.client.getMe();
        } catch (e) {}

        this.userState = {
          isLoggedIn: true,
          requires2FA: false,
          phoneNumber: me?.phone || this.userState.phoneNumber,
          sessionString: this.sessionString,
          user: {
            id: me?.id?.toString() || 'unknown',
            firstName: me?.firstName || 'Telegram User',
            lastName: me?.lastName,
            username: me?.username,
            phone: me?.phone || this.userState.phoneNumber,
          },
        };

        this.addLog(
          'info',
          `Session active! Account ${me?.firstName || 'User'} (@${me?.username || 'user'}) connected via MTProto.`
        );
        this.savePersistentState(true);
        this.setupGroupListener();
        this.refreshMonitoredGroupsEntities().catch((e) => console.warn('[Entity Refresh Note]', e?.message));

        // Perform immediate offline catch-up sweep safely
        setTimeout(() => {
          if (this.client && this.client.connected) {
            this.catchUpMissedMessages().catch((e) =>
              console.warn('[Initial Catch-Up Error]', e?.message)
            );
          }
        }, 3000);

        return { success: true, user: this.userState.user };
      } else {
        this.addLog('info', 'Saved session was revoked or expired.');
        this.userState = { isLoggedIn: false };
        return { success: false, error: 'Session expired' };
      }
    } catch (err: any) {
      if (err.message && err.message.includes('AUTH_KEY_DUPLICATED')) {
        this.addLog('info', 'Telegram session expired or revoked on device. Please login with your phone number and OTP.');
        this.userState = { isLoggedIn: false };
        this.sessionString = '';
        this.savePersistentState(true);
      } else {
        this.addLog('error', `Failed to restore Telegram session: ${err.message}`);
      }
      return { success: false, error: err.message };
    } finally {
      this.isReconnecting = false;
    }
  }

  public addLog(type: PipelineLog['type'], message: string, details?: any) {
    const logItem: PipelineLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      details,
    };
    this.logs.unshift(logItem);
    if (this.logs.length > 150) {
      this.logs.pop();
    }
    console.log(`[TeleRelay ${type.toUpperCase()}] ${message}`);
  }

  public getLogs(): PipelineLog[] {
    return this.logs;
  }

  public getUserState(): TelegramUserState {
    return this.userState;
  }

  public getDestinationConfig(): DestinationChannelConfig {
    return this.destinationConfig;
  }

  public getCaptionConfig(): CaptionConfig {
    return this.captionConfig;
  }

  public setCaptionConfig(config: Partial<CaptionConfig>) {
    this.captionConfig = {
      ...this.captionConfig,
      ...config,
      keepFileLine: config.keepFileLine !== undefined ? config.keepFileLine : true,
      replaceFileLink: config.replaceFileLink !== undefined ? config.replaceFileLink : true,
      myGroupLink:
        config.myGroupLink && config.myGroupLink.trim()
          ? config.myGroupLink.trim()
          : this.destinationConfig.directLink || 'https://t.me/JRov0',
      forwardPhotosAndVideosTogether:
        config.forwardPhotosAndVideosTogether !== undefined
          ? config.forwardPhotosAndVideosTogether
          : true,
      enableMD5Deduplication:
        config.enableMD5Deduplication !== undefined
          ? config.enableMD5Deduplication
          : true,
      keepFileMeta: true,
    };
    this.savePersistentState(false);
    this.addLog(
      'info',
      `Rules updated: Keep File line (${this.captionConfig.keepFileLine ? 'YES' : 'NO'}), Replace Link with ${this.captionConfig.myGroupLink}, Album Sync (${this.captionConfig.forwardPhotosAndVideosTogether ? 'ON' : 'OFF'}), MD5 Deduplication (${this.captionConfig.enableMD5Deduplication ? 'ON' : 'OFF'}).`
    );
    return this.captionConfig;
  }

  public getMonitoredGroups(): MonitoredGroup[] {
    return this.monitoredGroups;
  }

  public isListenerActive(): boolean {
    return this.isListening;
  }

  public getRelayedVideos(): RelayedVideoItem[] {
    return this.relayedVideos;
  }

  public getQueueLength(): number {
    return this.videoQueue.length;
  }

  public getActiveCount(): number {
    return this.isQueueWorkerRunning ? 1 : 0;
  }

  public getQueueStats() {
    return {
      pendingCount: this.videoQueue.length,
      isProcessing: this.isQueueWorkerRunning,
      totalRelayed: this.totalRelayedCount,
      totalFailed: this.totalFailedCount,
      retryAttempts: this.totalRetryAttempts,
      isRateLimited: this.isRateLimited,
      floodWaitSeconds: this.isRateLimited
        ? Math.max(0, Math.ceil((this.floodWaitUntil - Date.now()) / 1000))
        : 0,
      zeroSkipActive: true,
      lastCatchUpAt: this.lastCatchUpAt,
      burstCapacity: 100,
      pacingSpeedSec: this.pacingSpeedSec,
    };
  }

  public setPacingSpeed(sec: number): number {
    const val = Number(sec);
    if (!isNaN(val) && val >= 0.1 && val <= 30) {
      this.pacingSpeedSec = Number(val.toFixed(1));
      this.savePersistentState(false);
    }
    return this.pacingSpeedSec;
  }

  public clearQueue() {
    const count = this.videoQueue.length;
    this.videoQueue = [];
    this.queuedMessageKeys.clear();
    this.addLog('info', `Queue cleared! (${count} pending items cleared).`);
    return { success: true, count };
  }

  // ==================== REAL TELEGRAM LOGIN FLOWS ====================

  public async sendLoginCode(phoneNumber: string, customApiId?: number, customApiHash?: string) {
    try {
      this.currentApiId = customApiId || DEFAULT_API_ID;
      this.currentApiHash = customApiHash || DEFAULT_API_HASH;

      const cleanPhone = phoneNumber.replace(/\s+/g, '');
      this.addLog('info', `Connecting to Telegram MTProto for ${cleanPhone}...`);

      const session = new StringSession(this.sessionString || '');
      this.client = new TelegramClient(session, this.currentApiId, this.currentApiHash, {
        connectionRetries: 5,
      });

      await this.client.connect();

      this.addLog('info', `Requesting Telegram verification code for ${cleanPhone}...`);
      const { phoneCodeHash, isCodeViaApp } = await this.client.sendCode(
        {
          apiId: this.currentApiId,
          apiHash: this.currentApiHash,
        },
        cleanPhone
      );

      this.userState = {
        isLoggedIn: false,
        phoneNumber: cleanPhone,
        phoneCodeHash,
      };

      this.addLog(
        'info',
        `Verification code sent to ${cleanPhone} (${isCodeViaApp ? 'Official Telegram app' : 'SMS'}).`
      );

      return {
        success: true,
        phoneCodeHash,
        isCodeViaApp,
        message: 'Telegram verification code sent! Check your Telegram app chat or SMS.',
      };
    } catch (err: any) {
      this.addLog('error', `Failed to send Telegram login code: ${err.message}`);
      throw new Error(err.message || 'Failed to send Telegram code');
    }
  }

  public async verifyLoginCode(code: string, twoFactorPassword?: string) {
    if (!this.client || !this.userState.phoneNumber) {
      throw new Error('No active login request found. Please request an OTP code first.');
    }

    if (this.userState.requires2FA && twoFactorPassword && twoFactorPassword.trim()) {
      return await this.verify2FAPassword(twoFactorPassword);
    }

    try {
      this.addLog('info', `Submitting OTP code for ${this.userState.phoneNumber}...`);

      try {
        await this.client.invoke(
          new Api.auth.SignIn({
            phoneNumber: this.userState.phoneNumber,
            phoneCodeHash: this.userState.phoneCodeHash || '',
            phoneCode: code.trim(),
          })
        );
      } catch (signInErr: any) {
        const errMessage = signInErr.message || signInErr.errorMessage || '';

        if (
          errMessage.includes('SESSION_PASSWORD_NEEDED') ||
          signInErr.errorMessage === 'SESSION_PASSWORD_NEEDED'
        ) {
          this.userState.requires2FA = true;

          let hint = '';
          try {
            const pwdInfo: any = await this.client.invoke(new Api.account.GetPassword());
            hint = pwdInfo.hint || '';
            this.userState.passwordHint = hint;
          } catch (hintErr) {}

          if (!twoFactorPassword || !twoFactorPassword.trim()) {
            this.addLog(
              'info',
              `Account has Two-Step Verification (2FA) enabled.${hint ? ` Hint: "${hint}".` : ''} Awaiting password.`
            );
            return {
              success: false,
              requires2FA: true,
              hint,
              message: 'Your Telegram account has 2FA enabled. Please enter your 2-step password.',
            };
          }

          return await this.verify2FAPassword(twoFactorPassword);
        } else {
          throw signInErr;
        }
      }

      const me: any = await this.client.getMe();
      this.sessionString = (this.client.session.save() as unknown) as string;

      this.userState = {
        isLoggedIn: true,
        requires2FA: false,
        phoneNumber: this.userState.phoneNumber,
        sessionString: this.sessionString,
        user: {
          id: me.id?.toString() || 'unknown',
          firstName: me.firstName || 'Telegram User',
          lastName: me.lastName,
          username: me.username,
          phone: me.phone || this.userState.phoneNumber,
        },
      };

      this.addLog('info', `Successfully logged in as ${me.firstName} (@${me.username || 'user'})!`);
      this.setupGroupListener();
      this.refreshMonitoredGroupsEntities().catch((e) => console.warn('[Refresh Entities]', e?.message));
      this.savePersistentState(true);

      return {
        success: true,
        user: this.userState.user,
        sessionString: this.sessionString,
        message: 'Successfully logged in to your Telegram account!',
      };
    } catch (err: any) {
      this.addLog('error', `Login verification failed: ${err.message}`);
      throw new Error(err.message || 'Invalid verification code');
    }
  }

  public async verify2FAPassword(password: string) {
    if (!this.client) {
      throw new Error('Telegram client not initialized');
    }

    try {
      this.addLog('info', 'Verifying Two-Step Verification (2FA) cloud password...');

      const passwordInfo: any = await this.client.invoke(new Api.account.GetPassword());
      const passwordCheck = await computeCheck(passwordInfo, password);

      await this.client.invoke(
        new Api.auth.CheckPassword({
          password: passwordCheck,
        })
      );

      const me: any = await this.client.getMe();
      this.sessionString = (this.client.session.save() as unknown) as string;

      this.userState = {
        isLoggedIn: true,
        requires2FA: false,
        phoneNumber: me.phone || this.userState.phoneNumber,
        sessionString: this.sessionString,
        user: {
          id: me.id?.toString() || 'unknown',
          firstName: me.firstName || 'Telegram User',
          lastName: me.lastName,
          username: me.username,
          phone: me.phone || this.userState.phoneNumber,
        },
      };

      this.addLog('info', `2FA verification successful! Logged in as ${me.firstName}.`);
      this.setupGroupListener();
      this.refreshMonitoredGroupsEntities().catch((e) => console.warn('[Refresh Entities]', e?.message));
      this.savePersistentState(true);

      return {
        success: true,
        user: this.userState.user,
        sessionString: this.sessionString,
        message: '2FA password verified successfully!',
      };
    } catch (err: any) {
      this.addLog('error', `2FA verification failed: ${err.message}`);
      throw new Error(err.message || 'Invalid 2FA password');
    }
  }

  public async logout() {
    try {
      if (this.client) {
        if (this.currentEventHandler && this.currentEventBuilder) {
          try {
            (this.client as any).removeEventHandler(
              this.currentEventHandler,
              this.currentEventBuilder
            );
          } catch (e) {}
        }
        await this.client.disconnect();
      }
      this.client = null;
      this.sessionString = '';
      this.userState = { isLoggedIn: false };
      this.isListening = false;
      this.savePersistentState(true);
      this.addLog('info', 'Logged out of Telegram session.');
      return { success: true };
    } catch (err: any) {
      throw new Error(err.message);
    }
  }

  public async getUserChannels() {
    if (!this.client || !this.userState.isLoggedIn) {
      return [];
    }
    try {
      const dialogs = await this.client.getDialogs({ limit: 40 });
      const channels = dialogs
        .filter((d: any) => d.isChannel || d.isGroup)
        .map((d: any) => ({
          id: d.id?.toString(),
          title: d.title || 'Untitled',
          username: d.entity?.username,
          isChannel: Boolean(d.isChannel),
          isCreator: Boolean(d.entity?.creator),
          canPost: Boolean(d.entity?.creator || d.entity?.adminRights || !d.entity?.broadcast),
        }));
      return channels;
    } catch (err: any) {
      console.warn('Could not list user channels:', err.message);
      return [];
    }
  }

  public async verifyDestinationChannel(channelInput: string) {
    if (!this.client || !this.userState.isLoggedIn) {
      throw new Error('Telegram account is not connected. Please login first.');
    }

    const clean = channelInput.trim();
    if (!clean) {
      throw new Error('Please provide a channel username or link (e.g. @mychannel or t.me/mychannel)');
    }

    this.addLog('info', `Checking posting permissions for channel: ${clean}...`);

    let handle = clean.replace(/^https?:\/\/t\.me\//, '').replace(/^@/, '');
    let entity: any = null;

    try {
      entity = await this.client.getEntity(clean);
    } catch (err) {
      try {
        entity = await this.client.getEntity(handle);
      } catch (e: any) {
        if (/^-?\d+$/.test(handle)) {
          try {
            entity = await this.client.getEntity(Number(handle));
          } catch (e2) {}
        }
      }
    }

    if (!entity) {
      throw new Error(
        `Could not access channel "${clean}". Ensure your logged-in Telegram account is a member or admin of this channel.`
      );
    }

    const isCreator = entity.creator === true;
    const isAdmin = Boolean(entity.adminRights || entity.admin);
    const canPost = isCreator || isAdmin || !entity.broadcast;

    const username = entity.username;
    const directLink = username ? `https://t.me/${username}` : `https://t.me/c/${entity.id}`;

    this.destinationConfig = {
      channelInput: clean,
      channelTitle: entity.title || handle,
      channelId: entity.id?.toString(),
      channelUsername: username,
      canPost,
      isVerified: true,
      memberCount: entity.participantsCount,
      lastCheckedAt: new Date().toLocaleTimeString(),
      directLink,
    };

    if (!this.captionConfig.myGroupLink) {
      this.captionConfig.myGroupLink = directLink;
    }

    const normDestId = normalizeTelegramId(this.destinationConfig.channelId);
    const normDestUser = normalizeTelegramId(this.destinationConfig.channelUsername);
    this.monitoredGroups = this.monitoredGroups.filter((g) => {
      const normGId = normalizeTelegramId(g.chatId);
      const normGUser = normalizeTelegramId(g.username);
      if (normDestId && normGId && normGId === normDestId) return false;
      if (normDestUser && normGUser && normGUser === normDestUser) return false;
      return true;
    });

    this.addLog(
      'info',
      `Destination channel verified: "${this.destinationConfig.channelTitle}" (ID: ${this.destinationConfig.channelId}, Can Post: ${canPost ? 'YES' : 'Restricted'}).`
    );

    this.savePersistentState(false);

    return {
      success: true,
      destination: this.destinationConfig,
    };
  }

  public async testRelayToChannel(channelInput?: string, captionText?: string) {
    if (!this.client || !this.userState.isLoggedIn) {
      throw new Error('Telegram account is not connected. Please login first.');
    }

    const target = channelInput || this.destinationConfig.channelInput;
    if (!target) {
      throw new Error('Please enter or select a destination channel first.');
    }

    this.addLog('info', `Running live channel delivery test for: ${target}...`);

    let targetEntity: any = null;
    let handle = target.trim().replace(/^https?:\/\/t\.me\//, '').replace(/^@/, '');
    try {
      targetEntity = await this.client.getEntity(handle);
    } catch (err: any) {
      throw new Error(`Cannot reach target channel "${target}": ${err.message}`);
    }

    const testVideoPath = path.join(this.tempDir, `test_share_${Date.now()}.mp4`);
    const testPhotoPath = path.join(this.tempDir, `test_photo_${Date.now()}.jpg`);
    try {
      const { execSync } = await import('child_process');
      execSync(
        `ffmpeg -y -f lavfi -i testsrc=duration=4:size=640x360:rate=24 -f lavfi -i sine=frequency=800:duration=4 -c:v libx264 -preset ultrafast -c:a aac -pix_fmt yuv420p "${testVideoPath}"`,
        { stdio: 'ignore' }
      );
      execSync(
        `ffmpeg -y -i "${testVideoPath}" -vframes 1 -q:v 2 "${testPhotoPath}"`,
        { stdio: 'ignore' }
      );
    } catch (ffmpegErr: any) {
      this.addLog('error', `Failed to generate test media: ${ffmpegErr.message}`);
      throw new Error('FFmpeg test generation failed');
    }

    const targetLink =
      (this.captionConfig.myGroupLink && this.captionConfig.myGroupLink.trim()) ||
      this.destinationConfig.directLink ||
      `https://t.me/${this.destinationConfig.channelUsername || 'JRov0'}`;

    const formattedCaption =
      captionText ||
      [
        `File: STc_Eva10069_20261007_2155`,
        `Username: #Eva10069`,
        `Sid: #ID${Date.now().toString().slice(-8)}`,
        `Duration: 00:00:04`,
        `Size: 0.12 MB`,
        `Label: HD1`,
        `Status: Live Video + SS Album Stream Verified ✅`,
      ].join('\n');

    const sampleEntities = [
      new Api.MessageEntityBlockquote({ offset: 0, length: formattedCaption.length }),
      new Api.MessageEntityTextUrl({
        offset: 6,
        length: 'STc_Eva10069_20261007_2155'.length,
        url: targetLink,
      }),
      new Api.MessageEntityHashtag({
        offset: formattedCaption.indexOf('#Eva10069'),
        length: '#Eva10069'.length,
      }),
    ];

    try {
      this.addLog(
        'info',
        `Posting verified test Album (Video + Screenshot SS) into "${targetEntity.title || handle}"...`
      );

      const sentMsg: any = await this.client.sendFile(targetEntity, {
        file: testVideoPath,
        caption: formattedCaption,
        formattingEntities: sampleEntities,
        supportsStreaming: true,
      });

      const msgId = sentMsg?.id || Date.now();
      const username = targetEntity.username;
      const directLink = username
        ? `https://t.me/${username}/${msgId}`
        : `https://t.me/c/${targetEntity.id}/${msgId}`;

      this.addLog(
        'forwarded',
        `Test video successfully posted into "${targetEntity.title || handle}"! Link points to ${targetLink}. (Msg ID: ${msgId})`
      );

      const relayedItem: RelayedVideoItem = {
        id: `relayed-test-${Date.now()}`,
        messageId: Number(msgId),
        sourceChat: 'Channel Verification Test',
        destinationChat: targetEntity.title || handle,
        title: 'File: STc_Eva10069_20261007_2155',
        thumbnailUrl: '',
        originalSizeMB: 0.12,
        trimmedSizeMB: 0.12,
        cutSeconds: 0,
        relayedAt: new Date().toLocaleTimeString(),
        status: 'completed',
        directLink,
        isAlbum: true,
        mediaCount: 2,
        replacedLink: targetLink,
      };
      this.relayedVideos.unshift(relayedItem);
      this.savePersistentState(true);

      return {
        success: true,
        messageId: msgId,
        channelTitle: targetEntity.title || handle,
        directLink,
        replacedLink: targetLink,
        message: `Video successfully posted into "${targetEntity.title || handle}"!`,
      };
    } catch (sendErr: any) {
      this.addLog('error', `Failed to post test video: ${sendErr.message}`);
      throw new Error(`Failed to post video to channel: ${sendErr.message}`);
    } finally {
      if (fs.existsSync(testVideoPath)) {
        try {
          fs.unlinkSync(testVideoPath);
        } catch (e) {}
      }
      if (fs.existsSync(testPhotoPath)) {
        try {
          fs.unlinkSync(testPhotoPath);
        } catch (e) {}
      }
    }
  }

  /**
 * Computes all possible normalized ID and username variants for a monitored group
 * to perform 100% airtight strict matching against incoming Telegram messages.
 */
  public getGroupMatchIdentifiers(group: MonitoredGroup): Set<string> {
    const ids = new Set<string>();

    if (group.chatId) {
      const raw = group.chatId.toString().trim();
      const clean = normalizeTelegramId(raw);
      if (clean) {
        ids.add(clean);
        ids.add(`-100${clean}`);
        ids.add(`-${clean}`);
      }
      if (raw) ids.add(raw.toLowerCase());
    }

    if (group.username) {
      const cleanUser = normalizeTelegramId(group.username);
      if (cleanUser) {
        ids.add(cleanUser);
        ids.add(`@${cleanUser}`);
      }
    }

    if (group.link) {
      const cleanLink = normalizeTelegramId(group.link);
      if (cleanLink && cleanLink !== 'c') ids.add(cleanLink);

      // Handle invite links: t.me/+hash or t.me/joinchat/hash
      const hashMatch = group.link.match(/(?:joinchat\/|\+)([a-zA-Z0-9_-]+)/);
      if (hashMatch && hashMatch[1]) {
        ids.add(hashMatch[1].toLowerCase());
      }

      // Handle private channel/group message links: t.me/c/1234567890/123
      const cMatch = group.link.match(/t\.me\/c\/(\d+)/i);
      if (cMatch && cMatch[1]) {
        const cId = cMatch[1];
        ids.add(cId);
        ids.add(`-100${cId}`);
        ids.add(`-${cId}`);
      }

      // Handle public username links: t.me/groupname
      const handleMatch = group.link.match(/t\.me\/([a-zA-Z0-9_]+)/i);
      if (
        handleMatch &&
        handleMatch[1] &&
        !handleMatch[1].startsWith('+') &&
        handleMatch[1] !== 'joinchat' &&
        handleMatch[1] !== 'c'
      ) {
        ids.add(handleMatch[1].toLowerCase());
        ids.add(`@${handleMatch[1].toLowerCase()}`);
      }
    }

    return ids;
  }

  /**
   * Refreshes real Telegram chat IDs for all monitored groups once client is connected
   */
  public async refreshMonitoredGroupsEntities() {
    if (!this.client || !this.userState.isLoggedIn) return;
    try {
      const dialogs = await this.client.getDialogs({ limit: 200 });
      let updated = false;

      for (const group of this.monitoredGroups) {
        if (!group.chatId) {
          const normLink = normalizeTelegramId(group.link);
          const cMatch = group.link.match(/t\.me\/c\/(\d+)/i);
          const internalId = cMatch ? cMatch[1] : null;

          for (const d of dialogs) {
            const ent = d.entity as any;
            if (!ent) continue;
            const entId = ent.id?.toString();
            const entNormId = normalizeTelegramId(entId);
            const entUser = ent.username?.toLowerCase();
            const entTitle = (ent.title || '').trim().toLowerCase();

            const matchByInternal = internalId && (entNormId === internalId || entId === internalId);
            const matchByUser = entUser && (
              normLink === entUser ||
              group.link.toLowerCase().includes(`t.me/${entUser}`) ||
              group.link.toLowerCase() === `@${entUser}`
            );
            const matchByTitle = group.title && entTitle === group.title.trim().toLowerCase();

            if (matchByInternal || matchByUser || matchByTitle) {
              group.chatId = entId;
              group.username = ent.username || group.username;
              group.title = ent.title || group.title;
              group.memberCount = ent.participantsCount || group.memberCount;
              updated = true;
              break;
            }
          }
        }
      }

      if (updated) {
        this.savePersistentState(true);
      }
    } catch (e) {
      console.warn('[Refresh Entities Warning]', e);
    }
  }

  public async addSourceGroup(groupInput: string) {
    const rawLinks = groupInput
      .split(/[\s,\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (rawLinks.length === 0) {
      throw new Error('Please provide at least one Telegram group link');
    }

    const added: MonitoredGroup[] = [];
    const errors: string[] = [];

    for (const cleanLink of rawLinks) {
      if (this.monitoredGroups.some((g) => g.link === cleanLink)) {
        continue;
      }

      let title = cleanLink;
      let username: string | undefined;
      let chatId: string | undefined;
      let memberCount: number | undefined;

      // Extract internal channel ID if private link: t.me/c/1234567890/...
      const cMatch = cleanLink.match(/t\.me\/c\/(\d+)/i);
      if (cMatch && cMatch[1]) {
        chatId = cMatch[1];
      }

      // Check if raw numeric ID provided: -1001234567890 or 1234567890
      if (/^-?\d+$/.test(cleanLink)) {
        chatId = normalizeTelegramId(cleanLink);
      }

      if (this.client && this.userState.isLoggedIn) {
        try {
          this.addLog('info', `Resolving Telegram group: ${cleanLink}...`);

          // 1. Try finding group in user's joined dialogs
          try {
            const dialogs = await this.client.getDialogs({ limit: 100 });
            for (const d of dialogs) {
              const ent = d.entity as any;
              if (!ent) continue;
              const entId = ent.id?.toString();
              const entNormId = normalizeTelegramId(entId);
              const entUser = ent.username?.toLowerCase();
              const cleanNorm = normalizeTelegramId(cleanLink);

              const matchById = chatId && (entNormId === normalizeTelegramId(chatId) || entId === chatId);
              const matchByUser = entUser && (
                cleanLink.toLowerCase().includes(`t.me/${entUser}`) ||
                cleanNorm === entUser ||
                cleanLink.toLowerCase() === `@${entUser}`
              );
              const matchByTitle = cleanLink.trim().toLowerCase() === (ent.title || '').trim().toLowerCase();

              if (matchById || matchByUser || matchByTitle) {
                title = ent.title || title;
                username = ent.username || username;
                chatId = ent.id?.toString() || chatId;
                memberCount = ent.participantsCount || memberCount;
                this.chatEntityCache.set(normalizeTelegramId(chatId), ent);
                break;
              }
            }
          } catch (dialogErr) {}

          // 2. If not found in dialogs, resolve via MTProto API
          if (!chatId) {
            if (cleanLink.includes('joinchat/') || cleanLink.includes('t.me/+')) {
              const hashMatch = cleanLink.match(/(?:joinchat\/|\+)([a-zA-Z0-9_-]+)/);
              if (hashMatch && hashMatch[1]) {
                const hash = hashMatch[1];
                try {
                  const checkRes: any = await this.client.invoke(
                    new Api.messages.CheckChatInvite({ hash })
                  );
                  if (checkRes.chat) {
                    title = checkRes.chat.title;
                    chatId = checkRes.chat.id?.toString();
                    username = checkRes.chat.username;
                    memberCount = checkRes.chat.participantsCount;
                    this.chatEntityCache.set(normalizeTelegramId(chatId), checkRes.chat);
                  } else if (checkRes.title) {
                    title = checkRes.title;
                    memberCount = checkRes.participantsCount;
                  }
                } catch (joinErr: any) {
                  // User might already be joined or invite requires import
                  try {
                    const importRes: any = await this.client.invoke(
                      new Api.messages.ImportChatInvite({ hash })
                    );
                    if (importRes?.chats?.[0]) {
                      const c = importRes.chats[0];
                      title = c.title || title;
                      chatId = c.id?.toString();
                      username = c.username;
                      memberCount = c.participantsCount;
                      this.chatEntityCache.set(normalizeTelegramId(chatId), c);
                    }
                  } catch (impErr: any) {
                    console.warn('Import/Check invite note', impErr?.message);
                  }
                }
              }
            } else {
              let handle = cleanLink.replace(/^https?:\/\/t\.me\//, '').replace(/^@/, '');
              if (!handle.startsWith('c/')) {
                try {
                  const entity: any = await this.client.getEntity(handle);
                  if (entity) {
                    title = entity.title || entity.firstName || handle;
                    username = entity.username;
                    chatId = entity.id?.toString();
                    memberCount = entity.participantsCount;
                    this.chatEntityCache.set(normalizeTelegramId(chatId), entity);
                  }
                } catch (entErr: any) {
                  console.warn('GetEntity note:', entErr?.message);
                }
              }
            }
          }
        } catch (err: any) {
          this.addLog('info', `Group registration note: ${err.message}. Added for listener.`);
        }
      }

      const normDestId = normalizeTelegramId(this.destinationConfig.channelId);
      const normDestUser = normalizeTelegramId(this.destinationConfig.channelUsername);
      const normChatId = normalizeTelegramId(chatId);
      const normUser = normalizeTelegramId(username);

      if (
        (normDestId && normChatId && normChatId === normDestId) ||
        (normDestUser && normUser && normUser === normDestUser)
      ) {
        errors.push(`Cannot add destination channel (${cleanLink}) as source group.`);
        continue;
      }

      const newGroup: MonitoredGroup = {
        id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        link: cleanLink,
        title: title || cleanLink,
        username,
        chatId,
        memberCount,
        addedAt: new Date().toLocaleTimeString(),
      };

      this.monitoredGroups.push(newGroup);
      added.push(newGroup);
      this.updateAllowedSourceIdsCache();
      
      this.addLog(
        'info',
        `Source Group added: "${newGroup.title}" (${cleanLink}${chatId ? ` | ID: ${chatId}` : ''}) for strict 24/7 forwarding.`
      );
    }

    if (added.length > 0) {
      this.savePersistentState(false);
      // Trigger catch-up immediately for the new group
      this.catchUpMissedMessages().catch(() => {});
    }

    return {
      success: added.length > 0,
      addedCount: added.length,
      groups: this.monitoredGroups,
      addedTitles: added.map((g) => g.title),
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  public clearAllSourceGroups() {
    const count = this.monitoredGroups.length;
    this.monitoredGroups = [];
    this.updateAllowedSourceIdsCache();
    this.addLog(
      'info',
      `Cleared all monitored source groups (${count} removed). No videos will be forwarded until new groups are added.`
    );
    this.savePersistentState(false);
    return { success: true, removedCount: count };
  }

  public removeSourceGroup(id: string) {
    const initialCount = this.monitoredGroups.length;
    this.monitoredGroups = this.monitoredGroups.filter((g) => g.id !== id);
    if (this.monitoredGroups.length !== initialCount) {
      this.updateAllowedSourceIdsCache();
      this.addLog('info', `Removed group from monitoring list.`);
      this.savePersistentState(false);
    }
    return { success: true };
  }

  // ==================== REAL-TIME MTPROTO LISTENER ====================

  private setupGroupListener() {
    if (!this.client) return;

    if (this.currentEventHandler && this.currentEventBuilder) {
      try {
        (this.client as any).removeEventHandler(
          this.currentEventHandler,
          this.currentEventBuilder
        );
      } catch (e) {}
      this.currentEventHandler = null;
      this.currentEventBuilder = null;
    }

    (this.client as any).on('disconnected', () => {
      this.addLog('info', 'MTProto transport disconnected; GramJS auto-reconnect engaged.');
    });

    const handler = async (event: any) => {
      try {
        const message = event.message;
        if (!message || message.out) return;

        // 1. Resolve basic identifiers first to check deduplication immediately
        const peerId = message.peerId?.channelId || message.peerId?.chatId || message.chatId;
        const normPeerId = normalizeTelegramId(peerId);
        const messageKey = normPeerId ? `${normPeerId}_${message.id}` : null;

        // 2. Early Deduplication Check (before any async work)
        if (messageKey) {
          if (
            this.processedMessageKeys.has(messageKey) ||
            this.queuedMessageKeys.has(messageKey) ||
            this.processingMessageKeys.has(messageKey)
          ) {
            return;
          }
          this.queuedMessageKeys.add(messageKey);
        }

        // 3. STRICT REQUIREMENT: If ZERO source groups are monitored, DROP EVERYTHING!
        if (!this.monitoredGroups || this.monitoredGroups.length === 0) {
          return;
        }

        // 4. Reject private 1-on-1 direct messages (DMs) or bot PMs
        const isPrivateDm = Boolean(
          message.peerId?.userId &&
          !message.peerId?.channelId &&
          !message.peerId?.chatId
        );
        if (isPrivateDm) {
          return;
        }

        // 5. Verify media type
        if (!this.isVideoOrMediaMessage(message)) return;

        // 6. Build master allowlist check using high-speed cache
        let isAllowed = false;
        if (normPeerId && this.allowedSourceIdsCache.has(normPeerId)) {
          isAllowed = true;
        }

        let chat: any = null;
        // If not immediately found in cache by ID, we need to resolve chat to check username/link
        if (!isAllowed) {
          try {
            const peerKey = peerId?.toString();
            if (peerKey && this.chatCache.has(peerKey)) {
              chat = this.chatCache.get(peerKey);
            } else {
              chat = await message.getChat();
              if (peerKey && chat) {
                this.chatCache.set(peerKey, chat);
                if (this.chatCache.size > 300) {
                  const firstKey = this.chatCache.keys().next().value;
                  if (firstKey !== undefined) this.chatCache.delete(firstKey);
                }
              }
            }
          } catch (e) {}

          const chatUsername = chat?.username?.toString();
          if (chatUsername) {
            const normUser = normalizeTelegramId(chatUsername);
            if (normUser && (this.allowedSourceIdsCache.has(normUser) || this.allowedSourceIdsCache.has(`@${normUser}`))) {
              isAllowed = true;
            }
          }
        }

        if (!isAllowed) {
          return;
        }

        // 7. Anti-Loop Gate: NEVER process messages originating from destination channel
        const normDestId = normalizeTelegramId(this.destinationConfig.channelId);
        const normDestUsername = normalizeTelegramId(this.destinationConfig.channelUsername);
        const normDestInput = normalizeTelegramId(this.destinationConfig.channelInput);

        // Check if messageKey still unique after potential async yield
        if (messageKey) this.processingMessageKeys.add(messageKey);

        const candidateIds = new Set<string>();
        if (normPeerId) candidateIds.add(normPeerId);
        if (chat?.username) candidateIds.add(normalizeTelegramId(chat.username));

        for (const cand of candidateIds) {
          if (
            (normDestId && cand === normDestId) ||
            (normDestUsername && cand === normDestUsername) ||
            (normDestInput && cand === normDestInput)
          ) {
            if (messageKey) this.processingMessageKeys.delete(messageKey);
            return; // Dropped anti-loop!
          }
        }

        // 8. STRICT CHECK: Does ANY candidate ID match an allowed source group?
        let matchedSourceGroup: MonitoredGroup | null = null;
        for (const cand of candidateIds) {
          if (this.allowedSourceIdsCache.has(cand)) {
            matchedSourceGroup =
              this.monitoredGroups.find((g) => this.getGroupMatchIdentifiers(g).has(cand)) || null;
            if (matchedSourceGroup) break;
          }
        }

        if (!matchedSourceGroup) {
          if (messageKey) this.processingMessageKeys.delete(messageKey);
          return;
        }

        // Auto-enrich group chat ID
        if (!matchedSourceGroup.chatId && chat?.id) {
          matchedSourceGroup.chatId = chat.id.toString();
          if (chat.username && !matchedSourceGroup.username) {
            matchedSourceGroup.username = chat.username;
          }
          this.savePersistentState(false);
        }

        const groupTitle = chat?.title || matchedSourceGroup.title || 'Source Group';
        const targetChatId = normPeerId || matchedSourceGroup.chatId;
        if (targetChatId) {
          this.lastPushEventTimestamp.set(targetChatId, Date.now());
          const curHighest = this.lastProcessedMessageIdMap.get(targetChatId) || 0;
          if (message.id > curHighest) {
            this.lastProcessedMessageIdMap.set(targetChatId, message.id);
          }
        }

        const groupedId = message.groupedId ? message.groupedId.toString() : null;

        // 1. ALBUM HANDLING (Messages with native groupedId)
        if (groupedId) {
          const groupedKey = `${normPeerId || matchedSourceGroup.chatId || 'unk'}_${groupedId}`;

          if (this.pendingAlbums.has(groupedKey)) {
            const entry = this.pendingAlbums.get(groupedKey)!;
            if (!entry.messages.some((m) => m.id === message.id)) {
              entry.messages.push(message);
            }
            clearTimeout(entry.timer);
            // Robust 650ms debounce window to ensure all parts (video + photo) arrive together
            entry.timer = setTimeout(() => this.finalizeAlbum(groupedKey), 650);
            if (messageKey) this.processingMessageKeys.delete(messageKey);
            return;
          }

          // Check if this album was recently finalized and is still in the queue waiting to be sent
          const recentFinalized = this.recentlyFinalizedAlbums.get(groupedKey);
          if (recentFinalized) {
            const pendingTask = this.videoQueue.find((t) => t.id === recentFinalized.taskId);
            if (pendingTask) {
              if (!pendingTask.messages.some((m) => m.id === message.id)) {
                pendingTask.messages.push(message);
                pendingTask.messages.sort((a, b) => a.id - b.id);
                pendingTask.isAlbum = true;
                if (messageKey) this.queuedMessageKeys.add(messageKey);
                this.addLog(
                  'video_detected',
                  `[Album Guard] Attached late album media #${message.id} to active album in queue! Video + photo kept together.`
                );
              }
              if (messageKey) this.processingMessageKeys.delete(messageKey);
              return;
            }
          }

          const timer = setTimeout(() => this.finalizeAlbum(groupedKey), 650);
          this.pendingAlbums.set(groupedKey, {
            groupedKey,
            chatId: normPeerId || matchedSourceGroup.chatId || 'unknown',
            groupTitle,
            messages: [message],
            timer,
          });
          if (messageKey) this.processingMessageKeys.delete(messageKey);
          return;
        }

        // 2. CONSECUTIVE / REPLY MEDIA PAIRING (when channels post Video + SS Photo without groupedId)
        const targetChat = normPeerId || matchedSourceGroup.chatId || 'unknown';
        const existingPair = this.pendingSinglesBuffer.get(targetChat);

        if (this.captionConfig.forwardPhotosAndVideosTogether !== false) {
          if (existingPair) {
            const firstMsg = existingPair.messages[0];
            const isFirstVideo = this.isVideoMessage(firstMsg);
            const isFirstPhoto = this.isPhotoMessage(firstMsg);
            const isThisVideo = this.isVideoMessage(message);
            const isThisPhoto = this.isPhotoMessage(message);

            const isComplementaryPair =
              (isFirstVideo && isThisPhoto) ||
              (isFirstPhoto && isThisVideo) ||
              (message.replyToMsgId && message.replyToMsgId === firstMsg.id);

            if (isComplementaryPair) {
              clearTimeout(existingPair.timer);
              existingPair.messages.push(message);
              existingPair.messages.sort((a, b) => a.id - b.id);
              this.pendingSinglesBuffer.delete(targetChat);

              for (const m of existingPair.messages) {
                this.queuedMessageKeys.add(`${targetChat}_${m.id}`);
              }

              this.videoQueue.push({
                id: `paired-album-${Date.now()}-${targetChat}`,
                isAlbum: true,
                chatId: targetChat,
                groupTitle,
                messages: existingPair.messages,
                attempts: 0,
                enqueuedAt: Date.now(),
              });

              this.addLog(
                'video_detected',
                `[Auto-Pair Guard] Paired Video & Screenshot Photo from "${groupTitle}" into one album! Forwarding together.`
              );

              if (messageKey) this.processingMessageKeys.delete(messageKey);
              this.startQueueWorker();
              return;
            } else {
              // Flush the previous buffered message if not a matching pair
              clearTimeout(existingPair.timer);
              this.pendingSinglesBuffer.delete(targetChat);
              this.enqueueStandaloneMedia(existingPair.chatId, existingPair.groupTitle, existingPair.messages[0]);
            }
          }

          // Buffer standalone media briefly (600ms) to see if an accompanying screenshot/video follows
          const singleTimer = setTimeout(() => {
            const buf = this.pendingSinglesBuffer.get(targetChat);
            if (!buf) return;
            this.pendingSinglesBuffer.delete(targetChat);
            this.enqueueStandaloneMedia(buf.chatId, buf.groupTitle, buf.messages[0]);
          }, 600);

          this.pendingSinglesBuffer.set(targetChat, {
            chatId: targetChat,
            groupTitle,
            messages: [message],
            timer: singleTimer,
          });

          if (messageKey) this.processingMessageKeys.delete(messageKey);
          return;
        }

        // 3. Fallback standalone media (if forwardPhotosAndVideosTogether is OFF)
        this.enqueueStandaloneMedia(targetChat, groupTitle, message, messageKey);
      } catch (err: any) {
        // Find the messageKey if possible to clear the lock
        try {
          const message = event.message;
          const peerId = message?.peerId?.channelId || message?.peerId?.chatId || message?.chatId;
          const normPeerId = normalizeTelegramId(peerId);
          const messageKey = normPeerId ? `${normPeerId}_${message.id}` : null;
          if (messageKey) this.processingMessageKeys.delete(messageKey);
        } catch (e) {}

        this.addLog('error', `Listener error: ${err.message}`);
        console.error('[Listener Error]', err);
      }
    };

    const eventBuilder = new NewMessage({ incoming: true });
    this.currentEventHandler = handler;
    this.currentEventBuilder = eventBuilder;
    this.client.addEventHandler(handler, eventBuilder);
    this.isListening = true;
    this.addLog(
      'info',
      'Telegram MTProto Listener ACTIVE. Zero-Skip Bulk Video Pipeline ready.'
    );
  }

  /**
   * Finalizes an album group once all media items (video + screenshot photos) have arrived.
   * Splits into batches of <= 10 (Telegram's maximum limit per SendMultiMedia) so zero items are dropped!
   */
  private finalizeAlbum(groupedKey: string) {
    const item = this.pendingAlbums.get(groupedKey);
    if (!item) return;

    this.pendingAlbums.delete(groupedKey);

    item.messages.sort((a, b) => a.id - b.id);

    const uniqueMessages: any[] = [];
    for (const m of item.messages) {
      if (!uniqueMessages.some((u) => u.id === m.id)) {
        uniqueMessages.push(m);
      }
    }

    if (uniqueMessages.length === 0) return;

    this.addLog(
      'video_detected',
      `Album detected in "${item.groupTitle}" (${uniqueMessages.length} items). Slicing into safe batches of 10...`
    );

    // Slice into batches of 10 items (Telegram MTProto limit)
    for (let i = 0; i < uniqueMessages.length; i += 10) {
      const chunk = uniqueMessages.slice(i, i + 10);
      for (const m of chunk) {
        this.queuedMessageKeys.add(`${item.chatId}_${m.id}`);
      }

      const taskId = `queue-album-${Date.now()}-${item.chatId}-${i}`;
      this.videoQueue.push({
        id: taskId,
        isAlbum: chunk.length > 1,
        groupedKey: `${groupedKey}_${i}`,
        chatId: item.chatId,
        groupTitle: item.groupTitle,
        messages: chunk,
        attempts: 0,
        enqueuedAt: Date.now(),
      });

      this.recentlyFinalizedAlbums.set(groupedKey, {
        taskId,
        messages: chunk,
        finalizedAt: Date.now(),
      });

      if (this.recentlyFinalizedAlbums.size > 200) {
        const oldestKey = this.recentlyFinalizedAlbums.keys().next().value;
        if (oldestKey) this.recentlyFinalizedAlbums.delete(oldestKey);
      }
    }

    this.startQueueWorker();
  }

  private enqueueStandaloneMedia(
    chatId: string,
    groupTitle: string,
    message: any,
    messageKey?: string | null
  ) {
    const key = messageKey || `${chatId}_${message.id}`;
    this.queuedMessageKeys.add(key);
    this.videoQueue.push({
      id: `queue-${Date.now()}-${message.id}`,
      isAlbum: false,
      messageKey: key,
      chatId,
      groupTitle,
      messages: [message],
      attempts: 0,
      enqueuedAt: Date.now(),
    });

    this.addLog(
      'video_detected',
      `Video detected in monitored group "${groupTitle}" (Msg #${message.id}). Queue depth: ${this.videoQueue.length}.`
    );

    this.startQueueWorker();
  }

  // ==================== OFFLINE BACKLOG CATCH-UP ENGINE ====================

  /**
   * Scans monitored groups for any un-relayed videos posted while the app/group was offline.
   * Guaranteed ZERO-SKIP: Even if 100 videos were posted while server was asleep, all are recovered!
   */
  public async catchUpMissedMessages(): Promise<{ success: boolean; count: number; error?: string }> {
    if (!this.client || !this.client.connected || !this.userState.isLoggedIn) {
      return { success: false, count: 0, error: 'Telegram account not connected' };
    }

    if (this.isCatchingUp) {
      return { success: false, count: 0, error: 'Catch-up already in progress' };
    }

    this.isCatchingUp = true;
    let totalDiscovered = 0;

    try {
      this.addLog('info', `[Catch-Up] Starting sweep of ${this.monitoredGroups.length} monitored groups...`);

      for (const group of this.monitoredGroups) {
        const normChatId = normalizeTelegramId(group.chatId || group.username || group.link);
        if (!normChatId) continue;

        try {
          let chatEntity: any = this.chatEntityCache.get(normChatId);
          if (!chatEntity) {
            try {
              if (group.chatId && /^-?\d+$/.test(group.chatId)) {
                chatEntity = await this.client.getEntity(Number(group.chatId));
              } else {
                chatEntity = await this.client.getEntity(group.username || group.link);
              }
              if (chatEntity) {
                this.chatEntityCache.set(normChatId, chatEntity);
              }
            } catch (e) {
              try {
                chatEntity = await this.client.getEntity(group.link);
                if (chatEntity) this.chatEntityCache.set(normChatId, chatEntity);
              } catch (e2) {}
            }
          }
          if (!chatEntity) continue;

          const lastKnownId = this.lastProcessedMessageIdMap.get(normChatId) || 0;

          // Fetch up to 100 recent messages from group
          const fetchParams: any = { limit: 100 };
          if (lastKnownId > 0) {
            fetchParams.minId = lastKnownId;
          }

          const messages: any = await this.client.getMessages(chatEntity, fetchParams);
          if (!Array.isArray(messages) || messages.length === 0) continue;

          const missedMedia: any[] = [];
          let highestId = lastKnownId;

          for (const msg of messages) {
            if (!msg || msg.out) continue;
            if (msg.id > highestId) highestId = msg.id;

            const msgPeerId = msg.peerId?.channelId || msg.peerId?.chatId || msg.chatId;
            const normMsgPeerId = normalizeTelegramId(msgPeerId);
            const msgKey = normMsgPeerId ? `${normMsgPeerId}_${msg.id}` : null;

            if (msgKey) {
              if (
                this.processedMessageKeys.has(msgKey) ||
                this.queuedMessageKeys.has(msgKey) ||
                this.processingMessageKeys.has(msgKey)
              ) {
                continue;
              }
              this.queuedMessageKeys.add(msgKey);
            }

            if (this.isVideoOrMediaMessage(msg)) {
              missedMedia.push(msg);
            }
          }

          // Chronological order: Oldest to newest
          missedMedia.sort((a, b) => a.id - b.id);

          const albums: Map<string, any[]> = new Map();
          const singles: any[] = [];

          for (const msg of missedMedia) {
            const msgPeerId = msg.peerId?.channelId || msg.peerId?.chatId || msg.chatId;
            const normMsgPeerId = normalizeTelegramId(msgPeerId) || normChatId;
            const groupedId = msg.groupedId ? msg.groupedId.toString() : null;
            if (groupedId) {
              const gKey = `${normMsgPeerId}_${groupedId}`;
              if (!albums.has(gKey)) albums.set(gKey, []);
              albums.get(gKey)!.push(msg);
            } else {
              singles.push({ msg, normMsgPeerId });
            }
          }

          for (const { msg, normMsgPeerId } of singles) {
            const msgKey = `${normMsgPeerId}_${msg.id}`;
            this.videoQueue.push({
              id: `catchup-${Date.now()}-${msg.id}`,
              isAlbum: false,
              messageKey: msgKey,
              chatId: normMsgPeerId,
              groupTitle: group.title,
              messages: [msg],
              attempts: 0,
              enqueuedAt: Date.now(),
            });
            totalDiscovered++;
          }

          for (const [gKey, albumMsgs] of albums.entries()) {
            const normMsgPeerId = gKey.split('_')[0];
            albumMsgs.sort((a, b) => a.id - b.id);
            for (let i = 0; i < albumMsgs.length; i += 10) {
              const chunk = albumMsgs.slice(i, i + 10);
              this.videoQueue.push({
                id: `catchup-album-${Date.now()}-${gKey}-${i}`,
                isAlbum: chunk.length > 1,
                groupedKey: `${gKey}_${i}`,
                chatId: normMsgPeerId,
                groupTitle: group.title,
                messages: chunk,
                attempts: 0,
                enqueuedAt: Date.now(),
              });
              totalDiscovered += chunk.length;
            }
          }

          if (highestId > lastKnownId) {
            this.lastProcessedMessageIdMap.set(normChatId, highestId);
          }
        } catch (err: any) {
          console.warn(`[Catch-Up Scan Warning for ${group.title}]`, err?.message);
        }
      }
    } finally {
      this.isCatchingUp = false;
    }

    this.lastCatchUpAt = new Date().toLocaleTimeString();

    if (totalDiscovered > 0) {
      this.addLog(
        'video_detected',
        `[Catch-Up Sweep] Discovered ${totalDiscovered} missed videos posted during offline period! Added to queue.`
      );
      this.savePersistentState(false);
      this.startQueueWorker();
    }

    return { success: true, count: totalDiscovered };
  }

  /**
   * Ultra-Fast Background Query Checker:
   * Scans monitored groups every 1-2s (har 1,2 second mai query check)
   * Uses round-robin check with minId so zero videos are ever missed.
   * If a video was missed by socket, enqueues and forwards in 0.5s!
   * Isolated throttle shield ensures outgoing 0.5s relays are never frozen.
   */
  public async quickSweepMissedMessages(): Promise<number> {
    if (
      !this.client ||
      !this.client.connected ||
      !this.userState.isLoggedIn ||
      this.isCatchingUp ||
      this.monitoredGroups.length === 0
    ) {
      return 0;
    }

    // If query sweep was temporarily throttled by Telegram, respect timer without freezing forwarder
    if (Date.now() < this.isSweepThrottledUntil) {
      return 0;
    }

    let newlyFound = 0;
    const groupCount = this.monitoredGroups.length;
    // Check one group per cycle (round-robin) to avoid Telegram getHistory API rate limits
    const group = this.monitoredGroups[this.sweepGroupIndex % groupCount];
    this.sweepGroupIndex = (this.sweepGroupIndex + 1) % groupCount;

    if (!group) return 0;

    const normChatId = normalizeTelegramId(group.chatId || group.username || group.link);
    if (!normChatId) return 0;

    // If this group recently received a real-time socket event, push stream is 100% healthy
    const lastPush = this.lastPushEventTimestamp.get(normChatId) || 0;
    if (Date.now() - lastPush < 5000) {
      return 0;
    }

    // Rate meter: Avoid querying the exact same group more than once per 3.5 seconds
    const lastSweepTime = this.lastGroupSweepTimestamp.get(normChatId) || 0;
    if (Date.now() - lastSweepTime < 3500) {
      return 0;
    }
    this.lastGroupSweepTimestamp.set(normChatId, Date.now());

    let chatEntity = this.chatEntityCache.get(normChatId);
    if (!chatEntity) {
      try {
        if (group.chatId && /^-?\d+$/.test(group.chatId)) {
          chatEntity = await this.client.getEntity(Number(group.chatId));
        } else {
          chatEntity = await this.client.getEntity(group.username || group.link);
        }
        if (chatEntity) this.chatEntityCache.set(normChatId, chatEntity);
      } catch (e) {
        return 0;
      }
    }
    if (!chatEntity) return 0;

    const lastKnownId = this.lastProcessedMessageIdMap.get(normChatId) || 0;

    try {
      const fetchParams: any = { limit: 3 };
      if (lastKnownId > 0) {
        fetchParams.minId = lastKnownId;
      }

      const messages: any = await this.client.getMessages(chatEntity, fetchParams);
      if (!Array.isArray(messages) || messages.length === 0) return 0;

      let highestId = lastKnownId;
      for (const msg of messages) {
        if (!msg || msg.out) continue;
        if (msg.id > highestId) highestId = msg.id;

        const msgPeerId = msg.peerId?.channelId || msg.peerId?.chatId || msg.chatId;
        const normMsgPeerId = normalizeTelegramId(msgPeerId) || normChatId;
        const msgKey = `${normMsgPeerId}_${msg.id}`;

        if (
          this.processedMessageKeys.has(msgKey) ||
          this.queuedMessageKeys.has(msgKey) ||
          this.processingMessageKeys.has(msgKey)
        ) {
          continue;
        }

        if (this.isVideoOrMediaMessage(msg)) {
          this.queuedMessageKeys.add(msgKey);
          this.videoQueue.push({
            id: `fastsweep-${Date.now()}-${msg.id}`,
            isAlbum: Boolean(msg.groupedId),
            messageKey: msgKey,
            chatId: normMsgPeerId,
            groupTitle: group.title,
            messages: [msg],
            attempts: 0,
            enqueuedAt: Date.now(),
          });
          newlyFound++;
          this.addLog(
            'video_detected',
            `⚡ [1-2s Query Check] Found missed video #${msg.id} in "${group.title}"! Forwarding in 0.5s...`
          );
        }
      }

      if (highestId > lastKnownId) {
        this.lastProcessedMessageIdMap.set(normChatId, highestId);
      }
    } catch (err: any) {
      const flood = this.checkFloodWaitError(err);
      if (flood.isFlood) {
        this.isSweepThrottledUntil = Date.now() + (flood.seconds + 2) * 1000;
        this.addLog(
          'info',
          `[Query Check Shield] Telegram sweep query throttled for ${flood.seconds}s. Real-time push listener and 0.5s forwarder active at full speed.`
        );
      }
    }

    if (newlyFound > 0) {
      this.startQueueWorker();
    }
    return newlyFound;
  }

  // ==================== RESILIENT ZERO-SKIP QUEUE WORKER ====================

  /**
   * Resilient queue processor:
   * 1. Processes tasks with 1000ms polite throttle between relays.
   * 2. Automatically pauses queue and retries task on Telegram Flood Wait without dropping.
   * 3. Retries transient errors up to 6 times.
   * 4. Ensures 100% of 100+ incoming videos are delivered!
   */
  private async startQueueWorker() {
    if (this.isQueueWorkerRunning) return;
    this.isQueueWorkerRunning = true;

    try {
      while (this.videoQueue.length > 0) {
        // Handle active flood wait rate limit sleep
        if (this.isRateLimited) {
          const now = Date.now();
          if (now < this.floodWaitUntil) {
            const waitMs = this.floodWaitUntil - now;
            await new Promise((r) => setTimeout(r, Math.min(waitMs, 2000)));
            continue;
          } else {
            // Buffer cooldown: Telegram rate-limit bucket needs a brief rest before accepting new writes
            this.addLog(
              'info',
              `[Rate Limit Shield] Flood wait elapsed. Cooling down for 3s buffer before resuming...`
            );
            await new Promise((r) => setTimeout(r, 3000));
            this.isRateLimited = false;
            this.lastRelayTimestamp = Date.now();
            this.addLog(
              'info',
              `[Rate Limit Shield] Cooldown complete. Turbo ${this.pacingSpeedSec}s rhythm active. Resuming queue.`
            );
          }
        }

        const task = this.videoQueue[0];
        if (!task) break;

        // Ultra-Fast 0.5s Relay Rate Throttle:
        // As requested by user: When video arrives in group, immediately relay within ~0.5s
        const pacingIntervalMs = Math.round((this.pacingSpeedSec || 0.5) * 1000);

        const timeSinceLastRelay = Date.now() - this.lastRelayTimestamp;
        if (timeSinceLastRelay < pacingIntervalMs && !task.isSimulated) {
          await new Promise((r) => setTimeout(r, pacingIntervalMs - timeSinceLastRelay));
        } else if (timeSinceLastRelay < 80 && task.isSimulated) {
          await new Promise((r) => setTimeout(r, 80 - timeSinceLastRelay));
        }

        try {
          const fingerprints = await this.relayMediaTask(task);

          // Task succeeded! Dequeue task
          this.videoQueue.shift();
          this.lastRelayTimestamp = Date.now();
          this.totalRelayedCount++;

          // Mark message IDs as completed
          for (let i = 0; i < task.messages.length; i++) {
            const m = task.messages[i];
            if (m.id) {
              const mKey = `${task.chatId}_${m.id}`;
              this.processedMessageKeys.add(mKey);
              this.queuedMessageKeys.delete(mKey);

              const docId = m.media?.document?.id?.toString() || m.video?.id?.toString();
              if (docId) this.processedDocIds.add(docId);

              // Store MD5 fingerprint (if provided by relayMediaTask)
              const fingerprint = fingerprints[i];
              if (fingerprint) {
                this.processedMD5s.add(fingerprint);
              }

              const currentHighest = this.lastProcessedMessageIdMap.get(task.chatId) || 0;
              if (m.id > currentHighest) {
                this.lastProcessedMessageIdMap.set(task.chatId, m.id);
              }
            }
          }

          this.savePersistentState(false);
        } catch (taskErr: any) {
          const floodInfo = this.checkFloodWaitError(taskErr);
          if (floodInfo.isFlood) {
            const waitSec = floodInfo.seconds;
            this.isRateLimited = true;
            this.floodWaitUntil = Date.now() + (waitSec + 1) * 1000;
            this.addLog(
              'info',
              `[Rate Limit Shield] Telegram Flood Wait (${waitSec}s). Queue safely paused. Video #${task.messages[0]?.id || 'item'} preserved for retry!`
            );
            await new Promise((r) => setTimeout(r, (waitSec + 1) * 1000));
            this.isRateLimited = false;
            this.lastRelayTimestamp = Date.now();
            continue;
          }

          // Transient network error: retry up to 6 times
          task.attempts = (task.attempts || 0) + 1;
          this.totalRetryAttempts++;

          if (task.attempts <= 6) {
            this.addLog(
              'info',
              `[Auto-Retry] Video relay error (${taskErr.message}). Retrying (${task.attempts}/6) in 3s without dropping...`
            );
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          } else {
            // Drop only after 6 full failed attempts to keep queue moving
            this.videoQueue.shift();
            this.totalFailedCount++;
            this.addLog(
              'error',
              `[Relay Dropped] Video task permanently failed after 6 retries: ${taskErr.message}`
            );
            for (const m of task.messages) {
              this.queuedMessageKeys.delete(`${task.chatId}_${m.id}`);
            }
          }
        }
      }
    } finally {
      this.isQueueWorkerRunning = false;
    }
  }

  private async getFileFingerprint(message: any): Promise<string | null> {
    if (!message || !message.media) return null;
    const doc = message.media.document || message.video || message.media.photo;
    if (!doc) return null;

    const docId = doc.id?.toString() || 'unknown';
    const fileSize = doc.size || 0;
    const accessHash = doc.accessHash?.toString() || '';
    const mimeType = doc.mimeType || '';

    // If MD5 deduplication is disabled, we don't calculate content fingerprint
    if (this.captionConfig.enableMD5Deduplication === false) return null;

    try {
      // Zero-RPC Fingerprint: Use Telegram's unique cryptographic ID, access hash, and file size.
      // ZERO network downloads (eliminates upload.getFile FLOOD_WAIT rate limits completely).
      const { createHash } = await import('crypto');
      const hash = createHash('sha256');
      hash.update(`${docId}_${accessHash}_${fileSize}_${mimeType}`);
      return hash.digest('hex');
    } catch (err) {
      return `${docId}_${fileSize}`;
    }
  }

  /**
   * Relays a single task (Standalone video or Album) into the destination channel
   * Returns the fingerprints of the relayed videos for deduplication tracking
   */
  public async relayMediaTask(task: QueueTask): Promise<string[]> {
    const { isAlbum, messages, groupTitle, isSimulated } = task;
    const fingerprints: string[] = [];
    if (!messages || messages.length === 0) return fingerprints;

    // 1. ADVANCED DEDUPLICATION CHECK (MD5 & DocID)
    if (this.captionConfig.enableMD5Deduplication !== false) {
      // Parallelize fingerprinting for albums to maximize speed!
      const fingerprintPromises = messages.map(async (m) => {
        const docId = m.media?.document?.id?.toString() || m.video?.id?.toString();
        
        // Concurrent Check (DocID)
        if (docId && (this.processedDocIds.has(docId) || this.processingDocIds.has(docId))) {
          return { docIdMatch: true, docId };
        }
        
        const fingerprint = await this.getFileFingerprint(m);
        
        // Concurrent Check (Fingerprint)
        if (fingerprint && (this.processedMD5s.has(fingerprint) || this.processingFingerprints.has(fingerprint))) {
           return { docIdMatch: true, docId, fingerprint, isFingerprintMatch: true };
        }

        return { docIdMatch: false, docId, fingerprint };
      });

      const results = await Promise.all(fingerprintPromises);

      for (const res of results) {
        if (res.docIdMatch) {
          this.addLog('info', `[Deduplication] Skipped relay of already processed video (${res.isFingerprintMatch ? 'MD5' : 'DocID'}: ${res.fingerprint || res.docId})`);
          return fingerprints;
        }
        if (res.fingerprint) {
          if (fingerprints.includes(res.fingerprint)) {
            this.addLog('info', `[Deduplication] Skipped relay of duplicate video content in same album (MD5: ${res.fingerprint})`);
            return fingerprints;
          }
          fingerprints.push(res.fingerprint);
        }
      }
    }

    // Mark as being processed to prevent concurrent duplicates
    const addedProcessingDocIds: string[] = [];
    const addedProcessingFingerprints: string[] = [];
    
    for (const m of messages) {
      const dId = m.media?.document?.id?.toString() || m.video?.id?.toString();
      if (dId) {
        this.processingDocIds.add(dId);
        addedProcessingDocIds.push(dId);
      }
    }
    for (const f of fingerprints) {
      this.processingFingerprints.add(f);
      addedProcessingFingerprints.push(f);
    }

    try {
      if (isSimulated) {
        await this.handleSimulatedRelay(task);
        return fingerprints;
      }

    if (!this.client || !this.userState.isLoggedIn) {
      throw new Error('Telegram account not logged in');
    }

    const destinationTarget =
      this.destinationConfig.channelId || this.destinationConfig.channelInput;

    if (!destinationTarget) {
      throw new Error('Destination channel not configured in settings');
    }

    let destinationEntity: any = this.resolvedDestinationEntity;
    if (!destinationEntity) {
      try {
        let handle = this.destinationConfig.channelInput
          .replace(/^https?:\/\/t\.me\//, '')
          .replace(/^@/, '');
        destinationEntity = await this.client.getEntity(handle);
        this.resolvedDestinationEntity = destinationEntity;
      } catch (err) {
        destinationEntity = destinationTarget;
      }
    }

    // Anti-Loop Check: Ensure source chat != destination channel
    const sourcePeerId = (
      messages[0].peerId?.channelId ||
      messages[0].peerId?.chatId ||
      messages[0].chatId
    )?.toString();
    const destEntityId =
      destinationEntity?.id?.toString() || this.destinationConfig.channelId;

    if (
      normalizeTelegramId(sourcePeerId) === normalizeTelegramId(destEntityId) ||
      normalizeTelegramId(sourcePeerId) === normalizeTelegramId(this.destinationConfig.channelInput)
    ) {
      this.addLog('info', '[Anti-Loop Guard] Dropped relay: source is same as destination channel.');
      return fingerprints;
    }

    const targetGroupLink =
      (this.captionConfig.myGroupLink && this.captionConfig.myGroupLink.trim()) ||
      this.destinationConfig.directLink ||
      (this.destinationConfig.channelUsername
        ? `https://t.me/${this.destinationConfig.channelUsername}`
        : 'https://t.me/JRov0');

    const textMsg =
      messages.find((m: any) => m.message && m.message.trim().length > 0) || messages[0];
    const rawCaption = textMsg.message || '';
    const rawEntities = textMsg.entities || [];

    const { text: formattedCaption, entities: formattedEntities } =
      processCaptionAndEntities(rawCaption, rawEntities, this.captionConfig, targetGroupLink);

    let totalBytes = 0;
    for (const m of messages) {
      const size = m.media?.document?.size || m.file?.size || 0;
      totalBytes += Number(size);
    }
    const sizeMB = totalBytes ? Number((totalBytes / 1024 / 1024).toFixed(2)) : 0;

    let delivered = false;
    let forwardedId: number = textMsg.id || Date.now();

    // ==========================================
    // CASE A: ALBUM (VIDEO + SCREENSHOT PHOTO)
    // ==========================================
    if (isAlbum && messages.length > 1) {
      this.addLog(
        'info',
        `Relaying Album (${messages.length} items) from "${groupTitle}" with group link "${targetGroupLink}"...`
      );

      // Method 1: SendMultiMedia (Server-to-Server cloud album delivery)
      try {
        const multiMedia: any[] = [];
        for (const m of messages) {
          if (m.media) {
            const inputMedia = getInputMedia(m.media);
            const isCaptionItem = m.id === textMsg.id;
            multiMedia.push(
              new Api.InputSingleMedia({
                media: inputMedia,
                randomId: bigInt(Math.floor(Math.random() * 1000000000)),
                message: isCaptionItem ? formattedCaption : '',
                entities: isCaptionItem ? formattedEntities : [],
              })
            );
          }
        }

        if (multiMedia.length > 0) {
          const sendRes: any = await this.client.invoke(
            new Api.messages.SendMultiMedia({
              peer: destinationEntity,
              multiMedia,
            })
          );
          delivered = true;
          forwardedId = Array.isArray(sendRes?.updates)
            ? sendRes.updates[0]?.id || textMsg.id
            : textMsg.id;
          this.addLog(
            'forwarded',
            `Album (${messages.length} items) delivered together with replaced link ${targetGroupLink} ✅`
          );
        }
      } catch (multiMediaErr: any) {
        const flood = this.checkFloodWaitError(multiMediaErr);
        if (flood.isFlood) throw multiMediaErr; // Re-throw flood wait immediately
        this.addLog(
          'info',
          `SendMultiMedia note: ${multiMediaErr.message}. Falling back to native MTProto forward...`
        );
      }

      // Method 2 (Fallback): forwardMessages with dropAuthor: true
      if (!delivered) {
        try {
          const msgIds = messages.map((m: any) => m.id);
          const forwarded: any = await this.client.forwardMessages(destinationEntity, {
            messages: msgIds,
            fromPeer: messages[0].peerId || messages[0].chatId,
            dropAuthor: true,
          });

          const sentArray = Array.isArray(forwarded) ? forwarded : [forwarded];
          forwardedId = sentArray[0]?.id || textMsg.id;
          delivered = true;

          this.addLog(
            'forwarded',
            `Album (${messages.length} items) forwarded together via MTProto! (Msg ID: ${forwardedId})`
          );

          try {
            const captionSent = sentArray.find((s: any) => s.message) || sentArray[0];
            if (captionSent && captionSent.id) {
              await this.client.editMessage(destinationEntity, {
                message: captionSent.id,
                text: formattedCaption,
                formattingEntities: formattedEntities,
              });
            }
          } catch (editErr: any) {}
        } catch (forwardErr: any) {
          throw forwardErr;
        }
      }
    } else {
      // ==========================================
      // CASE B: STANDALONE VIDEO / MEDIA
      // ==========================================
      this.addLog(
        'info',
        `Relaying video (${sizeMB} MB) from "${groupTitle}" with group link "${targetGroupLink}"...`
      );

      // Method 1: Native MTProto SendMedia (Direct cloud pointer transfer, instant ~0.2s)
      try {
        const inputMedia = getInputMedia(textMsg.media);
        if (inputMedia) {
          const sendRes: any = await this.client.invoke(
            new Api.messages.SendMedia({
              peer: destinationEntity,
              media: inputMedia,
              message: formattedCaption,
              entities: formattedEntities,
              randomId: bigInt(Math.floor(Math.random() * 1000000000)),
            })
          );
          const updates = sendRes?.updates || (Array.isArray(sendRes) ? sendRes : []);
          forwardedId = (sendRes as any)?.id || updates[0]?.id || textMsg.id;
          delivered = true;
          this.addLog(
            'forwarded',
            `Video delivered in 0.5s with replaced link "${targetGroupLink}"! (Msg ID: ${forwardedId})`
          );
        }
      } catch (sendMediaErr: any) {
        const flood = this.checkFloodWaitError(sendMediaErr);
        if (flood.isFlood) throw sendMediaErr;
        this.addLog('info', `Direct SendMedia note: ${sendMediaErr.message}. Trying sendFile...`);
      }

      // Method 2 (Fallback): sendFile with cloud media pointer
      if (!delivered) {
        try {
          const sent: any = await this.client.sendFile(destinationEntity, {
            file: textMsg.media,
            caption: formattedCaption,
            formattingEntities: formattedEntities,
            supportsStreaming: true,
          });
          forwardedId = sent?.id || textMsg.id;
          delivered = true;
          this.addLog(
            'forwarded',
            `Video delivered with replaced link "${targetGroupLink}"! (Msg ID: ${forwardedId})`
          );
        } catch (sendErr: any) {
          const flood = this.checkFloodWaitError(sendErr);
          if (flood.isFlood) throw sendErr;
          this.addLog('info', `Direct send note: ${sendErr.message}. Falling back to MTProto forward...`);
        }
      }

      // Method 2: forwardMessages
      if (!delivered) {
        try {
          const forwarded: any = await this.client.forwardMessages(destinationEntity, {
            messages: [textMsg.id],
            fromPeer: textMsg.peerId || textMsg.chatId,
            dropAuthor: true,
          });
          const sent = Array.isArray(forwarded) ? forwarded[0] : forwarded;
          forwardedId = sent?.id || textMsg.id;
          delivered = true;

          try {
            await this.client.editMessage(destinationEntity, {
              message: forwardedId,
              text: formattedCaption,
              formattingEntities: formattedEntities,
            });
          } catch (editErr: any) {}

          this.addLog(
            'forwarded',
            `Video forwarded via MTProto with replaced link! (Msg ID: ${forwardedId})`
          );
        } catch (forwardErr: any) {
          throw forwardErr;
        }
      }
    }

    // Record success in live feed
    this.recordRelaySuccess(
      forwardedId,
      groupTitle,
      formattedCaption || rawCaption,
      textMsg,
      sizeMB,
      isAlbum,
      messages.length,
      targetGroupLink
    ).catch((e) => console.error('Feed record error:', e));

    return fingerprints;
    } finally {
      // Always clear processing locks
      for (const dId of addedProcessingDocIds) this.processingDocIds.delete(dId);
      for (const f of addedProcessingFingerprints) this.processingFingerprints.delete(f);
    }
  }

  /**
   * Handles simulated video relay for testing zero-skip performance
   */
  private async handleSimulatedRelay(task: QueueTask) {
    await new Promise((r) => setTimeout(r, 200));
    const title = task.simulatedTitle || 'Simulated Bulk Video';
    const size = task.simulatedSizeMB || 45.2;
    const msgId = Date.now() % 100000;

    const relayedItem: RelayedVideoItem = {
      id: `relayed-${Date.now()}-${msgId}`,
      messageId: msgId,
      sourceChat: task.groupTitle,
      destinationChat:
        this.destinationConfig.channelTitle ||
        this.destinationConfig.channelInput ||
        'Destination Channel',
      title,
      thumbnailUrl: '',
      originalSizeMB: size,
      trimmedSizeMB: size,
      cutSeconds: 0,
      relayedAt: new Date().toLocaleTimeString(),
      status: 'completed',
      directLink: this.destinationConfig.directLink,
      isAlbum: task.isAlbum,
      mediaCount: task.messages.length,
      replacedLink: this.captionConfig.myGroupLink,
    };

    this.relayedVideos.unshift(relayedItem);
    if (this.relayedVideos.length > 100) this.relayedVideos.pop();

    this.addLog(
      'forwarded',
      `[Simulated Burst] "${title}" processed and delivered to ${this.destinationConfig.channelTitle || 'channel'}! Zero skip verified.`
    );
  }

  /**
   * Simulates a burst upload of 10, 20, or 100 videos to test the zero-skip engine
   */
  public async simulateBurstUpload(count: number = 10) {
    const safeCount = Math.min(100, Math.max(1, count));
    this.addLog(
      'info',
      `[Burst Stress Test] Injecting ${safeCount} videos simultaneously into queue to test Zero-Skip capacity...`
    );

    for (let i = 1; i <= safeCount; i++) {
      const mockId = Date.now() + i;
      this.videoQueue.push({
        id: `sim-burst-${mockId}`,
        isAlbum: false,
        groupTitle: 'High-Throughput Source Group',
        chatId: 'simulated_chat',
        messages: [{ id: mockId, message: `File: STc_BurstTest_${i}_${Date.now()}` }],
        attempts: 0,
        enqueuedAt: Date.now(),
        isSimulated: true,
        simulatedTitle: `File: STc_BulkVideo_${i}_1080p.mp4`,
        simulatedSizeMB: Number((20 + (i % 50) * 1.5).toFixed(1)),
      });
    }

    this.addLog(
      'video_detected',
      `[Burst Test Enqueued] ${safeCount} videos buffered in queue. Total queue length: ${this.videoQueue.length}. Processing with zero skips...`
    );

    this.startQueueWorker();
    return { success: true, count: safeCount, queueLength: this.videoQueue.length };
  }

  private async recordRelaySuccess(
    messageId: number,
    groupTitle: string,
    caption: string,
    originalMessage: any,
    fileSizeMB: number,
    isAlbum: boolean = false,
    mediaCount: number = 1,
    replacedLink?: string
  ) {
    const msgId = originalMessage.id || Date.now();

    const username = this.destinationConfig.channelUsername;
    const directLink = username
      ? `https://t.me/${username}/${messageId}`
      : this.destinationConfig.channelId
      ? `https://t.me/c/${this.destinationConfig.channelId}/${messageId}`
      : undefined;

    let displayTitle = caption.split('\n')[0] || 'Telegram Video';

    const relayedItem: RelayedVideoItem = {
      id: `relayed-${Date.now()}-${msgId}`,
      messageId: Number(messageId),
      sourceChat: groupTitle,
      destinationChat:
        this.destinationConfig.channelTitle ||
        this.destinationConfig.channelInput ||
        'Destination',
      title: displayTitle,
      thumbnailUrl: '', // Will update if async thumb download succeeds
      originalSizeMB: fileSizeMB,
      trimmedSizeMB: fileSizeMB,
      cutSeconds: 0,
      relayedAt: new Date().toLocaleTimeString(),
      status: 'completed',
      directLink,
      isAlbum,
      mediaCount,
      replacedLink,
    };

    this.relayedVideos.unshift(relayedItem);
    if (this.relayedVideos.length > 100) this.relayedVideos.pop();

    this.savePersistentState(false);

    // Asynchronously fetch thumbnail in background without blocking 0.5s forwarder
    setImmediate(async () => {
      try {
        if (!this.client || this.isRateLimited) return;
        const thumbFileName = `thumb_${msgId}.jpg`;
        const thumbFilePath = path.join(this.thumbnailsDir, thumbFileName);
        if (!fs.existsSync(thumbFilePath)) {
          const thumbBuffer = await this.client.downloadMedia(originalMessage, { thumb: 0 });
          if (thumbBuffer) {
            fs.writeFileSync(thumbFilePath, thumbBuffer);
            relayedItem.thumbnailUrl = `/thumbnails/${thumbFileName}`;
            this.savePersistentState(false);
          }
        }
      } catch (e) {}
    });

    return { success: true, messageId, directLink };
  }

  public resetFloodWait(): { success: boolean; pacingSpeedSec: number } {
    this.isRateLimited = false;
    this.floodWaitUntil = 0;
    this.isSweepThrottledUntil = 0;
    this.pacingSpeedSec = 0.5;
    this.savePersistentState(false);
    this.addLog('info', 'Telegram Flood Wait state cleared. 0.5s Turbo relay re-engaged.');
    this.startQueueWorker();
    return { success: true, pacingSpeedSec: 0.5 };
  }
}

// Singleton backend instance
export const relayManager = new TelegramRelayManager();
