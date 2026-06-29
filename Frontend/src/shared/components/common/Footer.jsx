import React from 'react';

const Footer = () => {
  const sections = [
    {
      title: 'Về chúng tôi',
      links: [
        'Giới thiệu BusDN',
        'Tuyển dụng',
        'Tin tức',
        'Liên hệ',
      ],
    },
    {
      title: 'Hỗ trợ',
      links: [
        'Hướng dẫn thanh toán',
        'Quy định sử dụng',
        'Hoàn vé',
        'Chính sách bảo mật',
      ],
    },
    {
      title: 'Trở thành đối tác',
      links: [
        'Cổng thông tin đối tác',
        'Phần mềm quản lý nhà xe',
        'Đơn vị vận tải',
        'Tổng đài AI',
      ],
    },
  ];

  return (
    <footer id="support" className="scroll-mt-24 bg-on-surface pb-10 pt-20 text-surface-dim dark:bg-primary-container dark:text-on-primary-fixed-variant">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12 px-8 py-16 w-full max-w-7xl mx-auto">
        <div className="space-y-6">
          <div className="text-xl font-display font-bold text-tertiary-fixed-dim">
            BusDN
          </div>
          <p className="text-body-md font-body opacity-70">
            The Guided Path to Seamless Travel.
          </p>

          <div className="flex gap-4">
            <button
              type="button"
              disabled
              title="Social channel coming soon"
              className="flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-full bg-white/10 opacity-60"
              aria-label="Social channel coming soon"
            >
              <span className="material-symbols-outlined">social_leaderboard</span>
            </button>
            <button
              type="button"
              disabled
              title="Video channel coming soon"
              className="flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-full bg-white/10 opacity-60"
              aria-label="Video channel coming soon"
            >
              <span className="material-symbols-outlined">video_library</span>
            </button>
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
                  <span className="inline-block text-surface-variant/70">
                    {link}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="container mx-auto px-8 pt-12 border-t border-white/5 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-sm opacity-50">
          © {new Date().getFullYear()} BusDN. The Guided Path to Seamless Travel.
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
