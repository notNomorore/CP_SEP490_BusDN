export type UserRole = 'PASSENGER' | 'ADMIN' | 'DRIVER' | 'CONDUCTOR' | string;

export type AuthUser = {
  id: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  fullName: string;
  avatar?: string;
  role: UserRole;
  status?: string;
  isVerified?: boolean;
  isFirstLogin?: boolean;
  walletBalance?: number;
  notificationEnabled?: boolean;
  monthlyPassStatus?: string;
  monthlyPassExpireDate?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type TicketStatistics = {
  totalTrips: number;
  tripsThisMonth: number;
  amountSpent: number;
  favoriteRouteNumber?: string | null;
  favoriteRouteTrips: number;
};

export type MonthlyPass = {
  status?: string;
  expireDate?: string;
  isActive: boolean;
  ridesThisMonth: number;
};

export type UserProfile = AuthUser & {
  monthlyPass?: MonthlyPass;
  ticketStatistics?: TicketStatistics;
  recentTravelHistory?: unknown[];
};

export type LoginResponse = {
  success: boolean;
  message: string;
  token: string;
  user: AuthUser;
};

export type RegisterPayload = {
  fullName: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  password: string;
  confirmPassword: string;
};

export type RegisterResponse = {
  success: boolean;
  message: string;
  userId: string;
  expiresAt?: string;
};

export type VerifyOtpPayload = {
  email?: string;
  phone?: string;
  phoneNumber?: string;
  otp: string;
};

export type VerifyOtpResponse = {
  success: boolean;
  message: string;
  user: AuthUser;
};

export type PendingRegistrationOtp = {
  email?: string;
  phone?: string;
  identifier: string;
  expiresAt?: string;
};
