import mongoose from 'mongoose';

const RouteOperatingConfigSchema = new mongoose.Schema({
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
  effectiveDate: { type: Date, default: null },
  dayOfWeek: { type: Number, min: 0, max: 6, default: null },
  startTime: { type: String, required: true, trim: true },
  endTime: { type: String, required: true, trim: true },
  frequencyMinutes: { type: Number, required: true, min: 5, max: 180 },
  requiredVehicles: { type: Number, required: true, min: 1, max: 100 },
  requiredDrivers: { type: Number, required: true, min: 1, max: 100 },
  requiredAssistants: { type: Number, required: true, min: 0, max: 100 },
  demandLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'], default: 'MEDIUM' },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

RouteOperatingConfigSchema.index({ routeId: 1, effectiveDate: 1, dayOfWeek: 1, startTime: 1 });
RouteOperatingConfigSchema.index({ isActive: 1, effectiveDate: 1, dayOfWeek: 1 });

export default mongoose.model('RouteOperatingConfig', RouteOperatingConfigSchema);
