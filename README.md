# CP_SEP490_BusDN

BusDN is a modern bus transportation management system for ticket booking, route operations, real-time tracking, passenger services, staff workflows, and admin reporting.

## Project Overview

The system is built as a modular web and mobile platform:

- **Frontend:** React, Vite, Tailwind CSS
- **Mobile:** Expo, React Native, Expo Router
- **Backend:** Node.js, Express, MongoDB, Mongoose
- **Real-time:** Socket.IO
- **State management:** Zustand
- **Authentication:** JWT-based authentication with email/phone verification

## Project Structure

```text
CP_SEP490_BusDN/
+-- Backend/                 # Express.js backend
|   +-- src/
|   |   +-- modules/         # Feature modules
|   |   +-- middleware/      # Express middlewares
|   |   +-- config/          # App configuration
|   |   +-- utils/           # Shared utilities
|   |   +-- constants/       # Shared constants
|   |   +-- app.js           # Express app factory
|   |   +-- server.js        # Server entry point
|   +-- package.json
|   +-- .env.local
|
+-- Frontend/                # React + Vite frontend
|   +-- src/
|   |   +-- features/        # Feature modules
|   |   +-- shared/          # Shared components and utilities
|   |   +-- App.jsx
|   |   +-- main.jsx
|   +-- package.json
|   +-- .env.local
|
+-- Mobile/                  # Expo mobile app
|   +-- app/                 # Expo Router screens
|   +-- src/                 # Mobile source code
|   +-- app.json
|   +-- package.json
|   +-- .env.example
|
+-- AUTH_DOCUMENTATION.md
+-- AUTH_QUICK_REFERENCE.md
+-- README.md
```

## Key Features

- Passenger registration, login, and profile management
- Route search and ticket purchase
- Ticket and transaction history
- Promotion campaign management
- Payment order handling
- Driver and bus assistant workflows
- QR ticket validation
- Route, schedule, vehicle, and staff management
- Lost item reporting
- Feedback management
- Admin dashboards and revenue reporting
- Real-time tracking and notifications

## Authentication

The authentication system supports:

- Email or phone registration
- OTP verification
- JWT access tokens
- Password reset flow
- Password change for authenticated users
- Role-based access control
- Account lock and unlock
- Protected frontend routes

See [AUTH_DOCUMENTATION.md](./AUTH_DOCUMENTATION.md) for more details.

## User Roles

- `PASSENGER`
- `DRIVER`
- `BUS_ASSISTANT`
- `CONDUCTOR`
- `STAFF`
- `FINANCE`
- `ADMIN`

## Prerequisites

- Node.js 20.x is recommended
- npm
- MongoDB Atlas or a local MongoDB instance
- Expo tooling for the mobile app

## Backend Setup

```bash
cd Backend
npm install
cp .env.example .env.local
npm run dev
```

The backend runs at:

```text
http://localhost:3000
```

Required backend environment variables:

```env
NODE_ENV=development
PORT=3000
HOST=localhost

MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/dbname
DATABASE_NAME=BusDN

JWT_SECRET=your_secret_key_here
JWT_EXPIRE=7d
JWT_REFRESH_EXPIRE=30d

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
EMAIL_FROM=noreply@busdn.com

SESSION_SECRET=session_secret_here
CORS_ORIGIN=http://localhost:5173

UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
```

## Frontend Setup

```bash
cd Frontend
npm install
echo "VITE_API_BASE_URL=http://localhost:3000/api" > .env.local
npm run dev
```

The frontend runs at:

```text
http://localhost:5173
```

## Mobile Setup

```bash
cd Mobile
npm install
npx expo start
```

Create a local `.env` file from `.env.example` if the mobile app requires API configuration.

## Available Scripts

### Backend

```bash
npm run start
npm run dev
npm run test
npm run seed
```

### Frontend

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run lint:fix
npm run test
npm run test:ui
```

### Mobile

```bash
npm run start
npm run android
npm run ios
npm run web
npm run typecheck
```

## Main API Endpoints

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/verify-otp`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/change-password`
- `PUT /api/auth/profile`

### Bus Stops

- `GET /api/bus-stops`
- `GET /api/bus-stops/:id`
- `POST /api/bus-stops/import`
- `POST /api/bus-stops/sync`
- `GET /api/bus-stops/export/csv`

The project can import Da Nang bus stops from a configured EcoBus/DanaBus endpoint:

```env
DANABUS_STOP_API_URL=https://ecobus.danang.gov.vn/api/api/BusStop/GetListBusStop
```

Only valid stops inside Da Nang are imported. Invalid rows are skipped and logged.

## Testing

Backend:

```bash
cd Backend
npm run test
```

Frontend:

```bash
cd Frontend
npm run test
```

Mobile:

```bash
cd Mobile
npm run typecheck
```

## Deployment

Backend:

```bash
cd Backend
npm run start
```

Frontend:

```bash
cd Frontend
npm run build
```

Deploy `Frontend/dist/` to a static hosting provider such as Vercel, Firebase Hosting, or Netlify.

## Architecture Principles

- Modular monolith structure
- Feature-based organization
- Service layer for business logic
- Reusable shared utilities
- Server-side validation
- Role-based authorization
- Clear separation between frontend, backend, and mobile app

## Notes

- Do not commit real credentials, API keys, or production secrets.
- Keep environment-specific values in `.env.local` or `.env`.
- Use example files only for safe placeholder values.

## License

MIT License. This project is intended for educational and development purposes.

## Status

Version: `0.1.0`

Status: In development
