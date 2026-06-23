import { z } from 'zod';

export const genderOptions = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

export const profileFormSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  email: z.string().trim().email('Enter a valid email address'),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^(\+84|0)[0-9]{9,10}$/, 'Enter a valid Vietnamese phone number'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']),
  dateOfBirth: z.string().optional(),
  address: z.string().trim().max(250, 'Address must be less than 250 characters'),
  notificationEnabled: z.boolean(),
  notificationTypes: z.object({
    arrivalAlerts: z.boolean(),
    delayAlerts: z.boolean(),
    routeChangeAlerts: z.boolean(),
    tripUpdates: z.boolean(),
    accountUpdates: z.boolean(),
  }),
});

export const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must include an uppercase letter')
      .regex(/[a-z]/, 'Password must include a lowercase letter')
      .regex(/\d/, 'Password must include a number')
      .regex(/[@$!%*?&]/, 'Password must include a special character'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'Password confirmation does not match',
    path: ['confirmPassword'],
  });

export const defaultProfileValues = {
  fullName: '',
  email: '',
  phoneNumber: '',
  gender: 'PREFER_NOT_TO_SAY',
  dateOfBirth: '',
  address: '',
  notificationEnabled: true,
  notificationTypes: {
    arrivalAlerts: true,
    delayAlerts: true,
    routeChangeAlerts: true,
    tripUpdates: true,
    accountUpdates: true,
  },
};
