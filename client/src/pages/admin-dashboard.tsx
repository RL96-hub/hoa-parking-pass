import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Download, Search, Check, X } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api, Pass } from "@/lib/supabase-db";

function isPassActive(pass: Pass) {
  return new Date(pass.expiresAt).getTime() > Date.now();
}

function getUnitLabel(pass: Pass) {
  if (pass.buildingNumber && pass.unitNumber) {
    return `B${pass.buildingNumber}-${pass.unitNumber}`;
  }

  if (pass.unitNumber) {
    return `Unit ${pass.unitNumber}`;
  }

  return "Unknown";
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const communityId = localStorage.getItem("communityId") || "";
  const communityName = localStorage.getItem("communityName") || "Community";

  const { data: passes = [], isLoading } = useQuery({
    queryKey: ["admin-passes", communityId],
    queryFn: () => api.getAllPasses(communityId),
    enabled: !!communityId,
  });

  const updatePaymentMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "paid" | "waived" }) =>
      api.updatePassPaymentStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-passes", communityId] });
      queryClient.invalidateQueries({ queryKey: ["security-passes", localStorage.getItem("communityCode") || ""] });
      toast({ title: "Status Updated" });
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: err.message,
      });
    },
  });

  const filteredPasses = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return passes.filter((p) => {
      const unitStr = getUnitLabel(p).toLowerCase();
      const searchMatch =
        !term ||
        p.vehicleSnapshot.licensePlate.toLowerCase().includes(term) ||
        p.vehicleSnapshot.make.toLowerCase().includes(term) ||
        p.vehicleSnapshot.model.toLowerCase().includes(term) ||
        p.vehicleSnapshot.color.toLowerCase().includes(term) ||
        (p.vehicleSnapshot.nickname || "").toLowerCase().includes(term) ||
        unitStr.includes(term);

      if (!searchMatch) return false;

      if (statusFilter === "active") return isPassActive(p);
      if (statusFilter === "unpaid") return p.paymentStatus === "payment_required";
      if (statusFilter === "expired") return !isPassActive(p);

      return true;
    });
  }, [passes, searchTerm, statusFilter]);

  const activePasses = useMemo(() => {
    return passes.filter((p) => isPassActive(p));
  }, [passes]);

  const unpaidCount = useMemo(() => {
    return passes.filter((p) => p.paymentStatus === "payment_required").length;
  }, [passes]);

  const unitUsage = useMemo(() => {
    const usageMap = new Map<string, number>();

    passes.forEach((p) => {
      const label = getUnitLabel(p);
      usageMap.set(label, (usageMap.get(label) || 0) + 1);
    });

    return Array.from(usageMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [passes]);

  const handleExport = () => {
    if (!passes.length) return;

    const csv = [
      ["Pass ID", "Building", "Unit", "License Plate", "Make", "Model", "Color", "Created", "Expires", "Type", "Status"],
      ...passes.map((p) => [
        p.id,
        p.buildingNumber || "",
        p.unitNumber || "",
        p.vehicleSnapshot.licensePlate,
        p.vehicleSnapshot.make,
        p.vehicleSnapshot.model,
        p.vehicleSnapshot.color,
        p.createdAt,
        p.expiresAt,
        p.type,
        p.paymentStatus,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `passes-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Layout userType="admin" onLogout={() => setLocation("/")}>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Admin Overview</h1>
            <p className="text-muted-foreground">{communityName}</p>
          </div>

          <Button variant="outline" onClick={handleExport} disabled={!passes.length}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Passes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{activePasses.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Outstanding Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">{unpaidCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Passes (All Time)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{passes.length}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search plate, unit, make, model..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Passes</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="expired">Expired Only</SelectItem>
                  <SelectItem value="unpaid">Unpaid Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filteredPasses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        No passes found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPasses.slice(0, 25).map((pass) => (
                      <TableRow key={pass.id}>
                        <TableCell className="font-medium">
                          {getUnitLabel(pass)}
                        </TableCell>

                        <TableCell>
                          <div className="font-mono">{pass.vehicleSnapshot.licensePlate}</div>
                          <div className="text-xs text-muted-foreground">
                            {pass.vehicleSnapshot.make} {pass.vehicleSnapshot.model}
                          </div>
                        </TableCell>

                        <TableCell>
                          {isPassActive(pass) ? (
                            <Badge className="bg-green-500 hover:bg-green-500">Active</Badge>
                          ) : (
                            <Badge variant="outline">Expired</Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-xs">
                          {format(parseISO(pass.createdAt), "MM/dd HH:mm")}
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          {format(parseISO(pass.expiresAt), "MM/dd HH:mm")}
                        </TableCell>

                        <TableCell>
                          {pass.type === "free" ? (
                            <Badge variant="secondary">Free</Badge>
                          ) : pass.type === "party" ? (
                            <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200">
                              Party
                            </Badge>
                          ) : (
                            <Badge variant={pass.paymentStatus === "paid" ? "default" : "destructive"}>
                              {pass.paymentStatus === "payment_required"
                                ? `Due $${pass.price ?? 0}`
                                : pass.paymentStatus}
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          {pass.paymentStatus === "payment_required" && (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-green-600"
                                title="Mark Paid"
                                onClick={() => updatePaymentMutation.mutate({ id: pass.id, status: "paid" })}
                              >
                                <Check className="w-4 h-4" />
                              </Button>

                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-muted-foreground"
                                title="Waive"
                                onClick={() => updatePaymentMutation.mutate({ id: pass.id, status: "waived" })}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Units (Usage)</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={unitUsage} layout="vertical" margin={{ left: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 12 }} />
                    <Tooltip cursor={{ fill: "transparent" }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}