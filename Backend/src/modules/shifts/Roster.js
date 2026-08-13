import mongoose from 'mongoose';

const RequirementSchema = new mongoose.Schema({
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
  date: { type: Date, required: true },
  morning: {
    vehicles: { type: Number, min: 0, default: 0 },
    drivers: { type: Number, min: 0, default: 0 },
    assistants: { type: Number, min: 0, default: 0 },
  },
  afternoon: {
    vehicles: { type: Number, min: 0, default: 0 },
    drivers: { type: Number, min: 0, default: 0 },
    assistants: { type: Number, min: 0, default: 0 },
  },
}, { _id: false });

const RosterSchema = new mongoose.Schema({
  weekStartDate: { type: Date, required: true, unique: true },
  weekEndDate: { type: Date, required: true },
  status: { type: String, enum: ['DRAFT', 'PUBLISHED'], default: 'DRAFT' },
  routeRequirements: { type: [RequirementSchema], default: [] },
  validation: { type: mongoose.Schema.Types.Mixed, default: { valid: false, errors: [], warnings: [] } },
  publishedAt: { type: Date, default: null },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

RosterSchema.index({ status: 1, weekStartDate: -1 });

export default mongoose.model('Roster', RosterSchema);
