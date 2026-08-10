# Notification Service

BusDN notifications are centralized behind:

```js
import notificationService from '../systemNotifications/notification.service.js';
```

Business modules should call `notificationService.send(payload)` instead of creating notification documents, resolving users, emitting Socket.IO events, or sending email directly.

## Architecture

`NotificationService` coordinates:

- recipient resolution in `notificationRecipientResolver.js`
- MongoDB persistence with the existing `Notification` and `NotificationReceipt` models
- realtime dispatch through the existing Socket.IO server
- optional email delivery through the existing SMTP/Nodemailer `emailService`
- operation staff alert writes through the existing `OperationNotification` model

No second Socket.IO server or second SMTP configuration is created.

## API

```js
await notificationService.send({
  type: 'FEEDBACK_RESPONSE',
  title: 'Feedback response received',
  message: 'Your feedback has received a response from the administrator.',
  target: {
    type: 'USER',
    userId: passengerId,
  },
  channels: {
    inApp: true,
    email: true,
    push: false,
  },
  priority: 'normal',
  data: {
    feedbackId,
  },
  source: {
    module: 'feedback',
    entityId: feedbackId,
  },
  deduplicationKey: `feedback-response:${feedbackId}`,
}, { createdBy: adminId, io });
```

`send()` returns the persisted `Notification` document. Notification failures should be handled as secondary side effects by business modules.

## Supported Targets

Supported target types:

- `USER`: one user by `userId`
- `USERS`: multiple users by `userIds`
- `ALL_USERS`: all active unlocked users
- `ALL_PASSENGERS`: active passenger accounts
- `ALL_STAFF`: active driver, assistant, conductor, and admin accounts
- `ROLE`: active users matching `role`
- `ADMINS`: active admin accounts
- `ROUTE_PASSENGERS`: passengers associated with a route through favorites, route notification subscriptions, tickets, or monthly pass records
- `TRIP_STAFF`: driver and assistant assigned to an existing trip/schedule

`VEHICLE_STAFF` is defined as a future target type but is not resolved because the current schema does not provide one reliable vehicle-to-staff relationship.

## Types

Semantic types such as `INCIDENT_ALERT`, `FEEDBACK_RESPONSE`, `VEHICLE_REASSIGNED`, `MAINTENANCE_REQUIRED`, `PROMOTION`, and `SYSTEM_ALERT` are accepted. Legacy frontend types such as `general`, `route_update`, `delay_alert`, `service_interruption`, `emergency`, `maintenance`, and `promotion` are still stored for compatibility. The semantic type is also saved as `notificationType`.

## Channels

- `inApp`: persists the notification and emits `server:notification:new` through the existing Socket.IO server when `io` is provided
- `email`: sends through the existing SMTP/App Password setup in `emailService`
- `push`: accepted for forward compatibility but no mobile push dispatcher exists yet

Email failure is logged and reflected in `deliverySummary.failedCount`; it does not roll back the notification or fail unrelated business work.

## Examples

Send to one user:

```js
await notificationService.send({
  type: 'SYSTEM_ALERT',
  title: 'Account update',
  message: 'Your profile was updated.',
  target: { type: 'USER', userId },
  channels: { inApp: true, email: false },
});
```

Send to multiple users:

```js
await notificationService.send({
  type: 'SYSTEM_ALERT',
  title: 'Maintenance notice',
  message: 'A saved trip may be affected.',
  target: { type: 'USERS', userIds },
  channels: { inApp: true, email: false },
});
```

Broadcast:

```js
await notificationService.send({
  type: 'SYSTEM_ALERT',
  title: 'System notice',
  message: 'BusDN will perform maintenance tonight.',
  target: { type: 'ALL_USERS' },
  channels: { inApp: true, email: false },
});
```

Send to a role:

```js
await notificationService.send({
  type: 'TRIP_CHANGED',
  title: 'Schedule changed',
  message: 'Please review your assigned trips.',
  target: { type: 'ROLE', role: 'DRIVER' },
  channels: { inApp: true, email: false },
});
```

