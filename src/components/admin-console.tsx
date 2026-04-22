"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  LoaderCircle,
  RefreshCw,
  Shield,
  ShieldAlert,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  API_BASE_URL,
  ApiError,
  clearStoredSession,
  fetchAdminUsers,
  fetchAuditLogs,
  fetchBlockedIps,
  fetchCurrentUser,
  fetchLiveness,
  fetchLoginTrend,
  fetchReadiness,
  fetchSecurityDashboard,
  fetchSuspiciousLogins,
  fetchTopAttackingIps,
  fetchVersions,
  getStoredSession,
  login,
  logout,
  refreshAccessToken,
  restoreUser,
  setStoredSession,
  suspendUser,
  toggleStaff,
  type AdminUser,
  type AdminUsersResponse,
  type ApiVersions,
  type AuditLog,
  type AuthSession,
  type BlockedIp,
  type LivenessStatus,
  type LoginTrendPoint,
  type ReadinessStatus,
  type SecurityDashboard,
  type SuspiciousLogin,
  type TopAttackingIp,
  verifyTwoFactorLogin,
} from "@/lib/api";

type PublicSnapshot = {
  live: LivenessStatus;
  ready: ReadinessStatus;
  versions: ApiVersions;
};

type PrivateSnapshot = {
  users: AdminUsersResponse;
  security: SecurityDashboard;
  suspiciousLogins: SuspiciousLogin[];
  topIps: TopAttackingIp[];
  blockedIps: BlockedIp[];
  loginTrend: LoginTrendPoint[];
  auditLogs: AuditLog[];
};

const emptyPrivateSnapshot: PrivateSnapshot = {
  users: { users: [], total_pages: 1, current_page: 1 },
  security: {
    total_users: 0,
    failed_logins_24h: 0,
    successful_logins_24h: 0,
    locked_accounts: 0,
    blocked_ips: 0,
    recent_security_events: [],
  },
  suspiciousLogins: [],
  topIps: [],
  blockedIps: [],
  loginTrend: [],
  auditLogs: [],
};

function userDisplayName(user?: AdminUser | null) {
  if (!user) {
    return "Unknown operator";
  }

  const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return fullName || user.email;
}

function hasAdminAccess(user?: AdminUser | null) {
  if (!user) {
    return false;
  }

  return user.is_superuser || user.is_staff || user.role === "ADMIN";
}

