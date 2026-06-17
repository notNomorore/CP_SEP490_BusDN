# CP_SEP490_BusDN
nguyennhatminhnau@gmail.com |@Minh123| admin
huhuhichic64@gmail.com | @Minh123 | khách
skykidclone80@gmail.com / @Minh123
Modern bus transportation booking system with real-time tracking, ticketing, and comprehensive fleet management.

## ðŸŽ¯ Project Overview

This is a complete rewrite of the BusDN system with improved architecture, scalability, and maintainability. The system is built with:

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express + MongoDB
- **Real-time:** Socket.IO for live tracking and notifications
- **State Management:** Zustand for frontend state
- **Authentication:** JWT-based with email/phone verification

## ðŸ“ Project Structure

```
CP_SEP490_BusDN/
â”œâ”€â”€ Backend/              # Express.js backend
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ modules/      # Feature modules (auth, routes, bookings, etc.)
â”‚   â”‚   â”œâ”€â”€ middleware/   # Express middlewares
â”‚   â”‚   â”œâ”€â”€ config/       # Configuration
â”‚   â”‚   â”œâ”€â”€ utils/        # Utility functions
â”‚   â”‚   â”œâ”€â”€ constants/    # Constants
â”‚   â”‚   â”œâ”€â”€ app.js        # Express app factory
â”‚   â”‚   â””â”€â”€ server.js     # Server entry point
â”‚   â”œâ”€â”€ package.json
â”‚   â””â”€â”€ .env.local        # Environment variables
â”‚
â”œâ”€â”€ Frontend/             # React + Vite frontend
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ features/     # Feature modules (auth, routes, bookings, etc.)
â”‚   â”‚   â”œâ”€â”€ shared/       # Shared components and utilities
â”‚   â”‚   â”œâ”€â”€ App.jsx       # Main app component
â”‚   â”‚   â””â”€â”€ main.jsx      # Entry point
â”‚   â”œâ”€â”€ package.json
â”‚   â””â”€â”€ .env.local        # Environment variables
â”‚
â”œâ”€â”€ AUTH_DOCUMENTATION.md # Complete auth system docs
â”œâ”€â”€ AUTH_QUICK_REFERENCE.md # Quick reference guide
â””â”€â”€ README.md             # This file
```

## ðŸ” Authentication System

The system includes a complete authentication system with:

âœ… **User Registration**
- Email or phone-based registration
- OTP email verification
- Strong password requirements
- Multi-step registration flow

âœ… **User Login**
- Email or phone login
- JWT token-based authentication
- 7-day token expiration
- Session persistence

âœ… **Password Management**
- Secure password hashing (bcryptjs)
- Password reset with OTP verification
- Change password (authenticated users)
- Password strength requirements

âœ… **User Management**
- Role-based access control (RBAC)
- User profiles with avatars
- Wallet/balance tracking
- Priority group management
- Account lock/unlock

### Key Features

- **Security:** Passwords hashed with 10 salt rounds
- **Rate Limiting:** 5 auth attempts per 15 minutes
- **OTP Expiry:** 10-minute OTP validity
- **CORS:** Properly configured for frontend domain
- **Error Handling:** Comprehensive error messages

See [AUTH_DOCUMENTATION.md](./AUTH_DOCUMENTATION.md) for complete details.

## ðŸš€ Getting Started

### Prerequisites

- Node.js 18+
- MongoDB Atlas account
- npm or yarn

### Backend Setup

```bash
cd Backend

# Install dependencies
npm install -g commitizen

# Create .env.local file
cp .env.example .env.local

# Edit .env.local with your configuration
# Required variables:
# - MONGODB_URI
# - JWT_SECRET
# - SMTP credentials (for email)

# Start development server
npm run dev
```

Backend runs on `http://localhost:3000`

### Frontend Setup

```bash
cd Frontend

# Install dependencies
npm install

# Create .env.local file
echo "VITE_API_BASE_URL=http://localhost:3000/api" > .env.local

# Start development server
npm run dev
```

Frontend runs on `http://localhost:5173`

## ðŸ“ Available Scripts

### Backend

```bash
npm run start   # Start production server
npm run dev     # Start development server with hot reload
npm run test    # Run tests
npm run seed    # Seed database with sample data
```

