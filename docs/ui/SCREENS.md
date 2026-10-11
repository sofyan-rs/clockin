# ClockIn screens

Every screen from the design canvas, grouped by flow. **PNG = visual source of truth** (rendered at 390×844 for mobile, 1440 wide for web). **HTML = exact copy, spacing, colors and sample data** (inline styles; links between screens show the navigation).

Related: [PRD §14](../implementation/PRD.md) (inventory + not-yet-designed items), [DESIGN_SYSTEM](../implementation/DESIGN_SYSTEM.md), [ARCHITECTURE §10–11](../ARCHITECTURE.md).

HTML notes: the files were authored for a design canvas. The markup inside `<x-dc>` is plain HTML with inline styles. A few screens put repeated rows in `<sc-for>` templates whose data sits in the `<script type="text/x-dc">` block at the bottom (look at `renderVals()` for sample data). Treat them as reference, not production code. Sample data is illustrative and not always consistent (e.g. Employee ID shows as `EMP-2017` on web and `ID 2024017` on mobile; the real format is the company's own `employee_code`).

Mobile column = suggested Compose destination/state. Web column = suggested Nuxt route. **Phase** = when the screen ships (PRD §5).

**Phase 1 gating.** Phase 2 entry points that appear inside Phase 1 screens are hidden by feature flag until Phase 2 (PRD §5.1):

- Mobile bottom nav shows **Home, History, Profile** (Requests tab hidden); notification bell on Home hidden; Reminders row in Profile hidden; "Request correction" link in Day detail hidden.
- Web Settings tabs Approval flows, Leave types, Holidays hidden; Employee detail approvers card shows a placeholder.

## Mobile (Kotlin Multiplatform / Compose)


### 1 · Launch & sign in

| ID | Screen | Files | Destination / state | Phase |
|---|---|---|---|---|
| M01 | Splash | [png](mobile/png/Splash.png) · [html](mobile/html/Splash.html) | `SplashScreen` | 1 |
| M01a | Update required | [png](mobile/png/ForceUpdate.png) · [html](mobile/html/ForceUpdate.html) | `ForceUpdateScreen` | 1 |
| M02 | Login | [png](mobile/png/Login.png) · [html](mobile/html/Login.html) | `LoginScreen` | 1 |
| M03 | Device not recognized | [png](mobile/png/DeviceUnknown.png) · [html](mobile/html/DeviceUnknown.html) | `DeviceNotRecognizedScreen` | 1 |
| M04a | Data consent | [png](mobile/png/Consent.png) · [html](mobile/html/Consent.html) | `ConsentScreen` | 1 |
| M04 | Location & camera access | [png](mobile/png/Permissions.png) · [html](mobile/html/Permissions.html) | `PermissionsScreen` | 1 |
| M02a | Forgot password | [png](mobile/png/ForgotPassword.png) · [html](mobile/html/ForgotPassword.html) | `ForgotPasswordScreen` | 1 |
| M02b | Reset link sent | [png](mobile/png/ResetSent.png) · [html](mobile/html/ResetSent.html) | `ForgotPasswordScreen (sent state)` | 1 |
| M02c | Contact HR | [png](mobile/png/ContactHR.png) · [html](mobile/html/ContactHR.html) | `ContactHrSheet` | 1 |

### 2 · Home & clock in at the office

| ID | Screen | Files | Destination / state | Phase |
|---|---|---|---|---|
| M05 | Home: inside geofence | [png](mobile/png/Main.png) · [html](mobile/html/Main.html) | `HomeScreen (state: InsideGeofence)` | 1 |
| M05 | Home: outside geofence | [png](mobile/png/HomeOutside.png) · [html](mobile/html/HomeOutside.html) | `HomeScreen (OutsideGeofence)` | 1 |
| M07 | Clock-in selfie | [png](mobile/png/Selfie.png) · [html](mobile/html/Selfie.html) | `SelfieScreen(mode=ClockIn)` | 1 |
| M08 | Clock-in confirmation | [png](mobile/png/Confirm.png) · [html](mobile/html/Confirm.html) | `ClockConfirmScreen(ClockIn)` | 1 |
| M05 | Home: no shift today | [png](mobile/png/HomeNoShift.png) · [html](mobile/html/HomeNoShift.html) | `HomeScreen (NoShift)` | 1 |
| M05 | Home: on leave | [png](mobile/png/HomeLeave.png) · [html](mobile/html/HomeLeave.html) | `HomeScreen (OnLeave)` | 1 |

### 3 · Location, camera & offline states

| ID | Screen | Files | Destination / state | Phase |
|---|---|---|---|---|
| M05 | Finding location | [png](mobile/png/HomeLocating.png) · [html](mobile/html/HomeLocating.html) | `HomeScreen (Locating)` | 1 |
| M05 | Weak GPS | [png](mobile/png/HomeLowAccuracy.png) · [html](mobile/html/HomeLowAccuracy.html) | `HomeScreen (WeakGps)` | 1 |
| M05 | Fake GPS blocked | [png](mobile/png/HomeMockGPS.png) · [html](mobile/html/HomeMockGPS.html) | `HomeScreen (MockGpsBlocked)` | 1 |
| M05 | Location access off | [png](mobile/png/HomeNoPermission.png) · [html](mobile/html/HomeNoPermission.html) | `HomeScreen (PermissionDenied)` | 1 |
| M07 | No face detected | [png](mobile/png/SelfieNoFace.png) · [html](mobile/html/SelfieNoFace.html) | `SelfieScreen (NoFace)` | 1 |
| M05 | Offline, waiting to sync | [png](mobile/png/HomeOffline.png) · [html](mobile/html/HomeOffline.html) | `HomeScreen (Offline, pending sync)` | 1 |

### 4 · Clock in from home

| ID | Screen | Files | Destination / state | Phase |
|---|---|---|---|---|
| M05 | Home: WFH | [png](mobile/png/HomeWFH.png) · [html](mobile/html/HomeWFH.html) | `HomeScreen (WorkMode=WFH)` | 1 |
| M07 | Selfie: WFH | [png](mobile/png/SelfieWFH.png) · [html](mobile/html/SelfieWFH.html) | `SelfieScreen(mode=ClockIn, WFH)` | 1 |
| M08 | Confirmation: WFH | [png](mobile/png/ConfirmWFH.png) · [html](mobile/html/ConfirmWFH.html) | `ClockConfirmScreen(WFH)` | 1 |

### 5 · Clock out

| ID | Screen | Files | Destination / state | Phase |
|---|---|---|---|---|
| M05 | Home: clocked in | [png](mobile/png/HomeClockedIn.png) · [html](mobile/html/HomeClockedIn.html) | `HomeScreen (ClockedIn)` | 1 |
| M06 | Early leave warning | [png](mobile/png/EarlyLeave.png) · [html](mobile/html/EarlyLeave.html) | `EarlyLeaveDialog` | 1 |
| M07 | Clock-out selfie | [png](mobile/png/SelfieOut.png) · [html](mobile/html/SelfieOut.html) | `SelfieScreen(mode=ClockOut)` | 1 |
| M08 | Clock-out confirmation | [png](mobile/png/ClockOutDone.png) · [html](mobile/html/ClockOutDone.html) | `ClockConfirmScreen(ClockOut)` | 1 |
| M05 | Home: clocked out | [png](mobile/png/HomeDone.png) · [html](mobile/html/HomeDone.html) | `HomeScreen (ClockedOut)` | 1 |

### 6 · History & notifications

| ID | Screen | Files | Destination / state | Phase |
|---|---|---|---|---|
| M09 | History | [png](mobile/png/History.png) · [html](mobile/html/History.html) | `HistoryScreen` | 1 |
| M10 | Day detail | [png](mobile/png/DayDetail.png) · [html](mobile/html/DayDetail.html) | `DayDetailScreen` | 1 |
| M16 | Notifications | [png](mobile/png/Notifications.png) · [html](mobile/html/Notifications.html) | `NotificationsScreen` | 2 |

### 7 · Requests

| ID | Screen | Files | Destination / state | Phase |
|---|---|---|---|---|
| M12 | Requests | [png](mobile/png/Requests.png) · [html](mobile/html/Requests.html) | `RequestsScreen (tab: Mine)` | 2 |
| M13 | New request: leave | [png](mobile/png/NewRequest.png) · [html](mobile/html/NewRequest.html) | `NewRequestScreen(type=Leave)` | 2 |
| M13a | Leave type picker | [png](mobile/png/LeaveTypePicker.png) · [html](mobile/html/LeaveTypePicker.html) | `LeaveTypePickerSheet` | 2 |
| M13 | New request: sick | [png](mobile/png/NewRequestSick.png) · [html](mobile/html/NewRequestSick.html) | `NewRequestScreen(type=Sick)` | 2 |
| M13 | New request: overtime | [png](mobile/png/NewRequestOvertime.png) · [html](mobile/html/NewRequestOvertime.html) | `NewRequestScreen(type=Overtime)` | 2 |
| M13 | New request: correction | [png](mobile/png/NewRequestCorrection.png) · [html](mobile/html/NewRequestCorrection.html) | `NewRequestScreen(type=Correction)` | 2 |
| M14 | Request detail: leave | [png](mobile/png/RequestDetail.png) · [html](mobile/html/RequestDetail.html) | `RequestDetailScreen (Leave, pending)` | 2 |
| M14 | Request detail: sick | [png](mobile/png/RequestDetailSick.png) · [html](mobile/html/RequestDetailSick.html) | `RequestDetailScreen (Sick)` | 2 |
| M14 | Request detail: overtime | [png](mobile/png/RequestDetailOvertime.png) · [html](mobile/html/RequestDetailOvertime.html) | `RequestDetailScreen (Overtime)` | 2 |
| M14 | Request detail: correction | [png](mobile/png/RequestDetailCorrection.png) · [html](mobile/html/RequestDetailCorrection.html) | `RequestDetailScreen (Correction)` | 2 |
| M14 | Request detail: declined | [png](mobile/png/RequestDetailDeclined.png) · [html](mobile/html/RequestDetailDeclined.html) | `RequestDetailScreen (Declined)` | 2 |

### 8 · Profile & settings

| ID | Screen | Files | Destination / state | Phase |
|---|---|---|---|---|
| M11 | Profile | [png](mobile/png/Profile.png) · [html](mobile/html/Profile.html) | `ProfileScreen` | 1 |
| M11a | Reminder settings | [png](mobile/png/Reminders.png) · [html](mobile/html/Reminders.html) | `RemindersScreen` | 2 |
| M11b | Change password | [png](mobile/png/ChangePassword.png) · [html](mobile/html/ChangePassword.html) | `ChangePasswordScreen` | 1 |
| M11c | Sign out confirmation | [png](mobile/png/SignOut.png) · [html](mobile/html/SignOut.html) | `SignOutDialog` | 1 |

### 9 · Approvals (team lead, manager, HR)

| ID | Screen | Files | Destination / state | Phase |
|---|---|---|---|---|
| M15 | Approvals list | [png](mobile/png/Approvals.png) · [html](mobile/html/Approvals.html) | `RequestsScreen (tab: To approve)` | 2 |
| M15a | Review request | [png](mobile/png/ApprovalDetail.png) · [html](mobile/html/ApprovalDetail.html) | `ApprovalDetailScreen` | 2 |
| M15b | Decline with note | [png](mobile/png/DeclineSheet.png) · [html](mobile/html/DeclineSheet.html) | `DeclineSheet` | 2 |

## Web admin (Nuxt + Nuxt UI)


### 1 · Sign in & account

| ID | Screen | Files | Route | Phase |
|---|---|---|---|---|
| W01 | Sign in | [png](web/png/WebLogin.png) · [html](web/html/WebLogin.html) | `/login` | 1 |
| W01a | Sign in: wrong password | [png](web/png/WebLoginError.png) · [html](web/html/WebLoginError.html) | `/login (error state)` | 1 |
| W01b | Forgot password | [png](web/png/WebForgotPassword.png) · [html](web/html/WebForgotPassword.html) | `/forgot-password` | 1 |
| W01c | Reset link sent | [png](web/png/WebResetSent.png) · [html](web/html/WebResetSent.html) | `/forgot-password (sent state)` | 1 |
| W01d | Set new password | [png](web/png/WebNewPassword.png) · [html](web/html/WebNewPassword.html) | `/reset-password?token=…` | 1 |
| W01e | Account menu | [png](web/png/WebAccountMenu.png) · [html](web/html/WebAccountMenu.html) | `sidebar account UDropdownMenu` | 1 |
| W01f | Change password | [png](web/png/WebAdminPassword.png) · [html](web/html/WebAdminPassword.html) | `modal from account menu` | 1 |

### 2 · Dashboard & review

| ID | Screen | Files | Route | Phase |
|---|---|---|---|---|
| W02 | Dashboard | [png](web/png/WebDashboard.png) · [html](web/html/WebDashboard.html) | `/` | 1 |
| W10 | Needs review | [png](web/png/WebReview.png) · [html](web/html/WebReview.html) | `/review (/review/[id])` | 1 |
| W10a | Needs review: empty | [png](web/png/WebReviewEmpty.png) · [html](web/html/WebReviewEmpty.html) | `/review (empty)` | 1 |

### 3 · Reports

| ID | Screen | Files | Route | Phase |
|---|---|---|---|---|
| W08 | Monthly recap | [png](web/png/WebRecap.png) · [html](web/html/WebRecap.html) | `/reports/monthly?view=employee` | 1 |
| W08a | Monthly recap: by department | [png](web/png/WebRecapDept.png) · [html](web/html/WebRecapDept.html) | `/reports/monthly?view=department` | 1 |

### 4 · Employees

| ID | Screen | Files | Route | Phase |
|---|---|---|---|---|
| W03 | Employees | [png](web/png/WebEmployees.png) · [html](web/html/WebEmployees.html) | `/employees` | 1 |
| W03a | Employees: empty | [png](web/png/WebEmployeesEmpty.png) · [html](web/html/WebEmployeesEmpty.html) | `/employees (empty)` | 1 |
| W03b | Import CSV | [png](web/png/WebImportCSV.png) · [html](web/html/WebImportCSV.html) | `/employees/import` | 1 |
| W04a | Add employee | [png](web/png/WebAddEmployee.png) · [html](web/html/WebAddEmployee.html) | `/employees/new` | 1 |
| W04 | Employee detail | [png](web/png/WebEmployeeDetail.png) · [html](web/html/WebEmployeeDetail.html) | `/employees/[id]` | 1 |
| W04c | Deactivate employee | [png](web/png/WebDeactivateEmployee.png) · [html](web/html/WebDeactivateEmployee.html) | `/employees/[id] + deactivate modal` | 1 |
| W04b | Delete employee | [png](web/png/WebDeleteEmployee.png) · [html](web/html/WebDeleteEmployee.html) | `/employees/[id] + delete modal` | 1 |

### 5 · Office locations & work hours

| ID | Screen | Files | Route | Phase |
|---|---|---|---|---|
| W06 | Office locations | [png](web/png/WebLocations.png) · [html](web/html/WebLocations.html) | `/locations (/locations/[id])` | 1 |
| W06a | Delete location | [png](web/png/WebDeleteLocation.png) · [html](web/html/WebDeleteLocation.html) | `/locations/[id] + delete modal` | 1 |
| W07 | Work hours | [png](web/png/WebWorkHours.png) · [html](web/html/WebWorkHours.html) | `/work-hours` | 1 |
| W07a | New schedule | [png](web/png/WebNewSchedule.png) · [html](web/html/WebNewSchedule.html) | `/work-hours/new` | 1 |
| W07b | Edit schedule | [png](web/png/WebEditSchedule.png) · [html](web/html/WebEditSchedule.html) | `/work-hours/[id]` | 1 |
| W07d | Edit schedule: rotation | [png](web/png/WebEditRotation.png) · [html](web/html/WebEditRotation.html) | `/work-hours/[id] (biweekly)` | 1 |
| W07c | Delete schedule | [png](web/png/WebDeleteSchedule.png) · [html](web/html/WebDeleteSchedule.html) | `/work-hours + delete modal` | 1 |

### 6 · Audit log

| ID | Screen | Files | Route | Phase |
|---|---|---|---|---|
| W11 | Audit log | [png](web/png/WebAuditLog.png) · [html](web/html/WebAuditLog.html) | `/audit-log` | 1 |

### 7 · Settings

| ID | Screen | Files | Route | Phase |
|---|---|---|---|---|
| W16 | Settings: general | [png](web/png/WebSettingsGeneral.png) · [html](web/html/WebSettingsGeneral.html) | `/settings` | 1 |
| W16d | Settings: departments | [png](web/png/WebSettingsDepartments.png) · [html](web/html/WebSettingsDepartments.html) | `/settings/departments (/[id])` | 1 |
| W16f | Add department | [png](web/png/WebAddDepartment.png) · [html](web/html/WebAddDepartment.html) | `/settings/departments + add modal` | 1 |
| W16a | Settings: users & roles | [png](web/png/WebSettingsUsers.png) · [html](web/html/WebSettingsUsers.html) | `/settings/users` | 1 |
| W16a·1 | User actions menu | [png](web/png/WebUserActions.png) · [html](web/html/WebUserActions.html) | `/settings/users (row action menu)` | 1 |
| W16a·2 | Remove admin access | [png](web/png/WebRemoveAccess.png) · [html](web/html/WebRemoveAccess.html) | `/settings/users + remove-access modal` | 1 |
| W16c | Invite admin user | [png](web/png/WebInviteUser.png) · [html](web/html/WebInviteUser.html) | `/settings/users + invite modal (employee)` | 1 |
| W16c·1 | Invite non-employee | [png](web/png/WebInviteNonEmployee.png) · [html](web/html/WebInviteNonEmployee.html) | `/settings/users + invite modal (non-employee)` | 1 |
| W16b | Settings: approval flows | [png](web/png/WebSettingsApproval.png) · [html](web/html/WebSettingsApproval.html) | `/settings/approval-flows (?type=leave&dept=)` | 2 |
| W16e | Settings: leave types | [png](web/png/WebSettingsLeave.png) · [html](web/html/WebSettingsLeave.html) | `/settings/leave-types/[id]` | 2 |
| W16e·1 | Leave types: special leave | [png](web/png/WebSpecialLeave.png) · [html](web/html/WebSpecialLeave.html) | `/settings/leave-types/special` | 2 |
| W16g | Settings: holidays | [png](web/png/WebSettingsHolidays.png) · [html](web/html/WebSettingsHolidays.html) | `/settings/holidays?year=` | 2 |
| W16g·1 | Add holiday | [png](web/png/WebAddHoliday.png) · [html](web/html/WebAddHoliday.html) | `/settings/holidays + add modal` | 2 |
