import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import RouteStation from '../src/modules/admin/RouteStation.js';

const allowedDistricts = [
  'Hải Châu',
  'Thanh Khê',
  'Sơn Trà',
  'Ngũ Hành Sơn',
  'Liên Chiểu',
  'Cẩm Lệ',
  'Hoà Vang',
  'Hòa Vang',
  'Hoàng Sa',
];

await connectDatabase();

const result = await RouteStation.deleteMany({
  source: 'DANABUS',
  $or: [
    { address: /Quảng Nam/i },
    { district: { $nin: allowedDistricts } },
  ],
});

console.log(JSON.stringify({ deleted: result.deletedCount }));

await disconnectDatabase();
