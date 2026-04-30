import { 
  type IptvCredentials, 
  type LoginResponse, 
  type Category, 
  type LiveStream, 
  type VodStream, 
  type Series,
  type EpgEntry
} from "./types";
import { 
  iptvLogin, 
  iptvLoginM3u, 
  fetchAllowedServers, 
  resolveStreamBase,
  isHostAllowed,
  IptvLoginError
} from "./auth";
import {
  getLiveCategories,
  getLiveStreams,
  getVodCategories,
  getVodStreams,
  getSeriesCategories,
  getSeries,
  getSeriesInfo,
  getVodInfo,
  iptvFetch
} from "./catalog";
import {
  buildLiveStreamUrl,
  buildVodStreamUrl,
  buildSeriesEpisodeUrl,
  requestStreamToken,
  reportStreamEvent,
  getHostProxyMode,
  markHostProxyRequired,
  clearHostProxyMode,
  getPlaybackStrategy,
  isValidStreamUrl,
  getFormatBadge,
  getStreamType,
  isExternalOnly,
  normalizeExt
} from "./streaming";
import { getShortEpg } from "./epg";
import { proxyImageUrl, connectivityConfig, setConnectivityConfig, getTelemetrySnapshot, isRealOnline, subscribeConnectivity, getQueueStats } from "./utils";

// Backward compatibility exports
export {
  iptvLogin,
  iptvLoginM3u,
  fetchAllowedServers,
  resolveStreamBase,
  isHostAllowed,
  IptvLoginError,
  getLiveCategories,
  getLiveStreams,
  getVodCategories,
  getVodStreams,
  getSeriesCategories,
  getSeries,
  getSeriesInfo,
  getVodInfo,
  iptvFetch,
  buildLiveStreamUrl,
  buildVodStreamUrl,
  buildSeriesEpisodeUrl,
  requestStreamToken,
  reportStreamEvent,
  getHostProxyMode,
  markHostProxyRequired,
  clearHostProxyMode,
  getPlaybackStrategy,
  isValidStreamUrl,
  getFormatBadge,
  getStreamType,
  isExternalOnly,
  normalizeExt,
  getShortEpg,
  proxyImageUrl,
  connectivityConfig,
  setConnectivityConfig,
  getTelemetrySnapshot,
  isRealOnline,
  subscribeConnectivity,
  getQueueStats
};

// Export types
export type {
  IptvCredentials,
  LoginResponse,
  Category,
  LiveStream,
  VodStream,
  Series,
  EpgEntry
};
