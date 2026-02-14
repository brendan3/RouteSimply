import {
  users,
  locations,
  routes,
  timeEntries,
  workLocations,
  routeConfirmations,
  materials,
  locationMaterials,
  stopCompletions,
  driverLocations,
  messages,
  routeTemplates,
  organizations,
  type User,
  type InsertUser,
  type Location,
  type InsertLocation,
  type Route,
  type InsertRoute,
  type TimeEntry,
  type InsertTimeEntry,
  type WorkLocation,
  type InsertWorkLocation,
  type RouteConfirmation,
  type InsertRouteConfirmation,
  type Material,
  type InsertMaterial,
  type LocationMaterial,
  type InsertLocationMaterial,
  type LocationMaterialWithDetails,
  type StopCompletion,
  type InsertStopCompletion,
  type DriverLocation,
  type InsertDriverLocation,
  type Message,
  type InsertMessage,
  type RouteTemplate,
  type InsertRouteTemplate,
  type Organization,
  type InsertOrganization,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, or, isNull, gte, lte, count, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: string): Promise<void>;

  // Locations
  getLocation(id: string): Promise<Location | undefined>;
  getAllLocations(): Promise<Location[]>;
  createLocation(location: InsertLocation): Promise<Location>;
  createLocations(locations: InsertLocation[]): Promise<Location[]>;
  updateLocation(id: string, data: Partial<InsertLocation>): Promise<Location>;
  deleteLocation(id: string): Promise<void>;
  clearLocations(): Promise<void>;

  // Routes
  getRoute(id: string): Promise<Route | undefined>;
  getAllRoutes(): Promise<Route[]>;
  getRoutesByDriver(driverId: string): Promise<Route[]>;
  createRoute(route: InsertRoute): Promise<Route>;
  updateRoute(id: string, data: Partial<InsertRoute>): Promise<Route>;
  deleteRoute(id: string): Promise<void>;
  clearRoutes(): Promise<void>;
  clearRoutesByDay(dayOfWeek: string): Promise<void>;
  clearRoutesByDate(date: string): Promise<void>;

  // Time Entries
  getTimeEntry(id: string): Promise<TimeEntry | undefined>;
  getTodayEntryByDriver(driverId: string, date: string): Promise<TimeEntry | undefined>;
  getAllTimeEntries(): Promise<TimeEntry[]>;
  createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: string, data: Partial<InsertTimeEntry>): Promise<TimeEntry>;

  // Work Locations
  getWorkLocation(id: string): Promise<WorkLocation | undefined>;
  getAllWorkLocations(): Promise<WorkLocation[]>;
  createWorkLocation(location: InsertWorkLocation): Promise<WorkLocation>;
  deleteWorkLocation(id: string): Promise<void>;

  // Route Confirmations
  getRouteConfirmationsByDate(scheduledDate: string): Promise<RouteConfirmation[]>;
  upsertRouteConfirmation(confirmation: InsertRouteConfirmation): Promise<RouteConfirmation>;
  deleteRouteConfirmationsByDate(scheduledDate: string): Promise<void>;
  getExcludedLocationIdsByDate(scheduledDate: string): Promise<string[]>;

  // Materials
  getMaterial(id: string): Promise<Material | undefined>;
  getAllMaterials(): Promise<Material[]>;
  createMaterial(material: InsertMaterial): Promise<Material>;
  updateMaterial(id: string, data: Partial<InsertMaterial>): Promise<Material>;
  deleteMaterial(id: string): Promise<void>;

  // Location Materials
  getLocationMaterials(locationId: string): Promise<LocationMaterialWithDetails[]>;
  getAllLocationMaterials(): Promise<LocationMaterial[]>;
  addLocationMaterial(data: InsertLocationMaterial): Promise<LocationMaterial>;
  updateLocationMaterial(id: string, data: Partial<InsertLocationMaterial>): Promise<LocationMaterial>;
  removeLocationMaterial(id: string): Promise<void>;
  removeAllLocationMaterials(locationId: string): Promise<void>;

  // Stop Completions
  getStopCompletion(id: string): Promise<StopCompletion | undefined>;
  getStopCompletionsByRoute(routeId: string): Promise<StopCompletion[]>;
  getStopCompletionsByDriver(driverId: string, date?: string): Promise<StopCompletion[]>;
  createStopCompletion(data: InsertStopCompletion): Promise<StopCompletion>;
  updateStopCompletion(id: string, data: Partial<InsertStopCompletion>): Promise<StopCompletion>;
  deleteStopCompletion(id: string): Promise<void>;
  getAllStopCompletions(): Promise<StopCompletion[]>;

  // Driver Locations
  getDriverLocation(driverId: string): Promise<DriverLocation | undefined>;
  getAllDriverLocations(): Promise<DriverLocation[]>;
  upsertDriverLocation(data: InsertDriverLocation): Promise<DriverLocation>;

  // Messages
  getMessage(id: string): Promise<Message | undefined>;
  getMessagesBetween(userId1: string, userId2: string, limit?: number): Promise<Message[]>;
  getMessagesForUser(userId: string, limit?: number): Promise<Message[]>;
  createMessage(data: InsertMessage): Promise<Message>;
  markMessageRead(id: string): Promise<Message>;
  getUnreadCount(userId: string): Promise<number>;

  // Route Templates
  getRouteTemplate(id: string): Promise<RouteTemplate | undefined>;
  getAllRouteTemplates(): Promise<RouteTemplate[]>;
  createRouteTemplate(data: InsertRouteTemplate): Promise<RouteTemplate>;
  updateRouteTemplate(id: string, data: Partial<InsertRouteTemplate>): Promise<RouteTemplate>;
  deleteRouteTemplate(id: string): Promise<void>;

  // Organizations
  getOrganization(id: string): Promise<Organization | undefined>;
  createOrganization(data: InsertOrganization): Promise<Organization>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User> {
    const [user] = await db.update(users).set(data as any).where(eq(users.id, id)).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // Locations
  async getLocation(id: string): Promise<Location | undefined> {
    const [location] = await db.select().from(locations).where(eq(locations.id, id));
    return location || undefined;
  }

  async getAllLocations(): Promise<Location[]> {
    return db.select().from(locations).orderBy(desc(locations.uploadDate));
  }

  async createLocation(insertLocation: InsertLocation): Promise<Location> {
    const [location] = await db.insert(locations).values(insertLocation).returning();
    return location;
  }

  async createLocations(insertLocations: InsertLocation[]): Promise<Location[]> {
    if (insertLocations.length === 0) return [];
    return db.insert(locations).values(insertLocations).returning();
  }

  async updateLocation(id: string, data: Partial<InsertLocation>): Promise<Location> {
    const [location] = await db.update(locations).set(data as any).where(eq(locations.id, id)).returning();
    return location;
  }

  async deleteLocation(id: string): Promise<void> {
    await db.delete(locations).where(eq(locations.id, id));
  }

  async clearLocations(): Promise<void> {
    await db.delete(locations);
  }

  // Routes
  async getRoute(id: string): Promise<Route | undefined> {
    const [route] = await db.select().from(routes).where(eq(routes.id, id));
    return route || undefined;
  }

  async getAllRoutes(): Promise<Route[]> {
    return db.select().from(routes).orderBy(desc(routes.date));
  }

  async getRoutesByDriver(driverId: string): Promise<Route[]> {
    return db.select().from(routes).where(eq(routes.driverId, driverId));
  }

  async createRoute(insertRoute: InsertRoute): Promise<Route> {
    const [route] = await db.insert(routes).values(insertRoute as any).returning();
    return route;
  }

  async updateRoute(id: string, data: Partial<InsertRoute>): Promise<Route> {
    const [route] = await db.update(routes).set(data as any).where(eq(routes.id, id)).returning();
    return route;
  }

  async deleteRoute(id: string): Promise<void> {
    await db.delete(routes).where(eq(routes.id, id));
  }

  async clearRoutes(): Promise<void> {
    await db.delete(routes);
  }

  async clearRoutesByDay(dayOfWeek: string): Promise<void> {
    await db.delete(routes).where(eq(routes.dayOfWeek, dayOfWeek));
  }

  async clearRoutesByDate(date: string): Promise<void> {
    await db.delete(routes).where(eq(routes.date, date));
  }

  // Time Entries
  async getTimeEntry(id: string): Promise<TimeEntry | undefined> {
    const [entry] = await db.select().from(timeEntries).where(eq(timeEntries.id, id));
    return entry || undefined;
  }

  async getTodayEntryByDriver(driverId: string, date: string): Promise<TimeEntry | undefined> {
    const [entry] = await db
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.driverId, driverId), eq(timeEntries.date, date)));
    return entry || undefined;
  }

  async getAllTimeEntries(): Promise<TimeEntry[]> {
    return db.select().from(timeEntries).orderBy(desc(timeEntries.date));
  }

  async createTimeEntry(insertEntry: InsertTimeEntry): Promise<TimeEntry> {
    const [entry] = await db.insert(timeEntries).values(insertEntry).returning();
    return entry;
  }

  async updateTimeEntry(id: string, data: Partial<InsertTimeEntry>): Promise<TimeEntry> {
    const [entry] = await db.update(timeEntries).set(data).where(eq(timeEntries.id, id)).returning();
    return entry;
  }

  // Work Locations
  async getWorkLocation(id: string): Promise<WorkLocation | undefined> {
    const [location] = await db.select().from(workLocations).where(eq(workLocations.id, id));
    return location || undefined;
  }

  async getAllWorkLocations(): Promise<WorkLocation[]> {
    return db.select().from(workLocations);
  }

  async createWorkLocation(insertLocation: InsertWorkLocation): Promise<WorkLocation> {
    const [location] = await db.insert(workLocations).values(insertLocation).returning();
    return location;
  }

  async deleteWorkLocation(id: string): Promise<void> {
    await db.delete(workLocations).where(eq(workLocations.id, id));
  }

  // Route Confirmations
  async getRouteConfirmationsByDate(scheduledDate: string): Promise<RouteConfirmation[]> {
    return db.select().from(routeConfirmations).where(eq(routeConfirmations.scheduledDate, scheduledDate));
  }

  async upsertRouteConfirmation(confirmation: InsertRouteConfirmation): Promise<RouteConfirmation> {
    const existing = await db.select().from(routeConfirmations)
      .where(and(
        eq(routeConfirmations.scheduledDate, confirmation.scheduledDate),
        eq(routeConfirmations.locationId, confirmation.locationId)
      ));
    
    if (existing.length > 0) {
      const [updated] = await db.update(routeConfirmations)
        .set({ excluded: confirmation.excluded, confirmedAt: new Date() })
        .where(eq(routeConfirmations.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(routeConfirmations).values(confirmation).returning();
      return created;
    }
  }

  async deleteRouteConfirmationsByDate(scheduledDate: string): Promise<void> {
    await db.delete(routeConfirmations).where(eq(routeConfirmations.scheduledDate, scheduledDate));
  }

  async getExcludedLocationIdsByDate(scheduledDate: string): Promise<string[]> {
    const excluded = await db.select({ locationId: routeConfirmations.locationId })
      .from(routeConfirmations)
      .where(and(
        eq(routeConfirmations.scheduledDate, scheduledDate),
        eq(routeConfirmations.excluded, true)
      ));
    return excluded.map(e => e.locationId);
  }

  // Materials
  async getMaterial(id: string): Promise<Material | undefined> {
    const [material] = await db.select().from(materials).where(eq(materials.id, id));
    return material || undefined;
  }

  async getAllMaterials(): Promise<Material[]> {
    return db.select().from(materials).orderBy(materials.name);
  }

  async createMaterial(insertMaterial: InsertMaterial): Promise<Material> {
    const [material] = await db.insert(materials).values(insertMaterial).returning();
    return material;
  }

  async updateMaterial(id: string, data: Partial<InsertMaterial>): Promise<Material> {
    const [material] = await db.update(materials).set(data).where(eq(materials.id, id)).returning();
    return material;
  }

  async deleteMaterial(id: string): Promise<void> {
    await db.delete(materials).where(eq(materials.id, id));
  }

  // Location Materials
  async getLocationMaterials(locationId: string): Promise<LocationMaterialWithDetails[]> {
    const results = await db.select({
      id: locationMaterials.id,
      locationId: locationMaterials.locationId,
      materialId: locationMaterials.materialId,
      quantity: locationMaterials.quantity,
      daysOfWeek: locationMaterials.daysOfWeek,
      material: {
        id: materials.id,
        name: materials.name,
        category: materials.category,
        stockQuantity: materials.stockQuantity,
      },
    })
    .from(locationMaterials)
    .leftJoin(materials, eq(locationMaterials.materialId, materials.id))
    .where(eq(locationMaterials.locationId, locationId));
    
    return results.map(r => ({
      id: r.id,
      locationId: r.locationId,
      materialId: r.materialId,
      quantity: r.quantity,
      daysOfWeek: r.daysOfWeek,
      material: r.material || undefined,
    }));
  }

  async getAllLocationMaterials(): Promise<LocationMaterial[]> {
    return db.select().from(locationMaterials);
  }

  async addLocationMaterial(data: InsertLocationMaterial): Promise<LocationMaterial> {
    const [lm] = await db.insert(locationMaterials).values(data).returning();
    return lm;
  }

  async updateLocationMaterial(id: string, data: Partial<InsertLocationMaterial>): Promise<LocationMaterial> {
    const [lm] = await db.update(locationMaterials)
      .set(data)
      .where(eq(locationMaterials.id, id))
      .returning();
    return lm;
  }

  async removeLocationMaterial(id: string): Promise<void> {
    await db.delete(locationMaterials).where(eq(locationMaterials.id, id));
  }

  async removeAllLocationMaterials(locationId: string): Promise<void> {
    await db.delete(locationMaterials).where(eq(locationMaterials.locationId, locationId));
  }

  // ============ Stop Completions ============

  async getStopCompletion(id: string): Promise<StopCompletion | undefined> {
    const [sc] = await db.select().from(stopCompletions).where(eq(stopCompletions.id, id));
    return sc || undefined;
  }

  async getStopCompletionsByRoute(routeId: string): Promise<StopCompletion[]> {
    return db.select().from(stopCompletions)
      .where(eq(stopCompletions.routeId, routeId))
      .orderBy(stopCompletions.completedAt);
  }

  async getStopCompletionsByDriver(driverId: string, date?: string): Promise<StopCompletion[]> {
    if (date) {
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      return db.select().from(stopCompletions)
        .where(and(
          eq(stopCompletions.driverId, driverId),
          gte(stopCompletions.completedAt, startOfDay),
          lte(stopCompletions.completedAt, endOfDay),
        ))
        .orderBy(stopCompletions.completedAt);
    }
    return db.select().from(stopCompletions)
      .where(eq(stopCompletions.driverId, driverId))
      .orderBy(desc(stopCompletions.completedAt));
  }

  async createStopCompletion(data: InsertStopCompletion): Promise<StopCompletion> {
    const [sc] = await db.insert(stopCompletions).values(data).returning();
    return sc;
  }

  async updateStopCompletion(id: string, data: Partial<InsertStopCompletion>): Promise<StopCompletion> {
    const [sc] = await db.update(stopCompletions).set(data).where(eq(stopCompletions.id, id)).returning();
    return sc;
  }

  async deleteStopCompletion(id: string): Promise<void> {
    await db.delete(stopCompletions).where(eq(stopCompletions.id, id));
  }

  async getAllStopCompletions(): Promise<StopCompletion[]> {
    return db.select().from(stopCompletions).orderBy(desc(stopCompletions.completedAt));
  }

  // ============ Driver Locations ============

  async getDriverLocation(driverId: string): Promise<DriverLocation | undefined> {
    const [loc] = await db.select().from(driverLocations).where(eq(driverLocations.driverId, driverId));
    return loc || undefined;
  }

  async getAllDriverLocations(): Promise<DriverLocation[]> {
    return db.select().from(driverLocations);
  }

  async upsertDriverLocation(data: InsertDriverLocation): Promise<DriverLocation> {
    const existing = await this.getDriverLocation(data.driverId);
    if (existing) {
      const [updated] = await db.update(driverLocations)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(driverLocations.driverId, data.driverId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(driverLocations).values(data).returning();
    return created;
  }

  // ============ Messages ============

  async getMessage(id: string): Promise<Message | undefined> {
    const [msg] = await db.select().from(messages).where(eq(messages.id, id));
    return msg || undefined;
  }

  async getMessagesBetween(userId1: string, userId2: string, limit = 50): Promise<Message[]> {
    return db.select().from(messages)
      .where(or(
        and(eq(messages.senderId, userId1), eq(messages.recipientId, userId2)),
        and(eq(messages.senderId, userId2), eq(messages.recipientId, userId1)),
      ))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
  }

  async getMessagesForUser(userId: string, limit = 100): Promise<Message[]> {
    return db.select().from(messages)
      .where(or(
        eq(messages.senderId, userId),
        eq(messages.recipientId, userId),
        isNull(messages.recipientId), // broadcasts
      ))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    const [msg] = await db.insert(messages).values(data).returning();
    return msg;
  }

  async markMessageRead(id: string): Promise<Message> {
    const [msg] = await db.update(messages)
      .set({ readAt: new Date() })
      .where(eq(messages.id, id))
      .returning();
    return msg;
  }

  async getUnreadCount(userId: string): Promise<number> {
    const result = await db.select({ count: count() }).from(messages)
      .where(and(
        or(eq(messages.recipientId, userId), isNull(messages.recipientId)),
        isNull(messages.readAt),
      ));
    return result[0]?.count || 0;
  }

  // ============ Route Templates ============

  async getRouteTemplate(id: string): Promise<RouteTemplate | undefined> {
    const [tmpl] = await db.select().from(routeTemplates).where(eq(routeTemplates.id, id));
    return tmpl || undefined;
  }

  async getAllRouteTemplates(): Promise<RouteTemplate[]> {
    return db.select().from(routeTemplates).orderBy(routeTemplates.name);
  }

  async createRouteTemplate(data: InsertRouteTemplate): Promise<RouteTemplate> {
    const [tmpl] = await db.insert(routeTemplates).values(data).returning();
    return tmpl;
  }

  async updateRouteTemplate(id: string, data: Partial<InsertRouteTemplate>): Promise<RouteTemplate> {
    const [tmpl] = await db.update(routeTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(routeTemplates.id, id))
      .returning();
    return tmpl;
  }

  async deleteRouteTemplate(id: string): Promise<void> {
    await db.delete(routeTemplates).where(eq(routeTemplates.id, id));
  }

  // ============ Organizations ============

  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org || undefined;
  }

  async createOrganization(data: InsertOrganization): Promise<Organization> {
    const [org] = await db.insert(organizations).values(data).returning();
    return org;
  }
}

export const storage = new DatabaseStorage();
