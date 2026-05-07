"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ApiError,
  fetchDeviceSessions,
  fetchLoginHistory,
  fetchSecurityEvents,
  getStoredSession,
  revokeDeviceSession,
  runWithSession,
  syncCurrentSession,
  type AuthSession,
  type DeviceSessionRecord,
  type LoginHistoryEntry,
  type SecurityEventEntry,
} from "@/lib/api";

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "Unable to load the current session.";
}

export default function SessionsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [deviceSessions, setDeviceSessions] = useState<DeviceSessionRecord[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEventEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSessionData() {
      setLoading(true);

      try {
        const nextSession = await syncCurrentSession(getStoredSession());
        const { data } = await runWithSession((accessToken) =>
          Promise.all([
            fetchDeviceSessions(accessToken),
            fetchLoginHistory(accessToken),
            fetchSecurityEvents(accessToken),
          ]),
        );

        if (!cancelled) {
          setSession(nextSession);
          setDeviceSessions(data[0]);
          setLoginHistory(data[1]);
          setSecurityEvents(data[2]);
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

    void loadSessionData();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRevoke(sessionId: string) {
    setRevokingId(sessionId);

    try {
      await runWithSession((accessToken) => revokeDeviceSession(accessToken, sessionId));
      const { data } = await runWithSession((accessToken) => fetchDeviceSessions(accessToken));
      setDeviceSessions(data);
      toast.success("Session revoked successfully.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRevokingId(null);
    }
  }

  if (loading) {
    return <div className="text-gray-500">Loading session details...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sessions & Activity</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review sign-ins, session history, and recent security activity in one place.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Authenticated Operator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          {session ? (
            <>
              <p>
                <span className="font-medium text-slate-900">Email:</span> {session.user.email}
              </p>
              <p>
                <span className="font-medium text-slate-900">Role:</span>{" "}
                {session.user.role ??
                  (session.user.is_superuser
                    ? "SUPERUSER"
                    : session.user.is_staff
                      ? "STAFF"
                      : "USER")}
              </p>
              <p>
                <span className="font-medium text-slate-900">Account status:</span>{" "}
                {session.user.is_active ? "Active" : "Suspended"}
              </p>
            </>
          ) : (
            <p>No active session found.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Device Sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {deviceSessions.length === 0 ? (
            <p className="text-sm text-slate-500">No active device sessions returned.</p>
          ) : (
            deviceSessions.map((deviceSession) => (
              <div
                key={deviceSession.id}
                className="flex flex-col gap-3 rounded-lg border px-4 py-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{deviceSession.device}</span>
                    <Badge variant={deviceSession.is_active ? "default" : "secondary"}>
                      {deviceSession.is_active ? "Active" : "Inactive"}
                    </Badge>
                    {deviceSession.trusted_until && (
                      <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                        Trusted
                      </Badge>
                    )}
                  </div>
                  <p className="text-slate-500">IP: {deviceSession.ip_address}</p>
                  <p className="text-slate-500">
                    Last used: {formatDate(deviceSession.last_used)}
                  </p>
                  <p className="text-slate-500">
                    Created: {formatDate(deviceSession.created_at)}
                  </p>
                </div>

                <Button
                  variant="outline"
                  className="text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                  disabled={revokingId === deviceSession.id}
                  onClick={() => void handleRevoke(deviceSession.id)}
                >
                  {revokingId === deviceSession.id ? "Revoking..." : "Revoke"}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Login History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loginHistory.length === 0 ? (
              <p className="text-sm text-slate-500">No login history returned.</p>
            ) : (
              loginHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-lg border px-4 py-3 text-sm text-slate-600"
                >
                  <p className="font-medium text-slate-900">{entry.ip_address}</p>
                  <p className="truncate">{entry.user_agent || "Unknown device"}</p>
                  <p className="text-slate-500">{formatDate(entry.created_at)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {securityEvents.length === 0 ? (
              <p className="text-sm text-slate-500">No security events returned.</p>
            ) : (
              securityEvents.map((event, index) => (
                <div
                  key={`${event.event_type}-${event.created_at}-${index}`}
                  className="rounded-lg border px-4 py-3 text-sm text-slate-600"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">
                      {formatEventName(event.event_type)}
                    </p>
                    <span className="text-slate-500">{formatDate(event.created_at)}</span>
                  </div>
                  <p className="mt-1 text-slate-500">
                    IP: {event.ip_address || "N/A"} | Device: {event.user_agent || "Unknown"}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatEventName(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
