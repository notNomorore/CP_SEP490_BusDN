const firstValue = (source, keys) => {
  for (const key of keys) {
    const value = key.split('.').reduce((current, part) => current?.[part], source);
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return undefined;
};

const normalizeRoutes = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((route) => {
    if (typeof route === 'string' || typeof route === 'number') {
      return { routeCode: String(route), routeName: '' };
    }

    return {
      routeId: route.id || route.routeId || route._id || '',
      routeCode: route.code || route.routeCode || route.routeNo || route.routeNumber || '',
      routeName: route.name || route.routeName || route.title || '',
    };
  });
};

export const extractStopArray = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = [
    payload?.data?.stops,
    payload?.data?.busStops,
    payload?.data?.items,
    payload?.data?.list,
    payload?.data,
    payload?.stops,
    payload?.busStops,
    payload?.items,
    payload?.list,
    payload?.result?.stops,
    payload?.result?.items,
    payload?.results,
  ];

  return candidates.find(Array.isArray) || [];
};

export const mapExternalStopToStation = (rawStop, source = 'PUBLIC_API') => {
  const latitude = Number(firstValue(rawStop, [
    'latitude',
    'lat',
    'Latitude',
    'Lat',
    'geo.lat',
    'location.lat',
    'location.latitude',
  ]));
  const longitude = Number(firstValue(rawStop, [
    'longitude',
    'lng',
    'lon',
    'Longitude',
    'Lng',
    'Lon',
    'geo.lng',
    'geo.lon',
    'location.lng',
    'location.lon',
    'location.longitude',
  ]));
  const sourceId = firstValue(rawStop, [
    'id',
    '_id',
    'stopId',
    'stop_id',
    'stationId',
    'station_id',
    'StopId',
    'ObjectId',
  ]);
  const stopCode = firstValue(rawStop, [
    'stopCode',
    'stop_code',
    'code',
    'stationCode',
    'station_code',
    'StopCode',
    'Code',
  ]);
  const stopName = firstValue(rawStop, [
    'stopName',
    'stop_name',
    'name',
    'stationName',
    'station_name',
    'title',
    'StopName',
    'Name',
  ]);

  return {
    stationCode: String(stopCode || sourceId || `DNB${Date.now().toString().slice(-8)}`).trim().toUpperCase(),
    stationName: String(stopName || '').trim(),
    address: String(firstValue(rawStop, ['address', 'Address', 'street', 'description', 'Description']) || stopName || 'Da Nang').trim(),
    latitude,
    longitude,
    city: String(firstValue(rawStop, ['city', 'city_name', 'cityName', 'City']) || 'Da Nang').trim(),
    district: String(firstValue(rawStop, ['district', 'district_name', 'districtName', 'District', 'quan', 'area']) || '').trim(),
    ward: String(firstValue(rawStop, ['ward', 'ward_name', 'wardName', 'Ward', 'phuong']) || '').trim(),
    zone: String(firstValue(rawStop, ['zone', 'Zone']) || '').trim(),
    source,
    sourceId: sourceId ? String(sourceId).trim() : undefined,
    isActive: rawStop.isActive !== false && rawStop.active !== false,
    routes: normalizeRoutes(firstValue(rawStop, ['routes', 'Routes', 'routeList', 'route_list'])),
  };
};

export const mapStationToBusStop = (station, routes = []) => ({
  id: String(station._id),
  stopCode: station.stationCode,
  stopName: station.stationName,
  name: station.stationName,
  address: station.address,
  latitude: station.latitude,
  longitude: station.longitude,
  district: station.district || '',
  ward: station.ward || '',
  source: station.source || 'MANUAL',
  sourceId: station.sourceId || station.googlePlaceId || '',
  routes,
  routeIds: [...new Set(routes.map((route) => route.routeId).filter(Boolean))],
  isActive: station.isActive !== false,
  createdAt: station.createdAt,
  updatedAt: station.updatedAt,
});
