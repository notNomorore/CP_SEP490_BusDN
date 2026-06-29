import React from 'react';
import { useNavigate } from 'react-router-dom';
import Footer from './Footer.jsx';
import Header from '../navigation/Header.jsx';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 pb-16 pt-32 sm:px-6">
        <section className="w-full max-w-2xl rounded-3xl border border-outline-variant/40 bg-white/90 p-8 text-center shadow-xl shadow-primary/5 sm:p-12">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary-container text-primary">
            <span className="material-symbols-outlined text-3xl" aria-hidden="true">wrong_location</span>
          </span>
          <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-on-tertiary-container">
            Error 404
          </p>
          <h1 className="mt-3 text-3xl font-black text-primary sm:text-4xl">
            This stop is not on the route
          </h1>
          <p className="mx-auto mt-4 max-w-lg leading-7 text-on-surface-variant">
            The page may have moved, or the address is no longer available. Return home or search the current BusDN routes.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="min-h-12 rounded-xl bg-primary px-6 font-bold text-on-primary hover:bg-primary-container"
            >
              Back to home
            </button>
            <button
              type="button"
              onClick={() => navigate('/search')}
              className="min-h-12 rounded-xl border border-outline-variant bg-white px-6 font-bold text-primary hover:bg-surface-container-low"
            >
              Search routes
            </button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default NotFoundPage;
