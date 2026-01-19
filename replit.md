# Grizzly Mats Driver Management App

## Overview
A mobile-optimized web application for managing mat delivery driver schedules, GPS-verified time tracking, and route optimization. Built with a Light Glass UI (glassmorphism) design aesthetic featuring frosted glass effects, purple/cyan gradient accents, and premium visual styling.

## Demo Credentials
- **Admin**: username: `admin`, password: `admin123`
- **Driver**: username: `driver1`, password: `driver123`

## Project Architecture

### Frontend (React + TypeScript)
- **Framework**: React with Vite
- **Styling**: Tailwind CSS with Light Glass UI design system
- **Design System**: Glassmorphism with frosted effects, purple/cyan gradients, and backdrop blur
- **State Management**: TanStack Query for server state, localStorage for UI preferences
- **Routing**: Wouter
- **UI Components**: Custom components with Shadcn/UI primitives (glass-styled)

### State Persistence
UI preferences persist across navigation using localStorage:
- **Routes Page**: View mode (list/map/calendar), day filter, status tab, calendar date
- **Delivery Stops Page**: View mode (cards/list), day filter
- **Calendar Page**: View mode (weekly/monthly), current date
- **Admin Sidebar**: Nav item order (drag-and-drop reorderable), Team & Settings collapsed state

### Backend (Node.js + Express)
- **API**: RESTful API with Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **File Upload**: Multer for CSV file handling
- **CSV Parsing**: csv-parse library

### Database Schema
- `users` - Drivers and administrators
- `locations` - Delivery stop locations (from CSV uploads)
- `routes` - Assigned routes with stops in JSON format
- `time_entries` - Clock in/out records with GPS coordinates
- `work_locations` - Geofenced locations for GPS verification
- `materials` - Inventory of materials/services (mats, supplies, etc.)
- `location_materials` - Junction table linking materials to locations with quantity and day-specific support

## Key Features

### Admin Dashboard
1. **Delivery Stops Management**
   - CSV upload for delivery locations with automatic geocoding
   - Multi-day scheduling per location (assign Mon-Sun toggles)
   - Locations can be assigned to multiple days (e.g., Tuesday AND Friday)
   - Search and filter delivery stops

2. **Confirm Locations** (Route Generation Workflow)
   - Select a date and review stops scheduled for that day
   - Toggle individual stops to include/exclude from route generation
   - **Generate Routes** button opens dialog to auto-create optimized routes
   - **Build Manually** button to manually assign locations to driver routes
   - Auto-generate optimized routes using K-means clustering + nearest-neighbor algorithm
   - Google Routes API integration for optimal waypoint ordering
   - **Routes automatically start and end at the Warehouse** (configured in Work Locations)
   - **Date-specific scheduling**: Routes are generated for specific dates (not recurring weekly)

3. **Route Management** (Driver Assignment & Viewing)
   - **List View**: Cards showing routes grouped by status (draft/assigned/published)
   - **Map View**: Interactive map with colored markers per route
   - **Calendar View**: Monthly calendar showing routes by date
   - Move stops up/down within a route or reassign to different drivers
   - Assign drivers to routes
   - Publish routes for drivers to see
   - Delete routes when needed

4. **Calendar View** (Separate Page)
   - Weekly view (default) showing routes per driver per day
   - Monthly view with route summaries per day
   - **Routes appear only on their specific scheduled date** (not every occurrence of that day)
   - Color-coded routes by driver
   - Navigation controls (back, forward, today)

5. **Driver Management**
   - Add/remove drivers and admins
   - View all team members

6. **Time Tracking**
   - View all clock in/out entries
   - Export to CSV for payroll

7. **Work Locations**
   - Configure geofenced locations with auto-geocoding from address
   - Set GPS verification radius (default 100m)

8. **Materials Management**
   - Add, edit, delete materials/services inventory
   - Organize materials by category
   - Assign materials to locations via customer detail dialog
   - View materials required at each delivery stop

9. **Customer Detail Dialog**
   - Click on customer name to open detail dialog
   - View location info, scheduled days, and assigned materials
   - Admin can assign/remove materials from the dialog

### Driver Mobile View
1. **Schedule**
   - View assigned route for the day
   - Numbered stop list with customer info
   - One-tap Google Maps navigation

2. **Time Clock**
   - GPS-verified clock in/out
   - Must be within geofenced work location
   - Visual status indicators

3. **Profile**
   - View account info
   - Log out

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login

### Users
- `GET /api/users` - Get all users
- `POST /api/users` - Create user
- `DELETE /api/users/:id` - Delete user

### Locations
- `GET /api/locations` - Get delivery locations
- `PATCH /api/locations/:id` - Update location (e.g., daysOfWeek assignments)
- `DELETE /api/locations/:id` - Delete a location
- `POST /api/locations/upload` - Upload CSV file

### Routes
- `GET /api/routes` - Get all routes (optional: ?driverId=, ?dayOfWeek=)
- `POST /api/routes/generate` - Generate routes from locations (body: { driverCount, dayOfWeek, scheduledDate })
- `PATCH /api/routes/:id/assign` - Assign driver to route
- `PATCH /api/routes/:id/stops` - Update stop order within a route
- `POST /api/routes/move-stop` - Move stop from one route to another
- `POST /api/routes/publish` - Publish all assigned routes
- `POST /api/routes/unpublish` - Unpublish all published routes (returns to assigned status)
- `POST /api/routes/unpublish?date=YYYY-MM-DD` - Unpublish routes for a specific date
- `PATCH /api/routes/:id/unpublish` - Unpublish a single route

### Config
- `GET /api/config/maps-key` - Get Google Maps API key for frontend

### Time Entries
- `GET /api/time-entries` - Get all entries
- `GET /api/time-entries/today` - Get today's entry for driver
- `POST /api/time-entries/clock-in` - Clock in with GPS
- `POST /api/time-entries/clock-out` - Clock out with GPS

### Work Locations
- `GET /api/work-locations` - Get work locations
- `POST /api/work-locations` - Create work location
- `DELETE /api/work-locations/:id` - Delete work location

### Materials
- `GET /api/materials` - Get all materials
- `POST /api/materials` - Create a material
- `PATCH /api/materials/:id` - Update a material
- `DELETE /api/materials/:id` - Delete a material

### Location Materials
- `GET /api/locations/:locationId/materials` - Get materials for a location
- `POST /api/locations/:locationId/materials` - Assign material to location (body: { materialId, quantity?, daysOfWeek? })
- `DELETE /api/location-materials/:id` - Remove material assignment

## CSV Upload Format
Required columns:
- `address` - Delivery address
- `customer_name` - Customer name

Optional columns:
- `service_type` - Type of service
- `notes` - Additional notes
- `materials` - Comma-separated list of materials (e.g., "Logo Mat, Anti-Fatigue Mat, Paper Towels"). Materials are auto-created if they don't exist.

## Running the Project
```bash
npm run dev
```

## Database Commands
```bash
npm run db:push    # Push schema changes
npx tsx server/seed.ts  # Seed demo data
```

## Design Guidelines
The app follows Apple Human Interface Guidelines with:
- Clean white background
- System font stack (SF Pro Display)
- Large touch targets (48-56px)
- Card-based layouts
- Minimal UI with clear labels
- Green for Clock In, Red for Clock Out
- Blue for primary actions