### Frontend

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint errors
npm run test         # Run tests
npm run test:ui      # Run tests with UI
```

## ðŸ”‘ Key API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/verify-otp` - Verify email with OTP
- `POST /api/auth/login` - Login user
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with OTP
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user (protected)
- `POST /api/auth/change-password` - Change password (protected)
- `PUT /api/auth/profile` - Update profile (protected)

### Da Nang Bus Stops

- `GET /api/bus-stops` - List active Da Nang bus stops. Supports `search`, `district`, `routeId`, `source`.
- `GET /api/bus-stops/:id` - Get one bus stop with linked routes.
- `POST /api/bus-stops/import` - Admin import from configured DanaBus/EcoBus endpoint or posted `stops`.
- `POST /api/bus-stops/sync` - Admin sync from `DANABUS_STOP_API_URL`.
- `GET /api/bus-stops/export/csv` - Admin CSV export with columns `stop_code,stop_name,address,latitude,longitude,district,ward,routes,source`.

The live project uses MongoDB/Mongoose, so imported stops are saved into `RouteStation`. This lets the existing admin route creation screen use imported Da Nang stops immediately.

#### Configuring DanaBus/EcoBus import

The current official/public stop endpoint discovered from EcoBus/DanaBus is:

```text
https://ecobus.danang.gov.vn/api/api/BusStop/GetListBusStop
```

Set `DANABUS_STOP_API_URL` in `Backend/.env.local` if the endpoint changes. Do not hardcode sample stops.

To find the endpoint:

1. Open the official DanaBus/EcoBus web app in Chrome or Edge.
2. Open DevTools with `F12`, then go to the `Network` tab.
3. Filter requests by `Fetch/XHR`.
4. Use the site feature that lists stops, searches stops, shows nearby stops, or opens route details.
5. Look for JSON responses containing fields such as stop id/code/name/address/latitude/longitude.
6. Copy the request URL and configure it as `DANABUS_STOP_API_URL`.
7. Restart the backend and run `POST /api/bus-stops/sync` from the DanaBus station catalog inside `/admin/routes`.

Only stops inside Da Nang are imported. The bounding box is latitude `15.85..16.25` and longitude `107.95..108.35`. Invalid rows are skipped and written into `BusStopSyncLog` with a reason.

### Future Endpoints

- `/api/routes` - Route management
- `/api/buses` - Bus management
- `/api/bookings` - Ticket booking
- `/api/trips` - Trip management
- `/api/tracking` - Real-time tracking
- `/api/admin` - Admin operations

## ðŸŽ¨ Frontend Features

### Components

- âœ… **AuthShell** - Shared authentication layout
- âœ… **Login** - Complete login flow with password reset
- âœ… **Register** - Multi-step registration process
- âœ… **ProtectedRoute** - Route protection based on auth status
- âœ… **AdminRoute** - Admin-only route protection

### State Management

- Zustand store for auth state
- Persistent storage (localStorage)
- Automatic session restoration
- Centralized error handling

### Hooks

- `useAuth()` - Main authentication hook
- `useAuthStore()` - Direct store access

## ðŸ›¡ï¸ Security Features

1. **JWT Authentication** - Stateless token-based auth
2. **Password Hashing** - bcryptjs with 10 rounds
3. **OTP Verification** - Time-limited OTP codes
4. **Rate Limiting** - Prevent brute force attacks
5. **CORS Protection** - Domain-based access control
6. **Helmet.js** - HTTP security headers
7. **Input Validation** - Server-side validation
8. **Error Handling** - Secure error messages

## ðŸ“Š User Roles

- `PASSENGER` - Regular user for booking tickets
- `DRIVER` - Bus driver
- `CONDUCTOR` - Bus conductor
- `ASSISTANT` - Administrative assistant
- `ADMIN` - System administrator
- `STAFF` - Staff member
- `FINANCE` - Finance department

## ðŸŒ Environment Variables

### Backend (.env.local)

```
# Server
NODE_ENV=development
PORT=3000
HOST=localhost

# Database
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/dbname
DATABASE_NAME=BusDN

# JWT
JWT_SECRET=your_secret_key_here
JWT_EXPIRE=7d
JWT_REFRESH_EXPIRE=30d

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_password
EMAIL_FROM=noreply@busdn.com

# Session
SESSION_SECRET=session_secret_here

# CORS
CORS_ORIGIN=http://localhost:5173

# Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880

# Stripe (optional)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLIC_KEY=pk_test_...

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=debug
```

