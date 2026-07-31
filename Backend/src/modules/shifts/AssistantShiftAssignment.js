import mongoose from 'mongoose';

const AssistantShiftAssignmentSchema = new mongoose.Schema(
  {
    assistantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift',
      required: true,
    },
    workDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'ASSIGNED',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

AssistantShiftAssignmentSchema.index({ assistantId: 1, workDate: 1, status: 1 });
AssistantShiftAssignmentSchema.index({ shiftId: 1, workDate: 1 });

export default mongoose.model('AssistantShiftAssignment', AssistantShiftAssignmentSchema);
