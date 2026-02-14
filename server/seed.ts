import { db } from "./db";
import { users, workLocations } from "@shared/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth";

async function seed() {
  console.log("Seeding database...");

  // Create admin user if doesn't exist
  const existingAdmin = await db.select().from(users).where(eq(users.username, "admin"));
  
  if (existingAdmin.length === 0) {
    const hashedAdminPassword = await hashPassword("admin123");
    await db.insert(users).values({
      name: "Admin User",
      username: "admin",
      password: hashedAdminPassword,
      role: "admin",
      phone: null,
    });
    console.log("Created admin user: admin / admin123");
  } else {
    console.log("Admin user already exists");
  }

  // Create demo driver if doesn't exist
  const existingDriver = await db.select().from(users).where(eq(users.username, "driver1"));
  
  if (existingDriver.length === 0) {
    const hashedDriverPassword = await hashPassword("driver123");
    await db.insert(users).values({
      name: "John Driver",
      username: "driver1",
      password: hashedDriverPassword,
      role: "driver",
      phone: "(555) 123-4567",
    });
    console.log("Created demo driver: driver1 / driver123");
  } else {
    console.log("Demo driver already exists");
  }

  // Create demo work location if none exist
  const existingLocations = await db.select().from(workLocations);
  
  if (existingLocations.length === 0) {
    await db.insert(workLocations).values({
      name: "Main Warehouse",
      address: "123 Industrial Blvd, Anytown, USA",
      lat: 40.7128,
      lng: -74.006,
      radiusMeters: 100,
    });
    console.log("Created demo work location");
  } else {
    console.log("Work locations already exist");
  }

  console.log("Seeding complete!");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
