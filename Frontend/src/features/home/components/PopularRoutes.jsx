import React from 'react';

const PopularRoutes = () => {
  const routes = [
    {
      id: 'main',
      title: 'Hà Nội - Sa Pa',
      subtitle: 'Hành trình khám phá Tây Bắc huyền ảo',
      price: '290.000đ',
      badge: 'Best Seller',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBdsQIndki2ASBZgYlNgwBdIW696EVTi9IvW3sw5YipK8xY57IH-cGjWYxYv8Q3jcij_POoJ25nbjq-vWTMm5oua3qQ34GkjXq4QPfcvH3dBko5lALtBdK_-QtmtsGI9sgKhj6tl6Jv3KxlSDtSH5Dwz_CZDJZDBza2vPAF-Myd5wbs1-IMYZAckV04MqmdFxEvE0OErDzEap6ULv_ymDMfJzdNStNheUgR4Z-_q9KM7YjSfN6z0HWb4J-mIab_LEXW8OA4pFKwmXM'
    },
    {
      id: 'secondary-1',
      title: 'Sài Gòn - Đà Lạt',
      price: '200.000đ',
      originalPrice: '450.000đ',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCXW7HJSmoZXOqoIU0r68zKgV1XNFPYNYC2JmubyevFqLwbfWGEM6_TCZSJgu9lFxt3GwzHwM3-KVs0yzr_Fpd7HtIbOiULxWa5F_1uJ0EbV6slgjTmfyhqzNOWuUY44zVvajeiHN09JVEUDaW4ECi1yMJb81ykxmuEb4eN0np4f2kqSDOPStqAjkj4bzQN_nNwNreRTHYzvHP1ObYGrytl5l3M1w0uEROXEzEkoai0GX0LydB-KQ_32vzZIBsFKX4-bM2Kw2xPqnw'
    },
    {
      id: 'secondary-2',
      title: 'Sài Gòn - Phan Rang',
      price: '199.000đ',
      originalPrice: '259.000đ',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDgmmKvOU-PUKqJCWhoYmSvGZXyhza9glj1EIehfmg6ypG4kKWttquBb9sDukROV-Z4_J6hZLAqin0LVijeBS-n_NfLPxl1uUsjUoNPbYLuSaUKhOhFdgccy_lnPXIPH7CHjqCDtSG8QZ-rS98h1M72oZcPD4nvZgeK8ZjWsgAwqWCw5bVFVx58fyU23FrscmOMtJtKAgEXhDFjDBXE_c4DRlTRwvyb6BndROXdCt5hNF23h4F_vgFE7UvoMf4zPCpCi1fwoTOLfnM'
    }
  ];

  return (
    <section className="py-24 container mx-auto px-6">
      <div className="flex justify-between items-end mb-12">
        <div>
          <span className="text-on-tertiary-container font-bold text-sm uppercase tracking-widest">
            Trending Now
          </span>
          <h2 className="text-4xl font-headline font-bold text-primary mt-2">
            Tuyến đường phổ biến
          </h2>
        </div>
        <button className="group flex items-center gap-2 text-primary font-bold hover:text-on-tertiary-container transition-colors">
          Xem tất cả tuyến đường
          <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
            arrow_forward
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[700px]">
        <RouteCard
          route={routes[0]}
          className="md:col-span-7"
          isMainCard
        />

        <div className="md:col-span-5 grid grid-rows-2 gap-6">
          <RouteCard route={routes[1]} />
          <RouteCard route={routes[2]} />
        </div>
      </div>
    </section>
  );
};

const RouteCard = ({ route, className = '', isMainCard = false }) => {
  return (
    <div className={`relative group rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all ${className}`}>
      <img
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        src={route.image}
        alt={route.title}
      />

      <div className={`absolute inset-0 ${isMainCard ? 'bg-gradient-to-t from-primary via-transparent to-transparent opacity-80' : 'bg-gradient-to-t from-primary/80 to-transparent'}`}></div>

      <div className={`absolute bottom-0 left-0 ${isMainCard ? 'p-8' : 'p-6'} text-surface-bright w-full`}>
        {isMainCard && route.badge && (
          <span className="bg-primary-fixed text-on-primary-fixed px-3 py-1 rounded-full text-xs font-bold mb-3 inline-block">
            {route.badge}
          </span>
        )}

        <h3 className={`font-headline font-bold mb-2 ${isMainCard ? 'text-3xl' : 'text-xl'}`}>
          {route.title}
        </h3>

        {isMainCard && route.subtitle && (
          <p className="text-lg opacity-80 mb-4">{route.subtitle}</p>
        )}

        <div className={`flex ${isMainCard ? 'items-center justify-between' : 'items-center gap-3'}`}>
          <span className={`font-bold ${isMainCard ? 'text-2xl' : 'text-lg'}`}>
            Từ {route.price}
          </span>

          {route.originalPrice && !isMainCard && (
            <span className="text-sm line-through opacity-50">{route.originalPrice}</span>
          )}

          {isMainCard && (
            <button className="bg-surface-bright text-primary px-6 py-2 rounded-full font-bold hover:bg-on-tertiary-container transition-colors">
              Đặt ngay
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PopularRoutes;
