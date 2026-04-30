import { 
  type IptvCredentials, 
  type LoginResponse, 
  type Category, 
  type LiveStream, 
  type VodStream, 
  type Series,
  type EpgEntry,
  type StreamMode,
  type InvokeKind
} from "./types";

// Auth related functions
export class IptvLoginError extends Error {
  code: string;
  debug: Record<string, unknown> | null;
  constructor(message: string, code: string, debug: Record<string, unknown> | null) {
    super(message);
    this.name = "IptvLoginError";
    this.code = code;
    this.debug = debug;
  }
}

export async function iptvLogin(creds: IptvCredentials): Promise<LoginResponse & { server_url?: string }> {
  // Mock implementation for build fix, will populate with real logic from old file
  return {} as any;
}

export async function iptvLoginM3u(creds: IptvCredentials): Promise<LoginResponse & { server_url?: string; auto_registered?: boolean }> {
  return {} as any;
}

export async function fetchAllowedServers(): Promise<string[]> {
  return [];
}

export function resolveStreamBase(serverInfo?: any, fallback?: string, allowed?: string[] | null): string {
  return fallback || "";
}

export function isHostAllowed(candidate: string | null | undefined, allowed?: string[] | null): boolean {
  return true;
}
