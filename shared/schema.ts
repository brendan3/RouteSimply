import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, json, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table (drivers and admins)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone"),
  role: text("role").notNull().default("driver"), // 'admin' or 'driver'
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Locations table (delivery stops)
export const locations = pgTable("locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  address: text("address").notNull(),
  customerName: text("customer_name").notNull(),
  serviceType: text("service_type"),
  notes: text("notes"),
  lat: real("lat"),
  lng: real("lng"),
  uploadDate: date("upload_date").notNull().default(sql`CURRENT_DATE`),
});

// Routes table (assigned routes for drivers)
export const routes = pgTable("routes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: date("date").notNull().default(sql`CURRENT_DATE`),
  dayOfWeek: text("day_of_week"), // 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  driverId: varchar("driver_id").references(() => users.id),
  driverName: text("driver_name"),
  stopsJson: json("stops_json").$type<RouteStop[]>().default([]),
  routeLink: text("route_link"),
  totalDistance: real("total_distance"),
  estimatedTime: integer("estimated_time"), // in minutes
  status: text("status").notNull().default("draft"), // 'draft', 'assigned', 'published'
  stopCount: integer("stop_count").default(0),
});

// Time entries table (clock in/out records)
export const timeEntries = pgTable("time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").notNull().references(() => users.id),
  date: date("date").notNull().default(sql`CURRENT_DATE`),
  clockInTime: timestamp("clock_in_time"),
  clockInLat: real("clock_in_lat"),
  clockInLng: real("clock_in_lng"),
  clockInLocationName: text("clock_in_location_name"),
  clockOutTime: timestamp("clock_out_time"),
  clockOutLat: real("clock_out_lat"),
  clockOutLng: real("clock_out_lng"),
  clockOutLocationName: text("clock_out_location_name"),
});

// Work locations for geofencing
export const workLocations = pgTable("work_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  radiusMeters: integer("radius_meters").notNull().default(100),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  routes: many(routes),
  timeEntries: many(timeEntries),
}));

export const routesRelations = relations(routes, ({ one }) => ({
  driver: one(users, {
    fields: [routes.driverId],
    references: [users.id],
  }),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  driver: one(users, {
    fields: [timeEntries.driverId],
    references: [users.id],
  }),
}));

// Types for route stops
export interface RouteStop {
  id: string;
  locationId: string;
  address: string;
  customerName: string;
  serviceType?: string;
  notes?: string;
  lat?: number;
  lng?: number;
  sequence: number;
}

// CSV row schema for validation
export const csvRowSchema = z.object({
  address: z.string().min(1, "Address is required"),
  customer_name: z.string().min(1, "Customer name is required"),
  service_type: z.string().optional(),
  notes: z.string().optional(),
});

export type CSVRow = z.infer<typeof csvRowSchema>;

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertLocationSchema = createInsertSchema(locations).omit({ id: true });
export const insertRouteSchema = createInsertSchema(routes).omit({ id: true });
export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({ id: true });
export const insertWorkLocationSchema = createInsertSchema(workLocations).omit({ id: true });

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locations.$inferSelect;

export type InsertRoute = z.infer<typeof insertRouteSchema>;
export type Route = typeof routes.$inferSelect;

export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type TimeEntry = typeof timeEntries.$inferSelect;

export type InsertWorkLocation = z.infer<typeof insertWorkLocationSchema>;
export type WorkLocation = typeof workLocations.$inferSelect;

// API response types
export interface RouteWithDriver extends Route {
  driver?: User;
}

export interface TimeEntryWithDriver extends TimeEntry {
  driver?: User;
}

// Geolocation types
export interface GeoPosition {
  lat: number;
  lng: number;
}

export interface ClockActionResult {
  success: boolean;
  message: string;
  entry?: TimeEntry;
  distance?: number;
}
