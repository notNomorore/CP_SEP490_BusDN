import mongoose from 'mongoose';

const SchedulingPlanSchema = new mongoose.Schema({
  planCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
  workDate: { type: Date, required: true },
  status: { type: String, enum: ['DRAFT', 'CONFIRMED', 'CANCELLED'], default: 'DRAFT' },
  rows: { type: [mongoose.Schema.Types.Mixed], default: [] },
  summary: { type: mongoose.Schema.Types.Mixed, default: {} },
  hardErrors: { type: [String], default: [] },
  warnings: { type: [String], default: [] },
  confirmedShiftIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Shift', default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  confirmedAt: { type: Date, default: null },
}, { timestamps: true });

SchedulingPlanSchema.index({ workDate: 1, status: 1, createdAt: -1 });

export default mongoose.model('SchedulingPlan', SchedulingPlanSchema);
