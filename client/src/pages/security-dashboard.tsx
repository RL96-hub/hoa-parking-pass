import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format, isAfter, parseISO } from "date-fns";
import { Search, Shield, Car, Clock3, BadgeDollarSign, Building2, RefreshCw } from "lucide-react";

import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, Pass } from "@/lib/supabase-db";

function isPassActive(pass: Pass) {
  return isAfter(parseISO(pass.expiresAt), new Date());
}

function getStatusBadge(pass: Pass) {
  if (!isPassActive(pass)) {
    return <Badge variant="secondary">Expired</Badge>;
  }

  if (pass.paymentStatus === "payment_required") {
    return <Badge variant="destructive">Payment Required</Badge>;
  }

  if (pass.paymentStatus === "paid") {
    return <Badge className="bg-green-600 hover:bg-green-600">Paid</Badge>;
  }

  if (pass.paymentStatus === "waived") {
    return <Badge className="bg-amber-500 hover:bg-amber-500">Waived</Badge>;
  }

  return <Badge className="bg-blue-600 hover:bg-blue-600">Active</Badge>;
}

function getTypeBadge(pass: Pass) {
  if (pass.type === "party") {
    return <Badge variant="outline">Party</Badge>;
  }

  if (pass.type === "paid") {
    return <Badge variant="outline">Paid</Badge>;
  }

  return <Badge variant="outline">Free</Badge>;
}

export default function SecurityDashboardPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const communityId = localStorage.getItem("communityId") || "";
  const communityName = localStorage.getItem("communityName") || "Community";
  const communityCode = localStorage.getItem("communityCode") || "";
  const userType = localStorage.getItem("userType");

  React.useEffect(() => {
    if (userType !== "security") {
      setLocation("/");
    }
  }, [userType, setLocation]);

  const {
    data: passes = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["security-passes", communityId],
    queryFn: () => api.getAllPasses(communityId),
    enabled: !!communityId,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const filteredPasses = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return passes;

    return passes.filter((pass) => {
      const plate = pass.vehicleSnapshot.licensePlate?.toLowerCase() || "";
      const make = pass.vehicleSnapshot.make?.toLowerCase() || "";
      const model = pass.vehicleSnapshot.model?.toLowerCase() || "";
      const color = pass.vehicleSnapshot.color?.toLowerCase() || "";
      const nickname = pass.vehicleSnapshot.nickname?.toLowerCase() || "";
      const payment = pass.paymentStatus.toLowerCase();
      const type = pass.type.toLowerCase();
      const building = (pass.buildingNumber || "").toLowerCase();
      const unit = (pass.unitNumber || "").toLowerCase();
      const unitLabel = `b${pass.buildingNumber || ""}-${pass.unitNumber || ""}`.toLowerCase();

      return (
        plate.includes(term) ||
        make.includes(term) ||
        model.includes(term) ||
        color.includes(term) ||
        nickname.includes(term) ||
        payment.includes(term) ||
        type.includes(term) ||
        building.includes(term) ||
        unit.includes(term) ||
        unitLabel.includes(term)
      );
    });
  }, [passes, search]);

  const activePasses = useMemo(() => {
    return passes.filter((pass) => isPassActive(pass));
  }, [passes]);

  const paymentRequiredCount = useMemo(() => {
    return activePasses.filter((pass) => pass.paymentStatus === "payment_required").length;
  }, [activePasses]);

  return (
    <Layout userType="security" onLogout={() => setLocation("/")}>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Security Dashboard</h1>
            <p className="text-muted-foreground">Read-only access for {communityName}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">
              Community Code: <span className="font-medium">{communityCode}</span>
            </div>

            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Passes</CardDescription>
              <CardTitle className="text-3xl">{activePasses.length}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>Currently valid visitor passes</span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Passes</CardDescription>
              <CardTitle className="text-3xl">{passes.length}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-muted-foreground">
              <Car className="h-4 w-4" />
              <span>All passes in this community</span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Payment Required</CardDescription>
              <CardTitle className="text-3xl">{paymentRequiredCount}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-muted-foreground">
              <BadgeDollarSign className="h-4 w-4" />
              <span>Active passes pending payment</span>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pass Search</CardTitle>
            <CardDescription>
              Search by building, unit, plate, vehicle, color, pass type, or payment status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search passes..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pass History</CardTitle>
            <CardDescription>View-only history of active and previous passes for this community</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading passes...</div>
            ) : error ? (
              <div className="text-sm text-red-600">Failed to load passes. Please try again.</div>
            ) : filteredPasses.length === 0 ? (
              <div className="text-sm text-muted-foreground">No passes found.</div>
            ) : (
              <div className="space-y-3">
                {filteredPasses.map((pass) => {
                  const active = isPassActive(pass);

                  return (
                    <div
                      key={pass.id}
                      className="rounded-xl border p-4 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg font-semibold tracking-wide">
                              {pass.vehicleSnapshot.licensePlate}
                            </span>
                            {getStatusBadge(pass)}
                            {getTypeBadge(pass)}
                          </div>

                          <div className="text-sm text-muted-foreground">
                            {pass.vehicleSnapshot.make} {pass.vehicleSnapshot.model} • {pass.vehicleSnapshot.color}
                            {pass.vehicleSnapshot.nickname ? ` • ${pass.vehicleSnapshot.nickname}` : ""}
                          </div>

                          <div className="grid gap-1 text-sm text-muted-foreground md:grid-cols-2">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              <span>
                                Building {pass.buildingNumber ?? "?"} • Unit {pass.unitNumber ?? "?"}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <Clock3 className="h-4 w-4" />
                              <span>
                                Created: {format(parseISO(pass.createdAt), "MMM d, yyyy h:mm a")}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              <span>
                                Expires: {format(parseISO(pass.expiresAt), "MMM d, yyyy h:mm a")}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <BadgeDollarSign className="h-4 w-4" />
                              <span>Payment: {pass.paymentStatus.replaceAll("_", " ")}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-sm md:text-right">
                          <div className="font-medium">{active ? "Valid Now" : "Expired"}</div>
                          {typeof pass.price === "number" && pass.price > 0 ? (
                            <div className="text-muted-foreground">${pass.price.toFixed(2)}</div>
                          ) : (
                            <div className="text-muted-foreground">No charge</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}