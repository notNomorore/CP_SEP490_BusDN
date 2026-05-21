import React from 'react';

const Footer = () => {
  const sections = [
    {
      title: 'Về chúng tôi',
      links: [
        'Giới Thiệu Vexere.com',
        'Tuyển dụng',
        'Tin tức',
        'Liên hệ'
      ]
    },
    {
      title: 'Hỗ trợ',
      links: [
        'Hướng dẫn thanh toán',
        'Quy chế Vexere.com',
        'Ticket Refund',
        'Privacy Policy'
      ]
    },
    {
      title: 'Trở thành đối tác',
      links: [
        'Partner Portal',
        'Phần mềm quản lý nhà xe',
        'Bus Operators',
        'Tổng đài AI'
      ]
    }
  ];

  return (
    <footer className="bg-on-surface dark:bg-primary-container text-surface-dim dark:text-on-primary-fixed-variant pt-20 pb-10">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12 px-8 py-16 w-full max-w-7xl mx-auto">
        {/* Company Info */}
        <div className="space-y-6">
          <div className="text-xl font-display font-bold text-tertiary-fixed-dim">
            Veridian Transit
          </div>
          <p className="text-body-md font-body opacity-70">
            The Guided Path to Seamless Travel.
          </p>

          {/* Social Links */}
          <div className="flex gap-4">
            <a
              href="#"
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-on-tertiary-container hover:text-primary transition-all duration-300"
            >
              <span className="material-symbols-outlined">social_leaderboard</span>
            </a>
            <a
              href="#"
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-on-tertiary-container hover:text-primary transition-all duration-300"
            >
              <span className="material-symbols-outlined">video_library</span>
            </a>
          </div>
        </div>

        {/* Links Sections */}
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-6">
            <h4 className="text-title-lg font-headline text-surface-bright">
              {section.title}
            </h4>
            <ul className="space-y-3">
              {section.links.map((link, linkIdx) => (
                <li key={linkIdx}>
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

      {/* Bottom Footer */}
      <div className="container mx-auto px-8 pt-12 border-t border-white/5 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-sm opacity-50">
          © 2024 Veridian Transit. The Guided Path to Seamless Travel.
        </p>
        <div className="flex gap-8 text-sm opacity-50">
          <span>MST: 0315133726</span>
          <span>TP. Hồ Chí Minh, Việt Nam</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