Automatic business event:

```js
await notificationService.send({
  type: 'INCIDENT_ALERT',
  title: 'Route incident reported',
  message: 'A route incident may delay service.',
  target: { type: 'ROUTE_PASSENGERS', routeId },
  channels: { inApp: true, email: false },
  priority: 'high',
  source: { module: 'incident', entityId: incidentId },
  deduplicationKey: `incident:${incidentId}:route-passengers`,
});
```

## Scheduling

Future `scheduledAt` values are persisted with status `scheduled` and recipients resolved at creation time. This refactor does not introduce a new background scheduler. Existing promotion notification scheduling remains the active scheduler path.

## Operation Alerts

Driver/assistant operation alerts continue to use the existing `OperationNotification` collection and APIs. Write paths now go through:

- `notificationService.createOperationNotification(payload)`
- `notificationService.upsertOperationNotification(filter, update, options)`
- `notificationService.updateOperationNotifications(filter, update, options)`

Use these helpers instead of writing `OperationNotification` directly.

## Automatic Notification Integration

Implemented now:

- Feedback response: `notifyFeedbackResponse()` sends `FEEDBACK_RESPONSE` to the passenger with deduplication key `feedback:{feedbackId}:response`.
- Vehicle reassignment: existing reassignment flow sends `VEHICLE_REASSIGNED` to `TRIP_STAFF` and optionally `ROUTE_PASSENGERS` with keys `vehicle-reassignment:{tripId}:{vehicleId}:staff` and `vehicle-reassignment:{tripId}:{vehicleId}:passengers`.
- Maintenance required: emergency breakdown and standby-bus flows send `MAINTENANCE_REQUIRED` to admins, trip staff, and affected passengers where existing relationships provide recipients.
- Incident created: fleet incident creation sends `INCIDENT_ALERT` to `ROUTE_PASSENGERS` when the incident has a route ID.
- Trip delayed: existing fleet GPS delay detection sends `TRIP_DELAYED` to `ROUTE_PASSENGERS` with key `trip-delay:{tripId}`. No new delay algorithm was added.
- Ticket/payment success: PayOS completion sends `PAYMENT_SUCCESS` to the passenger for one-way tickets and monthly passes with keys `payment-success:ticket:{ticketId}` and `payment-success:monthly-pass:{passId}`.
- Promotion: the existing promotion scheduler sends `PROMOTION` to `ALL_PASSENGERS` with key `promotion:{promotionId}`.

Future integration points:

- Bus approaching: no ETA-threshold event is currently implemented. When the GPS/ETA module has a reliable threshold event, call:

```js
await notificationService.send({
  type: 'BUS_APPROACHING',
  title: 'Xe buýt sắp đến',
  message: 'Xe buýt của bạn sắp đến điểm dừng đã đăng ký.',
  target: { type: 'USERS', userIds: passengerIds },
  channels: { inApp: true, email: false },
  source: { module: 'eta', entityId: tripId },
  data: { tripId, stopId, etaMinutes },
  deduplicationKey: `bus-approaching:${tripId}:${stopId}`,
});
```

- More precise trip-delay targeting: current `ROUTE_PASSENGERS` uses existing route favorites, route notification subscriptions, tickets, and monthly pass records. If a future active-trip passenger manifest exists, add it to the recipient resolver instead of filtering inside business modules.

Public API notes:

- Web frontend uses `VITE_API_URL`/`VITE_API_BASE_URL` through `Frontend/src/shared/config/apiConfig.js`.
- Web Socket.IO uses `VITE_SOCKET_URL` through the same config file.
- Mobile API uses `EXPO_PUBLIC_API_URL`; mobile Socket.IO uses `EXPO_PUBLIC_SOCKET_URL`.
- NotificationService is backend-only. Frontend clients continue to use the existing public backend API and public Socket.IO URL.
