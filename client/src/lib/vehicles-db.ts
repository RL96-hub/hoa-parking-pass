import { api } from "@/lib/supabase-db";

export function normalizePlate(input: string) {
  return (input || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export async function getVehiclesByUnit(unitId: string) {
  return api.getVehicles(unitId);
}
