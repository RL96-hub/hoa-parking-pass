import { addHours, endOfMonth, format, isAfter, isBefore, isSameDay, parseISO, startOfMonth } from "date-fns";
import { supabase } from "@/lib/supabase";

export interface Community {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface Building {
  id: string;
  communityId: string;
  number: string;
  name?: string;
}

export interface Unit {
  id: string;
  buildingId: string;
  number: string;
  accessCode: string;
  freePassLimit: number;
  partyDays: string[];
  buildingNumber?: string;
}

export interface Vehicle {
  id: string;
  unitId: string;
  licensePlate: string;
  make: string;
  model: string;
  color: string;
  nickname?: string | null;
}

export type PaymentStatus = "free" | "paid" | "payment_required" | "waived";
export type PassType = "free" | "paid" | "party";

export interface Pass {
  id: string;
  unitId: string;
  unitNumber?: string;
  buildingNumber?: string;
  vehicleId: string | null;
  vehicleSnapshot: {
    licensePlate: string;
    make: string;
    model: string;
    color: string;
    nickname?: string | null;
  };
  createdAt: string;
  expiresAt: string;
  type: PassType;
  paymentStatus: PaymentStatus;
  price?: number;
}

export interface CommunitySettings {
  id?: string;
  communityId: string;
  pricePerPass: number;
  freePassLimit: number;
  partyPassLimit: number;
  securityPassword: string;
  adminPassword: string;
}

function normalizeCommunityCode(code: string) {
  return code.trim().toUpperCase();
}

function getStoredCommunityId() {
  return localStorage.getItem("communityId") || "";
}

function mapCommunity(row: any): Community {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    isActive: row.is_active,
  };
}

function mapBuilding(row: any): Building {
  return {
    id: row.id,
    communityId: row.community_id,
    number: row.number,
    name: row.name ?? undefined,
  };
}

function mapUnit(row: any): Unit {
  return {
    id: row.id,
    buildingId: row.building_id,
    number: row.number,
    accessCode: row.access_code,
    freePassLimit: row.free_pass_limit,
    partyDays: row.party_days ?? [],
    buildingNumber: row.buildings?.number,
  };
}

function mapVehicle(row: any): Vehicle {
  return {
    id: row.id,
    unitId: row.unit_id,
    licensePlate: row.license_plate,
    make: row.make,
    model: row.model,
    color: row.color,
    nickname: row.nickname ?? null,
  };
}

function mapPass(row: any): Pass {
  return {
    id: row.id,
    unitId: row.unit_id,
    unitNumber: row.units?.number ?? undefined,
    buildingNumber: row.units?.buildings?.number ?? undefined,
    vehicleId: row.vehicle_id,
    vehicleSnapshot: {
      licensePlate: row.vehicle_snapshot?.licensePlate ?? row.vehicle_snapshot?.license_plate ?? "",
      make: row.vehicle_snapshot?.make ?? "",
      model: row.vehicle_snapshot?.model ?? "",
      color: row.vehicle_snapshot?.color ?? "",
      nickname: row.vehicle_snapshot?.nickname ?? null,
    },
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    type: row.type,
    paymentStatus: row.payment_status,
    price: row.price ? Number(row.price) : undefined,
  };
}

async function getCommunityByCodeOrThrow(code: string) {
  const normalizedCode = normalizeCommunityCode(code);

  const { data, error } = await supabase
    .from("communities")
    .select("*")
    .eq("code", normalizedCode)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Community not found");

  return mapCommunity(data);
}

