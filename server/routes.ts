import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { format } from "date-fns";
import type { RouteStop, InsertLocation, InsertRoute, Location, Route } from "@shared/schema";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  insertUserSchema,
  insertWorkLocationSchema,
} from "@shared/schema";
import OpenAI from "openai";
import * as fs from "fs";

const upload = multer({ storage: multer.memoryStorage() });

// Validation schemas
const clockInSchema = z.object({
  driverId: z.string().min(1, "Driver ID is required"),
  lat: z.number({ message: "Latitude must be a number" }),
  lng: z.number({ message: "Longitude must be a number" }),
  locationName: z.string().optional(),
});

const clockOutSchema = z.object({
  driverId: z.string().min(1, "Driver ID is required"),
  entryId: z.string().min(1, "Entry ID is required"),
  lat: z.number({ message: "Latitude must be a number" }),
  lng: z.number({ message: "Longitude must be a number" }),
  locationName: z.string().optional(),
});

const updateStopsSchema = z.object({
  stops: z.array(z.object({
    id: z.string(),
    locationId: z.string(),
    address: z.string(),
    customerName: z.string(),
    serviceType: z.string().optional(),
    notes: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    sequence: z.number(),
  })),
});

const moveStopSchema = z.object({
  stopId: z.string().min(1, "Stop ID is required"),
  fromRouteId: z.string().min(1, "From route ID is required"),
  toRouteId: z.string().min(1, "To route ID is required"),
  newSequence: z.number().int().min(1, "Sequence must be at least 1"),
});

// Helper function to calculate distance between two coordinates using Haversine formula
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

// K-means clustering algorithm for geographic grouping
function kMeansClustering(locations: Location[], k: number): Location[][] {
  const validLocations = locations.filter(loc => loc.lat != null && loc.lng != null);
  
  if (validLocations.length === 0 || k <= 0) return [];
  if (k >= validLocations.length) {
    return validLocations.map(loc => [loc]);
  }

  // Initialize centroids by selecting k evenly spaced locations
  const step = Math.floor(validLocations.length / k);
  let centroids: { lat: number; lng: number }[] = [];
  for (let i = 0; i < k; i++) {
    const loc = validLocations[Math.min(i * step, validLocations.length - 1)];
    centroids.push({ lat: loc.lat!, lng: loc.lng! });
  }

  let assignments: number[] = new Array(validLocations.length).fill(0);
  const maxIterations = 20;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign each location to nearest centroid
    const newAssignments: number[] = [];
    for (const loc of validLocations) {
      let minDist = Infinity;
      let closestCentroid = 0;
      for (let c = 0; c < centroids.length; c++) {
        const dist = calculateHaversineDistance(loc.lat!, loc.lng!, centroids[c].lat, centroids[c].lng);
        if (dist < minDist) {
          minDist = dist;
          closestCentroid = c;
        }
      }
      newAssignments.push(closestCentroid);
    }

    // Check for convergence
    const hasConverged = newAssignments.every((a, i) => a === assignments[i]);
    assignments = newAssignments;

    if (hasConverged) break;

    // Update centroids
    const newCentroids: { lat: number; lng: number; count: number }[] = 
      Array.from({ length: k }, () => ({ lat: 0, lng: 0, count: 0 }));

    for (let i = 0; i < validLocations.length; i++) {
      const cluster = assignments[i];
      newCentroids[cluster].lat += validLocations[i].lat!;
      newCentroids[cluster].lng += validLocations[i].lng!;
      newCentroids[cluster].count++;
    }

    for (let c = 0; c < k; c++) {
      if (newCentroids[c].count > 0) {
        centroids[c] = {
          lat: newCentroids[c].lat / newCentroids[c].count,
          lng: newCentroids[c].lng / newCentroids[c].count,
        };
      }
    }
  }

  // Group locations by cluster
  const clusters: Location[][] = Array.from({ length: k }, () => []);
  for (let i = 0; i < validLocations.length; i++) {
    clusters[assignments[i]].push(validLocations[i]);
  }

  // Filter out empty clusters
  return clusters.filter(cluster => cluster.length > 0);
}

// Nearest-neighbor algorithm for route ordering within a cluster
function nearestNeighborOrdering<T extends { lat: number | null; lng: number | null }>(locations: T[]): T[] {
  if (locations.length <= 1) return [...locations];

  const result: T[] = [];
  const remaining = [...locations];

  // Start with the first location
  result.push(remaining.shift()!);

  while (remaining.length > 0) {
    const current = result[result.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = calculateHaversineDistance(
        current.lat!, current.lng!,
        remaining[i].lat!, remaining[i].lng!
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    result.push(remaining.splice(nearestIdx, 1)[0]);
  }

  return result;
}

// Calculate total route distance from ordered stops (returns kilometers with 1 decimal)
function calculateRouteDistance(stops: RouteStop[]): number | null {
  if (stops.length < 2) return 0;

  let totalMeters = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const current = stops[i];
    const next = stops[i + 1];

    if (current.lat == null || current.lng == null || next.lat == null || next.lng == null) {
      return null; // Cannot calculate if any stop lacks coordinates
    }

    totalMeters += calculateHaversineDistance(current.lat, current.lng, next.lat, next.lng);
  }

  // Convert to kilometers and round to 1 decimal place
  return Math.round((totalMeters / 1000) * 10) / 10;
}

// Geocode an address using Google Maps Geocoding API
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.log("Geocoding skipped: GOOGLE_MAPS_API_KEY not configured");
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      console.log(`Geocoded "${address}" -> lat: ${location.lat}, lng: ${location.lng}`);
      return { lat: location.lat, lng: location.lng };
    } else {
      console.log(`Geocoding failed for "${address}": ${data.status}`);
      return null;
    }
  } catch (error) {
    console.error(`Geocoding error for "${address}":`, error);
    return null;
  }
}

