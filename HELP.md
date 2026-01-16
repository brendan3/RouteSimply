# Grizzly Mats Driver Management App - User Guide

## Overview
This app helps you manage mat delivery drivers, create optimized routes, and track driver time. It's designed for both admin users (who manage everything) and drivers (who view their routes and clock in/out).

---

## Getting Started

### Logging In
1. Go to the app's main page
2. Enter your username and password
3. Click "Login"

**Demo Credentials:**
- Admin: username `admin`, password `admin123`
- Driver: username `driver1`, password `driver123`

---

## Admin Features

### 1. Delivery Stops

**What it does:** Manage all your customer delivery locations.

**How to use:**
1. Click "Delivery Stops" in the sidebar
2. You'll see summary cards showing how many stops are scheduled for each day
3. Use the "Cards" or "List" view toggle to switch between views

**Uploading Locations (CSV):**
1. Click "Upload CSV" button
2. Drag and drop your CSV file or click to browse
3. Required columns: `address`, `customer_name`
4. Optional columns: `service_type`, `notes`
5. Locations are automatically geocoded (converted to map coordinates)

**Scheduling Days:**
- Each stop has 7 day buttons (Mon-Sun)
- Click a day to toggle it on/off
- Green/highlighted days mean the stop is scheduled for that day
- A stop can be scheduled for multiple days (e.g., Tuesday AND Friday)

**Filtering:**
- Click a day card at the top to filter stops for that day
- Click "All Stops" to see everything
- Click the orange "Unscheduled" banner to see stops without assigned days
- Use the search box to find stops by customer name or address

**Deleting Stops:**
- Click the trash icon on any stop to delete it

---

### 2. Routes

**What it does:** Generate and manage optimized delivery routes for drivers.

**How to use:**
1. Click "Routes" in the sidebar
2. Use "List View" or "Map View" to see routes differently

**Generating Routes:**
1. Click "Generate Routes" button
2. Select how many drivers you need
3. Optionally select a specific day (or generate for all days)
4. Click "Generate"
5. Routes are automatically optimized using Google Maps
6. Every route starts and ends at the Warehouse (583 Frederick Road, Catonsville, MD 21228)

**Assigning Drivers:**
1. Find a route card showing "Draft" status
2. Click "Assign Driver" button
3. Select a driver from the dropdown
4. The route status changes to "Assigned"

**Publishing Routes:**
- Once routes are assigned, click "Publish All Routes"
- This makes routes visible to drivers

**Deleting Routes:**
- Click the trash icon on any route card to delete it

**Filtering by Day:**
- Click day buttons (Mon, Tue, Wed, etc.) to filter routes for that day
- Click "All Days" to see all routes

---

### 3. Calendar

**What it does:** View routes organized by date in a calendar format.

**How to use:**
1. Click "Calendar" in the sidebar
2. Use "Weekly" or "Monthly" view toggle
3. Navigate using the arrow buttons or click "Today"

**Weekly View:**
- Shows each day of the week
- Routes are color-coded by driver
- Click on a route to see details

**Monthly View:**
- Shows a month overview
- Each day shows route counts

---

### 4. Drivers

**What it does:** Manage your driver and admin accounts.

**How to use:**
1. Click "Drivers" in the sidebar
2. See a list of all users with their roles

**Adding a New Driver:**
1. Click "Add User" button
2. Enter username, password, and full name
3. Select role (Driver or Admin)
4. Click "Create User"

**Deleting Users:**
- Click the trash icon next to any user
- Cannot delete yourself

---

### 5. Time Tracking

**What it does:** View when drivers clock in and out.

**How to use:**
1. Click "Time Tracking" in the sidebar
2. See a table of all clock-in/out entries
3. Entries show: driver name, date, clock-in time, clock-out time, hours worked

**Exporting:**
- Click "Export CSV" to download time entries for payroll

---

### 6. Work Locations

**What it does:** Set up geofenced locations where drivers can clock in/out.

**How to use:**
1. Click "Work Locations" in the sidebar
2. See existing work locations (Warehouse is pre-configured)

**Adding a Work Location:**
1. Click "Add Location" button
2. Enter a name (e.g., "Warehouse", "Office")
3. Enter the full address
4. Set the radius in meters (default 100m)
5. The address is automatically geocoded
6. Click "Add"

**Deleting:**
- Click the trash icon to remove a location

---

## Driver Features

### Viewing Your Route

1. Log in with your driver account
2. You'll see your assigned route for today
3. Stops are numbered in order
4. First stop is always the Warehouse (load truck)
5. Last stop is always the Warehouse (return)

### Navigation

- Tap any stop to open directions in Google Maps
- Follow the numbered order

### Clock In/Out

1. Tap "Time Clock" in the menu
2. Your location is checked against work locations
3. If you're within range, tap "Clock In" or "Clock Out"
4. GPS coordinates are recorded

---

## Tips & Best Practices

### Route Generation
- Assign days to all your delivery stops BEFORE generating routes
- Generate routes for one day at a time for better control
- The system automatically optimizes route order to minimize driving time

### Scheduling Stops
- Use the filter cards to quickly see what's scheduled for each day
- The orange "Unscheduled" banner helps you find stops that need days assigned
- One stop can appear on multiple days (for recurring deliveries)

### Managing Drivers
- Create driver accounts before assigning routes
- Each driver should have a unique username
- Drivers can only see their own assigned routes

---

## Troubleshooting

### "No locations scheduled for this day"
- Go to Delivery Stops and assign days to your stops
- Make sure the day buttons are highlighted (selected)

### Routes not showing on map
- Make sure locations have been geocoded
- Try refreshing the page
- Check that routes have been generated for the selected day

### Driver can't see their route
- Make sure the route is "Published" (not just "Assigned")
- Verify the route is for today's day of week
- Check that the driver is assigned to the route

### Clock in/out not working
- Driver must be within the geofenced radius of a work location
- Check that Work Locations are configured with correct addresses
- Verify GPS is enabled on the driver's device

---

## Quick Reference

| Task | Where to Go | Action |
|------|-------------|--------|
| Upload delivery addresses | Delivery Stops | Click "Upload CSV" |
| Schedule stops for a day | Delivery Stops | Click day buttons on each stop |
| Create routes | Routes | Click "Generate Routes" |
| Assign a driver | Routes | Click "Assign Driver" on route card |
| Make routes visible to drivers | Routes | Click "Publish All Routes" |
| Add a new driver | Drivers | Click "Add User" |
| View driver hours | Time Tracking | View table or export CSV |
| Set up clock-in location | Work Locations | Click "Add Location" |

---

## Data Reference

### Current Warehouse
- Address: 583 Frederick Road, Catonsville, MD 21228
- All routes automatically start and end here

### CSV Upload Format
```
customer_name,address,service_type,notes
"Restaurant ABC","123 Main St, Baltimore, MD 21201","Full Service","Back entrance"
```

Required: `customer_name`, `address`
Optional: `service_type`, `notes`
