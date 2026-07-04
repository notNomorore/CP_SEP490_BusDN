BusDN Sequence Diagram Summary

Generated diagram files under docs/sequence/:

1. View_User_Accounts_sequence.txt
Use case: View User Accounts
Status: Fully matched to source code
Notes: Implemented by Frontend adminService.getUsers, AdminController.listUsers, and AdminModel.findUsers against the User collection. No separate UserService/UserRepository class exists.

2. Lock_User_Account_sequence.txt
Use case: Lock User Account
Status: Partially matched to source code
Notes: Implemented by PATCH /api/admin/users/:userId/lock and AdminModel.lockUserById. Source validates id/self-lock and updates accountLock/activityReports, but has no already-locked branch, separate AuditLog model write, or notification dispatch.

3. Unlock_User_Account_sequence.txt
Use case: Unlock User Account
Status: Partially matched to source code
Notes: Implemented by PATCH /api/admin/users/:userId/unlock and AdminModel.unlockUserById. Source updates status/accountLock/activityReports, but has no already-active validation, separate audit module call, or notification dispatch.

4. Create_Staff_Account_sequence.txt
Use case: Create Staff Account
Status: Fully matched to source code
Notes: Implemented by POST /api/admin/users, AdminController.createManagedUser, AdminModel.createManagedUser, and SMTP email sending. Staff is stored in the User collection with role and staffMetrics.

5. View_Staff_Performance_sequence.txt
Use case: View Staff Performance
Status: Fully matched to source code
Notes: Implemented by GET /api/admin/staff-performance, AdminModel.getStaffPerformanceSummary, and AdminModel.findStaffPerformanceUsers using User and TripSchedule aggregations.

6. Create_Bus_Route_sequence.txt
Use case: Create Bus Route
Status: Fully matched to source code
Notes: Implemented by POST /api/admin/routes, AdminController.createRoute, AdminModel.createRoute, BusRoute, and RouteStation assignment sync.

7. Update_Route_Information_sequence.txt
Use case: Update Route Information
Status: Fully matched to source code
Notes: Implemented by PUT/PATCH /api/admin/routes/:routeId and AdminModel.updateRouteById.

8. Deactivate_Route_sequence.txt
Use case: Deactivate Route
Status: Fully matched to source code
Notes: Implemented by PATCH /api/admin/routes/:routeId/suspend and DELETE /api/admin/routes/:routeId. Source checks active/future TripSchedule blockers before setting status SUSPENDED.

9. Define_Route_Path_sequence.txt
Use case: Define Route Path
Status: Partially matched to source code
Notes: Path editing and validation are mainly frontend Leaflet/routeWorkflowUtils logic. Backend persists orderedStops and polylinePath through the route update endpoint. No backend MapService class exists.

10. Create_Bus_Stop_sequence.txt
Use case: Create Bus Stop
Status: Partially matched to source code
Notes: busStopRoutes.js and BusStopController/BusStopService implement POST /api/bus-stops, but app.js currently comments out app.use('/api/bus-stops', busStopRoutes). AdminController.createStation also provides POST /api/admin/stations for station creation.

11. Update_Stop_Information_sequence.txt
Use case: Update Stop Information
Status: Partially matched to source code
Notes: busStopRoutes.js implements PUT /api/bus-stops/:id, but the route is not mounted in app.js. Service uses RouteStation and optional geocoding.

12. Assign_Stops_to_Route_sequence.txt
Use case: Assign Stops to Route
Status: Partially matched to source code
Notes: No standalone assign-stops endpoint exists. Assignment occurs by saving route orderedStops through PUT /api/admin/routes/:routeId, then AdminModel.syncRouteStationAssignments updates RouteStation.routeAssignments.

13. Visualize_Routes_on_Map_sequence.txt
Use case: Visualize Routes on Map
Status: Partially matched to source code
Notes: Route data comes from GET /api/admin/routes. Map rendering is implemented in frontend Leaflet components; no backend MapService module is implemented.

14. Add_New_Vehicle_sequence.txt
Use case: Add New Vehicle
Status: Fully matched to source code
Notes: Implemented by POST /api/admin/buses, AdminController.createBus, AdminModel.createBus, and FleetBus.

15. Update_Vehicle_Information_sequence.txt
Use case: Update Vehicle Information
Status: Fully matched to source code
Notes: Implemented by PUT /api/admin/buses/:busId and AdminModel.updateBusById.

16. Assign_Vehicle_to_Route_sequence.txt
Use case: Assign Vehicle to Route
Status: Missing implementation; closest flow shown
Notes: No dedicated FleetBus-to-route assignment endpoint exists. Closest source flow saves vehicleAssignment metadata on BusRoute through PUT /api/admin/routes/:routeId.

17. Mark_Vehicle_Under_Maintenance_sequence.txt
Use case: Mark Vehicle Under Maintenance
Status: Partially matched to source code
Notes: Implemented as PUT /api/admin/buses/:busId with status MAINTENANCE. No AdminController active trip blocker or notification dispatch is implemented for this action.

18. Create_Trip_Schedule_sequence.txt
Use case: Create Trip Schedule
Status: Fully matched to source code
Notes: Implemented by POST /api/admin/trip-schedules. Source validates route availability, vehicle status, driver/assistant shift eligibility, and overlapping schedule conflicts before saving TripSchedule.

19. Update_Assigned_Schedule_sequence.txt
Use case: Update Assigned Schedule
Status: Fully matched to source code
Notes: Implemented by PUT /api/admin/trip-schedules/:scheduleId. Source checks locked statuses, route schedule validation, assignment eligibility, and conflicts.

20. Assign_Driver_to_Trip_sequence.txt
Use case: Assign Driver to Trip
Status: Partially matched to source code
Notes: No dedicated driver-to-trip endpoint exists. Driver assignment is stored on TripSchedule through PUT /api/admin/trip-schedules/:scheduleId.

21. Assign_Assistant_to_Trip_sequence.txt
Use case: Assign Assistant to Trip
Status: Partially matched to source code
Notes: No dedicated assistant-to-trip endpoint exists. Assistant assignment is stored on TripSchedule through PUT /api/admin/trip-schedules/:scheduleId.

22. Assign_Vehicle_to_Schedule_sequence.txt
Use case: Assign Vehicle to Schedule
Status: Partially matched to source code
Notes: No dedicated vehicle-to-schedule endpoint exists. Vehicle assignment is stored on TripSchedule through PUT /api/admin/trip-schedules/:scheduleId after FleetBus availability and schedule conflict checks.

23. Handle_Emergency_Reassignment_sequence.txt
Use case: Handle Emergency Reassignment
Status: Fully matched to source code
Notes: Implemented by PUT /api/admin/trip-schedules/:scheduleId with emergencyReason. Source records emergencyHistory and creates an OperationNotification for affected staff.

General implementation notes:
- The codebase uses AdminController/AdminModel for many admin workflows instead of the standardized service/repository names requested in the prompt.
- ShiftController/ShiftService exist for shift assignments, but the targeted trip schedule assignment workflows in the admin route workflow use AdminController.updateTripSchedule.
- Audit logging exists in systemMonitoring/auditLogger.js, but these target admin workflows generally use activityReports or no audit call rather than AuditLogRepository.
- Notification dispatch for emergency reassignment uses OperationNotification. Lock/unlock and maintenance updates do not dispatch notifications in the inspected source.
