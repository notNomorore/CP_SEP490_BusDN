BusDN sequence diagram summary

Generated files:

1. View_Transaction_History_sequence.txt
Use case: View Transaction History
Status: partially matched
Notes: No dedicated passenger TransactionController, TransactionService, or transaction-history endpoint found. Closest source flow is TicketController.listMyTickets with PaymentOrder reconciliation.

2. Process_Payment_sequence.txt
Use case: Process Payment
Status: partially matched
Notes: Implemented through TicketController.createPayment and TicketService.createPaymentOrder, using PaymentOrder and PayOSService instead of separate PaymentController/PaymentService modules.

3. Apply_Promotion_Code_sequence.txt
Use case: Apply Promotion Code
Status: missing implementation
Notes: Promotion admin/statistics modules exist, but no passenger checkout endpoint applies a promotion code or updates final payment amount.

4. Retry_Failed_Payment_sequence.txt
Use case: Retry Failed Payment
Status: fully matched
Notes: Implemented through POST /api/tickets/:ticketId/payment and TicketService.createPaymentForPendingTicket, reusing existing pending orders or creating a payment for the same pending ticket.

5. Validate_E-Ticket_sequence.txt
Use case: Validate E-Ticket
Status: partially matched
Notes: Implemented as TicketController.validateQRCode and TicketService.validateQRCode. BusAssistantService also has validateETicket, but current frontend busAssistantService posts to /api/tickets/validate-qr.

6. Create_Walk-in_Ticket_sequence.txt
Use case: Create Walk-in Ticket
Status: fully matched
Notes: Implemented through BusAssistantController.createWalkInTicket and BusAssistantService.createWalkInTicket, saving WalkInTicket and Transaction records.

7. View_Shift_Revenue_sequence.txt
Use case: View Shift Revenue
Status: fully matched
Notes: Implemented through BusAssistantController.getShiftRevenue and BusAssistantService.getShiftRevenue using shift assignment and Transaction aggregation.

8. Submit_Revenue_Summary_sequence.txt
Use case: Submit Revenue Summary
Status: fully matched
Notes: Implemented through BusAssistantController.submitRevenueSummary and BusAssistantService.submitRevenueSummary using RevenueSummary, shift updates, and audit logging.

9. Create_Promotion_sequence.txt
Use case: Create Promotion
Status: fully matched
Notes: Implemented through PromotionController.createPromotion and PromotionService.createPromotion.

10. Update_Promotion_sequence.txt
Use case: Update Promotion
Status: fully matched
Notes: Implemented through PromotionController.updatePromotion and PromotionService.updatePromotion.

11. View_Promotion_Usage_Statistics_sequence.txt
Use case: View Promotion Usage Statistics
Status: fully matched
Notes: Implemented through PromotionController.getPromotionStatistics and PromotionService aggregations over PromotionUsage.

12. View_Revenue_Reports_sequence.txt
Use case: View Revenue Reports
Status: fully matched
Notes: Implemented through RevenueReportController.getRevenueReports and RevenueReportService.getRevenueReports.

13. View_Ticket_Sales_Statistics_sequence.txt
Use case: View Ticket Sales Statistics
Status: fully matched
Notes: Implemented through RevenueReportController.getTicketSalesStatistics and RevenueReportService.getTicketSalesStatistics.

14. Analyze_Peak_Hour_Demand_sequence.txt
Use case: Analyze Peak Hour Demand
Status: fully matched
Notes: Implemented through RevenueReportController.getPeakHourDemand and RevenueReportService.getPeakHourDemand.

15. Export_Financial_Reports_sequence.txt
Use case: Export Financial Reports
Status: partially matched
Notes: Export is implemented in RevenueReportService.exportFinancialReport with internal PDF/Excel buffer builders. No separate ExportService module exists.

16. View_Route_Efficiency_Analytics_sequence.txt
Use case: View Route Efficiency Analytics
Status: fully matched
Notes: Implemented through RouteEfficiencyController and RouteEfficiencyService under /api/admin/analytics/route-efficiency.

17. View_Incident_Reports_sequence.txt
Use case: View Incident Reports
Status: fully matched
Notes: Implemented through IncidentReportController.getIncidents and IncidentReportService.getIncidents.

18. View_Audit_Logs_sequence.txt
Use case: View Audit Logs
Status: fully matched
Notes: Implemented through SystemMonitoringController.getAuditLogs and SystemMonitoringService.getAuditLogs.

19. Monitor_Suspicious_Activities_sequence.txt
Use case: Monitor Suspicious Activities
Status: fully matched
Notes: Implemented through SystemMonitoringController.getSuspiciousActivities and SystemMonitoringService.getSuspiciousActivities. Detection rules exist in suspiciousDetection.service.js.

20. View_Walk-in_Ticket_Records_sequence.txt
Use case: View Walk-in Ticket Records
Status: fully matched
Notes: Implemented through WalkInTicketController.getTickets and WalkInTicketService.getTickets.

21. Reconcile_Walk-in_Revenue_sequence.txt
Use case: Reconcile Walk-in Revenue
Status: fully matched
Notes: Implemented through WalkInTicketController.reconcileRevenue and WalkInTicketService.reconcileRevenue.

22. View_Passenger_Violation_sequence.txt
Use case: View Passenger Violation
Status: fully matched
Notes: Implemented through PassengerComplianceController.listViolations/getViolation and PassengerComplianceService.

23. Apply_Passenger_Restriction_sequence.txt
Use case: Apply Passenger Restriction
Status: partially matched
Notes: Restriction application is implemented through PassengerComplianceController.applyRestriction and PassengerComplianceService.applyRestriction. Passenger notification is not implemented in the restriction flow.
