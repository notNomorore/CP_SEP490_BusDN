import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import {
  Bell,
  BusFront,
  CalendarDays,
  Camera,
  ChevronRight,
  Clock3,
  CreditCard,
  LoaderCircle,
  LogOut,
  Mail,
  MapPinned,
  Phone,
  Route,
  Save,
  Sparkles,
} from 'lucide-react';
import Header from '../../../shared/components/navigation/Header.jsx';
import Footer from '../../../shared/components/common/Footer.jsx';
import useAuthStore from '../../auth/stores/authStore.js';
import ChangePasswordForm from '../components/ChangePasswordForm.jsx';
import ProfileSidebar from '../components/ProfileSidebar.jsx';
import ProfileSkeleton from '../components/ProfileSkeleton.jsx';
import SectionCard from '../components/SectionCard.jsx';
import profileService from '../services/profileService.js';
import {
  defaultProfileValues,
  genderOptions,
  profileFormSchema,
} from '../schemas/profileSchema.js';

const fieldClassName =
  'w-full rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-outline/70 focus:border-on-tertiary-container focus:ring-2 focus:ring-on-tertiary-container/20';

const statCards = (profile) => [
  {
    label: 'Total trips',
    value: profile.ticketStatistics?.totalTrips ?? 0,
    detail: 'Completed rides',
  },
  {
    label: 'This month',
    value: profile.ticketStatistics?.tripsThisMonth ?? 0,
    detail: 'Trips this month',
  },
  {
    label: 'Amount spent',
    value: `${(profile.ticketStatistics?.amountSpent ?? 0).toLocaleString()} VND`,
    detail: 'From ticket history',
  },
  {
    label: 'Top route',
    value: profile.ticketStatistics?.favoriteRouteNumber || 'N/A',
    detail: `${profile.ticketStatistics?.favoriteRouteTrips ?? 0} trips`,
  },
];

const getAvatarSource = (avatar) => {
  if (!avatar) {
    return '';
  }

  if (/^https?:\/\//i.test(avatar)) {
    return avatar;
  }

  const apiUrl = import.meta.env.VITE_API_URL?.trim() || 'http://localhost:3000';
  return `${apiUrl.replace(/\/$/, '')}${avatar.startsWith('/') ? avatar : `/${avatar}`}`;
};

const formatDateValue = (value) => {
  if (!value) {
    return 'Not updated';
  }

  try {
    return format(new Date(value), 'dd MMM yyyy');
  } catch {
    return 'Not updated';
  }
};

const notificationTypeOptions = [
  {
    name: 'arrivalAlerts',
    title: 'Bus arrival alerts',
    description: 'Notify when a subscribed bus is approaching or arriving at your selected stop.',
  },
  {
    name: 'delayAlerts',
    title: 'Delay alerts',
    description: 'Notify when a subscribed route has buses delayed beyond the expected schedule.',
  },
  {
    name: 'routeChangeAlerts',
    title: 'Route change alerts',
    description: 'Notify when subscribed routes have detours, stop changes, or temporary path updates.',
  },
  {
    name: 'tripUpdates',
    title: 'Trip updates',
    description: 'Notify about travel status, trip progress, and important passenger journey updates.',
  },
  {
    name: 'accountUpdates',
    title: 'Account updates',
    description: 'Notify about monthly pass, profile, security, and account-related changes.',
  },
];

const monthlyPassOptions = [
  { value: 'STANDARD', label: 'Standard monthly pass', price: 250000 },
  { value: 'STUDENT', label: 'Student monthly pass', price: 120000 },
  { value: 'PRIORITY', label: 'Priority monthly pass', price: 0 },
];

const formatCurrency = (value) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(value || 0);

const todayInputValue = () => new Date().toISOString().slice(0, 10);

