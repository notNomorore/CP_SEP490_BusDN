import { describe, expect, it } from 'vitest';
import {
  FEEDBACK_STATUS,
  assertFeedbackTransition,
  getReplyStatusForAdminAction,
} from './feedbackWorkflow.js';
import CustomerSupportService from './CustomerSupportService.js';
import {
  CreateSupportCaseDTO,
  FeedbackAdminActionDTO,
  PassengerFeedbackReplyDTO,
  SupportCaseResponseDTO,
} from './customerSupport.dto.js';

describe('feedback workflow transitions', () => {
  it('allows submitted feedback to start processing', () => {
    expect(assertFeedbackTransition(FEEDBACK_STATUS.NEW, FEEDBACK_STATUS.IN_REVIEW))
      .toBe(FEEDBACK_STATUS.IN_REVIEW);
  });

  it('allows legacy submitted feedback to start processing through aliases', () => {
    expect(assertFeedbackTransition('PENDING', 'IN_REVIEW')).toBe(FEEDBACK_STATUS.IN_REVIEW);
  });

  it('rejects arbitrary status jumps', () => {
    expect(() => assertFeedbackTransition(FEEDBACK_STATUS.NEW, FEEDBACK_STATUS.RESOLVED))
      .toThrow('Invalid feedback status transition');
  });

  it('allows resolved feedback to close', () => {
    expect(assertFeedbackTransition(FEEDBACK_STATUS.RESOLVED, FEEDBACK_STATUS.CLOSED))
      .toBe(FEEDBACK_STATUS.CLOSED);
  });

  it('maps waiting-for-passenger admin action to waiting reply status', () => {
    expect(getReplyStatusForAdminAction({
      nextStatus: FEEDBACK_STATUS.WAITING_FOR_INFORMATION,
      hasMessage: true,
      currentReplyStatus: 'UNREPLIED',
    })).toBe('WAITING_FOR_PASSENGER');
  });

  it('allows resolved feedback to reopen', () => {
    expect(assertFeedbackTransition(FEEDBACK_STATUS.RESOLVED, FEEDBACK_STATUS.REOPENED))
      .toBe(FEEDBACK_STATUS.REOPENED);
  });
});

describe('feedback validation', () => {
  it('rejects blank passenger feedback content', () => {
    const errors = CreateSupportCaseDTO.validate({
      type: 'SERVICE_FEEDBACK',
      title: 'Good title',
      description: '   ',
      category: 'SERVICE_QUALITY',
      ratingScore: 5,
      relatedTripId: 'TRIP-1',
    });

    expect(errors.description).toBeTruthy();
  });

  it('rejects too-short passenger feedback title and message', () => {
    const errors = CreateSupportCaseDTO.validate({
      type: 'SERVICE_FEEDBACK',
      title: 'Bad',
      description: 'too short',
      category: 'SERVICE_QUALITY',
      ratingScore: 5,
      relatedTripId: 'TRIP-1',
    });

    expect(errors.title).toBeTruthy();
    expect(errors.description).toBeTruthy();
  });

  it('requires a related trip or route for service feedback', () => {
    const errors = CreateSupportCaseDTO.validate({
      type: 'SERVICE_FEEDBACK',
      title: 'Valid title',
      description: 'This feedback has enough content.',
      category: 'SERVICE_QUALITY',
      ratingScore: 5,
      relatedTripId: '',
    });

    expect(errors.relatedTripId).toBe('Related trip or route is required for service feedback');
  });

  it('rejects empty admin reply when message key is present', () => {
    const errors = FeedbackAdminActionDTO.validate({
      status: 'IN_PROGRESS',
      message: ' ',
    });

    expect(errors.message).toBe('Message cannot be empty');
  });

  it('rejects unsupported enterprise priority', () => {
    const errors = FeedbackAdminActionDTO.validate({
      priority: 'URGENT',
    });

    expect(errors.priority).toContain('LOW, NORMAL, HIGH, or CRITICAL');
  });

  it('rejects empty passenger follow-up reply', () => {
    const errors = PassengerFeedbackReplyDTO.validate({ message: '   ' });

    expect(errors.message).toBe('Reply message is required');
  });
});

describe('complaint priority and notifications', () => {
  it('classifies safety complaints as critical without AI', () => {
    expect(CustomerSupportService.determineFeedbackPriority({
      category: 'OTHER',
      ratingScore: 5,
      title: 'Unsafe behavior',
      description: 'There was an accident risk near the stop.',
    })).toMatchObject({ priority: 'CRITICAL' });
  });

  it('classifies neutral feedback as normal', () => {
    expect(CustomerSupportService.determineFeedbackPriority({
      category: 'SERVICE_QUALITY',
      ratingScore: 3,
      title: 'Late route',
      description: 'The route was late today.',
    })).toMatchObject({ priority: 'NORMAL' });
  });

  it('generates a status-based notification preview', () => {
    const preview = CustomerSupportService.buildNotificationPreview({
      type: 'SERVICE_FEEDBACK',
      referenceNumber: 'FB-C3DBF3',
      status: FEEDBACK_STATUS.INVESTIGATING,
      routeName: 'R16',
      passenger: { email: 'passenger@example.com' },
    }, FEEDBACK_STATUS.INVESTIGATING);

    expect(preview.shouldNotify).toBe(true);
    expect(preview.channels.email).toBe(true);
    expect(preview.message).toContain('R16');
  });

  it('does not expose internal notes in passenger formatting', () => {
    const formatted = SupportCaseResponseDTO.format({
      _id: 'case-1',
      referenceNumber: 'FB-C3DBF3',
      type: 'SERVICE_FEEDBACK',
      responses: [
        {
          message: 'Visible response',
          visibleToPassenger: true,
        },
        {
          message: 'Internal note',
          responseType: 'INTERNAL_NOTE',
          visibleToPassenger: false,
        },
      ],
      conversation: [],
      auditTrail: [],
    });

    expect(formatted.responses).toHaveLength(1);
    expect(formatted.responses[0].message).toBe('Visible response');
  });
});
