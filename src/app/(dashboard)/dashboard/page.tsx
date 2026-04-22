"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ApiError,
  fetchBlockedIps,
  fetchLoginTrend,
  fetchSecurityDashboard,
  fetchTopAttackingIps,
  runWithSession,
  type BlockedIp,
  type LoginTrendPoint,
  type SecurityDashboard,
  type TopAttackingIp,
} from "@/lib/api";

type DashboardSnapshot = {
  stats: SecurityDashboard;
  trend: LoginTrendPoint[];
  topIps: TopAttackingIp[];
  blockedIps: BlockedIp[];
};

const emptySnapshot: DashboardSnapshot = {
  stats: {
    total_users: 0,
    failed_logins_24h: 0,
    successful_logins_24h: 0,
    locked_accounts: 0,
    blocked_ips: 0,
    recent_security_events: [],
  },
  trend: [],
  topIps: [],
  blockedIps: [],
};

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "Unable to load dashboard data.";
}

export default function DashboardPage() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        const [{ data: stats }, { data: trend }, { data: topIps }, { data: blockedIps }] =
          await Promise.all([
            runWithSession((accessToken) => fetchSecurityDashboard(accessToken)),
            runWithSession((accessToken) => fetchLoginTrend(accessToken)),
            runWithSession((accessToken) => fetchTopAttackingIps(accessToken)),
            runWithSession((accessToken) => fetchBlockedIps(accessToken)),
          ]);

        if (!cancelled) {
          setSnapshot({ stats, trend, topIps, blockedIps });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="p-8 text-gray-500">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Live metrics wired to the upgraded backend security endpoints.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Users" value={snapshot.stats.total_users} />
        <StatCard label="Failed Logins (24h)" value={snapshot.stats.failed_logins_24h} />
        <StatCard label="Locked Accounts" value={snapshot.stats.locked_accounts} />
        <StatCard label="Blocked IPs" value={snapshot.stats.blocked_ips} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Login Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[320px] w-full">
            {snapshot.trend.length === 0 ? (
              <p className="text-sm text-gray-500">No trend data returned by the backend.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={snapshot.trend}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Security Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.stats.recent_security_events.length === 0 ? (
              <p className="text-sm text-gray-500">No recent security events.</p>
            ) : (
              snapshot.stats.recent_security_events.map((event, index) => (
                <div
                  key={`${event.event}-${event.time}-${index}`}
                  className="flex items-start justify-between rounded-lg border px-3 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-900">{event.event}</p>
                    <p className="text-slate-500">{event.user ?? "System"}</p>
                  </div>
                  <span className="text-slate-500">{formatDate(event.time)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Attacking IPs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.topIps.length === 0 ? (
              <p className="text-sm text-gray-500">No attack-source data returned.</p>
            ) : (
              snapshot.topIps.map((ip) => (
                <div
                  key={ip.ip_address}
                  className="flex items-center justify-between rounded-lg border px-3 py-3 text-sm"
                >
                  <span>{ip.ip_address}</span>
                  <span className="font-semibold">{ip.attempts}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Blocked IPs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {snapshot.blockedIps.length === 0 ? (
            <p className="text-sm text-gray-500">No blocked IPs returned.</p>
          ) : (
            snapshot.blockedIps.map((entry) => (
              <div
                key={`${entry.ip}-${entry.blocked_at}`}
                className="grid gap-1 rounded-lg border px-3 py-3 text-sm md:grid-cols-[1fr_1fr_auto]"
              >
                <span className="font-medium">{entry.ip}</span>
                <span className="text-slate-500">{entry.reason}</span>
                <span className="text-slate-500">{formatDate(entry.blocked_at)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}