// Helper to add delay between operations
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Google Routes API response type
interface GoogleRoutesOptimizationResult {
  optimizedStops: RouteStop[];
  totalDistanceKm: number;
  estimatedTimeMinutes: number;
}

// Optimize route using Google Routes API with waypoint optimization
async function optimizeRouteWithGoogle(
  stops: RouteStop[]
): Promise<GoogleRoutesOptimizationResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.log("Google route optimization skipped: GOOGLE_MAPS_API_KEY not configured");
    return null;
  }

  // Need at least 2 stops to optimize
  if (stops.length < 2) {
    console.log("Google route optimization skipped: Less than 2 stops");
    return null;
  }

  // All stops must have coordinates
  const stopsWithCoords = stops.filter(s => s.lat != null && s.lng != null);
  if (stopsWithCoords.length !== stops.length) {
    console.log("Google route optimization skipped: Some stops lack coordinates");
    return null;
  }

  try {
    // Use first stop as origin and last stop as destination
    const origin = stops[0];
    const destination = stops[stops.length - 1];
    const intermediates = stops.slice(1, -1);

    const requestBody: any = {
      origin: {
        location: {
          latLng: { latitude: origin.lat, longitude: origin.lng }
        }
      },
      destination: {
        location: {
          latLng: { latitude: destination.lat, longitude: destination.lng }
        }
      },
      travelMode: "DRIVE",
      optimizeWaypointOrder: intermediates.length > 0,
    };

    // Only add intermediates if there are any
    if (intermediates.length > 0) {
      requestBody.intermediates = intermediates.map(stop => ({
        location: {
          latLng: { latitude: stop.lat, longitude: stop.lng }
        }
      }));
    }

    console.log(`Calling Google Routes API with ${stops.length} stops (${intermediates.length} intermediates)...`);

    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.optimizedIntermediateWaypointIndex"
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Google Routes API error:", JSON.stringify(data, null, 2));
      return null;
    }

    console.log("Google Routes API response:", JSON.stringify(data, null, 2));

    if (!data.routes || data.routes.length === 0) {
      console.log("Google Routes API returned no routes");
      return null;
    }

    const route = data.routes[0];
    const distanceMeters = route.distanceMeters || 0;
    const totalDistanceKm = Math.round((distanceMeters / 1000) * 10) / 10;

    // Parse duration (format: "1234s" for seconds)
    let estimatedTimeMinutes = 0;
    if (route.duration) {
      const durationStr = route.duration.toString();
      const seconds = parseInt(durationStr.replace('s', '')) || 0;
      estimatedTimeMinutes = Math.ceil(seconds / 60);
    }

    // Reorder stops based on optimized waypoint indices
    let optimizedStops: RouteStop[];

    if (intermediates.length > 0 && route.optimizedIntermediateWaypointIndex) {
      // Build optimized order: origin + reordered intermediates + destination
      const optimizedIntermediates = route.optimizedIntermediateWaypointIndex.map(
        (idx: number) => intermediates[idx]
      );
      optimizedStops = [origin, ...optimizedIntermediates, destination];
    } else {
      // No intermediates or no optimization data - keep original order
      optimizedStops = [...stops];
    }

    // Update sequence numbers
    optimizedStops = optimizedStops.map((stop, index) => ({
      ...stop,
      sequence: index + 1
    }));

    console.log(`Google route optimization complete: ${totalDistanceKm}km, ${estimatedTimeMinutes} min`);
    return { optimizedStops, totalDistanceKm, estimatedTimeMinutes };

  } catch (error) {
    console.error("Google Routes API error:", error);
    return null;
  }
}

