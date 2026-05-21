import React from 'react';
import Header from '../../../shared/components/navigation/Header';
import Footer from '../../../shared/components/common/Footer';
import Hero from '../components/Hero';
import TrustSignals from '../components/TrustSignals';
import PopularRoutes from '../components/PopularRoutes';
import Promotions from '../components/Promotions';
import Partners from '../components/Partners';

const HomePage = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 pt-20">
        <Hero />
        <TrustSignals />
        <PopularRoutes />
        <Promotions />
        <Partners />
      </main>

      <Footer />
    </div>
  );
};

export default HomePage;
