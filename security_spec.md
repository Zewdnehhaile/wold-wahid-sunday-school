# Security Specification: Wold Wahid Sunday School

## 1. Data Invariants
- `Registration`: Status is `pending` by default. Can only be `approved` or `rejected` by an `admin` or `superadmin`.
- `Student`: `studentId` must be unique. Only created after a `Registration` is approved by an `admin`.
- `Attendance`: Requires a valid `studentId` and `sessionId` for the current class schedule.
- `SupportTicket`: Student can only read their own tickets.
- `LeaveRequest`: Student can only read/write their own leave requests.
- `User`: Roles can only be managed by `superadmin`.
- `AuditLog`: Immutable logs. Only `superadmin` can read all; others cannot modify.

## 2. The "Dirty Dozen" Payloads (Examples)
1. Registration: Setting `status` to `approved` in the initial submission.
2. Registration: Injecting a massive string in `studentName` (ID Poisoning).
3. Student: Attempting to assign `studentId` without being an `admin`.
4. Student: Creating a student profile without a corresponding `Registration`.
5. Attendance: Attempting to record attendance for a future session.
6. SupportTicket: Student attempting to read another student's ticket.
7. LeaveRequest: Attempting to approve one's own leave request.
8. User: Non-admin trying to update their own `role` to `superadmin`.
9. AuditLog: Attempting to delete an existing audit log entry.
10. Registration: Submitting a registration without a `referenceNumber`.
11. Attendance: Recording two attendance entries for the same student/session.
12. AuditLog: Injecting malformed timestamp to disrupt log ordering.
