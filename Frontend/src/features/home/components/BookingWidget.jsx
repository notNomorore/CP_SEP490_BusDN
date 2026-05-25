import React, { useState } from 'react';

const BookingWidget = () => {
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
    window.alert('Tính năng tìm kiếm đang được phát triển.');
  };

  return (
    <div className="bg-surface-container-lowest p-8 rounded-[2rem] shadow-2xl border border-outline-variant/15 space-y-6">
      <div className="flex gap-4 p-1 bg-surface-container rounded-full w-fit">
        {[
          { id: 'bus', label: 'Xe khách' },
          { id: 'plane', label: 'Máy bay' },
          { id: 'train', label: 'Tàu hỏa' }
        ].map((type) => (
          <button
            key={type.id}
            onClick={() => setTripType(type.id)}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${
              tripType === type.id
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:bg-surface-variant/50'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-secondary uppercase tracking-widest px-1">
            Nơi xuất phát
          </label>
          <div className="relative group">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-tertiary-container group-focus-within:text-primary transition-colors">
              trip_origin
            </span>
            <input
              type="text"
              value={searchParams.from}
              onChange={(e) => handleInputChange('from', e.target.value)}
              placeholder="Hà Nội"
              className="w-full pl-12 pr-4 py-4 bg-surface-container-low border-0 rounded-xl focus:ring-2 focus:ring-on-tertiary-container text-on-surface font-medium placeholder:text-outline/50 transition-all"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-secondary uppercase tracking-widest px-1">
            Nơi đến
          </label>
          <div className="relative group">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-tertiary-container group-focus-within:text-primary transition-colors">
              place
            </span>
            <input
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
          <label className="text-xs font-bold text-secondary uppercase tracking-widest px-1">
            Ngày đi
          </label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-tertiary-container">
              calendar_today
            </span>
            <input
              type="date"
              value={searchParams.departDate}
              onChange={(e) => handleInputChange('departDate', e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-surface-container-low border-0 rounded-xl focus:ring-2 focus:ring-on-tertiary-container text-on-surface font-medium transition-all"
            />
          </div>
        </div>

        <div className="flex items-end pb-1">
          <button
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