async function getCommunitySettingsRow(communityId?: string) {
  const id = communityId || getStoredCommunityId();
  if (!id) throw new Error("Community not selected");

  const { data, error } = await supabase
    .from("community_settings")
    .select("*")
    .eq("community_id", id)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getCommunityUnitIds(communityId?: string): Promise<string[]> {
  const id = communityId || getStoredCommunityId();
  if (!id) return [];

  // First get all buildings for the selected community
  const { data: buildings, error: buildingError } = await supabase
    .from("buildings")
    .select("id")
    .eq("community_id", id);

  if (buildingError) throw buildingError;

  const buildingIds = (buildings ?? []).map((b: any) => b.id);
  if (buildingIds.length === 0) return [];

  // Then get all units inside those buildings
  const { data: units, error: unitError } = await supabase
    .from("units")
    .select("id")
    .in("building_id", buildingIds);

  if (unitError) throw unitError;

  return (units ?? []).map((u: any) => u.id);
}

export const api = {
  async getCommunityByCode(code: string): Promise<Community | null> {
    const normalizedCode = normalizeCommunityCode(code);

    const { data, error } = await supabase
      .from("communities")
      .select("*")
      .eq("code", normalizedCode)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;
    return data ? mapCommunity(data) : null;
  },

  async loginResident(
    communityCode: string,
    buildingNumber: string,
    unitNumber: string,
    accessCode: string
  ): Promise<{ community: Community; unit: Unit & { buildingNumber: string } } | null> {
    const community = await api.getCommunityByCode(communityCode);
    if (!community) return null;

    const { data, error } = await supabase
      .from("units")
      .select(`
        id,
        building_id,
        number,
        access_code,
        free_pass_limit,
        party_days,
        buildings!inner(
          number,
          community_id
        )
      `)
      .eq("number", unitNumber)
      .eq("access_code", accessCode)
      .eq("buildings.number", buildingNumber)
      .eq("buildings.community_id", community.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const unit = mapUnit(data);

    return {
      community,
      unit: {
        ...unit,
        buildingNumber: data.buildings.number,
      },
    };
  },

  async loginSecurity(
    communityCode: string,
    password: string
  ): Promise<{ community: Community } | null> {
    const community = await api.getCommunityByCode(communityCode);
    if (!community) return null;

    const settings = await api.getCommunitySettings(community.id);
    if (settings.securityPassword !== password) return null;

    return { community };
  },
  
  async loginAdmin(
	  communityCode: string,
	  password: string
	): Promise<{ community: Community } | null> {
	  const community = await api.getCommunityByCode(communityCode);
	  if (!community) return null;

	  const settings = await api.getCommunitySettings(community.id);
	  if (settings.adminPassword !== password) return null;

	  return { community };
	},

  async getCommunitySettings(communityId?: string): Promise<CommunitySettings> {
    const data = await getCommunitySettingsRow(communityId);
    if (!data) throw new Error("Community settings row not found");

    return {
	  id: data.id,
	  communityId: data.community_id,
	  pricePerPass: Number(data.price_per_pass),
	  freePassLimit: data.free_pass_limit,
	  partyPassLimit: data.party_pass_limit,
	  securityPassword: data.security_password,
	  adminPassword: data.admin_password,
	};
  },

  async updateCommunitySettings(
    communityId: string,
    newSettings: Partial<CommunitySettings>
  ): Promise<CommunitySettings> {
    const current = await getCommunitySettingsRow(communityId);
    if (!current) throw new Error("Community settings row not found");

    const payload: any = {};
    if (typeof newSettings.pricePerPass === "number" && !Number.isNaN(newSettings.pricePerPass)) {
      payload.price_per_pass = newSettings.pricePerPass;
    }
    if (typeof newSettings.freePassLimit === "number" && !Number.isNaN(newSettings.freePassLimit)) {
      payload.free_pass_limit = newSettings.freePassLimit;
    }
    if (typeof newSettings.partyPassLimit === "number" && !Number.isNaN(newSettings.partyPassLimit)) {
      payload.party_pass_limit = newSettings.partyPassLimit;
    }
    if (typeof newSettings.securityPassword === "string") {
      payload.security_password = newSettings.securityPassword;
    }
	if (typeof newSettings.adminPassword === "string") {
	  payload.admin_password = newSettings.adminPassword;
	}

    const { data, error } = await supabase
      .from("community_settings")
      .update(payload)
      .eq("id", current.id)
      .select("*")
      .single();

    if (error) throw error;

	return {
	  id: data.id,
	  communityId: data.community_id,
	  pricePerPass: Number(data.price_per_pass),
	  freePassLimit: data.free_pass_limit,
	  partyPassLimit: data.party_pass_limit,
	  securityPassword: data.security_password,
	  adminPassword: data.admin_password,
	};
  },

  // compatibility wrapper so older pages don't break immediately
  async getSettings(): Promise<CommunitySettings> {
    return api.getCommunitySettings();
  },

  // compatibility wrapper so older pages don't break immediately
  async updateSettings(newSettings: Partial<CommunitySettings>): Promise<CommunitySettings> {
    const communityId = getStoredCommunityId();
    if (!communityId) throw new Error("Community not selected");
    return api.updateCommunitySettings(communityId, newSettings);
  },

  async getBuildings(communityId?: string): Promise<Building[]> {
  const id = communityId || getStoredCommunityId();
  if (!id) return [];

  const { data, error } = await supabase
    .from("buildings")
    .select("*")
    .eq("community_id", id)
    .order("number", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapBuilding);
  },

  async addBuilding(
  communityIdOrPayload: string | Omit<Building, "id" | "communityId">,
  maybePayload?: Omit<Building, "id" | "communityId">
): Promise<Building> {
  let communityId = "";
  let payload: Omit<Building, "id" | "communityId">;

  if (typeof communityIdOrPayload === "string") {
    communityId = communityIdOrPayload;
    payload = maybePayload!;
  } else {
    communityId = getStoredCommunityId();
    payload = communityIdOrPayload;
  }

  if (!communityId) throw new Error("Community not selected");

  const { data, error } = await supabase
    .from("buildings")
    .insert({
      community_id: communityId,
      number: payload.number,
      name: payload.name || `Building ${payload.number}`,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapBuilding(data);
},

  async deleteBuilding(id: string): Promise<void> {
    const { count, error: countError } = await supabase
      .from("units")
      .select("*", { count: "exact", head: true })
      .eq("building_id", id);

    if (countError) throw countError;
    if ((count ?? 0) > 0) {
      throw new Error("Cannot delete building with existing units. Remove units first.");
    }

    const { error } = await supabase.from("buildings").delete().eq("id", id);
    if (error) throw error;
  },

	async getUnits(communityId?: string): Promise<(Unit & { buildingNumber: string })[]> {
	  const id = communityId || getStoredCommunityId();
	  if (!id) return [];

	  // First get buildings for the selected community
	  const { data: buildings, error: buildingError } = await supabase
		.from("buildings")
		.select("id, number")
		.eq("community_id", id)
		.order("number", { ascending: true });

	  if (buildingError) throw buildingError;

	  const buildingMap = new Map((buildings ?? []).map((b: any) => [b.id, b.number]));
	  const buildingIds = (buildings ?? []).map((b: any) => b.id);

	  if (buildingIds.length === 0) return [];

	  // Then get units in those buildings
	  const { data, error } = await supabase
		.from("units")
		.select("id, building_id, number, access_code, free_pass_limit, party_days")
		.in("building_id", buildingIds)
		.order("number", { ascending: true });

	  if (error) throw error;

	  return (data ?? []).map((row: any) => ({
		...mapUnit(row),
		buildingNumber: buildingMap.get(row.building_id) ?? "?",
	  }));
	},

  async getUnit(id: string): Promise<Unit | undefined> {
    const { data, error } = await supabase
      .from("units")
      .select("id, building_id, number, access_code, free_pass_limit, party_days")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapUnit(data) : undefined;
  },

  async addUnit(data: Omit<Unit, "id" | "partyDays" | "buildingNumber">): Promise<Unit> {
    if (data.accessCode.length < 4 || data.accessCode.length > 10) {
      throw new Error("Access code must be between 4 and 10 characters.");
    }

    const { data: inserted, error } = await supabase
      .from("units")
      .insert({
        building_id: data.buildingId,
        number: data.number,
        access_code: data.accessCode,
        free_pass_limit: data.freePassLimit,
        party_days: [],
      })
      .select("id, building_id, number, access_code, free_pass_limit, party_days")
      .single();

    if (error) throw error;
    return mapUnit(inserted);
  },

  async updateUnit(id: string, updates: Partial<Unit>): Promise<Unit> {
    if (updates.accessCode && (updates.accessCode.length < 4 || updates.accessCode.length > 10)) {
      throw new Error("Access code must be between 4 and 10 characters.");
    }

    const payload: any = {};
    if (updates.buildingId) payload.building_id = updates.buildingId;
    if (updates.number) payload.number = updates.number;
    if (updates.accessCode) payload.access_code = updates.accessCode;
    if (typeof updates.freePassLimit === "number") payload.free_pass_limit = updates.freePassLimit;
    if (updates.partyDays) payload.party_days = updates.partyDays;

    const { data, error } = await supabase
      .from("units")
      .update(payload)
      .eq("id", id)
      .select("id, building_id, number, access_code, free_pass_limit, party_days")
      .single();

    if (error) throw error;
    return mapUnit(data);
  },

  async deleteUnit(id: string): Promise<void> {
    const { error } = await supabase.from("units").delete().eq("id", id);
    if (error) throw error;
  },

  async importData(
    csvContent: string,
    communityId?: string
  ): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
    const targetCommunityId = communityId || getStoredCommunityId();
    if (!targetCommunityId) throw new Error("Community not selected");

    const lines = csvContent.split("\n");
    let created = 0, updated = 0, skipped = 0;
    const errors: string[] = [];

    const header = lines[0]?.toLowerCase() ?? "";
    if (!header.includes("building") || !header.includes("unit") || !header.includes("access")) {
      throw new Error("Invalid CSV header. Must contain Building, Unit, AccessCode");
    }

    const existingBuildings = await api.getBuildings(targetCommunityId);
    const buildingMap = new Map(existingBuildings.map((b) => [b.number, b]));
    const existingUnits = await api.getUnits(targetCommunityId);

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(",").map((p) => p.trim());
      if (parts.length < 3) {
        skipped++;
        errors.push(`Line ${i + 1}: Insufficient columns`);
        continue;
      }

      const [buildingNumber, unitNumber, accessCode] = parts;

      if (!buildingNumber || !unitNumber || !accessCode) {
        skipped++;
        errors.push(`Line ${i + 1}: Missing fields`);
        continue;
      }

      if (accessCode.length < 4 || accessCode.length > 10) {
        skipped++;
        errors.push(`Line ${i + 1}: Access code must be 4-10 chars (Unit ${unitNumber})`);
        continue;
      }

      let building = buildingMap.get(buildingNumber);
      if (!building) {
        building = await api.addBuilding(targetCommunityId, {
          number: buildingNumber,
          name: `Building ${buildingNumber}`,
        });
        buildingMap.set(buildingNumber, building);
      }

      const existingUnit = existingUnits.find((u) => u.buildingId === building!.id && u.number === unitNumber);

      if (existingUnit) {
        await api.updateUnit(existingUnit.id, { accessCode });
        updated++;
      } else {
        await api.addUnit({
          buildingId: building.id,
          number: unitNumber,
          accessCode,
          freePassLimit: 12,
        });
        created++;
      }
    }

    return { created, updated, skipped, errors };
  },

  async getVehicles(unitId: string): Promise<Vehicle[]> {
    const { data, error } = await supabase
      .from("vehicles")
      .select("id, unit_id, license_plate, make, model, color, nickname")
      .eq("unit_id", unitId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapVehicle);
  },

  async addVehicle(unitId: string, data: Omit<Vehicle, "id" | "unitId">): Promise<Vehicle> {
    const { data: inserted, error } = await supabase
      .from("vehicles")
      .insert({
        unit_id: unitId,
        license_plate: data.licensePlate,
        make: data.make,
        model: data.model,
        color: data.color,
        nickname: data.nickname || null,
      })
      .select("id, unit_id, license_plate, make, model, color, nickname")
      .single();

    if (error) throw error;
    return mapVehicle(inserted);
  },

  async updateVehicle(id: string, data: Partial<Vehicle>): Promise<Vehicle> {
    const payload: any = {};
    if (data.licensePlate) payload.license_plate = data.licensePlate;
    if (data.make) payload.make = data.make;
    if (data.model) payload.model = data.model;
    if (data.color) payload.color = data.color;
    if ("nickname" in data) payload.nickname = data.nickname || null;

    const { data: updated, error } = await supabase
      .from("vehicles")
      .update(payload)
      .eq("id", id)
      .select("id, unit_id, license_plate, make, model, color, nickname")
      .single();

    if (error) throw error;
    return mapVehicle(updated);
  },

  async deleteVehicle(id: string): Promise<void> {
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) throw error;
  },

  async getUnitPasses(unitId: string): Promise<Pass[]> {
    const { data, error } = await supabase
      .from("passes")
      .select("*")
      .eq("unit_id", unitId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapPass);
  },

  async getAllPasses(communityId?: string): Promise<Pass[]> {
	  const id = communityId || getStoredCommunityId();
	  if (!id) return [];

	  const { data, error } = await supabase
		.from("passes")
		.select(`
		  *,
		  units!inner(
			number,
			buildings!inner(
			  number,
			  community_id
			)
		  )
		`)
		.eq("units.buildings.community_id", id)
		.order("created_at", { ascending: false });

	  if (error) throw error;
	  return (data ?? []).map(mapPass);
  },

  async createPass(unitId: string, vehicleId: string, isPartyPass = false): Promise<Pass> {
    const vehicle = await (async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, unit_id, license_plate, make, model, color, nickname")
        .eq("id", vehicleId)
        .maybeSingle();

      if (error) throw error;
      return data;
    })();

    if (!vehicle) throw new Error("Vehicle not found");

    const { data: activePass, error: activeError } = await supabase
      .from("passes")
      .select("id, expires_at")
      .eq("vehicle_id", vehicleId)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (activeError) throw activeError;
    if (activePass) {
      throw new Error(`This vehicle already has an active pass expiring at ${new Date(activePass.expires_at).toLocaleTimeString()}`);
    }

    const unit = await api.getUnit(unitId);
    if (!unit) throw new Error("Unit not found");

    const settings = await api.getCommunitySettings();
    const allPasses = await api.getUnitPasses(unitId);

    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    let finalType: PassType = "free";
    let finalPaymentStatus: PaymentStatus = "free";
    let finalPrice = 0;
    let nextPartyDays = [...(unit.partyDays ?? [])];

    const isTodayPartyDay = nextPartyDays.includes(todayStr);

    if (isPartyPass) {
      if (isTodayPartyDay) {
        finalType = "party";
        finalPaymentStatus = "free";
      } else {
        const currentMonthPartyDays = nextPartyDays.filter((d) => {
          const date = parseISO(d);
          return (
            (isAfter(date, monthStart) && isBefore(date, monthEnd)) ||
            isSameDay(date, monthStart) ||
            isSameDay(date, monthEnd)
          );
        }).length;

        if (currentMonthPartyDays >= settings.partyPassLimit) {
          throw new Error(`Party pass limit (${settings.partyPassLimit}) reached for this month.`);
        }

        nextPartyDays.push(todayStr);
        await api.updateUnit(unitId, { partyDays: nextPartyDays });
        finalType = "party";
        finalPaymentStatus = "free";
      }
    } else {
      if (isTodayPartyDay) {
        finalType = "free";
        finalPaymentStatus = "free";
      } else {
        const passesThisMonth = allPasses.filter((p) => {
          const d = parseISO(p.createdAt);
          return d >= monthStart && d <= monthEnd && p.type === "free";
        }).length;

        if (passesThisMonth < unit.freePassLimit) {
          finalType = "free";
          finalPaymentStatus = "free";
        } else {
          finalType = "paid";
          finalPaymentStatus = "payment_required";
          finalPrice = settings.pricePerPass;
        }
      }
    }

    const insertPayload = {
      unit_id: unitId,
      vehicle_id: vehicle.id,
      vehicle_snapshot: {
        licensePlate: vehicle.license_plate,
        make: vehicle.make,
        model: vehicle.model,
        color: vehicle.color,
        nickname: vehicle.nickname,
      },
      created_at: now.toISOString(),
      expires_at: addHours(now, 24).toISOString(),
      type: finalType,
      payment_status: finalPaymentStatus,
      price: finalPrice > 0 ? finalPrice : null,
    };

    const { data, error } = await supabase
      .from("passes")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) throw error;
    return mapPass(data);
  },

  async updatePassPaymentStatus(passId: string, status: PaymentStatus): Promise<Pass> {
    const { data, error } = await supabase
      .from("passes")
      .update({ payment_status: status })
      .eq("id", passId)
      .select("*")
      .single();

    if (error) throw error;
    return mapPass(data);
  },
};