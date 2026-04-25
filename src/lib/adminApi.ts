import { supabase } from "@/integrations/supabase/client";

const TRANSIENT_ADMIN_API_ERROR = /503|temporarily unavailable|SUPABASE_EDGE_RUNTIME_ERROR|BOOT_ERROR|failed to fetch|network/i;
const ADMIN_API_BACKOFFS_MS = [500, 1500];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type FunctionErrorDetails = {
  message: string;
  code?: string;
  status?: number;
};

async function readFunctionError(error: unknown): Promise<FunctionErrorDetails> {
  const err = error as { message?: string; context?: Response } | null;
  const details: FunctionErrorDetails = {
    message: err?.message || "Falha ao carregar dados",
    status: err?.context?.status,
  };

  const response = err?.context;
  if (response && typeof response.clone === "function") {
    try {
      const parsed = await response.clone().json();
      if (parsed && typeof parsed === "object") {
        const body = parsed as { code?: unknown; message?: unknown; error?: unknown };
        details.code = body.code == null ? undefined : String(body.code);
        details.message = String(body.message ?? body.error ?? details.message);
      }
    } catch {
      // Keep the SDK message when the body is not JSON.
    }
  }

  return details;
}

function isTransient(details: FunctionErrorDetails): boolean {
  if (details.status === 503) return true;
  return TRANSIENT_ADMIN_API_ERROR.test(`${details.code ?? ""} ${details.message}`);
}

export async function invokeAdminApi<T>(
  action: string,
  payload?: Record<string, unknown>,
  retries = 2,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const { data, error } = await supabase.functions.invoke("admin-api", {
        body: { action, payload },
      });

      if (error) {
        const details = await readFunctionError(error);
        const e = new Error(details.message) as Error & FunctionErrorDetails;
        e.code = details.code;
        e.status = details.status;
        throw e;
      }

      if ((data as { error?: string } | null)?.error) {
        throw new Error((data as { error: string }).error);
      }

      return data as T;
    } catch (error) {
      lastError = error;
      const details: FunctionErrorDetails = {
        message: error instanceof Error ? error.message : String(error),
        code: (error as { code?: string })?.code,
        status: (error as { status?: number })?.status,
      };

      if (attempt >= retries || !isTransient(details)) break;
      await wait(ADMIN_API_BACKOFFS_MS[attempt] ?? 1500);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Falha ao carregar dados");
}