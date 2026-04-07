import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Edit2, Car, Loader2 } from "lucide-react";

import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { api, Vehicle } from "@/lib/supabase-db";
import { normalizePlate } from "@/lib/vehicles-db";

const vehicleSchema = z.object({
  licensePlate: z.string().min(2, "License plate is required").transform((v) => normalizePlate(v)),
  make: z.string().min(2, "Make is required"),
  model: z.string().min(1, "Model is required"),
  color: z.string().min(3, "Color is required"),
  nickname: z.string().optional(),
});

export default function ResidentVehicles() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [unitId, setUnitId] = useState<string | null>(null);
  const [unitLabel, setUnitLabel] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("unitId");
    const num = localStorage.getItem("unitNumber");
    const bldg = localStorage.getItem("buildingNumber");

    if (!id || !num || !bldg) {
      setLocation("/");
      return;
    }

    setUnitId(id);
    setUnitLabel(`Bldg ${bldg} - Unit ${num}`);
  }, [setLocation]);

  const form = useForm<z.infer<typeof vehicleSchema>>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: { licensePlate: "", make: "", model: "", color: "", nickname: "" },
  });

  useEffect(() => {
    if (!isDialogOpen) return;

    if (editingVehicle) {
      form.reset({
        licensePlate: editingVehicle.licensePlate,
        make: editingVehicle.make,
        model: editingVehicle.model,
        color: editingVehicle.color,
        nickname: editingVehicle.nickname || "",
      });
    } else {
      form.reset({ licensePlate: "", make: "", model: "", color: "", nickname: "" });
    }
  }, [isDialogOpen, editingVehicle, form]);

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["vehicles", unitId],
    enabled: !!unitId,
    queryFn: () => api.getVehicles(unitId!),
  });

  const addMutation = useMutation({
    mutationFn: (data: z.infer<typeof vehicleSchema>) => api.addVehicle(unitId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast({ title: "Vehicle Added" });
      setIsDialogOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: "Could not add vehicle",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: z.infer<typeof vehicleSchema>) => api.updateVehicle(editingVehicle!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast({ title: "Vehicle Updated" });
      setIsDialogOpen(false);
      setEditingVehicle(null);
    },
    onError: (err: any) => {
      toast({
        title: "Could not update vehicle",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteVehicle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast({ title: "Vehicle Deleted" });
    },
    onError: (err: any) => {
      toast({
        title: "Could not delete vehicle",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof vehicleSchema>) => {
    if (editingVehicle) {
      updateMutation.mutate(data);
    } else {
      addMutation.mutate(data);
    }
  };

  if (!unitId) return null;

  return (
    <Layout userType="resident" userName={unitLabel || ""}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold">My Vehicles</h1>
          <Button
            onClick={() => {
              setEditingVehicle(null);
              setIsDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> Add Vehicle
          </Button>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingVehicle ? "Edit Vehicle" : "Add New Vehicle"}</DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="licensePlate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>License Plate</FormLabel>
                      <FormControl>
                        <Input placeholder="ABC123" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="make"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Make</FormLabel>
                        <FormControl>
                          <Input placeholder="Toyota" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl>
                          <Input placeholder="Camry" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Color</FormLabel>
                        <FormControl>
                          <Input placeholder="Silver" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="nickname"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nickname (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Mom's Car" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={addMutation.isPending || updateMutation.isPending}>
                    {addMutation.isPending || updateMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    {editingVehicle ? "Save Changes" : "Save Vehicle"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isLoading ? (
            <div className="col-span-full text-center text-muted-foreground py-12">Loading vehicles...</div>
          ) : vehicles && vehicles.length > 0 ? (
            vehicles.map((vehicle) => (
              <Card key={vehicle.id} className="relative overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="font-mono tracking-wider text-primary">{vehicle.licensePlate}</CardTitle>
                      {vehicle.nickname ? <p className="text-sm text-muted-foreground mt-1">{vehicle.nickname}</p> : null}
                    </div>
                    <Car className="w-5 h-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Make:</span> {vehicle.make}</p>
                    <p><span className="text-muted-foreground">Model:</span> {vehicle.model}</p>
                    <p><span className="text-muted-foreground">Color:</span> {vehicle.color}</p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditingVehicle(vehicle); setIsDialogOpen(true); }}>
                      <Edit2 className="w-4 h-4 mr-2" /> Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(vehicle.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center text-muted-foreground py-12 border rounded-lg bg-muted/20">
              No vehicles yet. Add one to create visitor passes.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
