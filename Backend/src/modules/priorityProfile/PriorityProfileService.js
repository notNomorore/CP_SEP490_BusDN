import path from 'path';
import User from '../auth/User.js';

export class PriorityProfileService {
  static getStartOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  static getEndOfDate(date) {
    const endOfDate = new Date(date);
    endOfDate.setHours(23, 59, 59, 999);
    return endOfDate;
  }

  static isApprovedProfileActive(priorityProfile) {
    if (!priorityProfile || priorityProfile.status !== 'APPROVED') {
      return false;
    }

    if (!priorityProfile.expiryDate) {
      return true;
    }

    return this.getEndOfDate(priorityProfile.expiryDate) >= new Date();
  }

  static async syncExpiredProfiles() {
    await User.updateMany(
      {
        priorityStatus: 'APPROVED',
        'priorityProfile.status': 'APPROVED',
        'priorityProfile.expiryDate': { $lt: this.getStartOfToday() },
      },
      {
        $set: {
          priorityStatus: 'EXPIRED',
          isPriorityGroup: false,
          'priorityProfile.status': 'EXPIRED',
        },
      }
    );
  }

  static async applyExpiryIfNeeded(user) {
    if (!user?.priorityProfile?.expiryDate) {
      return user;
    }

    if (
      user.priorityProfile.status === 'APPROVED'
      && !this.isApprovedProfileActive(user.priorityProfile)
    ) {
      user.priorityStatus = 'EXPIRED';
      user.isPriorityGroup = false;
      user.priorityProfile.status = 'EXPIRED';
      await user.save();
    }

    return user;
  }

  static buildPriorityProfileQuery(status) {
    const query = {
      priorityStatus: { $in: ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'] },
      'priorityProfile.status': { $exists: true, $ne: 'NONE' },
    };

    if (status && status !== 'ALL') {
      query.priorityStatus = status;
      query['priorityProfile.status'] = status;
    }

    return query;
  }

  static async getProfile(userId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    return this.applyExpiryIfNeeded(user);
  }

  static async listRequests({ status = 'PENDING', page = 1, limit = 20 }) {
    await this.syncExpiredProfiles();

    const normalizedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
    const normalizedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
    const query = this.buildPriorityProfileQuery(status);

    const [items, total] = await Promise.all([
      User.find(query)
        .sort({ 'priorityProfile.submittedAt': -1, updatedAt: -1 })
        .skip((normalizedPage - 1) * normalizedLimit)
        .limit(normalizedLimit),
      User.countDocuments(query),
    ]);

    return {
      items,
      meta: {
        page: normalizedPage,
        limit: normalizedLimit,
        total,
        totalPages: Math.ceil(total / normalizedLimit),
      },
    };
  }

  static async getRequestByUserId(userId) {
    await this.syncExpiredProfiles();

    const user = await User.findOne({
      _id: userId,
      'priorityProfile.status': { $exists: true, $ne: 'NONE' },
    });

    if (!user) {
      throw new Error('Priority profile request not found');
    }

    return this.applyExpiryIfNeeded(user);
  }

  static async verifyRequest(userId, data, reviewerId) {
    const user = await this.getRequestByUserId(userId);

    if (!user.priorityProfile?.documents?.length) {
      throw new Error('Cannot verify profile without uploaded documents');
    }

    if (user.priorityProfile.status === 'APPROVED') {
      throw new Error('Approved priority profile cannot be verified again');
    }

    const isApproved = data.status === 'APPROVED';

    user.priorityStatus = data.status;
    user.isPriorityGroup = isApproved;
    user.priorityProfile.status = data.status;
    user.priorityProfile.rejectionReason = isApproved
      ? undefined
      : data.rejectionReason.trim();
    if (isApproved) {
      user.priorityProfile.expiryDate = data.noExpiry || !data.expiryDate
        ? undefined
        : new Date(data.expiryDate);
    }
    user.priorityProfile.reviewedAt = new Date();
    user.priorityProfile.reviewedBy = reviewerId;

    await user.save();
    return user;
  }

  static async registerProfile(userId, data) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    await this.applyExpiryIfNeeded(user);

    if (this.isApprovedProfileActive(user.priorityProfile)) {
      throw new Error('Your approved priority profile is still active. You can submit a new request after it expires.');
    }

    const existingProfile = user.priorityProfile?.toObject?.() || user.priorityProfile || {};
    const existingDocuments = existingProfile.documents || [];

    user.isPriorityGroup = false;
    user.priorityStatus = 'PENDING';
    user.priorityProfile = {
      ...existingProfile,
      profileType: data.profileType,
      fullName: data.fullName.trim(),
      dateOfBirth: new Date(data.dateOfBirth),
      identityNumber: data.identityNumber.trim(),
      cardNumber: data.cardNumber?.trim(),
      issuingAuthority: data.issuingAuthority?.trim(),
      reason: data.reason.trim(),
      status: 'PENDING',
      rejectionReason: undefined,
      submittedAt: new Date(),
      reviewedAt: undefined,
      documents: existingDocuments,
    };

    await user.save();
    return user;
  }

  static async uploadDocuments(userId, documentType, files) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.priorityProfile || user.priorityProfile.status === 'NONE') {
      throw new Error('Priority profile must be registered before uploading documents');
    }

    if (user.priorityProfile.status === 'APPROVED') {
      throw new Error('Approved priority profile cannot be changed');
    }

    const newDocuments = files.map((file) => ({
      type: documentType,
      originalName: file.originalname,
      fileName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      url: `/uploads/priority-profiles/${path.basename(file.filename)}`,
      uploadedAt: new Date(),
    }));

    user.priorityStatus = 'PENDING';
    user.priorityProfile.status = 'PENDING';
    user.priorityProfile.documents = [
      ...(user.priorityProfile.documents || []),
      ...newDocuments,
    ];
    user.priorityProfile.submittedAt = user.priorityProfile.submittedAt || new Date();

    await user.save();
    return user;
  }
}

export default PriorityProfileService;
