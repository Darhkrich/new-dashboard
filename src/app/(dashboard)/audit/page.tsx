"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError, fetchAuditLogs, runWithSession, type AuditLog } from "@/lib/api";

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "Unable to load audit logs.";
}

export default function AuditPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Loading audit logs...</div>}>
      <AuditPageContent />
    </Suspense>
  );
}

function AuditPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPage = Number(searchParams.get("page")) || 1;

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const loadLogs = useCallback(async (page: number) => {
    setLoading(true);

    try {
      const { data } = await runWithSession((accessToken) => fetchAuditLogs(accessToken, page));
      setLogs(data.results);
      setCurrentPage(data.current_page);
      setTotalPages(Math.max(1, data.total_pages));
      setTotalItems(data.count ?? data.results.length);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setLogs([]);
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

    const nextPath = params.toString() ? `/audit?${params.toString()}` : "/audit";
    router.replace(nextPath, { scroll: false });
    void loadLogs(currentPage);
  }, [currentPage, loadLogs, router]);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Audit Logs</h1>

      <div className="flex h-[calc(100vh-220px)] flex-col rounded-lg bg-white shadow">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-white shadow-sm">
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                    Loading audit logs...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                    No audit logs found.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-medium">{log.user || "System"}</TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell className="text-gray-500">{log.ip_address || "N/A"}</TableCell>
                    <TableCell>
                      {log.status_code >= 200 && log.status_code < 400 ? (
                        <Badge className="border-green-200 bg-green-100 text-green-800 hover:bg-green-100">
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="destructive">{log.status_code}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t p-4 text-sm text-gray-500">
          <div>
            Showing {logs.length === 0 ? 0 : (currentPage - 1) * 10 + 1} to{" "}
            {Math.min(currentPage * 10, totalItems || logs.length)} of {totalItems || logs.length} logs
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
