import mongoose from 'mongoose';

export const validateMaintenanceTaskIdParam = (params) => {
  const errors = {};

  if (!mongoose.isValidObjectId(params.id)) {
    errors.id = 'Invalid maintenance task identifier';
  }

  return errors;
};

export const validateApproveMaintenanceTask = (body) => {
  const errors = {};

  if (typeof body.safetyCheckPassed !== 'boolean') {
    errors.safetyCheckPassed = 'Safety check result is required';
  } else if (!body.safetyCheckPassed) {
    errors.safetyCheckPassed = 'Safety check must pass before approval';
  }

  if (body.approvalNote !== undefined && String(body.approvalNote).trim().length > 2000) {
    errors.approvalNote = 'Approval note must not exceed 2000 characters';
  }

  return errors;
};

export const validateRejectMaintenanceTask = (body) => {
  const errors = {};
  const note = String(body.approvalNote || body.rejectionReason || '').trim();

  if (!note) {
    errors.approvalNote = 'Rejection reason is required';
  }

  if (note.length > 2000) {
    errors.approvalNote = 'Rejection reason must not exceed 2000 characters';
  }

  return errors;
};

export default {
  validateMaintenanceTaskIdParam,
  validateApproveMaintenanceTask,
  validateRejectMaintenanceTask,
};