const formatPassType = (value) => String(value || 'STANDARD')
  .toLowerCase()
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const MonthlyPassPurchaseModal = ({ pass, error, isSubmitting, onClose, onSubmit }) => {
  const [form, setForm] = useState({
    passType: 'STANDARD',
    startDate: todayInputValue(),
    validityMonths: 1,
    paymentMethod: 'E_WALLET',
  });
  const selectedOption = monthlyPassOptions.find((option) => option.value === form.passType) || monthlyPassOptions[0];
  const totalPrice = selectedOption.price * Number(form.validityMonths || 1);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-primary/40 px-4">
      <section className="w-full max-w-xl rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-outline-variant/40 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-tertiary-container">Purchase Monthly Pass</p>
            <h2 className="mt-2 text-2xl font-headline font-extrabold text-primary">Monthly transportation pass</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-outline hover:bg-surface-container">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(form);
          }}
          className="space-y-4 px-6 py-5"
        >
          <label className="space-y-2">
            <span className="text-sm font-bold text-primary">Pass type</span>
            <select
              value={form.passType}
              onChange={(event) => setForm((current) => ({ ...current, passType: event.target.value }))}
              className={fieldClassName}
            >
              {monthlyPassOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {formatCurrency(option.price)}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-bold text-primary">Start date</span>
              <input
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                className={fieldClassName}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-bold text-primary">Validity period</span>
              <select
                value={form.validityMonths}
                onChange={(event) => setForm((current) => ({ ...current, validityMonths: Number(event.target.value) }))}
                className={fieldClassName}
              >
                <option value={1}>1 month</option>
                <option value={3}>3 months</option>
                <option value={6}>6 months</option>
              </select>
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-bold text-primary">Payment method</span>
            <select
              value={form.paymentMethod}
              onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))}
              className={fieldClassName}
            >
              <option value="E_WALLET">E-wallet</option>
              <option value="CREDIT_CARD">Credit card</option>
              <option value="ONLINE_BANKING">Online banking</option>
            </select>
          </label>

          <div className="rounded-[22px] bg-primary-fixed px-5 py-4 text-sm text-on-primary-fixed">
            Pass price: <strong>{formatCurrency(totalPrice)}</strong>. The digital pass will be linked to your account after successful payment.
          </div>

          {error ? (
            <div className="rounded-[20px] border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
              {error}
            </div>
          ) : null}

          {pass ? (
            <div className="rounded-[20px] border border-on-tertiary-container/20 bg-tertiary-container px-4 py-3 text-sm text-on-tertiary-container">
              <p className="font-black">Monthly pass purchased successfully</p>
              <p className="mt-1">Code: {pass.passCode} - {pass.passType}</p>
              <p>Status: {pass.passStatus} - Payment: {pass.paymentStatus}</p>
            </div>
          ) : null}

          <div className="flex justify-end gap-3 border-t border-outline-variant/30 pt-4">
            <button type="button" onClick={onClose} className="rounded-full border border-outline-variant px-5 py-3 text-sm font-bold text-primary">
              Close
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Processing...' : 'Confirm purchase'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, syncUser, logout } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [favoriteRoutes, setFavoriteRoutes] = useState([]);
  const [favoriteStops, setFavoriteStops] = useState([]);
  const [monthlyPasses, setMonthlyPasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isNotificationSaving, setIsNotificationSaving] = useState(false);
  const [isMonthlyPassModalOpen, setIsMonthlyPassModalOpen] = useState(false);
  const [isMonthlyPassSaving, setIsMonthlyPassSaving] = useState(false);
  const [monthlyPassPurchase, setMonthlyPassPurchase] = useState(null);
  const [monthlyPassError, setMonthlyPassError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [errorMessage, setErrorMessage] = useState('');

  const overviewRef = useRef(null);
  const favoritesRef = useRef(null);
  const passRef = useRef(null);
  const statisticsRef = useRef(null);
  const historyRef = useRef(null);
  const securityRef = useRef(null);
  const notificationsRef = useRef(null);

  const sectionMap = {
    overview: overviewRef,
    favorites: favoritesRef,
    pass: passRef,
    statistics: statisticsRef,
    history: historyRef,
    security: securityRef,
    notifications: notificationsRef,
  };

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(profileFormSchema),
    defaultValues: defaultProfileValues,
  });

  const notificationEnabled = watch('notificationEnabled');
  const notificationTypes = watch('notificationTypes');

  const loadProfile = async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const [profilePayload, routesPayload, stopsPayload, monthlyPassPayload] = await Promise.all([
        profileService.getMyProfile(),
        profileService.getFavoriteRoutes(),
        profileService.getFavoriteStops(),
        profileService.getMyMonthlyPasses(),
      ]);

      setProfile(profilePayload);
      setFavoriteRoutes(routesPayload);
      setFavoriteStops(stopsPayload);
      setMonthlyPasses(monthlyPassPayload?.passes || []);
      syncUser({
        ...(user || {}),
        fullName: profilePayload.fullName,
        email: profilePayload.email,
        avatar: profilePayload.avatar,
        role: profilePayload.role,
        notificationEnabled: profilePayload.notificationEnabled,
        notificationTypes: profilePayload.notificationTypes,
        notificationDevice: profilePayload.notificationDevice,
      });
      reset({
        fullName: profilePayload.fullName || '',
        email: profilePayload.email || '',
        phoneNumber: profilePayload.phoneNumber || '',
        gender: profilePayload.gender || 'PREFER_NOT_TO_SAY',
        dateOfBirth: profilePayload.dateOfBirth
          ? format(new Date(profilePayload.dateOfBirth), 'yyyy-MM-dd')
          : '',
        address: profilePayload.address || '',
        notificationEnabled: profilePayload.notificationEnabled ?? true,
        notificationTypes: {
          arrivalAlerts: profilePayload.notificationTypes?.arrivalAlerts ?? true,
          delayAlerts: profilePayload.notificationTypes?.delayAlerts ?? true,
          routeChangeAlerts: profilePayload.notificationTypes?.routeChangeAlerts ?? true,
          tripUpdates: profilePayload.notificationTypes?.tripUpdates ?? true,
          accountUpdates: profilePayload.notificationTypes?.accountUpdates ?? true,
        },
      });
      setAvatarPreview(getAvatarSource(profilePayload.avatar));
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load your profile at the moment.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const stats = useMemo(() => (profile ? statCards(profile) : []), [profile]);

  const handleScrollTo = (sectionId) => {
    setActiveSection(sectionId);
    sectionMap[sectionId]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const onSubmitProfile = async (values) => {
    setIsSaving(true);

    try {
      const updatedProfile = await profileService.updateProfile({
        ...values,
        favoriteRoutes,
        favoriteStops,
      });

      setProfile(updatedProfile);
      syncUser({
        ...(user || {}),
        fullName: updatedProfile.fullName,
        email: updatedProfile.email,
        avatar: updatedProfile.avatar,
        role: updatedProfile.role,
        notificationEnabled: updatedProfile.notificationEnabled,
        notificationTypes: updatedProfile.notificationTypes,
        notificationDevice: updatedProfile.notificationDevice,
      });
      toast.success('Profile updated successfully');
      reset({
        ...values,
        dateOfBirth: values.dateOfBirth || '',
      });
    } catch (error) {
      toast.error(error.message || 'Profile update failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setSelectedAvatar(file);
    if (avatarPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleAvatarUpload = async () => {
    if (!selectedAvatar) {
      return;
    }

    setIsUploading(true);

    try {
      const updatedProfile = await profileService.uploadAvatar(selectedAvatar);
      setProfile(updatedProfile);
      syncUser({
        ...(user || {}),
        fullName: updatedProfile.fullName,
        email: updatedProfile.email,
        avatar: updatedProfile.avatar,
        role: updatedProfile.role,
      });
      setAvatarPreview(getAvatarSource(updatedProfile.avatar));
      setSelectedAvatar(null);
      toast.success('Avatar uploaded successfully');
    } catch (error) {
      toast.error(error.message || 'Avatar upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePasswordChange = async (values) => {
    setIsPasswordSaving(true);

    try {
      await profileService.changePassword(values);
      toast.success('Password changed successfully');
    } catch (error) {
      toast.error(error.message || 'Password update failed');
      throw error;
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const getNotificationPermissionStatus = async (shouldEnable) => {
    if (!('Notification' in window)) {
      return 'UNSUPPORTED';
    }

    if (!shouldEnable) {
      return Notification.permission.toUpperCase();
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission.toUpperCase();
    }

    return Notification.permission.toUpperCase();
  };

  const handleNotificationSettingsSave = async () => {
    setIsNotificationSaving(true);

    try {
      const permissionStatus = await getNotificationPermissionStatus(notificationEnabled);
      const updatedProfile = await profileService.updateNotificationSettings({
        notificationEnabled,
        notificationTypes,
        permissionStatus,
        deviceToken: window.localStorage.getItem('busdnDeviceToken') || '',
      });

      setProfile(updatedProfile);
      syncUser({
        ...(user || {}),
        fullName: updatedProfile.fullName,
        email: updatedProfile.email,
        avatar: updatedProfile.avatar,
        role: updatedProfile.role,
        notificationEnabled: updatedProfile.notificationEnabled,
        notificationTypes: updatedProfile.notificationTypes,
        notificationDevice: updatedProfile.notificationDevice,
      });
      reset({
        fullName: updatedProfile.fullName || '',
        email: updatedProfile.email || '',
        phoneNumber: updatedProfile.phoneNumber || '',
        gender: updatedProfile.gender || 'PREFER_NOT_TO_SAY',
        dateOfBirth: updatedProfile.dateOfBirth
          ? format(new Date(updatedProfile.dateOfBirth), 'yyyy-MM-dd')
          : '',
        address: updatedProfile.address || '',
        notificationEnabled: updatedProfile.notificationEnabled ?? true,
        notificationTypes: {
          arrivalAlerts: updatedProfile.notificationTypes?.arrivalAlerts ?? true,
          delayAlerts: updatedProfile.notificationTypes?.delayAlerts ?? true,
          routeChangeAlerts: updatedProfile.notificationTypes?.routeChangeAlerts ?? true,
          tripUpdates: updatedProfile.notificationTypes?.tripUpdates ?? true,
          accountUpdates: updatedProfile.notificationTypes?.accountUpdates ?? true,
        },
      });

      if (notificationEnabled && permissionStatus === 'DENIED') {
        toast.error('Browser notification permission is blocked. Please allow notifications in your browser settings.');
      } else if (notificationEnabled && permissionStatus === 'UNSUPPORTED') {
        toast.error('This browser does not support push notifications.');
      } else {
        toast.success('Notification settings updated successfully');
      }
    } catch (error) {
      toast.error(error.message || 'Notification settings update failed');
    } finally {
      setIsNotificationSaving(false);
    }
  };

  const handleMonthlyPassModalOpen = () => {
    setMonthlyPassPurchase(null);
    setMonthlyPassError('');
    setIsMonthlyPassModalOpen(true);
  };

  const handleMonthlyPassPurchase = async (values) => {
    setIsMonthlyPassSaving(true);
    setMonthlyPassError('');

    try {
      const monthlyPass = await profileService.purchaseMonthlyPass(values);
      setMonthlyPassPurchase(monthlyPass);
      toast.success('Monthly pass purchased successfully');
      await loadProfile();
    } catch (error) {
      const message = error.message || 'Monthly pass purchase failed';
      setMonthlyPassError(message);
      toast.error(message);
    } finally {
      setIsMonthlyPassSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/auth/login');
  };

  if (isLoading) {
    return (
      <>
        <Header />
        <ProfileSkeleton />
      </>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto flex w-full max-w-7xl gap-6 px-4 pb-10 pt-28 lg:px-6">
        <ProfileSidebar
          user={profile}
          onNavigate={handleScrollTo}
          currentSection={activeSection}
        />

        <div className="min-w-0 flex-1 space-y-6">
          <section className="glass-card soft-panel relative overflow-hidden rounded-[32px] p-6">
            <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-primary-fixed/60 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full border-4 border-white shadow-xl">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt={profile?.fullName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-primary text-3xl font-black text-white">
                      {(profile?.fullName || 'P').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <label className="absolute bottom-1 right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-lg hover:bg-primary-container">
                    <Camera className="h-4 w-4" />
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </label>
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-headline font-extrabold tracking-tight text-primary">
                      {profile?.fullName}
                    </h1>
                    <span className="inline-flex items-center gap-2 rounded-full bg-primary-fixed px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-on-primary-fixed">
                      <Sparkles className="h-3.5 w-3.5" />
                      Verified Passenger
                    </span>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 text-sm text-on-surface-variant sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
                    <span className="inline-flex items-center gap-2">
                      <Mail className="h-4 w-4 text-on-tertiary-container" />
                      {profile?.email}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Phone className="h-4 w-4 text-on-tertiary-container" />
                      {profile?.phoneNumber || 'Phone not set'}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-on-tertiary-container" />
                      Joined {formatDateValue(profile?.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleScrollTo('overview')}
                  className="rounded-full border border-outline-variant/60 bg-white px-5 py-3 text-sm font-bold text-primary hover:bg-surface-container-low"
                >
                  Edit profile
                </button>
                <button
                  type="button"
                  onClick={handleAvatarUpload}
                  disabled={!selectedAvatar || isUploading}
                  className="rounded-full bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUploading ? 'Uploading...' : 'Save avatar'}
                </button>
              </div>
            </div>
          </section>

          {errorMessage ? (
            <div className="rounded-[26px] border border-error/20 bg-error-container px-5 py-4 text-sm text-on-error-container">
              {errorMessage}
            </div>
          ) : null}

          <SectionCard
            id="overview"
            ref={overviewRef}
            title="Personal Information"
            description="Keep your passenger details accurate for monthly pass validation, service notifications, and support verification."
            action={(
              <button
                type="button"
                onClick={handleSubmit(onSubmitProfile)}
                disabled={isSaving || !isDirty}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSaving ? 'Saving...' : 'Save changes'}
              </button>
            )}
          >
            <form className="grid gap-5 md:grid-cols-2" onSubmit={handleSubmit(onSubmitProfile)}>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-on-surface">Full name</span>
                <input {...register('fullName')} className={fieldClassName} placeholder="Passenger full name" />
                {errors.fullName ? <span className="text-sm text-error">{errors.fullName.message}</span> : null}
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-on-surface">Email</span>
                <input {...register('email')} className={fieldClassName} placeholder="name@example.com" />
                {errors.email ? <span className="text-sm text-error">{errors.email.message}</span> : null}
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-on-surface">Phone number</span>
                <input {...register('phoneNumber')} className={fieldClassName} placeholder="+84..." />
                {errors.phoneNumber ? <span className="text-sm text-error">{errors.phoneNumber.message}</span> : null}
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-on-surface">Gender</span>
                <select {...register('gender')} className={fieldClassName}>
                  {genderOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors.gender ? <span className="text-sm text-error">{errors.gender.message}</span> : null}
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-on-surface">Date of birth</span>
                <input type="date" {...register('dateOfBirth')} className={fieldClassName} />
                {errors.dateOfBirth ? <span className="text-sm text-error">{errors.dateOfBirth.message}</span> : null}
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-on-surface">Address</span>
                <textarea
                  {...register('address')}
                  className={`${fieldClassName} min-h-[112px] resize-none`}
                  placeholder="Street, ward, district, Da Nang"
                />
                {errors.address ? <span className="text-sm text-error">{errors.address.message}</span> : null}
              </label>
            </form>
          </SectionCard>

          <SectionCard
            id="favorites"
            ref={favoritesRef}
            title="Favorite Routes and Stops"
            description="Quick shortcuts to the places and routes you access most often."
          >
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Route className="h-5 w-5 text-on-tertiary-container" />
                  <h3 className="text-lg font-bold text-primary">Favorite Routes</h3>
                </div>
                {favoriteRoutes.length > 0 ? (
                  favoriteRoutes.map((routeItem) => (
                    <div
                      key={`${routeItem.routeId || routeItem.routeNumber}-${routeItem.destination}`}
                      className="rounded-[24px] border border-outline-variant/35 bg-surface px-5 py-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.22em] text-outline">
                            Route number
                          </p>
                          <p className="mt-1 text-2xl font-headline font-extrabold text-primary">
                            {routeItem.routeNumber}
                          </p>
                          <p className="mt-2 text-sm text-on-surface-variant">
                            Destination: {routeItem.destination}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-full bg-primary-fixed px-4 py-2 text-sm font-semibold text-on-primary-fixed hover:bg-primary-fixed-dim"
                        >
                          Quick access
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[24px] border border-dashed border-outline-variant bg-surface-container-low px-5 py-10 text-center text-on-surface-variant">
                    No favorite routes yet.
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <MapPinned className="h-5 w-5 text-on-tertiary-container" />
                  <h3 className="text-lg font-bold text-primary">Favorite Stops</h3>
                </div>
                {favoriteStops.length > 0 ? (
                  favoriteStops.map((stop) => (
                    <div
                      key={`${stop.stopId || stop.stopName}-${stop.address}`}
                      className="rounded-[24px] border border-outline-variant/35 bg-surface px-5 py-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-bold text-primary">{stop.stopName}</p>
                          <p className="mt-1 text-sm text-on-surface-variant">{stop.address || 'Address unavailable'}</p>
                          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-secondary-container px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-on-secondary-container">
                            <Clock3 className="h-3.5 w-3.5" />
                            {stop.nearbyArrivalText || 'ETA unavailable'}
                          </div>
                        </div>
                        <div className="rounded-full bg-surface-container px-3 py-2 text-xs font-bold text-primary">
                          {stop.distanceMeters ? `${stop.distanceMeters}m` : 'Nearby'}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[24px] border border-dashed border-outline-variant bg-surface-container-low px-5 py-10 text-center text-on-surface-variant">
                    No favorite stops yet.
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="pass"
            ref={passRef}
            title="Monthly Pass"
            description="Passenger pass validity, current status, and this month's usage at a glance."
            action={(
              <button
                type="button"
                onClick={handleMonthlyPassModalOpen}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary-container"
              >
                <CreditCard className="h-4 w-4" />
                Purchase monthly pass
              </button>
            )}
          >
            <div className="rounded-[28px] bg-primary p-6 text-white">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-primary-fixed-dim">
                    Pass Status
                  </p>
                  <h3 className="mt-3 text-3xl font-headline font-extrabold">
                    {profile?.monthlyPass?.status || 'INACTIVE'}
                  </h3>
                  <p className="mt-2 text-sm text-surface-container-highest/80">
                    Expiration date: {formatDateValue(profile?.monthlyPass?.expireDate)}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[24px] bg-white/10 px-5 py-4">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-fixed-dim">
                      Usage
                    </p>
                    <p className="mt-2 text-2xl font-extrabold">
                      {profile?.monthlyPass?.ridesThisMonth ?? 0} rides
                    </p>
                  </div>
                  <div className="rounded-[24px] bg-white/10 px-5 py-4">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-fixed-dim">
                      Access
                    </p>
                    <p className="mt-2 text-2xl font-extrabold">
                      {profile?.monthlyPass?.isActive ? 'Unlimited' : 'Inactive'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex flex-col gap-2 border-b border-outline-variant/40 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-primary">Purchased monthly passes</h3>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Digital monthly passes linked to this passenger account.
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-full bg-primary-fixed px-3 py-1 text-xs font-black uppercase tracking-wide text-on-primary-fixed">
                  {monthlyPasses.length} passes
                </span>
              </div>

              {monthlyPasses.length ? (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {monthlyPasses.map((pass) => (
                    <article
                      key={pass._id || pass.passCode}
                      className="rounded-[24px] border border-outline-variant/40 bg-surface-container-low px-5 py-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-primary px-3 py-1 text-xs font-black text-white">
                              {formatPassType(pass.passType)}
                            </span>
                            <span className="rounded-full bg-tertiary-container px-3 py-1 text-xs font-bold text-on-tertiary-container">
                              {pass.passStatus}
                            </span>
                            <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-primary">
                              {pass.paymentStatus}
                            </span>
                          </div>
                          <p className="mt-3 font-mono text-sm font-bold text-primary">
                            {pass.passCode}
                          </p>
                        </div>
                        <p className="text-lg font-extrabold text-primary">
                          {formatCurrency(pass.passPrice)}
                        </p>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm text-on-surface-variant sm:grid-cols-2">
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-outline">Start date</p>
                          <p className="mt-1 font-bold text-primary">{formatDateValue(pass.startDate)}</p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-outline">Expiry date</p>
                          <p className="mt-1 font-bold text-primary">{formatDateValue(pass.expiryDate)}</p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-outline">Payment</p>
                          <p className="mt-1 font-bold text-primary">{formatPassType(pass.paymentMethod)}</p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-outline">Purchased</p>
                          <p className="mt-1 font-bold text-primary">{formatDateValue(pass.purchasedAt)}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-[24px] border border-dashed border-outline-variant bg-surface-container-low px-5 py-8 text-center text-on-surface-variant">
                  No monthly passes purchased yet.
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            id="statistics"
            ref={statisticsRef}
            title="Ticket Statistics"
            description="Usage trends computed from your recent boarding history."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {stats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[24px] border border-outline-variant/35 bg-surface px-5 py-5"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-outline">
                    {item.label}
                  </p>
                  <p className="mt-3 text-3xl font-headline font-extrabold text-primary">
                    {item.value}
                  </p>
                  <p className="mt-2 text-sm text-on-surface-variant">{item.detail}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            id="history"
            ref={historyRef}
            title="Recent Travel History"
            description="Latest journeys detected on your BusDN passenger account."
          >
            <div className="space-y-4">
              {profile?.recentTravelHistory?.length ? (
                profile.recentTravelHistory.map((trip, index) => (
                  <div
                    key={`${trip.routeNumber}-${trip.boardedAt}-${index}`}
                    className="rounded-[24px] border border-outline-variant/35 bg-surface px-5 py-4"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="inline-flex items-center gap-2 rounded-full bg-primary-fixed px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-on-primary-fixed">
                            <BusFront className="h-3.5 w-3.5" />
                            Route {trip.routeNumber}
                          </span>
                          <span className="inline-flex items-center gap-2 text-sm text-on-surface-variant">
                            <Clock3 className="h-4 w-4 text-on-tertiary-container" />
                            {formatDistanceToNowStrict(new Date(trip.boardedAt), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="mt-3 text-lg font-bold text-primary">
                          {trip.fromStop} to {trip.toStop}
                        </p>
                        <p className="mt-1 text-sm text-on-surface-variant">
                          Vehicle {trip.vehicleLabel || 'N/A'} • {trip.paymentMethod} • Fare {trip.fare?.toLocaleString?.() ?? trip.fare} VND
                        </p>
                      </div>
                      <div className="rounded-full bg-secondary-container px-4 py-2 text-sm font-bold text-on-secondary-container">
                        {trip.status}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-outline-variant bg-surface-container-low px-5 py-10 text-center text-on-surface-variant">
                  No recent travel history available.
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            id="notifications"
            ref={notificationsRef}
            title="Notification Settings"
            description="Control whether BusDN sends passenger reminders and service alerts to this account."
            action={(
              <div className="inline-flex items-center gap-3 rounded-full bg-surface-container px-4 py-2">
                <Bell className="h-4 w-4 text-on-tertiary-container" />
                <span className="text-sm font-bold text-primary">
                  {notificationEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            )}
          >
            <div className="space-y-4">
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-[26px] border border-outline-variant/35 bg-surface px-5 py-4">
                <div>
                  <p className="text-base font-bold text-primary">Passenger push notifications</p>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Master switch for all route, bus, trip, and account notifications.
                  </p>
                </div>
                <div className="relative">
                  <input type="checkbox" {...register('notificationEnabled')} className="peer sr-only" />
                  <div className="h-7 w-12 rounded-full bg-surface-variant transition peer-checked:bg-on-tertiary-container" />
                  <div className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                </div>
              </label>

              <div className="grid gap-3 lg:grid-cols-2">
                {notificationTypeOptions.map((option) => (
                  <label
                    key={option.name}
                    className={`flex cursor-pointer items-center justify-between gap-4 rounded-[22px] border border-outline-variant/35 bg-surface px-5 py-4 ${
                      notificationEnabled ? '' : 'opacity-60'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-bold text-primary">{option.title}</p>
                      <p className="mt-1 text-sm text-on-surface-variant">{option.description}</p>
                    </div>
                    <div className="relative shrink-0">
                      <input
                        type="checkbox"
                        {...register(`notificationTypes.${option.name}`)}
                        disabled={!notificationEnabled}
                        className="peer sr-only"
                      />
                      <div className="h-7 w-12 rounded-full bg-surface-variant transition peer-checked:bg-on-tertiary-container peer-disabled:opacity-70" />
                      <div className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex flex-col gap-3 rounded-[22px] bg-surface-container-low px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-primary">Browser permission</p>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Current status: {profile?.notificationDevice?.permissionStatus || 'DEFAULT'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleNotificationSettingsSave}
                  disabled={isNotificationSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isNotificationSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isNotificationSaving ? 'Saving...' : 'Save notification settings'}
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="security"
            ref={securityRef}
            title="Security and Logout"
            description="Manage password security and close the current session from your passenger account."
            action={(
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-full bg-error-container px-5 py-3 text-sm font-bold text-on-error-container hover:opacity-90"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            )}
          >
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
              <ChangePasswordForm
                onSubmit={handlePasswordChange}
                isSubmitting={isPasswordSaving}
              />

              <div className="rounded-[28px] bg-surface-container-low p-5">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-on-tertiary-container" />
                  <h3 className="text-lg font-bold text-primary">Session summary</h3>
                </div>
                <div className="mt-5 space-y-4 text-sm text-on-surface-variant">
                  <div className="flex items-center justify-between gap-4">
                    <span>Role</span>
                    <span className="font-bold text-primary">{profile?.role}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Profile created</span>
                    <span className="font-bold text-primary">{formatDateValue(profile?.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Last profile update</span>
                    <span className="font-bold text-primary">{formatDateValue(profile?.updatedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Monthly pass</span>
                    <span className="font-bold text-primary">{profile?.monthlyPassStatus}</span>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </main>

      <Footer />

      {isMonthlyPassModalOpen ? (
        <MonthlyPassPurchaseModal
          pass={monthlyPassPurchase}
          error={monthlyPassError}
          isSubmitting={isMonthlyPassSaving}
          onClose={() => setIsMonthlyPassModalOpen(false)}
          onSubmit={handleMonthlyPassPurchase}
        />
      ) : null}
    </div>
  );
};

export default ProfilePage;
