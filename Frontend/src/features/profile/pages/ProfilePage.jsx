import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from '../../../shared/utils/toast.js';
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

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, syncUser, logout } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [favoriteRoutes, setFavoriteRoutes] = useState([]);
  const [favoriteStops, setFavoriteStops] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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

  const loadProfile = async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const [profilePayload, routesPayload, stopsPayload] = await Promise.all([
        profileService.getMyProfile(),
        profileService.getFavoriteRoutes(),
        profileService.getFavoriteStops(),
      ]);

      setProfile(profilePayload);
      setFavoriteRoutes(routesPayload);
      setFavoriteStops(stopsPayload);
      syncUser({
        ...(user || {}),
        fullName: profilePayload.fullName,
        email: profilePayload.email,
        avatar: profilePayload.avatar,
        role: profilePayload.role,
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
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-[26px] border border-outline-variant/35 bg-surface px-5 py-4">
              <div>
                <p className="text-base font-bold text-primary">Passenger push notifications</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Receive route reminders, smart boarding prompts, and monthly pass updates.
                </p>
              </div>
              <div className="relative">
                <input type="checkbox" {...register('notificationEnabled')} className="peer sr-only" />
                <div className="h-7 w-12 rounded-full bg-surface-variant transition peer-checked:bg-on-tertiary-container" />
                <div className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
              </div>
            </label>
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
    </div>
  );
};

export default ProfilePage;
