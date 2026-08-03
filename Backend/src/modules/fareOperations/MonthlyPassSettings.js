import mongoose from 'mongoose';

export const MONTHLY_PASS_SETTINGS_KEY = 'MONTHLY_PASS_SETTINGS';
export const DEFAULT_MONTHLY_PASS_DAILY_RIDE_LIMIT = 6;

const MonthlyPassSettingsSchema = new mongoose.Schema(
  {
    settingsKey: {
      type: String,
      default: MONTHLY_PASS_SETTINGS_KEY,
      unique: true,
      index: true,
    },
    maxRidesPerDay: {
      type: Number,
      min: 1,
      max: 20,
      default: DEFAULT_MONTHLY_PASS_DAILY_RIDE_LIMIT,
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.models.MonthlyPassSettings
  || mongoose.model('MonthlyPassSettings', MonthlyPassSettingsSchema);
