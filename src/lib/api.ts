export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://backenddevmasters-production.up.railway.app/api/v1"
).replace(/\/$/, "");

const SESSION_STORAGE_KEY = "admin-dashboard.session";

export type AdminUser = {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: "ADMIN" | "USER" | "MODERATOR" | string;
  email_verified?: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  is_active: boolean;
  account_locked_until?: string | null;
  date_joined?: string;
};

export type AuthSession = {
  user: AdminUser;
  accessToken: string;
  refreshToken: string;
};

export type LoginResponse =
  | {
      user: AdminUser;
      access: string;
      refresh: string;
    }
  | {
      message: string;
      user_id: number;
    };

export type RefreshResponse = {
  access: string;
  refresh?: string;
};

export type ApiMessage = {
  message?: string;
  detail?: string;
  status?: string;
  error?: string;
};

export type ReadinessStatus = {
  status: string;
  environment: string;
  checks: Record<string, string>;
};

export type LivenessStatus = {
  status: string;
  time: string;
};

export type ApiVersions = {
  default: string;
  supported: string[];
  deprecated: string[];
  deprecation_policy_url: string;
};

export type CoreMetrics = {
  requests_total: number;
  slow_requests_total: number;
  status_counts: Record<string, number>;
};

export type AdminUsersResponse = {
  users: AdminUser[];
  total_pages: number;
  current_page: number;
  count?: number;
};

export type SecurityDashboard = {
  total_users: number;
  failed_logins_24h: number;
  successful_logins_24h: number;
  locked_accounts: number;
  blocked_ips: number;
  recent_security_events: Array<{
    event: string;
    user: string | null;
    time: string;
  }>;
};

export type SuspiciousLogin = {
  email: string;
  ip: string;
  device: string;
  time: string;
};

export type TopAttackingIp = {
  ip_address: string;
  attempts: number;
};

export type BlockedIp = {
  ip: string;
  reason: string;
  blocked_at: string;
  blocked_until: string | null;
  is_active: boolean;
};

export type SecurityAlert = {
  id: number;
  title: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical" | string;
  ip: string | null;
  created_at: string;
  resolved: boolean;
};

export type DeviceSessionRecord = {
  id: string;
  device: string;
  ip_address: string;
  created_at: string;
  last_used: string;
  trusted_until: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  is_active: boolean;
};

export type LoginHistoryEntry = {
  id: number;
  ip_address: string;
  user_agent: string;
  created_at: string;
};

