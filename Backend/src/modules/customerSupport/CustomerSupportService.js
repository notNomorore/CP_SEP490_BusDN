import SupportCase from './SupportCase.js';

export class CustomerSupportService {
  static buildCaseQuery({ type, status, priority }) {
    const query = { type: 'COMPLAINT' };

    if (type === 'COMPLAINT') {
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
      type: 'COMPLAINT',
      passenger: userId,
      title: data.title.trim(),
      description: data.description.trim(),
      category: data.category || 'OTHER',
      priority: data.priority || 'NORMAL',
      routeName: data.routeName?.trim(),
      tripCode: data.tripCode?.trim(),
      busPlate: data.busPlate?.trim(),
      incidentAt: data.incidentAt ? new Date(data.incidentAt) : undefined,
      contactPhone: data.contactPhone?.trim(),
      contactEmail: data.contactEmail?.trim(),
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

    if (supportCase.status === 'CLOSED') {
      throw new Error('Closed complaint cases cannot be responded again');
    }

    const statusBefore = supportCase.status;
    const statusAfter = data.status || 'IN_PROGRESS';

    supportCase.responses.push({
      message: data.message.trim(),
      responder: adminId,
      statusBefore,
      statusAfter,
      responseType: 'COMPLAINT_RESPONSE',
      visibleToPassenger: true,
      createdAt: new Date(),
    });
    supportCase.status = statusAfter;
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
}

export default CustomerSupportService;