// Process geocoding in batches to respect rate limits
async function geocodeBatch(
  locations: InsertLocation[],
  batchSize: number = 5,
  delayMs: number = 200
): Promise<InsertLocation[]> {
  const results: InsertLocation[] = [];
  
  for (let i = 0; i < locations.length; i += batchSize) {
    const batch = locations.slice(i, i + batchSize);
    
    const geocodedBatch = await Promise.all(
      batch.map(async (loc) => {
        if (Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
          return loc;
        }
        
        const coords = await geocodeAddress(loc.address);
        if (coords) {
          return { ...loc, lat: coords.lat, lng: coords.lng };
        }
        return loc;
      })
    );
    
    results.push(...geocodedBatch);
    
    if (i + batchSize < locations.length) {
      await delay(delayMs);
    }
  }
  
  return results;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ============ AUTH ROUTES ============
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const user = await storage.getUserByUsername(username);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============ USER ROUTES ============
  app.get("/api/users", async (_req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      // Remove passwords from response
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      return res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Get users error:", error);
      return res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", async (req: Request, res: Response) => {
    try {
      const validation = insertUserSchema.safeParse(req.body);
      
      if (!validation.success) {
        const errors = validation.error.flatten();
        return res.status(400).json({
          message: "Validation failed",
          errors: errors.fieldErrors,
        });
      }

      const { name, phone, username, password, role } = validation.data;

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({
        name,
        phone: phone || null,
        username,
        password,
        role: role || "driver",
      });

      const { password: _, ...userWithoutPassword } = user;
      return res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Create user error:", error);
      return res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.delete("/api/users/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteUser(req.params.id);
      return res.status(204).send();
    } catch (error) {
      console.error("Delete user error:", error);
      return res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // ============ LOCATIONS (Delivery Stops) ROUTES ============
  app.get("/api/locations", async (_req: Request, res: Response) => {
    try {
      const locations = await storage.getAllLocations();
      return res.json(locations);
    } catch (error) {
      console.error("Get locations error:", error);
      return res.status(500).json({ message: "Failed to fetch locations" });
    }
  });

  app.patch("/api/locations/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { daysOfWeek } = req.body;

      const location = await storage.updateLocation(id, {
        daysOfWeek: daysOfWeek || null,
      });

      return res.json(location);
    } catch (error) {
      console.error("Update location error:", error);
      return res.status(500).json({ message: "Failed to update location" });
    }
  });

  app.delete("/api/locations/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteLocation(req.params.id);
      return res.status(204).send();
    } catch (error) {
      console.error("Delete location error:", error);
      return res.status(500).json({ message: "Failed to delete location" });
    }
  });

  // Re-geocode all locations that don't have coordinates
  app.post("/api/locations/geocode", async (_req: Request, res: Response) => {
    try {
      const locations = await storage.getAllLocations();
      const locationsWithoutCoords = locations.filter(loc => loc.lat == null || loc.lng == null);
      
      if (locationsWithoutCoords.length === 0) {
        return res.json({ message: "All locations already have coordinates", geocoded: 0 });
      }

      console.log(`Geocoding ${locationsWithoutCoords.length} locations without coordinates...`);
      
      let geocodedCount = 0;
      for (const location of locationsWithoutCoords) {
        const coords = await geocodeAddress(location.address);
        if (coords) {
          await storage.updateLocation(location.id, {
            lat: coords.lat,
            lng: coords.lng,
          });
          geocodedCount++;
        }
        // Add delay to avoid rate limiting
        await delay(200);
      }

      console.log(`Geocoding complete: ${geocodedCount}/${locationsWithoutCoords.length} locations geocoded`);
      return res.json({ 
        message: `Geocoded ${geocodedCount} out of ${locationsWithoutCoords.length} locations`,
        geocoded: geocodedCount,
        total: locationsWithoutCoords.length
      });
    } catch (error) {
      console.error("Geocode locations error:", error);
      return res.status(500).json({ message: "Failed to geocode locations" });
    }
  });

  app.post("/api/locations/upload", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const csvContent = req.file.buffer.toString("utf-8");
      
      let records: any[];
      try {
        records = parse(csvContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });
      } catch (parseError) {
        return res.status(400).json({ message: "Invalid CSV format" });
      }

      if (records.length === 0) {
        return res.status(400).json({ message: "CSV file is empty" });
      }

      // Validate required columns
      const firstRow = records[0];
      if (!firstRow.address && !firstRow.Address) {
        return res.status(400).json({ message: "CSV must have 'address' column" });
      }
      if (!firstRow.customer_name && !firstRow.customerName && !firstRow["Customer Name"]) {
        return res.status(400).json({ message: "CSV must have 'customer_name' column" });
      }

      // Parse and create locations
      const locationsToCreate: InsertLocation[] = records.map((row: any) => {
        const parseLat = row.lat ? parseFloat(row.lat) : null;
        const parseLng = row.lng ? parseFloat(row.lng) : null;
        return {
          address: row.address || row.Address || "",
          customerName: row.customer_name || row.customerName || row["Customer Name"] || "",
          serviceType: row.service_type || row.serviceType || row["Service Type"] || null,
          notes: row.notes || row.Notes || null,
          lat: Number.isFinite(parseLat) ? parseLat : null,
          lng: Number.isFinite(parseLng) ? parseLng : null,
          uploadDate: format(new Date(), "yyyy-MM-dd"),
        };
      });

      // Geocode addresses that don't have lat/lng (in batches to respect rate limits)
      const locationsNeedingGeocoding = locationsToCreate.filter(loc => loc.lat == null || loc.lng == null);
      console.log(`Geocoding ${locationsNeedingGeocoding.length} of ${locationsToCreate.length} locations`);
      
      const geocodedLocations = await geocodeBatch(locationsToCreate, 5, 200);
      
      const geocodedCount = geocodedLocations.filter(loc => loc.lat != null && loc.lng != null).length;
      console.log(`Geocoding complete: ${geocodedCount} locations have coordinates`);

      // Clear existing locations and add new ones
      await storage.clearLocations();
      await storage.clearRoutes();
      const createdLocations = await storage.createLocations(geocodedLocations);

      return res.status(201).json({
        message: `Uploaded ${createdLocations.length} locations`,
        count: createdLocations.length,
      });
    } catch (error) {
      console.error("Upload locations error:", error);
      return res.status(500).json({ message: "Failed to upload locations" });
    }
  });

  // ============ ROUTES ROUTES ============
  app.get("/api/routes", async (req: Request, res: Response) => {
    try {
      const { driverId, dayOfWeek } = req.query;
      
      if (driverId) {
        const routes = await storage.getRoutesByDriver(driverId as string);
        if (dayOfWeek) {
          const filtered = routes.filter(r => r.dayOfWeek === (dayOfWeek as string).toLowerCase());
          return res.json(filtered);
        }
        return res.json(routes);
      }

      const routes = await storage.getAllRoutes();
      if (dayOfWeek) {
        const filtered = routes.filter(r => r.dayOfWeek === (dayOfWeek as string).toLowerCase());
        return res.json(filtered);
      }
      return res.json(routes);
    } catch (error) {
      console.error("Get routes error:", error);
      return res.status(500).json({ message: "Failed to fetch routes" });
    }
  });

  // Helper function to generate routes for a specific day
  async function generateRoutesForDay(
    dayLocations: Location[],
    driverCount: number,
    dayOfWeek: string,
    scheduledDate?: string
  ): Promise<Route[]> {
    const createdRoutes: Route[] = [];
    
    // Get warehouse location for start/end of routes
    const workLocations = await storage.getAllWorkLocations();
    const warehouse = workLocations.find(wl => wl.name.toLowerCase() === 'warehouse');
    
    // Create warehouse stop helper
    const createWarehouseStop = (sequence: number, isStart: boolean): RouteStop => ({
      id: randomUUID(),
      locationId: warehouse?.id || 'warehouse',
      address: warehouse?.address || '583 Frederick Road, Catonsville, MD 21228',
      customerName: isStart ? 'Start: Warehouse' : 'End: Warehouse',
      serviceType: undefined,
      notes: isStart ? 'Load truck and begin route' : 'Return to warehouse',
      lat: warehouse?.lat || 39.27257,
      lng: warehouse?.lng || -76.7281,
      sequence,
    });

    // Check if locations have coordinates for geographic optimization
    const locationsWithCoords = dayLocations.filter(loc => loc.lat != null && loc.lng != null);
    const hasCoordinates = locationsWithCoords.length === dayLocations.length && dayLocations.length > 0;

    if (hasCoordinates) {
      // Use geographic clustering (K-means) + nearest-neighbor optimization
      const clusters = kMeansClustering(dayLocations, driverCount);

      for (const cluster of clusters) {
        if (cluster.length === 0) continue;

        // Apply nearest-neighbor ordering within each cluster
        const orderedLocations = nearestNeighborOrdering(cluster);

        // Create route stops with optimized sequence (starting at 2, leaving room for warehouse)
        let deliveryStops: RouteStop[] = orderedLocations.map((loc, index) => ({
          id: randomUUID(),
          locationId: loc.id,
          address: loc.address,
          customerName: loc.customerName,
          serviceType: loc.serviceType || undefined,
          notes: loc.notes || undefined,
          lat: loc.lat || undefined,
          lng: loc.lng || undefined,
          sequence: index + 2, // Start at 2, warehouse is 1
        }));

        // Try Google Routes API optimization for better results
        let totalDistance: number | null = null;
        let estimatedTime: number | null = null;
        const googleResult = await optimizeRouteWithGoogle(deliveryStops);
        
        if (googleResult) {
          deliveryStops = googleResult.optimizedStops;
          // Re-sequence after optimization
          deliveryStops.forEach((stop, idx) => {
            stop.sequence = idx + 2;
          });
          totalDistance = googleResult.totalDistanceKm;
          estimatedTime = googleResult.estimatedTimeMinutes;
          console.log(`Route for ${dayOfWeek} optimized with Google: ${deliveryStops.length} stops, ${totalDistance}km, ${estimatedTime} min`);
        }

        // Add warehouse at start and end
        const warehouseStart = createWarehouseStop(1, true);
        const warehouseEnd = createWarehouseStop(deliveryStops.length + 2, false);
        const stops = [warehouseStart, ...deliveryStops, warehouseEnd];

        // Calculate distance using full route including warehouse if Google didn't provide it
        if (!googleResult) {
          totalDistance = calculateRouteDistance(stops);
          estimatedTime = totalDistance ? Math.round((totalDistance / 40) * 60) + (deliveryStops.length * 5) : deliveryStops.length * 15;
          console.log(`Route for ${dayOfWeek} using nearest-neighbor: ${deliveryStops.length} stops, ${totalDistance}km (Haversine), ${estimatedTime} min est`);
        }

        const mapsUrl = generateGoogleMapsUrl(stops);

        const route = await storage.createRoute({
          date: scheduledDate || format(new Date(), "yyyy-MM-dd"),
          dayOfWeek: dayOfWeek,
          stopsJson: stops,
          routeLink: mapsUrl,
          totalDistance,
          estimatedTime,
          status: "draft",
          stopCount: stops.length,
          driverId: null,
          driverName: null,
        });

        createdRoutes.push(route);
      }
    } else {
      // Fallback: Simple round-robin division (no coordinates available)
      const stopsPerDriver = Math.ceil(dayLocations.length / driverCount);

      for (let i = 0; i < driverCount; i++) {
        const startIndex = i * stopsPerDriver;
        const endIndex = Math.min(startIndex + stopsPerDriver, dayLocations.length);
        
        if (startIndex >= dayLocations.length) break;

        const routeLocations = dayLocations.slice(startIndex, endIndex);
        
        let deliveryStops: RouteStop[] = routeLocations.map((loc, index) => ({
          id: randomUUID(),
          locationId: loc.id,
          address: loc.address,
          customerName: loc.customerName,
          serviceType: loc.serviceType || undefined,
          notes: loc.notes || undefined,
          lat: loc.lat || undefined,
          lng: loc.lng || undefined,
          sequence: index + 2, // Start at 2, warehouse is 1
        }));

        let totalDistance: number | null = null;
        let estimatedTime: number | null = null;
        let googleOptimized = false;
        const stopsHaveCoords = deliveryStops.every(s => s.lat != null && s.lng != null);
        
        if (stopsHaveCoords) {
          const googleResult = await optimizeRouteWithGoogle(deliveryStops);
          if (googleResult) {
            deliveryStops = googleResult.optimizedStops;
            // Re-sequence after optimization
            deliveryStops.forEach((stop, idx) => {
              stop.sequence = idx + 2;
            });
            totalDistance = googleResult.totalDistanceKm;
            estimatedTime = googleResult.estimatedTimeMinutes;
            googleOptimized = true;
          }
        }

        // Add warehouse at start and end
        const warehouseStart = createWarehouseStop(1, true);
        const warehouseEnd = createWarehouseStop(deliveryStops.length + 2, false);
        const stops = [warehouseStart, ...deliveryStops, warehouseEnd];

        // Calculate distance using full route including warehouse if Google didn't provide it
        if (!googleOptimized && stopsHaveCoords) {
          totalDistance = calculateRouteDistance(stops);
          estimatedTime = totalDistance ? Math.round((totalDistance / 40) * 60) + (deliveryStops.length * 5) : deliveryStops.length * 15;
        } else if (!googleOptimized) {
          estimatedTime = deliveryStops.length * 15;
        }

        const mapsUrl = generateGoogleMapsUrl(stops);

        const route = await storage.createRoute({
          date: scheduledDate || format(new Date(), "yyyy-MM-dd"),
          dayOfWeek: dayOfWeek,
          stopsJson: stops,
          routeLink: mapsUrl,
          totalDistance,
          estimatedTime,
          status: "draft",
          stopCount: stops.length,
          driverId: null,
          driverName: null,
        });

        createdRoutes.push(route);
      }
    }

    return createdRoutes;
  }

  app.post("/api/routes/generate", async (req: Request, res: Response) => {
    try {
      const { driverCount, dayOfWeek, scheduledDate } = req.body;

      if (!driverCount || driverCount < 1 || driverCount > 10) {
        return res.status(400).json({ message: "Driver count must be between 1 and 10" });
      }

      const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      if (dayOfWeek && !validDays.includes(dayOfWeek.toLowerCase())) {
        return res.status(400).json({ message: "Invalid day of week" });
      }

      // Get all locations
      const allLocations = await storage.getAllLocations();
      
      if (allLocations.length === 0) {
        return res.status(400).json({ message: "No locations to generate routes from" });
      }

      const createdRoutes: Route[] = [];
      const targetDay = dayOfWeek ? dayOfWeek.toLowerCase() : null;

      if (targetDay && scheduledDate) {
        // Generate routes for a specific date
        const dayLocations = allLocations.filter(loc => loc.daysOfWeek && loc.daysOfWeek.includes(targetDay));
        if (dayLocations.length === 0) {
          return res.status(400).json({ message: `No locations are scheduled for ${dayOfWeek}. Assign days to delivery stops first.` });
        }
        
        // Clear existing routes for this specific date
        await storage.clearRoutesByDate(scheduledDate);
        
        const routes = await generateRoutesForDay(dayLocations, driverCount, targetDay, scheduledDate);
        createdRoutes.push(...routes);
      } else if (targetDay) {
        // Legacy: Generate routes for a day (without specific date)
        const dayLocations = allLocations.filter(loc => loc.daysOfWeek && loc.daysOfWeek.includes(targetDay));
        if (dayLocations.length === 0) {
          return res.status(400).json({ message: `No locations are scheduled for ${dayOfWeek}. Assign days to delivery stops first.` });
        }
        
        await storage.clearRoutesByDay(targetDay);
        
        const routes = await generateRoutesForDay(dayLocations, driverCount, targetDay);
        createdRoutes.push(...routes);
      } else {
        // Generate routes for ALL days that have locations
        // First, clear all existing routes
        await storage.clearRoutes();
        
        // Group locations by each day they're assigned to
        for (const day of validDays) {
          const dayLocations = allLocations.filter(loc => loc.daysOfWeek && loc.daysOfWeek.includes(day));
          
          if (dayLocations.length > 0) {
            console.log(`Generating routes for ${day}: ${dayLocations.length} locations`);
            const routes = await generateRoutesForDay(dayLocations, driverCount, day);
            createdRoutes.push(...routes);
          }
        }
        
        if (createdRoutes.length === 0) {
          return res.status(400).json({ message: "No locations have day assignments. Assign days to delivery stops first." });
        }
      }

      return res.status(201).json(createdRoutes);
    } catch (error) {
      console.error("Generate routes error:", error);
      return res.status(500).json({ message: "Failed to generate routes" });
    }
  });

  app.patch("/api/routes/:id/assign", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { driverId, driverName } = req.body;

      const route = await storage.updateRoute(id, {
        driverId,
        driverName,
        status: "assigned",
      });

      return res.json(route);
    } catch (error) {
      console.error("Assign route error:", error);
      return res.status(500).json({ message: "Failed to assign route" });
    }
  });

  app.patch("/api/routes/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const route = await storage.updateRoute(id, req.body);
      return res.json(route);
    } catch (error) {
      console.error("Update route error:", error);
      return res.status(500).json({ message: "Failed to update route" });
    }
  });

  app.patch("/api/routes/:id/stops", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validation = updateStopsSchema.safeParse(req.body);

      if (!validation.success) {
        const errors = validation.error.flatten();
        return res.status(400).json({
          message: "Validation failed",
          errors: errors.fieldErrors,
        });
      }

      const { stops } = validation.data;

      const route = await storage.getRoute(id);
      if (!route) {
        return res.status(404).json({ message: "Route not found" });
      }

      const updatedRoute = await storage.updateRoute(id, {
        stopsJson: stops,
        stopCount: stops.length,
      });

      return res.json(updatedRoute);
    } catch (error) {
      console.error("Update stops error:", error);
      return res.status(500).json({ message: "Failed to update stops" });
    }
  });

  app.post("/api/routes/move-stop", async (req: Request, res: Response) => {
    try {
      const validation = moveStopSchema.safeParse(req.body);

      if (!validation.success) {
        const errors = validation.error.flatten();
        return res.status(400).json({
          message: "Validation failed",
          errors: errors.fieldErrors,
        });
      }

      const { stopId, fromRouteId, toRouteId, newSequence } = validation.data;

      const fromRoute = await storage.getRoute(fromRouteId);
      const toRoute = await storage.getRoute(toRouteId);

      if (!fromRoute) {
        return res.status(404).json({ message: "Source route not found" });
      }

      if (!toRoute) {
        return res.status(404).json({ message: "Target route not found" });
      }

      const fromStops = [...(fromRoute.stopsJson || [])];
      const stopIndex = fromStops.findIndex(s => s.id === stopId);

      if (stopIndex === -1) {
        return res.status(404).json({ message: "Stop not found in source route" });
      }

      const [movedStop] = fromStops.splice(stopIndex, 1);

      fromStops.forEach((stop, index) => {
        stop.sequence = index + 1;
      });

      const toStops = [...(toRoute.stopsJson || [])];
      const insertIndex = Math.min(newSequence - 1, toStops.length);
      movedStop.sequence = newSequence;
      toStops.splice(insertIndex, 0, movedStop);

      toStops.forEach((stop, index) => {
        stop.sequence = index + 1;
      });

      const updatedFromRoute = await storage.updateRoute(fromRouteId, {
        stopsJson: fromStops,
        stopCount: fromStops.length,
      });

      const updatedToRoute = await storage.updateRoute(toRouteId, {
        stopsJson: toStops,
        stopCount: toStops.length,
      });

      return res.json({
        fromRoute: updatedFromRoute,
        toRoute: updatedToRoute,
      });
    } catch (error) {
      console.error("Move stop error:", error);
      return res.status(500).json({ message: "Failed to move stop" });
    }
  });

  app.post("/api/routes/publish", async (_req: Request, res: Response) => {
    try {
      const routes = await storage.getAllRoutes();
      
      for (const route of routes) {
        if (route.status === "assigned") {
          await storage.updateRoute(route.id, { status: "published" });
        }
      }

      return res.json({ message: "Routes published successfully" });
    } catch (error) {
      console.error("Publish routes error:", error);
      return res.status(500).json({ message: "Failed to publish routes" });
    }
  });

  // Refresh all route stops with updated coordinates from locations
  app.post("/api/routes/refresh-coordinates", async (_req: Request, res: Response) => {
    try {
      const routes = await storage.getAllRoutes();
      const locations = await storage.getAllLocations();
      
      // Create a lookup map for location coordinates
      const locationCoords = new Map<string, { lat: number | null; lng: number | null }>();
      for (const loc of locations) {
        locationCoords.set(loc.id, { lat: loc.lat, lng: loc.lng });
      }

      let updatedCount = 0;
      for (const route of routes) {
        const stops = (route.stopsJson || []) as RouteStop[];
        let hasUpdates = false;

        const updatedStops = stops.map(stop => {
          const coords = locationCoords.get(stop.locationId);
          if (coords && (stop.lat !== coords.lat || stop.lng !== coords.lng)) {
            hasUpdates = true;
            return { ...stop, lat: coords.lat ?? undefined, lng: coords.lng ?? undefined };
          }
          return stop;
        });

        if (hasUpdates) {
          // Also regenerate the maps URL and recalculate distance/time
          const mapsUrl = generateGoogleMapsUrl(updatedStops);
          let totalDistance: number | null = null;
          let estimatedTime: number | null = null;
          
          const stopsHaveCoords = updatedStops.every(s => s.lat != null && s.lng != null);
          if (stopsHaveCoords) {
            const googleResult = await optimizeRouteWithGoogle(updatedStops);
            if (googleResult) {
              totalDistance = googleResult.totalDistanceKm;
              estimatedTime = googleResult.estimatedTimeMinutes;
            } else {
              totalDistance = calculateRouteDistance(updatedStops);
              estimatedTime = totalDistance ? Math.round((totalDistance / 40) * 60) + (updatedStops.length * 5) : updatedStops.length * 15;
            }
          }

          await storage.updateRoute(route.id, {
            stopsJson: updatedStops,
            routeLink: mapsUrl,
            totalDistance,
            estimatedTime,
          });
          updatedCount++;
        }
      }

      console.log(`Refreshed coordinates for ${updatedCount} routes`);
      return res.json({ 
        message: `Updated ${updatedCount} routes with new coordinates`,
        updated: updatedCount,
        total: routes.length
      });
    } catch (error) {
      console.error("Refresh coordinates error:", error);
      return res.status(500).json({ message: "Failed to refresh route coordinates" });
    }
  });

  // Delete a route
  app.delete("/api/routes/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteRoute(id);
      return res.json({ message: "Route deleted successfully" });
    } catch (error) {
      console.error("Delete route error:", error);
      return res.status(500).json({ message: "Failed to delete route" });
    }
  });

  // ============ TIME ENTRIES ROUTES ============
  app.get("/api/time-entries", async (_req: Request, res: Response) => {
    try {
      const entries = await storage.getAllTimeEntries();
      return res.json(entries);
    } catch (error) {
      console.error("Get time entries error:", error);
      return res.status(500).json({ message: "Failed to fetch time entries" });
    }
  });

  app.get("/api/time-entries/today", async (req: Request, res: Response) => {
    try {
      const { driverId } = req.query;
      
      if (!driverId) {
        return res.status(400).json({ message: "Driver ID is required" });
      }

      const today = format(new Date(), "yyyy-MM-dd");
      const entry = await storage.getTodayEntryByDriver(driverId as string, today);

      if (!entry) {
        return res.status(404).json({ message: "No entry found for today" });
      }

      return res.json(entry);
    } catch (error) {
      console.error("Get today entry error:", error);
      return res.status(500).json({ message: "Failed to fetch today's entry" });
    }
  });

  app.post("/api/time-entries/clock-in", async (req: Request, res: Response) => {
    try {
      const validation = clockInSchema.safeParse(req.body);
      
      if (!validation.success) {
        const errors = validation.error.flatten();
        return res.status(400).json({
          message: "Validation failed",
          errors: errors.fieldErrors,
        });
      }

      const { driverId, lat, lng, locationName } = validation.data;

      // Query all work locations and verify geofence
      const workLocations = await storage.getAllWorkLocations();
      
      if (workLocations.length > 0) {
        let isWithinGeofence = false;
        let closestDistance = Infinity;
        let closestLocationRadius = 0;

        for (const workLocation of workLocations) {
          const distance = calculateHaversineDistance(lat, lng, workLocation.lat, workLocation.lng);
          
          if (distance <= workLocation.radiusMeters) {
            isWithinGeofence = true;
            break;
          }
          
          // Track the closest location for error message
          if (distance < closestDistance) {
            closestDistance = distance;
            closestLocationRadius = workLocation.radiusMeters;
          }
        }

        if (!isWithinGeofence) {
          const distanceMeters = Math.round(closestDistance);
          const radiusMeters = closestLocationRadius;
          return res.status(400).json({
            message: `Clock-in not allowed. You are ${distanceMeters}m away from the nearest work location (required: within ${radiusMeters}m)`,
            distance: distanceMeters,
            requiredRadius: radiusMeters,
          });
        }
      }

      const today = format(new Date(), "yyyy-MM-dd");
      
      // Check if already clocked in today
      const existingEntry = await storage.getTodayEntryByDriver(driverId, today);
      if (existingEntry) {
        return res.status(409).json({ message: "Already clocked in today" });
      }

      const entry = await storage.createTimeEntry({
        driverId,
        date: today,
        clockInTime: new Date(),
        clockInLat: lat,
        clockInLng: lng,
        clockInLocationName: locationName || null,
        clockOutTime: null,
        clockOutLat: null,
        clockOutLng: null,
        clockOutLocationName: null,
      });

      return res.status(201).json(entry);
    } catch (error) {
      console.error("Clock in error:", error);
      return res.status(500).json({ message: "Failed to clock in" });
    }
  });

  app.post("/api/time-entries/clock-out", async (req: Request, res: Response) => {
    try {
      const validation = clockOutSchema.safeParse(req.body);
      
      if (!validation.success) {
        const errors = validation.error.flatten();
        return res.status(400).json({
          message: "Validation failed",
          errors: errors.fieldErrors,
        });
      }

      const { driverId, entryId, lat, lng, locationName } = validation.data;

      // Query all work locations and verify geofence
      const workLocations = await storage.getAllWorkLocations();
      
      if (workLocations.length > 0) {
        let isWithinGeofence = false;
        let closestDistance = Infinity;
        let closestLocationRadius = 0;

        for (const workLocation of workLocations) {
          const distance = calculateHaversineDistance(lat, lng, workLocation.lat, workLocation.lng);
          
          if (distance <= workLocation.radiusMeters) {
            isWithinGeofence = true;
            break;
          }
          
          // Track the closest location for error message
          if (distance < closestDistance) {
            closestDistance = distance;
            closestLocationRadius = workLocation.radiusMeters;
          }
        }

        if (!isWithinGeofence) {
          const distanceMeters = Math.round(closestDistance);
          const radiusMeters = closestLocationRadius;
          return res.status(400).json({
            message: `Clock-out not allowed. You are ${distanceMeters}m away from the nearest work location (required: within ${radiusMeters}m)`,
            distance: distanceMeters,
            requiredRadius: radiusMeters,
          });
        }
      }

      const entry = await storage.updateTimeEntry(entryId, {
        clockOutTime: new Date(),
        clockOutLat: lat,
        clockOutLng: lng,
        clockOutLocationName: locationName || null,
      });

      return res.json(entry);
    } catch (error) {
      console.error("Clock out error:", error);
      return res.status(500).json({ message: "Failed to clock out" });
    }
  });

  // ============ CONFIG ROUTES ============
  app.get("/api/config/maps-key", async (_req: Request, res: Response) => {
    try {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      
      if (!apiKey) {
        return res.status(404).json({ message: "Google Maps API key not configured" });
      }

      return res.json({ apiKey });
    } catch (error) {
      console.error("Get maps key error:", error);
      return res.status(500).json({ message: "Failed to fetch maps key" });
    }
  });

  // ============ WORK LOCATIONS ROUTES ============
  app.get("/api/work-locations", async (_req: Request, res: Response) => {
    try {
      const locations = await storage.getAllWorkLocations();
      return res.json(locations);
    } catch (error) {
      console.error("Get work locations error:", error);
      return res.status(500).json({ message: "Failed to fetch work locations" });
    }
  });

  app.post("/api/work-locations", async (req: Request, res: Response) => {
    try {
      const { name, address, lat, lng, radiusMeters } = req.body;

      if (!name || !address) {
        return res.status(400).json({
          message: "Name and address are required",
        });
      }

      // If lat/lng are not provided, geocode the address automatically
      let finalLat = lat;
      let finalLng = lng;

      if (finalLat == null || finalLng == null || isNaN(parseFloat(finalLat)) || isNaN(parseFloat(finalLng))) {
        console.log(`Geocoding work location address: "${address}"`);
        const coords = await geocodeAddress(address);
        if (coords) {
          finalLat = coords.lat;
          finalLng = coords.lng;
          console.log(`Geocoded "${address}" -> lat: ${finalLat}, lng: ${finalLng}`);
        } else {
          return res.status(400).json({
            message: "Could not find coordinates for this address. Please check the address and try again.",
          });
        }
      }

      const location = await storage.createWorkLocation({
        name,
        address,
        lat: parseFloat(finalLat),
        lng: parseFloat(finalLng),
        radiusMeters: radiusMeters || 100,
      });

      return res.status(201).json(location);
    } catch (error) {
      console.error("Create work location error:", error);
      return res.status(500).json({ message: "Failed to create work location" });
    }
  });

  app.delete("/api/work-locations/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteWorkLocation(req.params.id);
      return res.status(204).send();
    } catch (error) {
      console.error("Delete work location error:", error);
      return res.status(500).json({ message: "Failed to delete work location" });
    }
  });

  // ============ AI CHAT ROUTES ============
  app.post("/api/chat", async (req: Request, res: Response) => {
    try {
      const { message, conversationHistory = [], userId } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ message: "Message is required" });
      }

      // Require userId and verify they're an admin
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "OpenAI API key not configured" });
      }

      const openai = new OpenAI({ apiKey });

      // Read help documentation
      let helpContent = "";
      try {
        helpContent = fs.readFileSync("HELP.md", "utf-8");
      } catch (err) {
        console.log("HELP.md not found, continuing without documentation");
      }

      // Gather current app data for context
      const [users, locations, routes, timeEntries, workLocations] = await Promise.all([
        storage.getAllUsers(),
        storage.getAllLocations(),
        storage.getAllRoutes(),
        storage.getAllTimeEntries(),
        storage.getAllWorkLocations(),
      ]);

      const drivers = users.filter(u => u.role === "driver");
      const admins = users.filter(u => u.role === "admin");
      const publishedRoutes = routes.filter(r => r.status === "published");
      const assignedRoutes = routes.filter(r => r.status === "assigned");
      const draftRoutes = routes.filter(r => r.status === "draft");

      // Get today's day of week
      const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const todayDayOfWeek = days[new Date().getDay()];

      // Calculate some stats
      const todaysRoutes = routes.filter(r => r.dayOfWeek === todayDayOfWeek);
      const scheduledLocations = locations.filter(l => l.daysOfWeek && l.daysOfWeek.length > 0);
      const unscheduledLocations = locations.filter(l => !l.daysOfWeek || l.daysOfWeek.length === 0);

      // Build data summary for the AI
      const dataSummary = `
## Current App Data Summary

### Users
- Total drivers: ${drivers.length}
- Total admins: ${admins.length}
- Driver names: ${drivers.map(d => d.name).join(", ") || "None"}

### Delivery Stops
- Total locations: ${locations.length}
- Scheduled locations: ${scheduledLocations.length}
- Unscheduled locations: ${unscheduledLocations.length}
${["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(day => {
  const count = locations.filter(l => l.daysOfWeek?.includes(day)).length;
  return `- ${day.charAt(0).toUpperCase() + day.slice(1)}: ${count} stops`;
}).join("\n")}

### Routes
- Total routes: ${routes.length}
- Published routes: ${publishedRoutes.length}
- Assigned routes: ${assignedRoutes.length}
- Draft routes: ${draftRoutes.length}
- Today's routes (${todayDayOfWeek}): ${todaysRoutes.length}

### Today's Schedule
${todaysRoutes.length > 0 ? todaysRoutes.map(r => {
  const driver = users.find(u => u.id === r.driverId);
  const stopCount = r.stopCount || (r.stopsJson as RouteStop[])?.length || 0;
  return `- Route ${r.id.slice(0, 8)}: ${driver?.name || "Unassigned"} - ${stopCount} stops (${r.status})`;
}).join("\n") : "No routes scheduled for today"}

### Work Locations
${workLocations.map(wl => `- ${wl.name}: ${wl.address} (radius: ${wl.radiusMeters}m)`).join("\n") || "None configured"}

### Time Tracking
- Total time entries: ${timeEntries.length}
- Today's entries: ${timeEntries.filter(te => te.date === format(new Date(), "yyyy-MM-dd")).length}
`;

      const systemPrompt = `You are a helpful AI assistant for the Grizzly Mats Driver Management App. You help administrators understand how to use the app and answer questions about their data.

## Your Capabilities:
1. Answer "how to" questions using the app documentation
2. Provide data insights and summaries from the current app state
3. Help troubleshoot common issues
4. Give recommendations for route management and scheduling

## Guidelines:
- Be concise but helpful
- Reference specific features and steps when explaining how to do things
- Use the actual data when answering questions about routes, drivers, or schedules
- If you don't know something, admit it and suggest where they might find the answer
- Format responses with markdown for readability

## App Documentation:
${helpContent}

## Current App Data:
${dataSummary}
`;

      // Build messages array with conversation history
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...conversationHistory.map((msg: { role: string; content: string }) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
        { role: "user", content: message },
      ];

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      });

      const response = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

      return res.json({ response });
    } catch (error: any) {
      console.error("Chat error:", error);
      return res.status(500).json({ 
        message: error?.message || "Failed to process chat request" 
      });
    }
  });

  return httpServer;
}

// Helper function to generate Google Maps URL from stops
function generateGoogleMapsUrl(stops: RouteStop[]): string {
  if (stops.length === 0) return "";
  
  const baseUrl = "https://www.google.com/maps/dir/";
  
  // Use addresses for directions, URL encode them
  const encodedAddresses = stops.map(stop => 
    encodeURIComponent(stop.address)
  );
  
  return baseUrl + encodedAddresses.join("/");
}
