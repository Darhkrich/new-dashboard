"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  ApiError,
  fetchAdminUsers,
  restoreUser,
  runWithSession,
  suspendUser,
  toggleStaff,
  type AdminUser,
} from "@/lib/api";

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "The request could not be completed.";
}

export default function UsersPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Loading users...</div>}>
      <UsersPageContent />
    </Suspense>
  );
}

function UsersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialPage = Number(searchParams.get("page")) || 1;
  const initialSearch = searchParams.get("search") || "";

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  const loadUsers = useCallback(async (page: number, search: string) => {
    setLoading(true);

    try {
      const { data } = await runWithSession((accessToken) =>
        fetchAdminUsers(accessToken, page, search),
      );

      setUsers(data.users);
      setCurrentPage(data.current_page);
      setTotalPages(Math.max(1, data.total_pages));
      setTotalItems(data.count ?? data.users.length);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setUsers([]);
      setTotalPages(1);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (currentPage > 1) {
      params.set("page", String(currentPage));
    }
    if (searchQuery) {
      params.set("search", searchQuery);
    }

    const nextPath = params.toString() ? `/users?${params.toString()}` : "/users";
    router.replace(nextPath, { scroll: false });

    const timer = window.setTimeout(() => {
      void loadUsers(currentPage, searchQuery);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [currentPage, searchQuery, loadUsers, router]);

  async function handleAction(
    action: "toggle-staff" | "suspend" | "restore",
    userId: number,
  ) {
    try {
      if (action === "toggle-staff") {
        await runWithSession((accessToken) => toggleStaff(accessToken, userId));
      } else if (action === "suspend") {
        await runWithSession((accessToken) => suspendUser(accessToken, userId));
      } else {
        await runWithSession((accessToken) => restoreUser(accessToken, userId));
      }

      toast.success("User updated successfully.");
      await loadUsers(currentPage, searchQuery);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 rounded-lg bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold">Users Management</h1>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search users..."
            className="pl-9"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      <div className="flex h-[calc(100vh-220px)] flex-col rounded-lg bg-white shadow">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-white shadow-sm">
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                    Loading users...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-gray-500">{user.id}</TableCell>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>{`${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "N/A"}</TableCell>
                    <TableCell>
                      {user.is_superuser ? (
                        <Badge variant="destructive">Super Admin</Badge>
                      ) : user.is_staff ? (
                        <Badge>Staff</Badge>
                      ) : (
                        <Badge variant="secondary">User</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.is_active ? (
                        <Badge className="border-green-200 bg-green-100 text-green-800 hover:bg-green-100">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Suspended</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                          Options
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem render={<Link href={`/users/${user.id}`} />}>
                            View Details
                          </DropdownMenuItem>

                          {!user.is_superuser && (
                            <DropdownMenuItem
                              onClick={() => void handleAction("toggle-staff", user.id)}
                            >
                              {user.is_staff ? "Remove Staff Role" : "Promote to Staff"}
                            </DropdownMenuItem>
                          )}

                          {user.is_active && !user.is_superuser && (
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-700"
                              onClick={() => void handleAction("suspend", user.id)}
                            >
                              Suspend User
                            </DropdownMenuItem>
                          )}

                          {!user.is_active && (
                            <DropdownMenuItem
                              className="text-green-600 focus:text-green-700"
                              onClick={() => void handleAction("restore", user.id)}
                            >
                              Restore Account
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t p-4 text-sm text-gray-500">
          <div>
            Showing {users.length === 0 ? 0 : (currentPage - 1) * 10 + 1} to{" "}
            {Math.min(currentPage * 10, totalItems || users.length)} of {totalItems || users.length} users
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1 || loading}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>

            <span className="mx-2 font-medium text-gray-900">
              Page {currentPage} of {Math.max(1, totalPages)}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage >= totalPages || loading}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
