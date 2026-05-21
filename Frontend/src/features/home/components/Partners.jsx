import React from 'react';

const Partners = () => {
  const partners = [
    {
      name: 'Visa',
      logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuASGL311NGqFlSKLr_95JIWv8-PIelHRKWtf_4SnvTR7-xvJuyrPJheaiNqouOnk6ReMGw-mR96xD-CLsggN_xuPrT2bhDfWq6sinvyIHqiq-NoXxgkPNfmcnjDSRR3aeG8vMuJ33lj9z7ZckAOx9iXdVjqgI2PSbBkmIJMs1PMRyfNaf4tZ8HYaqrEOJWEOzWdqrA2mNxkpw4h3uaqRzg0sEu4dGNMtMqeZwrsMYgQv3ViY_n77or8VsxjLiWr1yVAQeotdH2j0DU',
      height: 'h-6'
    },
    {
      name: 'Mastercard',
      logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB8a3Pdh6xMJxaPgI_ubgO0lC_Mul7EhMFim39kHeGmcoUiD5X00n1nybPfPlDNl1dZtvvhs6HVYG1YkASyeiQBpscuHXapaSUI1LXtLtB4cacpP6sFqAm_QcWACBziRcjMN2I2NmiIOCtWA9NAEzVcxKpSTicx6ZdZFNHE0KDhlEttuZYrG9FKxXCSP1mEdBUmPMWjWUnJ_nSu7Ba1ilprKbYKiqz1YDPjepOVQbdMaFKTjaZ1D53O_GEufVsY3o5ozwecgnhrtsM',
      height: 'h-8'
    },
    {
      name: 'MoMo',
      logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDneNbTKX-NgTXPlwDqxNuPjpyQh5s6SQd2g6XEAdN1CRgRYUDoYEsfJfSKu12XGrqBVP9p52S35oc09e0Lnr0BJKHAuU5mX2QXMg90kqVeDCQPtU7kwo5b-D_7UmA1MCpvoQwKM1a9oUJn_ftuDAVqta1MSBJ7MpUoG964Z6wJTQf25hzmfYrtfze08HEs3cXBMwoZ8lI_N9lPBRWRJPa8J9hD9EcP1B08cF4_w_5PeePWR6jCcf_K0qtAo-SHr51nuOIYpL81JIk',
      height: 'h-10'
    },
    {
      name: 'ZaloPay',
      logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCfM1QMqF08MFu5mfo5aoVsA5NgALC6W3WWRYvCYWdD1EoIZXjtyYb9EWhWwD-Zdu3AOSHewCGjY6Y1LDE7TSB_-yhQHZ8ieUwphytFeMxm6r2NsCeA_u3oyRUc91PVdaANzpwHKj-1RWT8BeWxrK9UUEeI1z2KR3qrBt8Lr7Iv5IqPGY9zqb25Qd0AaDEHdio3zGvlJ7NUV9L8SIZy-1yWOnTdt0VstY31krP_CZyg5LCNAwQvJ0Cf5I9g69I5XJ4BygPwvNefkms',
      height: 'h-8'
    },
    {
      name: 'ShopeePay',
      logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC6yoPS1Oe-EiW8gUeEEAs73yPOoLFR2UUPCSQQBhV97OvB4pszpqGZwmhV1JvFf_xut0Qoa7N9rtHXnQArz91FaO35JElvEXEuneniNrbuXihzLFGVGQeBZFT7vdyLH9S25un0KD0Z6hdqJOITpjmAuqiqJTgxESpaVqwwfWBs0IIQGheXhA7G9E_wK_1kJMAeTX5f67RHDePVICFpycV5Lr1EMg7QCffx6gsURPDf2796dMGVhVfzZZada_v7GCbLgaWaLoBFsgQ',
      height: 'h-10'
    }
  ];

  return (
    <section className="py-16 container mx-auto px-6 border-t border-outline-variant/10">
      {/* Title */}
      <h3 className="text-center text-outline font-bold text-xs uppercase tracking-[0.3em] mb-12">
        Đối tác thanh toán tin cậy
      </h3>

      {/* Partners Grid */}
      <div className="flex flex-wrap justify-center items-center gap-12 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
        {partners.map((partner, idx) => (
          <img
            key={idx}
            alt={partner.name}
            className={`${partner.height}`}
            src={partner.logo}
          />
        ))}

        {/* Text Partners */}
        <div className="text-2xl font-bold text-primary">VNPay</div>
        <div className="text-2xl font-bold text-primary">JCB</div>
      </div>
    </section>
  );
};

export default Partners;
