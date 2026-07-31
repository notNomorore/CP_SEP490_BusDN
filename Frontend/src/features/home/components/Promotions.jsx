import React from 'react';

const Promotions = () => {
  const promos = [
    {
      id: 1,
      title: 'Lương về chốt deal - Giảm đến 50%',
      description: 'Đừng bỏ lỡ ngày hội ưu đãi lớn nhất mỗi tháng vào ngày 25 hàng tháng.',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDDCzcukpR8nFa4tsX_IAgub0pPgjNFpUhQ6Ijqi46nh80i88rjg9rFjQTZFkr9atNj2Nmd0QdCMf5QA0k6dADWhf56som65nBooINl5cWVna5BCzkOKRGzakzMQlm-JNv7qTjFr3UH-UAAO_R4SD3QA02vA99nWoRGSrOeSMqTT6Qx7Ae09RCzswPFYgIIHfPOUaPopc9IVtsgq3c5e0ILMRJ33aRZC1Q_w10d3BIKFdEORLkpfeYTfjxg_HVW0IzCUmjEK5Zl1Ro'
    },
    {
      id: 2,
      title: '12h - 14h Thứ 3 - Flash Sale đến 50%',
      description: 'Giờ vàng săn vé giá hời dành riêng cho khách hàng Veridian Transit.',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuASoPUcC12VzSv2uE31Zd8HbRLM5QKcuJbP_j79qxAKVlcnv_ZAet5rmftN-FQ7zXEbQpcO0HPbqV6e1BLceBG7SPRqnGSWT8az1lAPBzCmVnCIW_tdv-Z9pDqpcXPNEPMbVN-UHez3Udzgf_BMYIQmyJHIQH_ULA4xrHqQXu98hrgWgFdaq49DJfHFAqCQP9HlzpsMPJSzw4E1ZHGUvAMb0dpNN_A6zj6FXbLlFHr_6pgAytBezl3skwEcKzA-kAUv9B1Gtb-Fm40'
    },
    {
      id: 3,
      title: 'Giới thiệu bạn mới - Nhận quà khủng',
      description: 'Chia sẻ niềm vui du lịch và cùng bạn bè nhận ngàn voucher hấp dẫn.',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAUyXCpEkSKqpyNkCwUpqPBQjBE4z_6KfEYu-Jn3IwKAbva_00GYEp0v6pNFsIm-4A7muRKi_MOdJ19ocolAaIkRP39PAP8p8jice9mEIphk87FR0kqJRmpW5RIfsDSFg_iqvgSwGLpMC2nQ07Mb2JLTdefHq4vQA3l7K6qpDccMdUtV02S_-TC28JQnFCRcGWbAqRCVMhWg144g9aRbJdrVizrZcmh_r57Z4HqiLVP_LfyY-HgaH1odWxWj_E_r31Ukf07shl369g'
    }
  ];

  return (
    <section className="relative z-0 bg-surface-container py-20 lg:py-24">
      <div className="container mx-auto px-6">
        <div className="flex justify-between items-end mb-12">
          <div>
            <span className="text-on-tertiary-container font-bold text-sm uppercase tracking-widest">
              Exclusive Offers
            </span>
            <h2 className="text-4xl font-headline font-bold text-primary mt-2">
              Ưu đãi nổi bật
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {promos.map((promo) => (
            <div
              key={promo.id}
              className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-xl hover:shadow-2xl transition-all border border-outline-variant/15 flex flex-col gap-6 group"
            >
              <div className="overflow-hidden rounded-2xl aspect-[16/9]">
                <img
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  src={promo.image}
                  alt={promo.title}
                />
              </div>

              <div>
                <h3 className="text-xl font-headline font-bold text-primary mb-2">
                  {promo.title}
                </h3>
                <p className="text-on-surface-variant leading-relaxed">
                  {promo.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Promotions;
