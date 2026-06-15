import React from 'react';

const Footer = () => {
  const sections = [
    {
      title: 'Ve chung toi',
      links: [
        'Gioi thieu Vexere.com',
        'Tuyen dung',
        'Tin tuc',
        'Lien he',
      ],
    },
    {
      title: 'Ho tro',
      links: [
        'Huong dan thanh toan',
        'Quy che Vexere.com',
        'Ticket Refund',
        'Privacy Policy',
      ],
    },
    {
      title: 'Tro thanh doi tac',
      links: [
        'Partner Portal',
        'Phan mem quan ly nha xe',
        'Bus Operators',
        'Tong dai AI',
      ],
    },
  ];

  return (
    <footer className="bg-on-surface dark:bg-primary-container text-surface-dim dark:text-on-primary-fixed-variant pt-20 pb-10">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12 px-8 py-16 w-full max-w-7xl mx-auto">
        <div className="space-y-6">
          <div className="text-xl font-display font-bold text-tertiary-fixed-dim">
            Veridian Transit
          </div>
          <p className="text-body-md font-body opacity-70">
            The Guided Path to Seamless Travel.
          </p>

          <div className="flex gap-4">
            <a
              href="#"
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-on-tertiary-container hover:text-primary transition-all duration-300"
              aria-label="Social leaderboard"
            >
              <span className="material-symbols-outlined">social_leaderboard</span>
            </a>
            <a
              href="#"
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-on-tertiary-container hover:text-primary transition-all duration-300"
              aria-label="Video channel"
            >
              <span className="material-symbols-outlined">video_library</span>
            </a>
          </div>
        </div>

        {sections.map((section) => (
          <div key={section.title} className="space-y-6">
            <h4 className="text-title-lg font-headline text-surface-bright">
              {section.title}
            </h4>
            <ul className="space-y-3">
              {section.links.map((link) => (
                <li key={link}>
                  <a
                    href="#"
                    className="text-surface-variant/60 hover:text-surface-bright hover:translate-x-1 inline-block transition-transform duration-300"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="container mx-auto px-8 pt-12 border-t border-white/5 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-sm opacity-50">
          (c) 2024 Veridian Transit. The Guided Path to Seamless Travel.
        </p>
        <div className="flex gap-8 text-sm opacity-50">
          <span>MST: 0315133726</span>
          <span>TP. Ho Chi Minh, Viet Nam</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
