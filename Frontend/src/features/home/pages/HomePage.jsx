import React from 'react';
import { Navigate } from 'react-router-dom';
import Header from '../../../shared/components/navigation/Header';
import Footer from '../../../shared/components/common/Footer';
import Hero from '../components/Hero';
import TrustSignals from '../components/TrustSignals';
import PopularRoutes from '../components/PopularRoutes';
import Promotions from '../components/Promotions';
import Partners from '../components/Partners';
import useAuthStore from '../../auth/stores/authStore.js';
import getRoleLandingPath from '../../auth/utils/roleRedirect.js';

const HomePage = () => {
  const { user, isAuthenticated, isAdmin, isDriver, isBusAssistant } = useAuthStore();

  if (isAuthenticated && (isAdmin() || isDriver() || isBusAssistant())) {
    return <Navigate to={getRoleLandingPath(user)} replace />;
  }

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
