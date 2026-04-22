"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Mail, Shield, UserCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  ApiError,
  deleteAdminUser,
  fetchAdminUser,
  restoreUser,
  runWithSession,
  suspendUser,
  toggleStaff,
  unlockUser,
  updateAdminUser,
  type AdminUser,
} from "@/lib/api";

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "Unable to load the user details.";
}

export default function UserDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const userId = Number(params.id);

  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("USER");

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      setLoading(true);

      try {
        const { data } = await runWithSession((accessToken) =>
          fetchAdminUser(accessToken, userId),
        );

        if (!cancelled) {
          setUser(data);
          setEmail(data.email || "");
          setFirstName(data.first_name || "");
          setLastName(data.last_name || "");
          setRole(data.role || "USER");
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(getErrorMessage(error));
          router.replace("/users");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (Number.isFinite(userId)) {
      void loadUser();
    } else {
      router.replace("/users");
    }

    return () => {
      cancelled = true;
    };
  }, [router, userId]);

  async function handleAction(action: "toggle-staff" | "suspend" | "restore" | "unlock") {
    if (!user) {
      return;
    }

    try {
      if (action === "toggle-staff") {
        await runWithSession((accessToken) => toggleStaff(accessToken, user.id));
      } else if (action === "suspend") {
        await runWithSession((accessToken) => suspendUser(accessToken, user.id));
      } else if (action === "unlock") {
        await runWithSession((accessToken) => unlockUser(accessToken, user.id));
      } else {
        await runWithSession((accessToken) => restoreUser(accessToken, user.id));
      }

      const { data } = await runWithSession((accessToken) => fetchAdminUser(accessToken, user.id));
      setUser(data);
      toast.success("User updated successfully.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function handleSave() {
    if (!user) {
      return;
    }

    setSaving(true);

    try {
      const { data } = await runWithSession((accessToken) =>
        updateAdminUser(accessToken, user.id, {
          email,
          first_name: firstName,
          last_name: lastName,
          role,
        }),
      );

      setUser(data);
      setEmail(data.email || "");
      setFirstName(data.first_name || "");
      setLastName(data.last_name || "");
      setRole(data.role || "USER");
      toast.success("User details updated successfully.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!user) {
      return;
    }

    setDeleting(true);

    try {
      await runWithSession((accessToken) => deleteAdminUser(accessToken, user.id));
      toast.success("User deleted successfully.");
      router.replace("/users");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <Link href="/users" className="mb-6 flex w-fit items-center text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Users
        </Link>
        <div className="text-gray-500">Loading user details...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isLocked =
    Boolean(user.account_locked_until) &&
    new Date(user.account_locked_until as string).getTime() > Date.now();

  return (
    <div className="max-w-4xl space-y-6 p-6">
      <Link href="/users" className="flex w-fit items-center text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Users
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <UserCircle className="h-8 w-8 text-gray-400" />
          {`${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email}
        </h1>

        <div className="flex flex-wrap gap-2">
          {user.is_superuser && <Badge variant="destructive">Super Admin</Badge>}
          {!user.is_superuser && user.is_staff && <Badge>Staff</Badge>}
          {!user.is_staff && <Badge variant="secondary">User</Badge>}

          {user.is_active ? (
            <Badge className="border-green-200 bg-green-100 text-green-800 hover:bg-green-100">
              Active
            </Badge>
          ) : (
            <Badge variant="destructive">Suspended</Badge>
          )}

          {isLocked && (
            <Badge className="border-orange-200 bg-orange-100 text-orange-800 hover:bg-orange-100">
              Locked
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailRow label="Email Address" value={user.email} icon={<Mail className="h-5 w-5 text-gray-400" />} />
            <DetailRow
              label="Full Name"
              value={`${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "N/A"}
              icon={<UserCircle className="h-5 w-5 text-gray-400" />}
            />
            <DetailRow
              label="User ID"
              value={String(user.id)}
              icon={<Shield className="h-5 w-5 text-gray-400" />}
            />
            <DetailRow
              label="Joined"
              value={user.date_joined ? new Date(user.date_joined).toLocaleString() : "N/A"}
              icon={<Shield className="h-5 w-5 text-gray-400" />}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Edit User</CardTitle>
            <CardDescription>
              Uses `PATCH /api/v1/auth/{'{id}'}/` for direct user detail updates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Address</label>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">First Name</label>
                <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Last Name</label>
                <Input value={lastName} onChange={(event) => setLastName(event.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <select
                className="flex h-8 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                <option value="USER">USER</option>
                <option value="MODERATOR">MODERATOR</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>

            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Administrative Actions
            </CardTitle>
            <CardDescription>
              Actions on this page are now backed by the upgraded admin API.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!user.is_active ? (
              <Button
                variant="outline"
                className="w-full justify-start text-green-600 hover:bg-green-50 hover:text-green-700"
                onClick={() => void handleAction("restore")}
              >
                Restore Account
              </Button>
            ) : (
              !user.is_superuser && (
                <Button
                  variant="outline"
                  className="w-full justify-start text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                  onClick={() => void handleAction("suspend")}
                >
                  Suspend User
                </Button>
              )
            )}

            {!user.is_superuser && (
              <Button variant="outline" className="w-full justify-start" onClick={() => void handleAction("toggle-staff")}>
                {user.is_staff ? "Remove Staff Role" : "Promote to Staff"}
              </Button>
            )}

            {isLocked && (
              <Button
                variant="outline"
                className="w-full justify-start text-amber-700 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800"
                onClick={() => void handleAction("unlock")}
              >
                Unlock Account
              </Button>
            )}

            <Dialog>
              <DialogTrigger
                render={
                  <Button
                    variant="destructive"
                    className="w-full justify-start"
                    disabled={user.is_superuser || deleting}
                  />
                }
              >
                {deleting ? "Deleting..." : "Delete User"}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete this user?</DialogTitle>
                  <DialogDescription>
                    This uses `DELETE /api/v1/auth/{'{id}'}/` and cannot be undone from the dashboard.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter showCloseButton>
                  <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
                    {deleting ? "Deleting..." : "Confirm Delete"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 text-gray-600">
      {icon}
      <div>
        <p className="mb-0.5 text-sm text-gray-500">{label}</p>
        <p className="font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}
