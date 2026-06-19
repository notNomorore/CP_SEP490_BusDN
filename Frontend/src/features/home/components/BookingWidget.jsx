import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const BookingWidget = () => {
  const navigate = useNavigate();
  const [tripType, setTripType] = useState('bus');
  const [searchParams, setSearchParams] = useState({
    from: '',
    to: '',
    departDate: ''
  });

  const handleInputChange = (field, value) => {
    setSearchParams((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSearch = () => {
    const params = new URLSearchParams();

    if (searchParams.from.trim()) {
      params.set('from', searchParams.from.trim());
    }

    if (searchParams.to.trim()) {
      params.set('to', searchParams.to.trim());
    }

    if (searchParams.departDate) {
      params.set('date', searchParams.departDate);
    }

    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="space-y-6 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-2xl sm:p-8 lg:rounded-[2rem]">
      <div className="flex w-full gap-1 overflow-x-auto rounded-xl bg-surface-container p-1 sm:w-fit sm:rounded-full">
        {[
          { id: 'bus', label: 'Xe khách' },
          { id: 'plane', label: 'Máy bay' },
          { id: 'train', label: 'Tàu hỏa' }
        ].map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => setTripType(type.id)}
            disabled={type.id !== 'bus'}
            title={type.id !== 'bus' ? 'Coming soon' : undefined}
            aria-pressed={tripType === type.id}
            className={`min-h-10 shrink-0 rounded-lg px-4 py-2 text-sm font-bold sm:rounded-full sm:px-6 ${
              tripType === type.id
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:bg-surface-variant/50 disabled:cursor-not-allowed disabled:opacity-45'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="home-search-from" className="px-1 text-xs font-bold uppercase tracking-widest text-secondary">
            Nơi xuất phát
          </label>
          <div className="relative group">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-tertiary-container group-focus-within:text-primary transition-colors">
              trip_origin
            </span>
            <input
              id="home-search-from"
              type="text"
              value={searchParams.from}
              onChange={(e) => handleInputChange('from', e.target.value)}
              placeholder="Hà Nội"
              className="w-full pl-12 pr-4 py-4 bg-surface-container-low border-0 rounded-xl focus:ring-2 focus:ring-on-tertiary-container text-on-surface font-medium placeholder:text-outline/50 transition-all"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="home-search-to" className="px-1 text-xs font-bold uppercase tracking-widest text-secondary">
            Nơi đến
          </label>
          <div className="relative group">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-tertiary-container group-focus-within:text-primary transition-colors">
              place
            </span>
            <input
              id="home-search-to"
              type="text"
              value={searchParams.to}
              onChange={(e) => handleInputChange('to', e.target.value)}
              placeholder="Sa Pa"
              className="w-full pl-12 pr-4 py-4 bg-surface-container-low border-0 rounded-xl focus:ring-2 focus:ring-on-tertiary-container text-on-surface font-medium placeholder:text-outline/50 transition-all"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="home-search-date" className="px-1 text-xs font-bold uppercase tracking-widest text-secondary">
            Ngày đi
          </label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-tertiary-container">
              calendar_today
            </span>
            <input
              id="home-search-date"
              type="date"
              value={searchParams.departDate}
              onChange={(e) => handleInputChange('departDate', e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-surface-container-low border-0 rounded-xl focus:ring-2 focus:ring-on-tertiary-container text-on-surface font-medium transition-all"
            />
          </div>
        </div>

        <div className="flex items-end pb-1">
          <button
            type="button"
            onClick={handleSearch}
            className="w-full py-4 bg-primary text-on-primary rounded-xl font-bold text-lg hover:bg-primary-container active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
          >
            Tìm kiếm
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingWidget;
