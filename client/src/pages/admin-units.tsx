import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Edit, Trash2, Plus, Upload, Loader2 } from "lucide-react";

import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api, Unit } from "@/lib/supabase-db";

const buildingSchema = z.object({
  number: z.string().min(1, "Building number is required"),
  name: z.string().optional(),
});

const unitSchema = z.object({
  buildingId: z.string().min(1, "Building is required"),
  number: z.string().min(1, "Unit number is required"),
  accessCode: z.string().min(4, "Code must be at least 4 chars").max(10, "Code must be max 10 chars"),
  freePassLimit: z.coerce.number().min(0, "Limit cannot be negative"),
});

export default function AdminManagement() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const communityId = localStorage.getItem("communityId") || "";
  const communityName = localStorage.getItem("communityName") || "Community";

  const [activeTab, setActiveTab] = useState("units");
  const [showAccessCodes, setShowAccessCodes] = useState(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("all");

  const [isAddBuildingOpen, setIsAddBuildingOpen] = useState(false);
  const [isUnitDialogOpen, setIsUnitDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  const [csvContent, setCsvContent] = useState("");
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  const { data: buildings = [], isLoading: buildingsLoading } = useQuery({
    queryKey: ["buildings", communityId],
    queryFn: () => api.getBuildings(communityId),
    enabled: !!communityId,
  });

  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ["units", communityId],
    queryFn: () => api.getUnits(communityId),
    enabled: !!communityId,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings", communityId],
    queryFn: () => api.getCommunitySettings(communityId),
    enabled: !!communityId,
  });

  const buildingForm = useForm<z.infer<typeof buildingSchema>>({
    resolver: zodResolver(buildingSchema),
    defaultValues: { number: "", name: "" },
  });

  const unitForm = useForm<z.infer<typeof unitSchema>>({
    resolver: zodResolver(unitSchema),
    defaultValues: { buildingId: "", number: "", accessCode: "", freePassLimit: 12 },
  });

  React.useEffect(() => {
    if (editingUnit) {
      unitForm.reset({
        buildingId: editingUnit.buildingId,
        number: editingUnit.number,
        accessCode: editingUnit.accessCode,
        freePassLimit: editingUnit.freePassLimit,
      });
    } else {
      unitForm.reset({
        buildingId: selectedBuildingId !== "all" ? selectedBuildingId : "",
        number: "",
        accessCode: "",
        freePassLimit: settings?.freePassLimit ?? 12,
      });
    }
  }, [editingUnit, isUnitDialogOpen, selectedBuildingId, settings, unitForm]);

  const refreshAdminData = () => {
    queryClient.invalidateQueries({ queryKey: ["buildings", communityId] });
    queryClient.invalidateQueries({ queryKey: ["units", communityId] });
    queryClient.invalidateQueries({ queryKey: ["settings", communityId] });
  };

  const updateSettingsMutation = useMutation({
    mutationFn: (newSettings: any) => api.updateCommunitySettings(communityId, newSettings),
    onSuccess: () => {
      refreshAdminData();
      toast({ title: "Settings Updated" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Update Failed", description: err.message });
    },
  });

  const addBuildingMutation = useMutation({
    mutationFn: (data: z.infer<typeof buildingSchema>) => api.addBuilding(communityId, data),
    onSuccess: () => {
      refreshAdminData();
      toast({ title: "Building Added" });
      setIsAddBuildingOpen(false);
      buildingForm.reset();
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    },
  });

  const deleteBuildingMutation = useMutation({
    mutationFn: (id: string) => api.deleteBuilding(id),
    onSuccess: () => {
      refreshAdminData();
      toast({ title: "Building Deleted" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Cannot Delete", description: err.message });
    },
  });

  const addUnitMutation = useMutation({
    mutationFn: (data: z.infer<typeof unitSchema>) => api.addUnit(data),
    onSuccess: () => {
      refreshAdminData();
      toast({ title: "Unit Added" });
      setIsUnitDialogOpen(false);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    },
  });

  const updateUnitMutation = useMutation({
    mutationFn: (data: z.infer<typeof unitSchema>) => api.updateUnit(editingUnit!.id, data),
    onSuccess: () => {
      refreshAdminData();
      toast({ title: "Unit Updated" });
      setIsUnitDialogOpen(false);
      setEditingUnit(null);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    },
  });

  const deleteUnitMutation = useMutation({
    mutationFn: (id: string) => api.deleteUnit(id),
    onSuccess: () => {
      refreshAdminData();
      toast({ title: "Unit Deleted" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Delete Failed", description: err.message });
    },
  });

  const importMutation = useMutation({
    mutationFn: (csv: string) => api.importData(csv, communityId),
    onSuccess: (data) => {
      refreshAdminData();
      setImportResult(data);
      toast({
        title: "Import Completed",
        description: `Created: ${data.created}, Updated: ${data.updated}`,
      });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Import Failed", description: err.message });
    },
  });

  const handleUnitSubmit = (data: z.infer<typeof unitSchema>) => {
    if (editingUnit) {
      updateUnitMutation.mutate(data);
    } else {
      addUnitMutation.mutate(data);
    }
  };

const filteredUnits = units
  .filter((u) =>
    selectedBuildingId === "all" ? true : u.buildingId === selectedBuildingId
  )
  .sort((a, b) => {
    // Sort by building number first
    const buildingA = parseInt(a.buildingNumber || "0");
    const buildingB = parseInt(b.buildingNumber || "0");

    if (buildingA !== buildingB) {
      return buildingA - buildingB;
    }

    // Then sort by unit number
    const unitA = parseInt(a.number);
    const unitB = parseInt(b.number);

    return unitA - unitB;
  });

  return (
    <Layout userType="admin" onLogout={() => setLocation("/")}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Property Management</h1>
            <p className="text-muted-foreground">{communityName}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Extra Pass Price:</span>
            <div className="flex items-center gap-1">
              <span className="text-sm">$</span>
              <Input
                type="number"
                className="w-24 h-8"
                value={settings?.pricePerPass ?? ""}
                onChange={(e) =>
                  updateSettingsMutation.mutate({
                    pricePerPass: parseFloat(e.target.value || "0"),
                  })
                }
              />
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="units">Units</TabsTrigger>
            <TabsTrigger value="buildings">Buildings</TabsTrigger>
          </TabsList>

          <TabsContent value="units" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="space-y-1">
                  <CardTitle>Units</CardTitle>
                  <CardDescription>Manage residents and access codes.</CardDescription>
                </div>

                <div className="flex gap-2">
                  <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setCsvContent("");
                          setImportResult(null);
                        }}
                      >
                        <Upload className="w-4 h-4 mr-2" /> Import CSV
                      </Button>
                    </DialogTrigger>

                    <DialogContent className="max-w-xl">
                      <DialogHeader>
                        <DialogTitle>Import Buildings & Units</DialogTitle>
                      </DialogHeader>

                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Paste CSV data. Headers required: <code>Building, Unit, AccessCode</code>.
                          Will create buildings if missing and update existing units.
                        </p>

                        <Textarea
                          placeholder={"Building, Unit, AccessCode\n1, 101, 1234\n1, 102, 5678"}
                          rows={10}
                          className="font-mono text-xs"
                          value={csvContent}
                          onChange={(e) => setCsvContent(e.target.value)}
                        />

                        {importResult && (
                          <div className="bg-muted p-3 rounded text-sm space-y-1">
                            <p className="font-medium">Result:</p>
                            <div className="grid grid-cols-3 gap-2">
                              <span className="text-green-600">Created: {importResult.created}</span>
                              <span className="text-blue-600">Updated: {importResult.updated}</span>
                              <span className="text-orange-600">Skipped: {importResult.skipped}</span>
                            </div>

                            {importResult.errors.length > 0 && (
                              <div className="mt-2 text-destructive text-xs max-h-24 overflow-y-auto">
                                {importResult.errors.map((e, i) => (
                                  <div key={i}>{e}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <DialogFooter>
                        <Button
                          onClick={() => importMutation.mutate(csvContent)}
                          disabled={importMutation.isPending || !csvContent}
                        >
                          {importMutation.isPending ? "Processing..." : "Run Import"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Button
                    onClick={() => {
                      setEditingUnit(null);
                      setIsUnitDialogOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Unit
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 mb-6 justify-between items-start sm:items-center">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-sm font-medium whitespace-nowrap">Filter by Building:</span>

                    <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All Buildings" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Buildings</SelectItem>
                        {buildings.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            Building {b.number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Show Codes</span>
                    <Switch checked={showAccessCodes} onCheckedChange={setShowAccessCodes} />
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Building</TableHead>
                      <TableHead>Unit Number</TableHead>
                      <TableHead>Access Code</TableHead>
                      <TableHead>Monthly Limit</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {unitsLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : filteredUnits.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          No units found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUnits.map((unit) => (
                        <TableRow key={unit.id}>
                          <TableCell className="font-medium">{unit.buildingNumber}</TableCell>
                          <TableCell>{unit.number}</TableCell>
                          <TableCell className="font-mono">
                            {showAccessCodes ? (
                              <span className="bg-muted px-2 py-1 rounded text-xs">{unit.accessCode}</span>
                            ) : (
                              <span className="text-muted-foreground">••••</span>
                            )}
                          </TableCell>
                          <TableCell>{unit.freePassLimit}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setEditingUnit(unit);
                                  setIsUnitDialogOpen(true);
                                }}
                              >
                                <Edit className="w-4 h-4 text-muted-foreground" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:text-destructive"
                                onClick={() => {
                                  if (confirm(`Delete Unit ${unit.number} in Building ${unit.buildingNumber}?`)) {
                                    deleteUnitMutation.mutate(unit.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-muted-foreground" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Dialog open={isUnitDialogOpen} onOpenChange={setIsUnitDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingUnit ? "Edit Unit" : "Add Unit"}</DialogTitle>
                </DialogHeader>

                <Form {...unitForm}>
                  <form onSubmit={unitForm.handleSubmit(handleUnitSubmit)} className="space-y-4">
                    <FormField
                      control={unitForm.control}
                      name="buildingId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Building</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select Building" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {buildings.map((b) => (
                                <SelectItem key={b.id} value={b.id}>
                                  Building {b.number} {b.name ? `(${b.name})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={unitForm.control}
                      name="number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit Number</FormLabel>
                          <FormControl>
                            <Input placeholder="101" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={unitForm.control}
                      name="accessCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Access Code (4-10 chars)</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={unitForm.control}
                      name="freePassLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Monthly Free Pass Limit</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DialogFooter>
                      <Button type="submit" disabled={addUnitMutation.isPending || updateUnitMutation.isPending}>
                        {addUnitMutation.isPending || updateUnitMutation.isPending ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          "Save Unit"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="buildings" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="space-y-1">
                  <CardTitle>Buildings</CardTitle>
                  <CardDescription>Manage property buildings.</CardDescription>
                </div>

                <Dialog open={isAddBuildingOpen} onOpenChange={setIsAddBuildingOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" /> Add Building
                    </Button>
                  </DialogTrigger>

                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Building</DialogTitle>
                    </DialogHeader>

                    <Form {...buildingForm}>
                      <form
                        onSubmit={buildingForm.handleSubmit((data) => addBuildingMutation.mutate(data))}
                        className="space-y-4"
                      >
                        <FormField
                          control={buildingForm.control}
                          name="number"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Building Number</FormLabel>
                              <FormControl>
                                <Input placeholder="1" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={buildingForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="North Tower" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <DialogFooter>
                          <Button type="submit" disabled={addBuildingMutation.isPending}>
                            {addBuildingMutation.isPending ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              "Add Building"
                            )}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </CardHeader>

              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Building Number</TableHead>
                      <TableHead>Name/Notes</TableHead>
                      <TableHead>Units Count</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {buildingsLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : buildings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8">
                          No buildings found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      buildings.map((b) => {
                        const unitCount = units.filter((u) => u.buildingId === b.id).length;

                        return (
                          <TableRow key={b.id}>
                            <TableCell className="font-medium">{b.number}</TableCell>
                            <TableCell className="text-muted-foreground">{b.name || "-"}</TableCell>
                            <TableCell>{unitCount}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:text-destructive"
                                onClick={() => {
                                  if (unitCount > 0) {
                                    toast({
                                      variant: "destructive",
                                      title: "Cannot Delete",
                                      description: `Building ${b.number} has ${unitCount} active units. Delete units first.`,
                                    });
                                  } else {
                                    if (confirm(`Delete Building ${b.number}?`)) {
                                      deleteBuildingMutation.mutate(b.id);
                                    }
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}