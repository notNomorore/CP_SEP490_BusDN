import React from 'react';

const AdminPromotionShell = ({ children, title, subtitle, action }) => {
  return (
    <div className="w-full">
      <main className="mx-auto w-full max-w-7xl pb-10">
        <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-outline">
              Admin module
            </p>
            <h1 className="mt-2 text-3xl font-headline font-extrabold text-primary">
              {title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">{subtitle}</p>
          </div>
          {action}
        </div>

        {children}
      </main>
    </div>
  );
};

export default AdminPromotionShell;
