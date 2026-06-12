import React from 'react';
import BookingWidget from './BookingWidget';

const Hero = () => {
  return (
    <section className="relative h-[870px] min-h-[600px] flex items-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          className="w-full h-full object-cover"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBLL6gcNVAz1070IFnBqgdsc8gxkluQJSMV3V9XR6bICz9zXNMcKwT5EklYJ5p7lKSYbnWVw--1pmoac3vwagHKeKWqaanGqT-etqPbkze2AoyqqJUfGu7RvkBVZtW9_L4wuMidiPLgIl-UfxgUpFWopPEo4Yx58UGIoJVl7BzxXW_dUocCZvTmZA--2bmnQuTvW7H7xox332bFpzLRy2t6tlAdE9RKUoXdKNzmcgKave5mWio7Qq94XHTx5dFFiIceLBybqknScYM"
          alt="Modern coach bus"
        />
        <div className="absolute inset-0 hero-gradient"></div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 relative z-10 grid lg:grid-cols-12 gap-12 items-center">
        {/* Left Content */}
        <div className="lg:col-span-6 space-y-6">
          <span className="inline-block px-4 py-1 rounded-full bg-on-tertiary-container/20 text-on-tertiary-container text-sm font-bold tracking-wider uppercase">
            The Guided Path
          </span>
          
          <h1 className="text-5xl md:text-7xl font-headline font-bold text-surface-bright leading-[1.1] tracking-tight">
            Seamless Travel <br />
            <span className="text-on-tertiary-container">Evolved.</span>
          </h1>
          
          <p className="text-lg text-surface-variant/90 max-w-lg font-body">
            Experience the premium standard of transit. 2,000+ quality operators, 5,000+ routes, and 24/7 guided support for your journey.
          </p>
        </div>

        {/* Right - Booking Widget */}
        <div className="lg:col-span-6">
          <BookingWidget />
        </div>
      </div>

      <style>{`
        .hero-gradient {
          background: linear-gradient(to right, rgba(0, 26, 15, 0.9), rgba(0, 26, 15, 0.4));
        }
      `}</style>
    </section>
  );
};

export default Hero;
