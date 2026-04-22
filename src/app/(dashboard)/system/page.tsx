"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ApiError,
  fetchAdminAccessTest,
  fetchCoreMetrics,
  fetchLiveness,
  fetchReadiness,
  fetchVersions,
  getStoredSession,
  refreshAccessTokenFromTokenEndpoint,
  setStoredSession,
  syncCurrentSession,
  verifyJwtToken,
  type ApiVersions,
  type AuthSession,
  type CoreMetrics,
  type LivenessStatus,
  type ReadinessStatus,
} from "@/lib/api";

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "Unable to load system diagnostics.";
}

export default function SystemPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [liveness, setLiveness] = useState<LivenessStatus | null>(null);
  const [readiness, setReadiness] = useState<ReadinessStatus | null>(null);
  const [versions, setVersions] = useState<ApiVersions | null>(null);
  const [metrics, setMetrics] = useState<CoreMetrics | null>(null);
  const [adminTestMessage, setAdminTestMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingToken, setRefreshingToken] = useState(false);
  const [verifyingToken, setVerifyingToken] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSystemData() {
      setLoading(true);

      try {
        const current = await syncCurrentSession(getStoredSession());
        const [live, ready, apiVersions] = await Promise.all([
          fetchLiveness(),
          fetchReadiness(),
          fetchVersions(),
        ]);
        const [adminTest, coreMetrics] = await Promise.all([
          fetchAdminAccessTest(current.accessToken),
          fetchCoreMetrics(current.accessToken),
        ]);

        if (!cancelled) {
          setSession(current);
          setLiveness(live);
          setReadiness(ready);
          setVersions(apiVersions);
          setMetrics(coreMetrics);
          setAdminTestMessage(adminTest.message);
        }
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

    void loadSystemData();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleVerifyToken() {
    if (!session) {
      toast.error("No active session found.");
      return;
    }

    setVerifyingToken(true);

    try {
      await verifyJwtToken(session.accessToken);
      toast.success("Current access token is valid.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setVerifyingToken(false);
    }
  }

  async function handleRefreshToken() {
    if (!session) {
      toast.error("No active session found.");
      return;
    }

    setRefreshingToken(true);

    try {
      const refreshed = await refreshAccessTokenFromTokenEndpoint(session.refreshToken);
      const nextSession: AuthSession = {
        ...session,
        accessToken: refreshed.access,
        refreshToken: refreshed.refresh ?? session.refreshToken,
      };

      setStoredSession(nextSession);
      const synced = await syncCurrentSession(nextSession);
      setSession(synced);
      toast.success("Tokens refreshed through `/api/v1/auth/token/refresh/`.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRefreshingToken(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-gray-500">Loading system diagnostics...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">System</h1>
        <p className="mt-1 text-sm text-slate-500">
          Backend diagnostics for health, versions, admin access checks, metrics, and token tools.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Health & Versions</CardTitle>
            <CardDescription>
              Live data from `core/health`, `core/versions`, and the admin access test.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <Row label="Liveness" value={liveness?.status ?? "Unknown"} />
            <Row label="Readiness" value={readiness?.status ?? "Unknown"} />
            <Row label="Environment" value={readiness?.environment ?? "Unknown"} />
            <Row label="Database" value={readiness?.checks.database ?? "Unknown"} />
            <Row label="Cache" value={readiness?.checks.cache ?? "Unknown"} />
            <Row label="Default API Version" value={versions?.default ?? "Unknown"} />
            <Row label="Supported Versions" value={versions?.supported.join(", ") || "None"} />
            <Row label="Admin Test" value={adminTestMessage ?? "Unavailable"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request Metrics</CardTitle>
            <CardDescription>
              Counts returned by `GET /api/v1/core/metrics/`.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <MetricTile label="Total Requests" value={String(metrics?.requests_total ?? 0)} />
              <MetricTile
                label="Slow Requests"
                value={String(metrics?.slow_requests_total ?? 0)}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-900">Status Counts</p>
              {metrics ? (
                Object.entries(metrics.status_counts).map(([statusCode, count]) => (
                  <Row key={statusCode} label={statusCode} value={String(count)} />
                ))
              ) : (
                <p className="text-sm text-slate-500">No metrics returned.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Token Tools</CardTitle>
          <CardDescription>
            Uses `POST /api/v1/auth/verify/` and `POST /api/v1/auth/token/refresh/`.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
            <p>
              <span className="font-medium text-slate-900">Current operator:</span>{" "}
              {session?.user.email ?? "Unknown"}
            </p>
            <p className="mt-1 break-all">
              <span className="font-medium text-slate-900">Access token preview:</span>{" "}
              {session ? `${session.accessToken.slice(0, 24)}...` : "Unavailable"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => void handleVerifyToken()} disabled={verifyingToken}>
              {verifyingToken ? "Verifying..." : "Verify Current Token"}
            </Button>

            <Button onClick={() => void handleRefreshToken()} disabled={refreshingToken}>
              {refreshingToken ? "Refreshing..." : "Refresh Tokens"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-slate-50 px-4 py-3">
      <span className="font-medium text-slate-900">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
