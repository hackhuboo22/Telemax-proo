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

export interface TelegramCredentials {
  apiId: string;
  apiHash: string;
  phoneNumber: string;
  botToken?: string;
  sessionString?: string;
  twoFactorPassword?: string;
  authStatus: 'disconnected' | 'connecting' | 'awaiting_code' | 'connected' | 'error';
  userProfile?: {
    id: number | string;
    firstName: string;
    username?: string;
    phone: string;
    avatarUrl?: string;
  };
  botProfile?: any;
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

export interface ChannelRoute {
  id: string;
  name: string;
  sourceChat: string;
  sourceTitle: string;
  destinationChat: string;
  destinationTitle: string;
  enabled: boolean;
  cutDurationSeconds: number;
  removeLinks: boolean;
  stripUsernames: boolean;
  stripPromoKeywords: boolean;
  customWatermark?: string;
  filterMinDuration: number;
  filterMaxDuration: number;
  filterMaxSizeMB: number;
  reuploadAsVideo: boolean;
}

export interface VideoJob {
  id: string;
  routeId: string;
  sourceChat: string;
  destinationChat: string;
  messageId: number;
  fileName: string;
  originalDuration: number;
  trimmedDuration: number;
  originalSizeMB: number;
  trimmedSizeMB: number;
  thumbnailUrl: string;
  originalCaption: string;
  cleanedCaption: string;
  hasLinks: boolean;
  linksRemoved: string[];
  status: 'queued' | 'downloading' | 'trimming' | 'cleaning' | 'uploading' | 'completed' | 'failed';
  progress: number;
  timestamp: string;
  previewVideoUrl?: string;
  trimmedVideoUrl?: string;
  errorMessage?: string;
  directLink?: string;
}

export interface SanitizerResult {
  originalCaption: string;
  cleanedCaption: string;
  hasLinks: boolean;
  linksFound: string[];
  removedCount: number;
}

export interface FirestoreQuotaInfo {
  quotaExceeded: boolean;
  quotaExceededAt?: number;
  upgradeUrl?: string;
  pricingUrl?: string;
}

export interface QueueStats {
  pendingCount: number;
  isProcessing: boolean;
  totalRelayed: number;
  totalFailed: number;
  retryAttempts: number;
  isRateLimited: boolean;
  floodWaitSeconds: number;
  zeroSkipActive: boolean;
  lastCatchUpAt?: string;
  burstCapacity: number;
  pacingSpeedSec?: number | string;
}

