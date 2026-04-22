"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import AttackChart from "@/components/security/attack-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  fetchBlockedIps,
  fetchSecurityAlerts,
  fetchSecurityDashboard,
  fetchSuspiciousLogins,
  fetchTopAttackingIps,
  resolveSecurityAlert,
  runWithSession,
  unblockIp,
  type BlockedIp,
  type SecurityAlert,
  type SecurityDashboard,
  type SuspiciousLogin,
  type TopAttackingIp,
} from "@/lib/api";

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "Unable to load security data.";
}

export default function SecurityPage() {
  const [dashboard, setDashboard] = useState<SecurityDashboard | null>(null);
  const [suspicious, setSuspicious] = useState<SuspiciousLogin[]>([]);
  const [attackers, setAttackers] = useState<TopAttackingIp[]>([]);
  const [blocked, setBlocked] = useState<BlockedIp[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);

      try {
        const { data } = await runWithSession((accessToken) =>
          Promise.all([
            fetchSecurityDashboard(accessToken),
            fetchSuspiciousLogins(accessToken),
            fetchTopAttackingIps(accessToken),
            fetchBlockedIps(accessToken),
            fetchSecurityAlerts(accessToken),
          ]),
        );

        if (cancelled) {
          return;
        }

        setDashboard(data[0]);
        setSuspicious(data[1]);
        setAttackers(data[2]);
        setBlocked(data[3]);
        setAlerts(data[4]);
      } catch (error) {
        if (!cancelled) {
          toast.error(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleResolveAlert(alertId: number) {
    const nextActionKey = `alert-${alertId}`;
    setActionKey(nextActionKey);

    try {
      await runWithSession((accessToken) => resolveSecurityAlert(accessToken, alertId));
      setAlerts((current) =>
        current.map((alert) =>
          alert.id === alertId ? { ...alert, resolved: true } : alert,
        ),
      );
      toast.success("Alert resolved.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setActionKey(null);
    }
  }

  async function handleUnblockIp(ip: string) {
    const nextActionKey = `ip-${ip}`;
    setActionKey(nextActionKey);

    try {
      await runWithSession((accessToken) => unblockIp(accessToken, ip));
      setBlocked((current) => current.filter((entry) => entry.ip !== ip));
      setDashboard((current) =>
        current
          ? {
              ...current,
              blocked_ips: Math.max(0, current.blocked_ips - 1),
            }
          : current,
      );
      toast.success("IP unblocked.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setActionKey(null);
    }
  }

  if (loading || !dashboard) {
    return <div className="p-6">Loading security dashboard...</div>;
  }

  return (
    <div className="space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-bold">Security Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Connected to the live backend monitoring, alert resolution, and unblock endpoints.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <MetricCard label="Total Users" value={dashboard.total_users} />
        <MetricCard
          label="Failed Logins (24h)"
          value={dashboard.failed_logins_24h}
          emphasis="text-red-600"
        />
        <MetricCard
          label="Successful Logins (24h)"
          value={dashboard.successful_logins_24h}
          emphasis="text-green-600"
        />
        <MetricCard
          label="Locked Accounts"
          value={dashboard.locked_accounts}
          emphasis="text-yellow-600"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-semibold">Security Alerts</h2>
            <span className="text-xs text-slate-500">{alerts.length} recent alerts</span>
          </div>

          <div className="space-y-3">
            {alerts.length === 0 ? (
              <p className="text-sm text-slate-500">No alerts returned.</p>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-lg border px-4 py-3 text-sm text-slate-600"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{alert.title}</p>
                        <SeverityBadge severity={alert.severity} />
                        {alert.resolved && <Badge variant="secondary">Resolved</Badge>}
                      </div>
                      <p>{alert.message}</p>
                      <p className="text-xs text-slate-500">
                        {alert.ip ? `${alert.ip} | ` : ""}
                        {formatDate(alert.created_at)}
                      </p>
                    </div>

                    {!alert.resolved && (
                      <Button
                        variant="outline"
                        disabled={actionKey === `alert-${alert.id}`}
                        onClick={() => void handleResolveAlert(alert.id)}
                      >
                        {actionKey === `alert-${alert.id}` ? "Resolving..." : "Resolve"}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded bg-white p-6 shadow">
          <h2 className="mb-4 font-semibold">Recent Security Events</h2>
          <div className="space-y-3">
            {dashboard.recent_security_events.length === 0 ? (
              <p className="text-sm text-slate-500">No recent security events returned.</p>
            ) : (
              dashboard.recent_security_events.map((event, index) => (
                <div
                  key={`${event.event}-${event.time}-${index}`}
                  className="rounded-lg border px-4 py-3 text-sm text-slate-600"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">{event.event}</p>
                    <span className="text-xs text-slate-500">{formatDate(event.time)}</span>
                  </div>
                  <p className="mt-1 text-slate-500">{event.user ?? "System"}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded bg-white p-6 shadow">
        <h2 className="mb-4 font-semibold">Suspicious Login Attempts</h2>

        <table className="w-full">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2">Email</th>
              <th className="pb-2">IP</th>
              <th className="pb-2">Device</th>
              <th className="pb-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {suspicious.map((attempt, index) => (
              <tr key={`${attempt.email}-${attempt.ip}-${index}`} className="border-b">
                <td className="py-3">{attempt.email}</td>
                <td className="py-3">{attempt.ip}</td>
                <td className="py-3">{attempt.device || "Unknown device"}</td>
                <td className="py-3">{formatDate(attempt.time)}</td>
              </tr>
            ))}

            {suspicious.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-sm text-slate-500">
                  No suspicious login attempts returned.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <AttackChart data={attackers} />

      <section className="rounded bg-white p-6 shadow">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Blocked IPs</h2>
          <p className="text-xs text-slate-500">
            Active entries can now be unblocked directly from the dashboard.
          </p>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2">IP</th>
              <th className="pb-2">Reason</th>
              <th className="pb-2">Blocked At</th>
              <th className="pb-2">Status</th>
              <th className="pb-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {blocked.map((entry) => (
              <tr key={`${entry.ip}-${entry.blocked_at}`} className="border-b">
                <td className="py-3">{entry.ip}</td>
                <td className="py-3">{entry.reason}</td>
                <td className="py-3">{formatDate(entry.blocked_at)}</td>
                <td className="py-3">{entry.is_active ? "Active" : "Expired"}</td>
                <td className="py-3 text-right">
                  {entry.is_active ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionKey === `ip-${entry.ip}`}
                      onClick={() => void handleUnblockIp(entry.ip)}
                    >
                      {actionKey === `ip-${entry.ip}` ? "Unblocking..." : "Unblock"}
                    </Button>
                  ) : (
                    <span className="text-sm text-slate-400">No action</span>
                  )}
                </td>
              </tr>
            ))}

            {blocked.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-sm text-slate-500">
                  No blocked IPs returned.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: string;
}) {
  return (
    <div className="rounded bg-white p-5 shadow">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${emphasis ?? ""}`}>{value}</p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: SecurityAlert["severity"] }) {
  const palette =
    severity === "critical"
      ? "border-red-200 bg-red-100 text-red-800 hover:bg-red-100"
      : severity === "high"
        ? "border-orange-200 bg-orange-100 text-orange-800 hover:bg-orange-100"
        : severity === "medium"
          ? "border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100"
          : "border-sky-200 bg-sky-100 text-sky-800 hover:bg-sky-100";

  return <Badge className={palette}>{severity}</Badge>;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}
