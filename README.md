# CP_SEP490_BusDN - Veridian Transit Platform

Modern bus transportation booking system with real-time tracking, ticketing, and comprehensive fleet management.

## 🎯 Project Overview

This is a complete rewrite of the BusDN system with improved architecture, scalability, and maintainability. The system is built with:

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express + MongoDB
- **Real-time:** Socket.IO for live tracking and notifications
- **State Management:** Zustand for frontend state
- **Authentication:** JWT-based with email/phone verification

## 📁 Project Structure

```
CP_SEP490_BusDN/
├── Backend/              # Express.js backend
│   ├── src/
│   │   ├── modules/      # Feature modules (auth, routes, bookings, etc.)
│   │   ├── middleware/   # Express middlewares
│   │   ├── config/       # Configuration
│   │   ├── utils/        # Utility functions
│   │   ├── constants/    # Constants
│   │   ├── app.js        # Express app factory
│   │   └── server.js     # Server entry point
│   ├── package.json
│   └── .env.local        # Environment variables
│
├── Frontend/             # React + Vite frontend
│   ├── src/
│   │   ├── features/     # Feature modules (auth, routes, bookings, etc.)
│   │   ├── shared/       # Shared components and utilities
│   │   ├── App.jsx       # Main app component
│   │   └── main.jsx      # Entry point
│   ├── package.json
│   └── .env.local        # Environment variables
│
├── AUTH_DOCUMENTATION.md # Complete auth system docs
├── AUTH_QUICK_REFERENCE.md # Quick reference guide
└── README.md             # This file
```

## 🔐 Authentication System

The system includes a complete authentication system with:

✅ **User Registration**
- Email or phone-based registration
- OTP email verification
- Strong password requirements
- Multi-step registration flow

✅ **User Login**
- Email or phone login
- JWT token-based authentication
- 7-day token expiration
- Session persistence

✅ **Password Management**
- Secure password hashing (bcryptjs)
- Password reset with OTP verification
- Change password (authenticated users)
- Password strength requirements

✅ **User Management**
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

## 🚀 Getting Started

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

## 📝 Available Scripts

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

## 🔑 Key API Endpoints

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

### Future Endpoints

- `/api/routes` - Route management
- `/api/buses` - Bus management
- `/api/bookings` - Ticket booking
- `/api/trips` - Trip management
- `/api/tracking` - Real-time tracking
- `/api/admin` - Admin operations

## 🎨 Frontend Features

### Components

- ✅ **AuthShell** - Shared authentication layout
- ✅ **Login** - Complete login flow with password reset
- ✅ **Register** - Multi-step registration process
- ✅ **ProtectedRoute** - Route protection based on auth status
- ✅ **AdminRoute** - Admin-only route protection

### State Management

- Zustand store for auth state
- Persistent storage (localStorage)
- Automatic session restoration
- Centralized error handling

### Hooks

- `useAuth()` - Main authentication hook
- `useAuthStore()` - Direct store access

## 🛡️ Security Features

1. **JWT Authentication** - Stateless token-based auth
2. **Password Hashing** - bcryptjs with 10 rounds
3. **OTP Verification** - Time-limited OTP codes
4. **Rate Limiting** - Prevent brute force attacks
5. **CORS Protection** - Domain-based access control
6. **Helmet.js** - HTTP security headers
7. **Input Validation** - Server-side validation
8. **Error Handling** - Secure error messages

## 📊 User Roles

- `PASSENGER` - Regular user for booking tickets
- `DRIVER` - Bus driver
- `CONDUCTOR` - Bus conductor
- `ASSISTANT` - Administrative assistant
- `ADMIN` - System administrator
- `STAFF` - Staff member
- `FINANCE` - Finance department

## 🌐 Environment Variables

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

## 📚 Documentation

- [AUTH_DOCUMENTATION.md](./AUTH_DOCUMENTATION.md) - Complete authentication system documentation
- [AUTH_QUICK_REFERENCE.md](./AUTH_QUICK_REFERENCE.md) - Quick reference guide for developers

## 🔄 Code Reuse from Old Project

The new project reuses valuable patterns from BusDN_SE18C02:

- ✅ User authentication logic
- ✅ Password validation rules
- ✅ Socket.IO connection patterns
- ✅ UI component layouts
- ✅ API response formatting
- ✅ Error handling patterns
- ✅ Database schema structures

Improvements made:

- 🎯 Better module organization
- 🎯 Cleaner separation of concerns
- 🎯 Enhanced code reusability
- 🎯 Better type safety with DTOs
- 🎯 Improved error handling
- 🎯 Modern React patterns (hooks, Zustand)
- 🎯 Better state management
- 🎯 Scalable architecture

## 🚧 Implementation Roadmap

### Phase 1: Core Auth ✅
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

## 🧪 Testing

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

## 📦 Deployment

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

## 🤝 Architecture Principles

1. **Clean Architecture** - Separation of concerns
2. **Modular Monolith** - Feature-based modules
3. **Microservice-Ready** - Can be split into microservices
4. **DRY (Don't Repeat Yourself)** - Reusable code
5. **SOLID Principles** - Clean code practices
6. **Service Layer Pattern** - Business logic separation
7. **Repository Pattern** - Data access abstraction
8. **DTO Pattern** - Data transformation

## 🔗 Technologies

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

## 📞 Support & Contributing

For issues or questions:

1. Check documentation in AUTH_DOCUMENTATION.md
2. Review error messages in browser/server logs
3. Verify environment variables are set correctly
4. Ensure MongoDB is connected
5. Check API base URL configuration

## 📄 License

MIT License - feel free to use this project for educational purposes

## 👨‍💻 Development Team

- Backend Development
- Frontend Development
- UI/UX Design
- Testing & QA

---

**Created:** January 2024
**Version:** 0.1.0
**Status:** In Development
