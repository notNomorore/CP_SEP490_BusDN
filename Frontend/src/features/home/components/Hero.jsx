import React from 'react';
import BookingWidget from './BookingWidget';
import { HOME_BUS_HERO_IMAGE } from '../../../shared/constants/images.js';

const Hero = () => {
  return (
    <section className="relative flex min-h-[calc(100svh-80px)] items-center overflow-hidden py-12 sm:py-16 lg:min-h-[720px] lg:py-24">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          className="w-full h-full object-cover"
          src={HOME_BUS_HERO_IMAGE}
          alt="Modern coach bus"
        />
        <div className="absolute inset-0 hero-gradient"></div>
      </div>

      {/* Content */}
      <div className="container relative z-10 mx-auto grid items-center gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12">
        {/* Left Content */}
        <div className="lg:col-span-6 space-y-6">
          <span className="inline-block px-4 py-1 rounded-full bg-on-tertiary-container/20 text-on-tertiary-container text-sm font-bold tracking-wider uppercase">
            The Guided Path
          </span>
          
          <h1 className="text-4xl font-headline font-bold leading-[1.08] tracking-tight text-surface-bright sm:text-5xl md:text-6xl lg:text-7xl">
            Seamless Travel <br />
            <span className="text-on-tertiary-container">Evolved.</span>
          </h1>
          
          <p className="max-w-lg font-body text-base leading-7 text-surface-variant/90 sm:text-lg">
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
