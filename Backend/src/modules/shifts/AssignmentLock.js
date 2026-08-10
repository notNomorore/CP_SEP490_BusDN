import mongoose from 'mongoose';

const AssignmentLockSchema = new mongoose.Schema({
  lockKey: { type: String, required: true, unique: true },
  version: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('AssignmentLock', AssignmentLockSchema);
