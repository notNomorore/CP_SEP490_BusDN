import path from 'path';
import User from '../auth/User.js';
import PriorityProfileRequest from './PriorityProfileRequest.js';

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

  static buildDocuments(files, documentTypes) {
    return files.map((file, index) => ({
      type: documentTypes[index],
      originalName: file.originalname,
      fileName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      url: `/uploads/priority-profiles/${path.basename(file.filename)}`,
      uploadedAt: new Date(),
    }));
  }

  static async syncExpiredProfiles() {
    const expiredRequests = await PriorityProfileRequest.find({
      status: 'APPROVED',
      expiryDate: { $lt: this.getStartOfToday() },
    }).select('_id passenger');

    if (!expiredRequests.length) {
      return;
    }

    await PriorityProfileRequest.updateMany(
      { _id: { $in: expiredRequests.map((request) => request._id) } },
      { $set: { status: 'EXPIRED' } }
    );

    await User.updateMany(
      {
        _id: { $in: expiredRequests.map((request) => request.passenger) },
        priorityStatus: 'APPROVED',
        'priorityProfile.status': 'APPROVED',
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

  static async getLatestRequest(userId) {
    await this.syncExpiredProfiles();

    return PriorityProfileRequest.findOne({ passenger: userId })
      .sort({ submittedAt: -1, createdAt: -1 })
      .populate('passenger');
  }

  static async getActiveApprovedRequest(userId) {
    await this.syncExpiredProfiles();

    const request = await PriorityProfileRequest.findOne({
      passenger: userId,
      status: 'APPROVED',
      $or: [
        { expiryDate: { $exists: false } },
        { expiryDate: null },
        { expiryDate: { $gte: this.getStartOfToday() } },
      ],
    }).sort({ reviewedAt: -1, submittedAt: -1 });

    return request;
  }

  static async getPendingRequest(userId) {
    return PriorityProfileRequest.findOne({
      passenger: userId,
      status: 'PENDING',
    }).sort({ submittedAt: -1, createdAt: -1 });
  }

  static async getProfile(userId) {
    const request = await this.getLatestRequest(userId);

    if (request) {
      return request;
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  static async listPassengerRequests(userId) {
    await this.syncExpiredProfiles();

    return PriorityProfileRequest.find({ passenger: userId })
      .sort({ submittedAt: -1, createdAt: -1 })
      .populate('passenger');
  }

  static buildPriorityProfileQuery(status) {
    const query = {};

    if (status && status !== 'ALL') {
      query.status = status;
    }

    return query;
  }

  static async listRequests({ status = 'PENDING', page = 1, limit = 20 }) {
    await this.syncExpiredProfiles();

    const normalizedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
    const normalizedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
    const query = this.buildPriorityProfileQuery(status);

    const [items, total] = await Promise.all([
      PriorityProfileRequest.find(query)
        .populate('passenger')
        .sort({ submittedAt: -1, createdAt: -1 })
        .skip((normalizedPage - 1) * normalizedLimit)
        .limit(normalizedLimit),
      PriorityProfileRequest.countDocuments(query),
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

  static async getRequestById(requestId) {
    await this.syncExpiredProfiles();

    const request = await PriorityProfileRequest.findById(requestId).populate('passenger');

    if (!request) {
      throw new Error('Priority profile request not found');
    }

    return request;
  }

  static async verifyRequest(requestId, data, reviewerId) {
    const request = await this.getRequestById(requestId);

    if (!request.documents?.length) {
      throw new Error('Cannot verify profile without uploaded documents');
    }

    if (['APPROVED', 'REJECTED', 'EXPIRED'].includes(request.status)) {
      throw new Error('Processed priority profile request cannot be verified again');
    }

    const isApproved = data.status === 'APPROVED';

    request.status = data.status;
    request.rejectionReason = isApproved ? undefined : data.rejectionReason.trim();
    request.expiryDate = isApproved && !data.noExpiry && data.expiryDate
      ? new Date(data.expiryDate)
      : undefined;
    request.reviewedAt = new Date();
    request.reviewedBy = reviewerId;

    await request.save();

    const user = await User.findById(request.passenger?._id || request.passenger);
    if (user) {
      user.priorityStatus = data.status;
      user.isPriorityGroup = isApproved;
      user.priorityProfile = {
        profileType: request.profileType,
        fullName: request.fullName,
        dateOfBirth: request.dateOfBirth,
        identityNumber: request.identityNumber,
        cardNumber: request.cardNumber,
        issuingAuthority: request.issuingAuthority,
        reason: request.reason,
        status: request.status,
        rejectionReason: request.rejectionReason,
        expiryDate: request.expiryDate,
        submittedAt: request.submittedAt,
        reviewedAt: request.reviewedAt,
        reviewedBy: request.reviewedBy,
        documents: request.documents,
      };
      await user.save();
    }

    return this.getRequestById(request._id);
  }

  static async submitProfile(userId, data, files) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const activeApprovedRequest = await this.getActiveApprovedRequest(userId);
    if (this.isApprovedProfileActive(activeApprovedRequest)) {
      throw new Error('Your approved priority profile is still active. You can submit a new request after it expires.');
    }

    const pendingRequest = await this.getPendingRequest(userId);
    if (pendingRequest) {
      throw new Error('Your priority profile request is pending review. You cannot submit another request until it is reviewed.');
    }

    const documentTypes = JSON.parse(data.documentTypes || '[]');
    const request = await PriorityProfileRequest.create({
      passenger: userId,
      profileType: data.profileType,
      fullName: data.fullName.trim(),
      dateOfBirth: new Date(data.dateOfBirth),
      identityNumber: data.identityNumber.trim(),
      cardNumber: data.cardNumber?.trim(),
      issuingAuthority: data.issuingAuthority?.trim(),
      reason: data.reason.trim(),
      status: 'PENDING',
      submittedAt: new Date(),
      documents: this.buildDocuments(files, documentTypes),
    });

    user.isPriorityGroup = false;
    user.priorityStatus = 'PENDING';
    user.priorityProfile = {
      profileType: request.profileType,
      fullName: request.fullName,
      dateOfBirth: request.dateOfBirth,
      identityNumber: request.identityNumber,
      cardNumber: request.cardNumber,
      issuingAuthority: request.issuingAuthority,
      reason: request.reason,
      status: request.status,
      rejectionReason: undefined,
      submittedAt: request.submittedAt,
      reviewedAt: undefined,
      documents: request.documents,
    };
    await user.save();

    return this.getRequestById(request._id);
  }

  static async registerProfile(userId, data) {
    const activeApprovedRequest = await this.getActiveApprovedRequest(userId);
    if (this.isApprovedProfileActive(activeApprovedRequest)) {
      throw new Error('Your approved priority profile is still active. You can submit a new request after it expires.');
    }

    const pendingRequest = await this.getPendingRequest(userId);
    if (pendingRequest) {
      throw new Error('Your priority profile request is pending review. You cannot submit another request until it is reviewed.');
    }

    const request = await PriorityProfileRequest.create({
      passenger: userId,
      profileType: data.profileType,
      fullName: data.fullName.trim(),
      dateOfBirth: new Date(data.dateOfBirth),
      identityNumber: data.identityNumber.trim(),
      cardNumber: data.cardNumber?.trim(),
      issuingAuthority: data.issuingAuthority?.trim(),
      reason: data.reason.trim(),
      status: 'PENDING',
      submittedAt: new Date(),
      documents: [],
    });

    return this.getRequestById(request._id);
  }

  static async uploadDocuments(userId, documentType, files) {
    const request = await PriorityProfileRequest.findOne({
      passenger: userId,
      status: { $in: ['PENDING', 'REJECTED'] },
    }).sort({ submittedAt: -1, createdAt: -1 });

    if (!request) {
      throw new Error('Priority profile must be registered before uploading documents');
    }

    if (request.status === 'APPROVED') {
      throw new Error('Approved priority profile cannot be changed');
    }

    request.status = 'PENDING';
    request.documents = [
      ...(request.documents || []),
      ...this.buildDocuments(files, files.map(() => documentType)),
    ];
    request.submittedAt = request.submittedAt || new Date();
    await request.save();

    return this.getRequestById(request._id);
  }
}

export default PriorityProfileService;
