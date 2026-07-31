import { describe, expect, it } from 'vitest';
import {
  FEEDBACK_STATUS,
  assertFeedbackTransition,
  getReplyStatusForAdminAction,
} from './feedbackWorkflow.js';
import {
  CreateSupportCaseDTO,
  FeedbackAdminActionDTO,
  PassengerFeedbackReplyDTO,
} from './customerSupport.dto.js';

describe('feedback workflow transitions', () => {
  it('allows submitted feedback to start processing', () => {
    expect(assertFeedbackTransition(FEEDBACK_STATUS.PENDING, FEEDBACK_STATUS.IN_PROGRESS))
      .toBe(FEEDBACK_STATUS.IN_PROGRESS);
  });

  it('rejects closing feedback before it is resolved', () => {
    expect(() => assertFeedbackTransition(FEEDBACK_STATUS.IN_PROGRESS, FEEDBACK_STATUS.CLOSED))
      .toThrow('Invalid feedback status transition');
  });

  it('allows resolved feedback to close', () => {
    expect(assertFeedbackTransition(FEEDBACK_STATUS.RESOLVED, FEEDBACK_STATUS.CLOSED))
      .toBe(FEEDBACK_STATUS.CLOSED);
  });

  it('maps waiting-for-passenger admin action to waiting reply status', () => {
    expect(getReplyStatusForAdminAction({
      nextStatus: FEEDBACK_STATUS.WAITING_FOR_PASSENGER,
      hasMessage: true,
      currentReplyStatus: 'UNREPLIED',
    })).toBe('WAITING_FOR_PASSENGER');
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

  it('rejects empty passenger follow-up reply', () => {
    const errors = PassengerFeedbackReplyDTO.validate({ message: '   ' });

    expect(errors.message).toBe('Reply message is required');
  });
});
