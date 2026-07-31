# BusDN Mobile

Initial Expo mobile app for BusDN authentication.

## Stack

- Node.js target: `20.19.x`
- Expo SDK: `55`
- React Native: `0.83`
- React: `19.2`
- Routing: `expo-router`
- HTTP client: `axios`
- Auth token storage: `expo-secure-store`
- State: `zustand`

## Auth Flow

The mobile app mirrors the existing web auth flow:

- Register: `POST /auth/register`
- Verify registration OTP: `POST /auth/verify-otp`
- Resend OTP: `POST /auth/resend-otp`
- Login: `POST /auth/login`
- Logout: `POST /auth/logout`
- Restore user session from SecureStore on app launch

Registration does not log the user in immediately. The backend creates an unverified account and requires OTP verification before login.

## API Configuration

Create a local `.env` file from `.env.example`:

```bash
EXPO_PUBLIC_API_URL=https://cp-sep490-busdn.onrender.com/api
EXPO_PUBLIC_SOCKET_URL=https://cp-sep490-busdn.onrender.com
```

The Render API URL is the default fallback in `src/constants/config.ts`, so the app does not need localhost or a LAN IP for normal Expo Go testing.

Requirements for testing on a phone:

- The Render backend is deployed and healthy.
- `EXPO_PUBLIC_API_URL` includes `/api`.
- Socket.IO clients should use `EXPO_PUBLIC_SOCKET_URL` without `/api`.

Example:

```bash
EXPO_PUBLIC_API_URL=https://cp-sep490-busdn.onrender.com/api
EXPO_PUBLIC_SOCKET_URL=https://cp-sep490-busdn.onrender.com
```

## Run

```bash
cd Mobile
npm install
npx expo start -c
```

Scan the QR code with Expo Go.

## Project Structure

```text
Mobile/
  app/
    _layout.tsx
    index.tsx
    auth/
      login.tsx
      register.tsx
      verify-otp.tsx
    home.tsx
  src/
    api/
      client.ts
      auth.api.ts
    components/
      AppButton.tsx
      AppInput.tsx
      Screen.tsx
    constants/
      config.ts
      colors.ts
    store/
      auth.store.ts
    types/
      auth.ts
    utils/
      validation.ts
  app.json
  package.json
  tsconfig.json
  README.md
```
