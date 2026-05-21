import React from 'react';

const TrustSignals = () => {
  const signals = [
    {
      icon: 'verified_user',
      title: 'Chắc chắn có chỗ',
      description: 'Hoàn 150% nếu không có xe'
    },
    {
      icon: 'support_agent',
      title: 'Hỗ trợ 24/7',
      description: 'Luôn đồng hành cùng bạn'
    },
    {
      icon: 'sell',
      title: 'Nhiều ưu đãi',
      description: 'Giá tốt nhất thị trường'
    },
    {
      icon: 'account_balance_wallet',
      title: 'Thanh toán đa dạng',
      description: 'Bảo mật & Tiện lợi'
    }
  ];

  return (
    <section className="bg-primary text-surface-bright py-8">
      <div className="container mx-auto px-6 flex flex-wrap justify-center md:justify-between gap-8">
        {signals.map((signal, idx) => (
          <div key={idx} className="flex items-center gap-4 group">
            {/* Icon Circle */}
            <div className="w-12 h-12 rounded-full bg-on-tertiary-container/20 flex items-center justify-center transition-all group-hover:bg-on-tertiary-container group-hover:text-primary">
              <span 
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {signal.icon}
              </span>
            </div>

            {/* Text */}
            <div>
              <p className="font-headline font-bold text-sm">{signal.title}</p>
              <p className="text-xs opacity-60">{signal.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default TrustSignals;
