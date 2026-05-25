import SupportCase from './SupportCase.js';

export class CustomerSupportService {
  static buildCaseQuery({ type, status, priority }) {
    const query = {};

    if (type && type !== 'ALL') {
      query.type = type;
    }

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (priority && priority !== 'ALL') {
      query.priority = priority;
    }

    return query;
  }

  static async createCase(userId, data) {
    const supportCase = new SupportCase({
      type: data.type,
      passenger: userId,
      title: data.title.trim(),
      description: data.description.trim(),
      category: data.category || (data.type === 'LOST_ITEM' ? 'LOST_ITEM' : 'OTHER'),
      priority: data.priority || 'NORMAL',
      routeName: data.routeName?.trim(),
      tripCode: data.tripCode?.trim(),
      busPlate: data.busPlate?.trim(),
      incidentAt: data.incidentAt ? new Date(data.incidentAt) : undefined,
      contactPhone: data.contactPhone?.trim(),
      contactEmail: data.contactEmail?.trim(),
      lostItem: data.type === 'LOST_ITEM'
        ? {
          itemName: data.lostItem.itemName.trim(),
          itemDescription: data.lostItem.itemDescription?.trim(),
          lastSeenLocation: data.lostItem.lastSeenLocation?.trim(),
          lostAt: data.lostItem.lostAt ? new Date(data.lostItem.lostAt) : undefined,
          recoveryStatus: 'REPORTED',
        }
        : undefined,
    });

    await supportCase.save();
    return supportCase.populate('passenger', 'fullName email phone');
  }

  static async listCases({ type = 'ALL', status = 'OPEN', priority = 'ALL', page = 1, limit = 20 }) {
    const normalizedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
    const normalizedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
    const query = this.buildCaseQuery({ type, status, priority });

    const [items, total] = await Promise.all([
      SupportCase.find(query)
        .populate('passenger', 'fullName email phone')
        .sort({ priority: -1, createdAt: -1 })
        .skip((normalizedPage - 1) * normalizedLimit)
        .limit(normalizedLimit),
      SupportCase.countDocuments(query),
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

  static async getCaseById(caseId) {
    const supportCase = await SupportCase.findById(caseId)
      .populate('passenger', 'fullName email phone')
      .populate('responses.responder', 'fullName email role');

    if (!supportCase) {
      throw new Error('Support case not found');
    }

    return supportCase;
  }

  static async respondToComplaint(caseId, adminId, data) {
    const supportCase = await this.getCaseById(caseId);

    if (supportCase.type !== 'COMPLAINT') {
      throw new Error('Only complaint cases can be responded through this action');
    }

    supportCase.responses.push({
      message: data.message.trim(),
      responder: adminId,
      createdAt: new Date(),
    });
    supportCase.status = data.status || 'IN_PROGRESS';
    supportCase.assignedTo = supportCase.assignedTo || adminId;

    if (supportCase.status === 'RESOLVED') {
      supportCase.resolvedAt = new Date();
    }

    if (supportCase.status === 'CLOSED') {
      supportCase.closedAt = new Date();
    }

    await supportCase.save();
    return this.getCaseById(caseId);
  }

  static async updateLostItemCase(caseId, adminId, data) {
    const supportCase = await this.getCaseById(caseId);

    if (supportCase.type !== 'LOST_ITEM') {
      throw new Error('Only lost item cases can be handled through this action');
    }

    if (data.note?.trim()) {
      supportCase.responses.push({
        message: data.note.trim(),
        responder: adminId,
        createdAt: new Date(),
      });
    }

    if (data.status) {
      supportCase.status = data.status;
    }

    if (data.recoveryStatus) {
      supportCase.lostItem.recoveryStatus = data.recoveryStatus;
    }

    if (data.recoveryStatus === 'FOUND') {
      supportCase.lostItem.foundAt = new Date();
      supportCase.status = data.status || 'IN_PROGRESS';
    }

    if (data.recoveryStatus === 'RETURNED') {
      supportCase.lostItem.returnedAt = new Date();
      supportCase.status = 'RESOLVED';
      supportCase.resolvedAt = new Date();
    }

    if (supportCase.status === 'CLOSED') {
      supportCase.closedAt = new Date();
    }

    supportCase.assignedTo = supportCase.assignedTo || adminId;

    await supportCase.save();
    return this.getCaseById(caseId);
  }
}

export default CustomerSupportService;
