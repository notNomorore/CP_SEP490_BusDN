import React from 'react';
import Header from '../../../shared/components/navigation/Header';
import Footer from '../../../shared/components/common/Footer';

const AuthShell = ({
  eyebrow,
  heroTitle,
  heroDescription,
  heroImage = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBLL6gcNVAz1070IFnBqgdsc8gxkluQJSMV3V9XR6bICz9zXNMcKwT5EklYJ5p7lKSYbnWVw--1pmoac3vwagHKeKWqaanGqT-etqPbkze2AoyqqJUfGu7RvkBVZtW9_L4wuMidiPLgIl-UfxgUpFWopPEo4Yx58UGIoJVl7BzxXW_dUocCZvTmZA--2bmnQuTvW7H7xox332bFpzLRy2t6tlAdE9RKUoXdKNzmcgKave5mWio7Qq94XHTx5dFFiIceLBybqknScYM',
  heroChips = [],
  imagePosition = 'left',
  children
}) => {
  const isImageRight = imagePosition === 'right';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 pt-[72px]">
        <section className="min-h-[calc(100vh-72px)]">
          <div className="grid min-h-[calc(100vh-72px)] w-full overflow-hidden bg-surface-container-lowest lg:grid-cols-2">
            <div
              className={`relative hidden min-h-[280px] overflow-hidden lg:block lg:min-h-[calc(100vh-72px)] ${
                isImageRight ? 'lg:order-2' : ''
              }`}
            >
              <img
                src={heroImage}
                alt={heroTitle}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(0,26,15,0.88),rgba(0,49,32,0.55),rgba(43,164,113,0.2))]" />

              <div className="relative flex h-full flex-col justify-end gap-5 p-8 text-surface-bright md:p-10 lg:p-14">
                <div className="space-y-4">
                  <span className="inline-flex w-fit rounded-full border border-white/15 bg-white/10 px-4 py-1 text-sm font-semibold uppercase tracking-[0.24em] text-tertiary-fixed">
                    {eyebrow}
                  </span>
                  <h1 className="max-w-xl text-4xl font-display font-black leading-tight md:text-5xl">
                    {heroTitle}
                  </h1>
                  <p className="max-w-lg text-base leading-7 text-surface-variant/90 md:text-lg">
                    {heroDescription}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {heroChips.map((chip) => (
                    <div
                      key={chip.label}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-md"
                    >
                      <span className="material-symbols-outlined text-tertiary-fixed">
                        {chip.icon}
                      </span>
                      <span className="text-sm font-semibold tracking-wide">
                        {chip.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex min-h-[calc(100svh-72px)] items-center justify-center overflow-y-auto bg-white px-5 py-8 sm:px-6 md:px-10 lg:min-h-[calc(100vh-72px)] lg:px-16 lg:py-10">
              <div className="w-full max-w-xl">{children}</div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default AuthShell;
