# Grizzly Mats Driver Management App

## Overview
A mobile-optimized web application for managing mat delivery driver schedules, GPS-verified time tracking, and route optimization. Built with an Apple-inspired design aesthetic.

## Demo Credentials
- **Admin**: username: `admin`, password: `admin123`
- **Driver**: username: `driver1`, password: `driver123`

## Project Architecture

### Frontend (React + TypeScript)
- **Framework**: React with Vite
- **Styling**: Tailwind CSS with Apple-inspired design system
- **State Management**: TanStack Query for server state
- **Routing**: Wouter
- **UI Components**: Custom components with Shadcn/UI primitives

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

## Key Features

### Admin Dashboard
1. **Route Management**
   - CSV upload for delivery locations with automatic geocoding
   - Auto-generate optimized routes using K-means clustering + nearest-neighbor algorithm
   - Google Routes API integration for optimal waypoint ordering
   - Interactive Map View with colored markers per route
   - Move stops up/down within a route or reassign to different drivers
   - Assign drivers to routes
   - Publish routes for drivers to see

2. **Driver Management**
   - Add/remove drivers and admins
   - View all team members

3. **Time Tracking**
   - View all clock in/out entries
   - Export to CSV for payroll

4. **Work Locations**
   - Configure geofenced locations
   - Set GPS verification radius (default 100m)

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
- `POST /api/locations/upload` - Upload CSV file

### Routes
- `GET /api/routes` - Get all routes (optional: ?driverId=, ?dayOfWeek=)
- `POST /api/routes/generate` - Generate routes from locations (body: { driverCount, dayOfWeek })
- `PATCH /api/routes/:id/assign` - Assign driver to route
- `PATCH /api/routes/:id/stops` - Update stop order within a route
- `POST /api/routes/move-stop` - Move stop from one route to another
- `POST /api/routes/publish` - Publish all assigned routes

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

## CSV Upload Format
Required columns:
- `address` - Delivery address
- `customer_name` - Customer name

Optional columns:
- `service_type` - Type of service
- `notes` - Additional notes

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