export type SecurityEventEntry = {
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type LoginTrendPoint = {
  date: string;
  count: number;
};

export type AuditLog = {
  id: number;
  action: string;
  user: string | null;
  method: string;
  path: string;
  status_code: number;
  ip_address: string;
  timestamp: string;
};

export type AuditLogsResponse = {
  results: AuditLog[];
  total_pages: number;
  current_page: number;
  count?: number;
};

export type UpdateProfilePayload = {
  first_name?: string;
  last_name?: string;
};

export type UpdateAdminUserPayload = {
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  is_staff?: boolean;
  is_active?: boolean;
};

export type RegisterPayload = {
  username?: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
};

export type TwoFactorSetupResponse = {
  qr_code: string;
  qr_code_mime_type?: string;
  secret: string;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  token?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
};

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function buildUrl(path: string, query?: Record<string, string | number | undefined>) {
  const url = new URL(path, `${API_BASE_URL}/`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

function readErrorMessage(payload: unknown, fallbackStatus: number) {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const candidate = payload as Record<string, unknown>;

    for (const key of ["error", "detail", "message"]) {
      const value = candidate[key];
      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }
  }

  return `Request failed with status ${fallbackStatus}.`;
}

async function request<T>(path: string, options: RequestOptions = {}) {
  const { method = "GET", token, body, query, signal } = options;
  const headers = new Headers({
    Accept: "application/json",
  });

  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? ((await response.json()) as unknown)
    : ((await response.text()) as unknown);

  if (!response.ok) {
    throw new ApiError(readErrorMessage(payload, response.status), response.status, payload);
  }

  return payload as T;
}

export function getStoredSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function setStoredSession(session: AuthSession) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

export async function login(email: string, password: string) {
  return request<LoginResponse>("/api/v1/auth/login/", {
    method: "POST",
    body: { email, password },
  });
}

export async function registerUser(payload: RegisterPayload) {
  return request<{ message: string; email_verification_required?: boolean }>(
    "/api/v1/auth/register/",
    {
      method: "POST",
      body: payload,
    },
  );
}

export async function verifyTwoFactorLogin(userId: number, otp: string) {
  return request<Extract<LoginResponse, { user: AdminUser }>>("/api/v1/auth/2fa/login/", {
    method: "POST",
    body: { user_id: userId, otp },
  });
}

export async function setupTwoFactor(token: string) {
  return request<TwoFactorSetupResponse>("/api/v1/auth/2fa/setup/", {
    method: "POST",
    token,
  });
}

export async function verifyTwoFactorSetup(token: string, otp: string) {
  return request<ApiMessage>("/api/v1/auth/2fa/verify/", {
    method: "POST",
    token,
    body: { otp },
  });
}

export async function verifyEmail(uid: string, token: string) {
  return request<{ message: string }>("/api/v1/auth/verify-email/", {
    query: { uid, token },
  });
}

export async function resendVerificationEmail(email: string) {
  return request<ApiMessage>("/api/v1/auth/resend-verification/", {
    method: "POST",
    body: { email },
  });
}

export async function forgotPassword(email: string) {
  return request<ApiMessage>("/api/v1/auth/forgot-password/", {
    method: "POST",
    body: { email },
  });
}

export async function resetPassword(uid: string, token: string, newPassword: string) {
  return request<ApiMessage>("/api/v1/auth/reset-password/", {
    method: "POST",
    body: { uid, token, new_password: newPassword },
  });
}

export async function refreshAccessToken(refreshToken: string) {
  return request<RefreshResponse>("/api/v1/auth/refresh/", {
    method: "POST",
    body: { refresh: refreshToken },
  });
}

export async function refreshAccessTokenFromTokenEndpoint(refreshToken: string) {
  return request<RefreshResponse>("/api/v1/auth/token/refresh/", {
    method: "POST",
    body: { refresh: refreshToken },
  });
}

export async function verifyJwtToken(token: string) {
  return request<Record<string, never>>("/api/v1/auth/verify/", {
    method: "POST",
    body: { token },
  });
}

export async function logout(token: string, refreshToken: string) {
  return request<{ detail: string }>("/api/v1/auth/logout/", {
    method: "POST",
    token,
    body: { refresh: refreshToken },
  });
}

export async function fetchCurrentUser(token: string) {
  return request<AdminUser>("/api/v1/auth/me/", { token });
}

export async function fetchLiveness(signal?: AbortSignal) {
  return request<LivenessStatus>("/api/v1/core/health/live/", { signal });
}

export async function fetchReadiness(signal?: AbortSignal) {
  return request<ReadinessStatus>("/api/v1/core/health/ready/", { signal });
}

export async function fetchVersions(signal?: AbortSignal) {
  return request<ApiVersions>("/api/v1/core/versions/", { signal });
}

export async function fetchCoreMetrics(token: string, signal?: AbortSignal) {
  return request<CoreMetrics>("/api/v1/core/metrics/", { token, signal });
}

export async function fetchAdminUsers(
  token: string,
  page: number,
  search: string,
  signal?: AbortSignal,
) {
  const payload = await request<
    | AdminUser[]
    | AdminUsersResponse
    | {
        results?: AdminUser[];
        data?: AdminUser[];
        count?: number;
        total_pages?: number;
        current_page?: number;
      }
  >("/api/v1/auth/admin/users/", {
    token,
    query: { page, search },
    signal,
  });

  if (Array.isArray(payload)) {
    return {
      users: payload,
      total_pages: 1,
      current_page: page,
      count: payload.length,
    } satisfies AdminUsersResponse;
  }

  const record = payload as AdminUsersResponse & {
    results?: AdminUser[];
    data?: AdminUser[];
  };
  const users = record.users ?? record.results ?? record.data ?? [];
  const count = typeof record.count === "number" ? record.count : users.length;
  const totalPages =
    typeof record.total_pages === "number"
      ? record.total_pages
      : count > 0
        ? Math.ceil(count / Math.max(users.length || 10, 1))
        : 1;

  return {
    users,
    total_pages: totalPages,
    current_page: record.current_page ?? page,
    count,
  } satisfies AdminUsersResponse;
}

export async function suspendUser(token: string, userId: number) {
  return request<{ status: string }>("/api/v1/auth/suspend/", {
    method: "POST",
    token,
    body: { user_id: userId },
  });
}

export async function restoreUser(token: string, userId: number) {
  return request<{ status: string; is_active: boolean }>(
    `/api/v1/auth/users/${userId}/restore/`,
    {
      method: "POST",
      token,
    },
  );
}

export async function toggleStaff(token: string, userId: number) {
  return request<{ status: string; is_staff: boolean }>("/api/v1/auth/admin/toggle-user/", {
    method: "POST",
    token,
    body: { user_id: userId },
  });
}

export async function fetchSecurityDashboard(token: string, signal?: AbortSignal) {
  return request<SecurityDashboard>("/api/v1/security/dashboard/", { token, signal });
}

export async function fetchSuspiciousLogins(token: string, signal?: AbortSignal) {
  return request<SuspiciousLogin[]>("/api/v1/security/suspicious-logins/", {
    token,
    signal,
  });
}

export async function fetchTopAttackingIps(token: string, signal?: AbortSignal) {
  return request<TopAttackingIp[]>("/api/v1/security/top-attacking-ips/", {
    token,
    signal,
  });
}

export async function fetchBlockedIps(token: string, signal?: AbortSignal) {
  return request<BlockedIp[]>("/api/v1/security/blocked-ips/", { token, signal });
}

export async function unblockIp(token: string, ip: string) {
  return request<ApiMessage>("/api/v1/security/unblock-ip/", {
    method: "POST",
    token,
    body: { ip },
  });
}

export async function fetchLoginTrend(token: string, signal?: AbortSignal) {
  return request<LoginTrendPoint[]>("/api/v1/security/login-trend/", { token, signal });
}

export async function fetchSecurityAlerts(token: string, signal?: AbortSignal) {
  return request<SecurityAlert[]>("/api/v1/security/alerts/", { token, signal });
}

export async function resolveSecurityAlert(token: string, alertId: number) {
  return request<ApiMessage>("/api/v1/security/resolve-alert/", {
    method: "POST",
    token,
    body: { alert_id: alertId },
  });
}

export async function unlockUser(token: string, userId: number) {
  return request<ApiMessage>("/api/v1/security/unlock-user/", {
    method: "POST",
    token,
    body: { user_id: userId },
  });
}

export async function fetchAuditLogs(token: string, page = 1, signal?: AbortSignal) {
  const payload = await request<
    | AuditLog[]
    | AuditLogsResponse
    | {
        logs?: AuditLog[];
        data?: AuditLog[];
        count?: number;
        total_pages?: number;
        current_page?: number;
      }
  >("/api/v1/audit/", { token, signal, query: { page } });

  if (Array.isArray(payload)) {
    return {
      results: payload,
      total_pages: 1,
      current_page: page,
      count: payload.length,
    } satisfies AuditLogsResponse;
  }

  const record = payload as AuditLogsResponse & {
    logs?: AuditLog[];
    data?: AuditLog[];
  };
  const results = record.results ?? record.logs ?? record.data ?? [];
  const count = typeof record.count === "number" ? record.count : results.length;

  return {
    results,
    total_pages: record.total_pages ?? 1,
    current_page: record.current_page ?? page,
    count,
  } satisfies AuditLogsResponse;
}

export async function fetchAdminUser(token: string, userId: number, signal?: AbortSignal) {
  return request<AdminUser>(`/api/v1/auth/admin/users/${userId}/`, {
    token,
    signal,
  });
}

export async function updateAdminUser(
  token: string,
  userId: number,
  body: UpdateAdminUserPayload,
  signal?: AbortSignal,
) {
  return request<AdminUser>(`/api/v1/auth/${userId}/`, {
    method: "PATCH",
    token,
    body,
    signal,
  });
}

export async function deleteAdminUser(token: string, userId: number) {
  return request<ApiMessage>(`/api/v1/auth/${userId}/`, {
    method: "DELETE",
    token,
  });
}

export async function fetchAdminAccessTest(token: string, signal?: AbortSignal) {
  return request<{ message: string }>("/api/v1/auth/admin/test/", {
    token,
    signal,
  });
}

export async function updateCurrentUserProfile(
  token: string,
  body: UpdateProfilePayload,
  signal?: AbortSignal,
) {
  return request<AdminUser>("/api/v1/auth/me/", {
    method: "PATCH",
    token,
    body,
    signal,
  });
}

export async function changeCurrentUserEmail(token: string, newEmail: string) {
  return request<ApiMessage>("/api/v1/auth/change-email/", {
    method: "POST",
    token,
    body: { new_email: newEmail },
  });
}

export async function changeCurrentUserPassword(
  token: string,
  oldPassword: string,
  newPassword: string,
) {
  return request<ApiMessage>("/api/v1/auth/change-password/", {
    method: "POST",
    token,
    body: { old_password: oldPassword, new_password: newPassword },
  });
}

export async function fetchDeviceSessions(token: string, signal?: AbortSignal) {
  return request<DeviceSessionRecord[]>("/api/v1/auth/sessions/", { token, signal });
}

export async function revokeDeviceSession(token: string, sessionId: string) {
  return request<ApiMessage>("/api/v1/auth/sessions/revoke/", {
    method: "POST",
    token,
    body: { session_id: sessionId },
  });
}

export async function fetchLoginHistory(token: string, signal?: AbortSignal) {
  return request<LoginHistoryEntry[]>("/api/v1/auth/login-history/", {
    token,
    signal,
  });
}

export async function fetchSecurityEvents(token: string, signal?: AbortSignal) {
  return request<SecurityEventEntry[]>("/api/v1/auth/security-events/", {
    token,
    signal,
  });
}

export async function runWithSession<T>(
  work: (accessToken: string, session: AuthSession) => Promise<T>,
  source?: AuthSession | null,
) {
  const current = source ?? getStoredSession();
  if (!current) {
    throw new Error("Please sign in to continue.");
  }

  try {
    const data = await work(current.accessToken, current);
    return { data, session: current };
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }

    const refreshed = await refreshAccessToken(current.refreshToken);
    const nextSession: AuthSession = {
      ...current,
      accessToken: refreshed.access,
      refreshToken: refreshed.refresh ?? current.refreshToken,
    };

    setStoredSession(nextSession);
    const data = await work(nextSession.accessToken, nextSession);
    return { data, session: nextSession };
  }
}

export async function syncCurrentSession(source?: AuthSession | null) {
  const { data: user, session } = await runWithSession(
    (accessToken) => fetchCurrentUser(accessToken),
    source,
  );
  const nextSession = { ...session, user };
  setStoredSession(nextSession);
  return nextSession;
}

export async function logoutCurrentSession(source?: AuthSession | null) {
  const current = source ?? getStoredSession();

  try {
    if (current) {
      await runWithSession(
        (accessToken, session) => logout(accessToken, session.refreshToken),
        current,
      );
    }
  } finally {
    clearStoredSession();
  }
}
