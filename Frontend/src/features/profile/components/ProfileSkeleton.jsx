import React from 'react';

const SkeletonBlock = ({ className }) => (
  <div className={`animate-pulse rounded-2xl bg-surface-container-high ${className}`} />
);

const ProfileSkeleton = () => {
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 pb-10 pt-28 lg:px-6">
        <div className="hidden w-80 shrink-0 lg:block">
          <div className="glass-card soft-panel rounded-[28px] p-6">
            <SkeletonBlock className="h-16 w-16 rounded-full" />
            <SkeletonBlock className="mt-4 h-6 w-40" />
            <SkeletonBlock className="mt-2 h-4 w-52" />
            <div className="mt-8 space-y-3">
              <SkeletonBlock className="h-12 w-full" />
              <SkeletonBlock className="h-12 w-full" />
              <SkeletonBlock className="h-12 w-full" />
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-6">
          <div className="glass-card soft-panel rounded-[32px] p-6">
            <SkeletonBlock className="h-28 w-full" />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <SkeletonBlock className="h-72 w-full" />
            <SkeletonBlock className="h-72 w-full" />
          </div>
          <SkeletonBlock className="h-96 w-full" />
        </div>
      </div>
    </div>
  );
};

export default ProfileSkeleton;
