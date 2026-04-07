import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Clock, History, AlertCircle, RefreshCw, PartyPopper } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { format, differenceInHours, parseISO, isAfter } from "date-fns";

import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getVehiclesByUnit } from "@/lib/vehicles-db";
import { api } from "@/lib/supabase-db";

export default function ResidentDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [unitId, setUnitId] = useState<string | null>(null);
  const [unitLabel, setUnitLabel] = useState<string | null>(null);
  
  // New Pass State
  const [isNewPassOpen, setIsNewPassOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [passType, setPassType] = useState<"regular" | "party">("regular");

  useEffect(() => {
    const id = localStorage.getItem("unitId");
    const num = localStorage.getItem("unitNumber");
    const bldg = localStorage.getItem("buildingNumber");
    
    if (!id) {
      setLocation("/");
      return;
    }
    setUnitId(id);
    if (bldg && num) {
      setUnitLabel(`Bldg ${bldg} - Unit ${num}`);
    } else {
      setUnitLabel(num);
    }
  }, [setLocation]);

  const { data: passes, isLoading: passesLoading } = useQuery({
    queryKey: ["passes", unitId],
    queryFn: () => api.getUnitPasses(unitId!),
    enabled: !!unitId,
  });

const { data: vehicles, isLoading: vehiclesLoading } = useQuery({
  queryKey: ["vehicles", unitId],
  queryFn: () => getVehiclesByUnit(unitId!),
  enabled: !!unitId,
//const { data: vehicles } = useQuery({
//    queryKey: ["vehicles", unitId],
//    queryFn: () => api.getVehicles(unitId!),
//    enabled: !!unitId,
  });

  const { data: unitData } = useQuery({
    queryKey: ["unit", unitId],
    queryFn: () => api.getUnit(unitId!),
    enabled: !!unitId,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings
  });

  const createPassMutation = useMutation({
    mutationFn: async (data: { vehicleId: string, isParty: boolean }) => {
      return api.createPass(unitId!, data.vehicleId, data.isParty);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["passes"] });
      queryClient.invalidateQueries({ queryKey: ["unit"] });
      toast({ title: "Pass Created", description: "Your visitor pass is now active for 24 hours." });
      setIsNewPassOpen(false);
      setSelectedVehicleId("");
      setPassType("regular");
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Failed to create pass", description: error.message });
    }
  });

  const handleCreatePass = () => {
    if (!selectedVehicleId) return;
    createPassMutation.mutate({ vehicleId: selectedVehicleId, isParty: passType === "party" });
  };

  const handleReissuePass = (vehicleId: string) => {
    createPassMutation.mutate({ vehicleId, isParty: false });
  };

  if (!unitId) return null;

  const activePasses = passes?.filter(p => isAfter(parseISO(p.expiresAt), new Date())) || [];
  const expiredPasses = passes?.filter(p => !isAfter(parseISO(p.expiresAt), new Date())) || [];
  
  // Logic checks
  const currentMonth = new Date().getMonth();
  const freePassesUsed = passes?.filter(p => {
    const d = parseISO(p.createdAt);
    return d.getMonth() === currentMonth && p.type === "free";
  }).length || 0;
  
  const freePassesRemaining = Math.max(0, (unitData?.freePassLimit || 12) - freePassesUsed);
  
  const partyDaysUsed = unitData?.partyDays.filter(d => new Date(d).getMonth() === currentMonth).length || 0;
  const partyPassesRemaining = Math.max(0, (settings?.partyPassLimit || 3) - partyDaysUsed);
  const isTodayPartyDay = unitData?.partyDays.includes(format(new Date(), "yyyy-MM-dd"));

  return (
    <Layout userType="resident" userName={unitLabel || ""}>
      <div className="space-y-6">
        
        {/* Header Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-primary text-primary-foreground border-none shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">Active Passes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-display">{activePasses.length}</div>
              <p className="text-xs opacity-70 mt-1">Visitors currently registered</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Allowances</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end mb-2">
                  <div>
                      <div className="text-2xl font-bold font-display">{freePassesRemaining}</div>
                      <div className="text-xs text-muted-foreground">Free Passes Left</div>
                  </div>
                  <div className="text-right">
                      <div className="text-2xl font-bold font-display">{partyPassesRemaining}</div>
                      <div className="text-xs text-muted-foreground">Party Days Left</div>
                  </div>
              </div>
              {isTodayPartyDay && (
                  <Badge variant="secondary" className="w-full justify-center bg-purple-100 text-purple-700">
                      <PartyPopper className="w-3 h-3 mr-1" /> Party Mode Active!
                  </Badge>
              )}
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-center p-6 border-dashed border-2 bg-secondary/20">
             <Dialog open={isNewPassOpen} onOpenChange={setIsNewPassOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="w-full h-full min-h-[80px] text-lg gap-2 shadow-md">
                  <Plus className="w-5 h-5" /> New Visitor Pass
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Visitor Pass</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Select Vehicle</label>
                    <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a vehicle..." />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicles?.map(v => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.licensePlate} - {v.nickname || `${v.make} ${v.model}`}
                          </SelectItem>
                        ))}
                        <div className="p-2 border-t mt-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full justify-start h-auto p-1 text-primary"
                            onClick={() => {
                                setIsNewPassOpen(false);
                                setLocation("/vehicles");
                            }}
                          >
                            <Plus className="w-3 h-3 mr-2" /> Add new vehicle
                          </Button>
                        </div>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                      <label className="text-sm font-medium">Pass Type</label>
                      <RadioGroup value={passType} onValueChange={(v) => setPassType(v as "regular" | "party")}>
                          <div className="flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                              <RadioGroupItem value="regular" id="r1" />
                              <Label htmlFor="r1" className="flex-1 cursor-pointer">
                                  <div className="font-medium">Regular Pass</div>
                                  <div className="text-xs text-muted-foreground">Standard 24h visitor pass</div>
                              </Label>
                              <div className="text-xs font-medium">
                                  {isTodayPartyDay ? "Free (Party Day)" : freePassesRemaining > 0 ? "Free" : `$${settings?.pricePerPass?.toFixed(2)}`}
                              </div>
                          </div>
                          <div className={`flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-muted/50 transition-colors ${partyPassesRemaining === 0 && !isTodayPartyDay ? "opacity-50 pointer-events-none" : ""}`}>
                              <RadioGroupItem value="party" id="r2" disabled={partyPassesRemaining === 0 && !isTodayPartyDay} />
                              <Label htmlFor="r2" className="flex-1 cursor-pointer">
                                  <div className="flex items-center gap-2">
                                      <span className="font-medium">Party Pass</span>
                                      <Badge variant="outline" className="text-[10px] h-5">Today</Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground">Unlimited passes for today</div>
                              </Label>
                              <div className="text-xs font-medium">
                                  {isTodayPartyDay ? "Active" : `${partyPassesRemaining} left`}
                              </div>
                          </div>
                      </RadioGroup>
                  </div>
                  
                  {passType === "regular" && !isTodayPartyDay && freePassesRemaining === 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Payment Required</AlertTitle>
                      <AlertDescription>
                        You have used all free passes for this month. This pass will cost ${settings?.pricePerPass?.toFixed(2)}.
                      </AlertDescription>
                    </Alert>
                  )}

                  {passType === "party" && !isTodayPartyDay && (
                      <Alert className="bg-purple-50 border-purple-200 text-purple-900">
                          <PartyPopper className="h-4 w-4 text-purple-700" />
                          <AlertTitle>Activate Party Mode</AlertTitle>
                          <AlertDescription>
                              This will consume 1 of your {partyPassesRemaining} remaining party days. All passes created today will be free.
                          </AlertDescription>
                      </Alert>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsNewPassOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreatePass} disabled={createPassMutation.isPending || !selectedVehicleId}>
                    {createPassMutation.isPending ? "Creating..." : "Generate Pass"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Card>
        </div>

        {/* Active Passes Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-display font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> Active Passes
          </h2>
          
          {passesLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : activePasses.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-card text-muted-foreground">
              No active visitor passes at the moment.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activePasses.map(pass => (
                <Card key={pass.id} className="overflow-hidden border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    <div className="p-5 flex justify-between items-start">
                      <div>
                        <div className="font-display text-2xl font-bold tracking-wide mb-1">
                          {pass.vehicleSnapshot.licensePlate}
                        </div>
                        <div className="text-sm text-muted-foreground mb-3">
                          {pass.vehicleSnapshot.nickname || `${pass.vehicleSnapshot.color} ${pass.vehicleSnapshot.make}`}
                        </div>
                        <div className="flex flex-wrap gap-2">
                           <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">
                             Active
                           </Badge>
                           {pass.type === "party" ? (
                               <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200">Party Pass</Badge>
                           ) : pass.type === "free" ? (
                             <Badge variant="outline" className="text-muted-foreground">Free Pass</Badge>
                           ) : (
                             <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
                               {pass.paymentStatus === "paid" ? "Paid" : pass.paymentStatus === "waived" ? "Waived" : `Due $${pass.price}`}
                             </Badge>
                           )}
                        </div>
                      </div>
                      <div className="bg-white p-2 rounded-lg shadow-sm border">
                        <QRCodeSVG value={pass.id} size={64} />
                      </div>
                    </div>
                    <div className="bg-muted/50 px-5 py-3 text-xs text-muted-foreground border-t flex justify-between">
                      <span>Expires {format(parseISO(pass.expiresAt), "MMM d, h:mm a")}</span>
                      <span className="font-medium text-destructive">
                        {Math.max(0, differenceInHours(parseISO(pass.expiresAt), new Date()))}h remaining
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* History Section */}
        <div className="space-y-4 pt-4">
          <h2 className="text-xl font-display font-semibold flex items-center gap-2">
            <History className="w-5 h-5 text-muted-foreground" /> Recent History
          </h2>
          
          <Card>
            <div className="divide-y">
              {expiredPasses.slice(0, 5).map(pass => (
                <div key={pass.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div>
                    <div className="font-medium">{pass.vehicleSnapshot.licensePlate}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(pass.createdAt), "MMM d, yyyy")}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                     <div className="text-right hidden sm:block">
                       <div className="text-xs text-muted-foreground">Status</div>
                       <div className="text-sm font-medium">Expired</div>
                     </div>
                     <Button 
                       variant="ghost" 
                       size="sm" 
                       className="gap-1 text-primary hover:text-primary hover:bg-primary/10"
                       onClick={() => handleReissuePass(pass.vehicleId)}
                       disabled={createPassMutation.isPending}
                     >
                       <RefreshCw className="w-3 h-3" /> Re-issue
                     </Button>
                  </div>
                </div>
              ))}
              {expiredPasses.length === 0 && (
                <div className="p-8 text-center text-muted-foreground text-sm">No pass history available.</div>
              )}
            </div>
          </Card>
        </div>
        
      </div>
    </Layout>
  );
}