function formatDate(value?: string | null) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function AdminConsole() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [pendingTwoFactorUserId, setPendingTwoFactorUserId] = useState<number | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [publicSnapshot, setPublicSnapshot] = useState<PublicSnapshot | null>(null);
  const [privateSnapshot, setPrivateSnapshot] = useState<PrivateSnapshot>(emptyPrivateSnapshot);
  const [userSearch, setUserSearch] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [adminWarning, setAdminWarning] = useState<string | null>(null);
  const sessionRef = useRef<AuthSession | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const stored = getStoredSession();
    void loadPublicSnapshot();

    if (!stored) {
      setIsBootstrapping(false);
      return;
    }

    sessionRef.current = stored;
    setSession(stored);
    void loadPrivateSnapshot(stored).finally(() => setIsBootstrapping(false));
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  async function withFreshAccess<T>(work: (accessToken: string) => Promise<T>) {
    const current = sessionRef.current;
    if (!current) {
      throw new Error("Please sign in first.");
    }

    try {
      return await work(current.accessToken);
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

      sessionRef.current = nextSession;
      setSession(nextSession);
      setStoredSession(nextSession);
      return work(nextSession.accessToken);
    }
  }

  async function loadPublicSnapshot() {
    try {
      const [live, ready, versions] = await Promise.all([
        fetchLiveness(),
        fetchReadiness(),
        fetchVersions(),
      ]);

      startTransition(() => setPublicSnapshot({ live, ready, versions }));
    } catch (error) {
      showError(error, "Unable to reach the backend public endpoints.");
    }
  }

  async function loadPrivateSnapshot(source?: AuthSession | null) {
    const current = source ?? sessionRef.current;
    if (!current) {
      setPrivateSnapshot(emptyPrivateSnapshot);
      return;
    }

    setIsRefreshing(true);
    setAdminWarning(null);

    try {
      const me = await withFreshAccess((accessToken) => fetchCurrentUser(accessToken));
      const nextSession = { ...current, user: me };
      sessionRef.current = nextSession;
      setSession(nextSession);
      setStoredSession(nextSession);

      if (!hasAdminAccess(me)) {
        setPrivateSnapshot(emptyPrivateSnapshot);
        setAdminWarning(
          "This account authenticated successfully, but it does not have permission for the admin endpoints.",
        );
        return;
      }

      const [users, security, suspiciousLogins, topIps, blockedIps, loginTrend, auditLogs] =
        await Promise.all([
          withFreshAccess((accessToken) => fetchAdminUsers(accessToken, 1, userSearch)),
          withFreshAccess((accessToken) => fetchSecurityDashboard(accessToken)),
          withFreshAccess((accessToken) => fetchSuspiciousLogins(accessToken)),
          withFreshAccess((accessToken) => fetchTopAttackingIps(accessToken)),
          withFreshAccess((accessToken) => fetchBlockedIps(accessToken)),
          withFreshAccess((accessToken) => fetchLoginTrend(accessToken)),
          withFreshAccess((accessToken) => fetchAuditLogs(accessToken)),
        ]);

      startTransition(() =>
        setPrivateSnapshot({
          users,
          security,
          suspiciousLogins,
          topIps,
          blockedIps,
          loginTrend,
          auditLogs: auditLogs.results,
        }),
      );
    } catch (error) {
      showError(error, "Unable to load the authenticated admin data.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function loadUsers(page = 1) {
    try {
      const users = await withFreshAccess((accessToken) =>
        fetchAdminUsers(accessToken, page, userSearch),
      );
      setPrivateSnapshot((current) => ({ ...current, users }));
    } catch (error) {
      showError(error, "Unable to load admin users.");
    }
  }

  function showError(error: unknown, prefix: string) {
    if (error instanceof Error) {
      setErrorMessage(`${prefix} ${error.message}`);
      return;
    }

    setErrorMessage(prefix);
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingAuth(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await login(email, password);

      if ("user_id" in response) {
        setPendingTwoFactorUserId(response.user_id);
        setStatusMessage("Two-factor verification is required to complete sign-in.");
        return;
      }

      const nextSession: AuthSession = {
        user: response.user,
        accessToken: response.access,
        refreshToken: response.refresh,
      };

      sessionRef.current = nextSession;
      setSession(nextSession);
      setStoredSession(nextSession);
      setPassword("");
      setOtp("");
      setPendingTwoFactorUserId(null);
      setStatusMessage("Backend connection established. Loading admin data...");
      await loadPrivateSnapshot(nextSession);
    } catch (error) {
      showError(error, "Sign-in failed.");
    } finally {
      setIsSubmittingAuth(false);
      setIsBootstrapping(false);
    }
  }

  async function handleVerifyOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingTwoFactorUserId) {
      return;
    }

    setIsSubmittingAuth(true);
    setErrorMessage(null);

    try {
      const response = await verifyTwoFactorLogin(pendingTwoFactorUserId, otp);
      const nextSession: AuthSession = {
        user: response.user,
        accessToken: response.access,
        refreshToken: response.refresh,
      };

      sessionRef.current = nextSession;
      setSession(nextSession);
      setStoredSession(nextSession);
      setOtp("");
      setPassword("");
      setPendingTwoFactorUserId(null);
      setStatusMessage("Two-factor verification passed. Syncing dashboard...");
      await loadPrivateSnapshot(nextSession);
    } catch (error) {
      showError(error, "Two-factor verification failed.");
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  async function handleLogout() {
    const current = sessionRef.current;

    try {
      if (current) {
        await withFreshAccess((accessToken) => logout(accessToken, current.refreshToken));
      }
    } catch {
      // Local cleanup still happens even if the backend logout request fails.
    } finally {
      clearStoredSession();
      sessionRef.current = null;
      setSession(null);
      setPrivateSnapshot(emptyPrivateSnapshot);
      setPendingTwoFactorUserId(null);
      setStatusMessage("Signed out from the admin dashboard.");
    }
  }

  async function handleUserAction(
    action: "suspend" | "restore" | "toggle-staff",
    userId: number,
  ) {
    setBusyUserId(userId);
    setErrorMessage(null);

    try {
      if (action === "suspend") {
        await withFreshAccess((accessToken) => suspendUser(accessToken, userId));
      } else if (action === "restore") {
        await withFreshAccess((accessToken) => restoreUser(accessToken, userId));
      } else {
        await withFreshAccess((accessToken) => toggleStaff(accessToken, userId));
      }

      setStatusMessage("User action completed successfully.");
      await loadPrivateSnapshot();
    } catch (error) {
      showError(error, "Unable to complete the user action.");
    } finally {
      setBusyUserId(null);
    }
  }

  const statCards = [
    {
      title: "Total Users",
      value: privateSnapshot.security.total_users,
      icon: Users,
    },
    {
      title: "Failed Logins (24h)",
      value: privateSnapshot.security.failed_logins_24h,
      icon: ShieldAlert,
    },
    {
      title: "Locked Accounts",
      value: privateSnapshot.security.locked_accounts,
      icon: AlertTriangle,
    },
    {
      title: "Blocked IPs",
      value: privateSnapshot.security.blocked_ips,
      icon: Shield,
    },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.14),_transparent_30%),linear-gradient(180deg,_#f8fbff_0%,_#eef4ff_45%,_#f7f7f2_100%)] text-slate-950">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-[28px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_30px_100px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-sky-700">
                <Activity className="size-3.5" />
                Enterprise backend bridge
              </div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Connect the upgraded backend to your admin dashboard.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                The dashboard now speaks directly to the Django enterprise API for login,
                readiness checks, user management, security monitoring, and audit history.
              </p>
              <div className="flex flex-wrap gap-2">
                <Pill label="Backend" value={API_BASE_URL} tone="emerald" />
                <Pill
                  label="Operator"
                  value={session ? userDisplayName(session.user) : "Not signed in"}
                  tone="sky"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <SmallCard title="Liveness" value={publicSnapshot?.live.status ?? "Loading"} />
              <SmallCard title="Readiness" value={publicSnapshot?.ready.status ?? "Loading"} />
              <SmallCard
                title="API Version"
                value={publicSnapshot?.versions.default ?? "Loading"}
              />
            </div>
          </div>
        </section>

        {(errorMessage || statusMessage || adminWarning) && (
          <section className="grid gap-3">
            {errorMessage && (
              <Banner tone="red" icon={<AlertTriangle className="size-4" />} title="Attention">
                {errorMessage}
              </Banner>
            )}
            {statusMessage && (
              <Banner tone="blue" icon={<Activity className="size-4" />} title="Status">
                {statusMessage}
              </Banner>
            )}
            {adminWarning && (
              <Banner tone="amber" icon={<Shield className="size-4" />} title="Permission note">
                {adminWarning}
              </Banner>
            )}
          </section>
        )}

        <section className="grid gap-6 xl:grid-cols-[350px_minmax(0,1fr)]">
          <Card className="border border-slate-200/90 bg-white/90">
            <CardHeader>
              <CardTitle>Authentication</CardTitle>
              <CardDescription>
                Sign in with an admin-capable account to unlock the protected backend endpoints.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!session && !pendingTwoFactorUserId && (
                <form className="space-y-3" onSubmit={handleLogin}>
                  <Field
                    id="email"
                    label="Email"
                    value={email}
                    onChange={setEmail}
                    type="email"
                    placeholder="admin@example.com"
                  />
                  <Field
                    id="password"
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    type="password"
                    placeholder="Enter your password"
                  />
                  <Button type="submit" className="w-full" disabled={isSubmittingAuth}>
                    {isSubmittingAuth ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        Connect backend
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </form>
              )}

              {!session && pendingTwoFactorUserId && (
                <form className="space-y-3" onSubmit={handleVerifyOtp}>
                  <Field
                    id="otp"
                    label="One-time password"
                    value={otp}
                    onChange={setOtp}
                    placeholder="123456"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1" disabled={isSubmittingAuth}>
                      {isSubmittingAuth ? (
                        <>
                          <LoaderCircle className="size-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        "Verify 2FA"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setPendingTwoFactorUserId(null);
                        setOtp("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}

              {session && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                      Connected operator
                    </p>
                    <p className="mt-2 text-lg font-semibold">{userDisplayName(session.user)}</p>
                    <p className="text-sm text-slate-600">{session.user.email}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Pill label="Role" value={session.user.role ?? "Unknown"} tone="sky" />
                      <Pill
                        label="Admin"
                        value={hasAdminAccess(session.user) ? "Granted" : "Limited"}
                        tone={hasAdminAccess(session.user) ? "emerald" : "amber"}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setErrorMessage(null);
                        void loadPublicSnapshot();
                        void loadPrivateSnapshot();
                      }}
                      disabled={isRefreshing}
                    >
                      <RefreshCw className={isRefreshing ? "size-4 animate-spin" : "size-4"} />
                      Sync
                    </Button>
                    <Button variant="destructive" className="flex-1" onClick={handleLogout}>
                      Sign out
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-600">
                Set `NEXT_PUBLIC_API_BASE_URL` if the Django server is not running on
                `http://localhost:8000`.
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {statCards.map((card) => {
                const Icon = card.icon;
                return (
                  <Card key={card.title} className="border border-slate-200/90 bg-white/90">
                    <CardHeader className="flex-row items-start justify-between space-y-0">
                      <div>
                        <CardDescription>{card.title}</CardDescription>
                        <CardTitle className="text-3xl">{card.value}</CardTitle>
                      </div>
                      <div className="rounded-2xl bg-slate-100 p-2 text-slate-700">
                        <Icon className="size-5" />
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]">
              <Card className="border border-slate-200/90 bg-white/90">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <CardTitle>User Administration</CardTitle>
                    <CardDescription>
                      Connected to the admin users endpoint with suspend, restore, and
                      staff-toggle actions.
                    </CardDescription>
                  </div>
                  <div className="flex w-full max-w-sm gap-2">
                    <Input
                      value={userSearch}
                      onChange={(event) => setUserSearch(event.target.value)}
                      placeholder="Search by email"
                    />
                    <Button variant="outline" onClick={() => void loadUsers(1)} disabled={!session}>
                      Search
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Privileges</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {privateSnapshot.users.users.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center text-slate-500">
                            {session ? "No admin users returned yet." : "Sign in to load admin users."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        privateSnapshot.users.users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="font-medium text-slate-900">{user.email}</div>
                              <div className="text-xs text-slate-500">ID #{user.id}</div>
                            </TableCell>
                            <TableCell>
                              <Pill
                                label="Account"
                                value={user.is_active ? "Active" : "Suspended"}
                                tone={user.is_active ? "emerald" : "red"}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                <Pill label="Staff" value={user.is_staff ? "Yes" : "No"} tone="sky" />
                                <Pill
                                  label="Superuser"
                                  value={user.is_superuser ? "Yes" : "No"}
                                  tone={user.is_superuser ? "amber" : "slate"}
                                />
                              </div>
                            </TableCell>
                            <TableCell>{formatDate(user.date_joined)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    void handleUserAction(user.is_active ? "suspend" : "restore", user.id)
                                  }
                                  disabled={busyUserId === user.id}
                                >
                                  {user.is_active ? "Suspend" : "Restore"}
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => void handleUserAction("toggle-staff", user.id)}
                                  disabled={busyUserId === user.id || user.is_superuser}
                                >
                                  {busyUserId === user.id ? (
                                    <LoaderCircle className="size-4 animate-spin" />
                                  ) : user.is_staff ? (
                                    "Revoke staff"
                                  ) : (
                                    "Make staff"
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600">
                      Page {privateSnapshot.users.current_page} of {privateSnapshot.users.total_pages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        disabled={privateSnapshot.users.current_page <= 1 || !session}
                        onClick={() => void loadUsers(privateSnapshot.users.current_page - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        disabled={
                          privateSnapshot.users.current_page >= privateSnapshot.users.total_pages ||
                          !session
                        }
                        onClick={() => void loadUsers(privateSnapshot.users.current_page + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-slate-200/90 bg-white/90">
                <CardHeader>
                  <CardTitle>Backend Health</CardTitle>
                  <CardDescription>
                    Readiness, database, cache, and version metadata.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <HealthRow label="Liveness" value={publicSnapshot?.live.status ?? "Loading"} />
                  <HealthRow label="Readiness" value={publicSnapshot?.ready.status ?? "Loading"} />
                  <HealthRow
                    label="Database"
                    value={publicSnapshot?.ready.checks.database ?? "Pending"}
                  />
                  <HealthRow label="Cache" value={publicSnapshot?.ready.checks.cache ?? "Pending"} />
                  <HealthRow label="Version" value={publicSnapshot?.versions.default ?? "Pending"} />
                  <Button variant="outline" onClick={() => void loadPublicSnapshot()}>
                    <RefreshCw className="size-4" />
                    Recheck backend
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Card className="border border-slate-200/90 bg-white/90">
            <CardHeader>
              <CardTitle>Security Analytics</CardTitle>
              <CardDescription>
                Suspicious logins, attacking IPs, blocked addresses, and login trend.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <MetricGrid
                items={[
                  { label: "Successful", value: privateSnapshot.security.successful_logins_24h },
                  { label: "Failed", value: privateSnapshot.security.failed_logins_24h },
                  { label: "Blocked", value: privateSnapshot.blockedIps.length },
                ]}
              />
              <SimpleList
                title="Suspicious logins"
                items={privateSnapshot.suspiciousLogins.slice(0, 5).map((entry) => ({
                  primary: entry.email,
                  secondary: `${entry.ip} • ${formatDate(entry.time)}`,
                }))}
                emptyLabel="No suspicious login attempts returned."
              />
              <SimpleList
                title="Top attacking IPs"
                items={privateSnapshot.topIps.map((entry) => ({
                  primary: entry.ip_address,
                  secondary: `${entry.attempts} failed attempts`,
                }))}
                emptyLabel="No attack-source data returned."
              />
              <SimpleList
                title="Blocked IPs"
                items={privateSnapshot.blockedIps.slice(0, 5).map((entry) => ({
                  primary: entry.ip,
                  secondary: `${entry.reason} • ${entry.is_active ? "Active" : "Expired"}`,
                }))}
                emptyLabel="No blocked IPs returned."
              />
            </CardContent>
          </Card>

          <Card className="border border-slate-200/90 bg-white/90">
            <CardHeader>
              <CardTitle>Audit Trail</CardTitle>
              <CardDescription>
                Login trend and recent audit log rows from the enterprise backend.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                {privateSnapshot.loginTrend.length === 0 ? (
                  <p className="text-sm text-slate-500">No login trend data yet.</p>
                ) : (
                  privateSnapshot.loginTrend.map((point) => (
                    <div
                      key={point.date}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                    >
                      <span>{point.date}</span>
                      <span className="font-medium">{point.count}</span>
                    </div>
                  ))
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {privateSnapshot.auditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-slate-500">
                        {session ? "No audit rows returned yet." : "Sign in to load audit logs."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    privateSnapshot.auditLogs.slice(0, 8).map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium text-slate-900">{log.action}</TableCell>
                        <TableCell>{log.user ?? "System"}</TableCell>
                        <TableCell>{log.status_code}</TableCell>
                        <TableCell>{formatDate(log.timestamp)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {isBootstrapping && (
          <div className="fixed inset-x-0 bottom-6 mx-auto flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-lg">
            <LoaderCircle className="size-4 animate-spin" />
            Restoring your previous dashboard session...
          </div>
        )}
      </main>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700" htmlFor={id}>
        {label}
      </label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required
      />
    </div>
  );
}

function Banner({
  children,
  icon,
  title,
  tone,
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
  tone: "red" | "blue" | "amber";
}) {
  const tones = {
    red: "border-red-200 bg-red-50 text-red-900",
    blue: "border-sky-200 bg-sky-50 text-sky-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 ${tones[tone]}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm opacity-90">{children}</p>
        </div>
      </div>
    </div>
  );
}

function Pill({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "sky" | "emerald" | "amber" | "red";
}) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      <span className="opacity-70">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function SmallCard({ title, value }: { title: string; value: string }) {
  return (
    <Card size="sm" className="border border-slate-200/90 bg-slate-50/80">
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription>{value}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function HealthRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
      <span className="font-medium text-slate-900">{label}</span>
      <span className="text-slate-600">{value}</span>
    </div>
  );
}

function MetricGrid({
  items,
}: {
  items: Array<{ label: string; value: number }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function SimpleList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: Array<{ primary: string; secondary: string }>;
  emptyLabel: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        items.map((item) => (
          <div
            key={`${item.primary}-${item.secondary}`}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <p className="font-medium text-slate-900">{item.primary}</p>
            <p className="text-sm text-slate-600">{item.secondary}</p>
          </div>
        ))
      )}
    </div>
  );
}