### Frontend (.env.local)

```
VITE_API_BASE_URL=http://localhost:3000/api
```

## ðŸ“š Documentation

- [AUTH_DOCUMENTATION.md](./AUTH_DOCUMENTATION.md) - Complete authentication system documentation
- [AUTH_QUICK_REFERENCE.md](./AUTH_QUICK_REFERENCE.md) - Quick reference guide for developers

## ðŸ”„ Code Reuse from Old Project

The new project reuses valuable patterns from BusDN_SE18C02:

- âœ… User authentication logic
- âœ… Password validation rules
- âœ… Socket.IO connection patterns
- âœ… UI component layouts
- âœ… API response formatting
- âœ… Error handling patterns
- âœ… Database schema structures

Improvements made:

- ðŸŽ¯ Better module organization
- ðŸŽ¯ Cleaner separation of concerns
- ðŸŽ¯ Enhanced code reusability
- ðŸŽ¯ Better type safety with DTOs
- ðŸŽ¯ Improved error handling
- ðŸŽ¯ Modern React patterns (hooks, Zustand)
- ðŸŽ¯ Better state management
- ðŸŽ¯ Scalable architecture

## ðŸš§ Implementation Roadmap

### Phase 1: Core Auth âœ…
- [x] User registration and verification
- [x] Login and logout
- [x] Password reset flow
- [x] Token management
- [x] Protected routes

### Phase 2: Route Management
- [ ] Route CRUD operations
- [ ] Stop management
- [ ] Schedule management
- [ ] Fare matrix

### Phase 3: Booking System
- [ ] Ticket booking
- [ ] Payment integration
- [ ] Booking history
- [ ] Ticket validation

### Phase 4: Fleet Management
- [ ] Bus management
- [ ] Driver assignment
- [ ] Trip scheduling
- [ ] Maintenance tracking

### Phase 5: Real-time Features
- [ ] Live tracking
- [ ] Real-time notifications
- [ ] Trip updates
- [ ] Incident alerts

### Phase 6: Analytics
- [ ] Trip analytics
- [ ] Revenue reports
- [ ] User statistics
- [ ] Performance metrics

## ðŸ§ª Testing

### Backend Tests
```bash
cd Backend
npm run test
npm run test:coverage
```

### Frontend Tests
```bash
cd Frontend
npm run test
npm run test:ui
```

## ðŸ“¦ Deployment

### Backend (Node.js)
```bash
# Build
npm run build

# Start
npm run start
```

### Frontend (Static)
```bash
# Build
npm run build

# Output: Frontend/dist/
# Deploy to any static hosting (Vercel, Firebase, etc.)
```

## ðŸ¤ Architecture Principles

1. **Clean Architecture** - Separation of concerns
2. **Modular Monolith** - Feature-based modules
3. **Microservice-Ready** - Can be split into microservices
4. **DRY (Don't Repeat Yourself)** - Reusable code
5. **SOLID Principles** - Clean code practices
6. **Service Layer Pattern** - Business logic separation
7. **Repository Pattern** - Data access abstraction
8. **DTO Pattern** - Data transformation

## ðŸ”— Technologies

### Frontend
- React 18
- React Router 6
- Vite
- Tailwind CSS
- Zustand
- Axios
- Socket.IO Client
- date-fns

### Backend
- Node.js
- Express 5
- MongoDB with Mongoose
- JWT
- bcryptjs
- Socket.IO
- Nodemailer
- Redis (optional)
- Stripe (optional)

## ðŸ“ž Support & Contributing

For issues or questions:

1. Check documentation in AUTH_DOCUMENTATION.md
2. Review error messages in browser/server logs
3. Verify environment variables are set correctly
4. Ensure MongoDB is connected
5. Check API base URL configuration

## ðŸ“„ License

MIT License - feel free to use this project for educational purposes

## ðŸ‘¨â€ðŸ’» Development Team

- Backend Development
- Frontend Development
- UI/UX Design
- Testing & QA

---

**Created:** January 2024
**Version:** 0.1.0
**Status:** In Development
