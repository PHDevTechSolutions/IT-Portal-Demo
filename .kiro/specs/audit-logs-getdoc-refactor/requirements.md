# Requirements Document

## Introduction

The audit logs page (`/audit-logs`) currently subscribes to four Firestore collections — `taskflow_customer_audit_logs`, `activity_logs`, `systemAudits`, and `audit_trails` — using real-time `onSnapshot` listeners with a `limit(500)` cap on each. These persistent WebSocket connections accumulate Firestore read charges continuously, even when no data changes. The goal of this feature is to replace every `onSnapshot` listener with a one-time `getDocs` fetch, reducing Firestore read consumption while preserving all existing UI functionality: filtering, pagination, analytics, bulk selection, CSV/PDF export, and the detail dialog. A manual Refresh button already exists in the UI and will serve as the sole mechanism for re-fetching data after the initial load.

## Glossary

- **AuditLogsPage**: The Next.js client component rendered at `/audit-logs` (`app/audit-logs/page.tsx`).
- **Firestore_Listener**: A real-time `onSnapshot` subscription that keeps an open WebSocket connection and bills a read for every document returned on each snapshot event.
- **Firestore_Fetch**: A one-time `getDocs` call that reads documents once and closes the connection immediately.
- **Collection**: One of the four Firestore collections queried by the AuditLogsPage: `taskflow_customer_audit_logs`, `activity_logs`, `systemAudits`, `audit_trails`.
- **UnifiedLog**: The normalised in-memory record type that merges documents from all four Collections into a single shape for display.
- **Refresh_Button**: The existing "Refresh" button in the AuditLogsPage header that currently calls `window.location.reload()`.
- **Loading_State**: The boolean `loading` flag that controls skeleton rows in the table while data is being fetched.
- **New_Logs_Badge**: The animated badge that currently counts documents arriving after the last-viewed timestamp via the real-time listener.

---

## Requirements

### Requirement 1: Replace onSnapshot with getDocs for Initial Data Load

**User Story:** As a system administrator, I want the audit logs page to load data using one-time Firestore fetches instead of persistent listeners, so that Firestore read costs are reduced without losing access to historical log data.

#### Acceptance Criteria

1. WHEN the AuditLogsPage mounts, THE AuditLogsPage SHALL call `getDocs` once for each of the four Collections (`taskflow_customer_audit_logs`, `activity_logs`, `systemAudits`, `audit_trails`).
2. WHEN the AuditLogsPage mounts, THE AuditLogsPage SHALL NOT establish any `onSnapshot` listener on any Collection.
3. WHEN `getDocs` completes for all four Collections, THE AuditLogsPage SHALL merge the results into the `allLogs` array and set `loading` to `false`.
4. THE AuditLogsPage SHALL apply the same `orderBy` and `limit(500)` query constraints to each `getDocs` call that were previously applied to the corresponding `onSnapshot` query.
5. IF a `getDocs` call fails for a Collection that may not exist (e.g., `activity_logs`, `systemAudits`, `audit_trails`), THEN THE AuditLogsPage SHALL silently ignore the error and continue rendering with data from the remaining Collections.
6. IF a `getDocs` call fails for the primary Collection (`taskflow_customer_audit_logs`), THEN THE AuditLogsPage SHALL display an error state and set `loading` to `false`.

---

### Requirement 2: Manual Refresh Replaces Real-Time Updates

**User Story:** As a system administrator, I want to manually trigger a data refresh on the audit logs page, so that I can see the latest logs on demand without incurring continuous Firestore read charges.

#### Acceptance Criteria

1. WHEN the user clicks the Refresh button, THE AuditLogsPage SHALL re-execute all four `getDocs` fetches and replace the current in-memory log data with the new results.
2. WHEN a refresh is in progress, THE AuditLogsPage SHALL set `loading` to `true` so that skeleton rows are displayed in the table.
3. WHEN a refresh completes, THE AuditLogsPage SHALL set `loading` to `false` and render the updated log data.
4. THE Refresh_Button SHALL remain enabled and visible at all times, including while a refresh is in progress.
5. THE AuditLogsPage SHALL NOT automatically re-fetch data at any interval; all data refreshes SHALL be user-initiated.

---

### Requirement 3: Remove New Logs Badge

**User Story:** As a system administrator, I want the UI to accurately reflect the fetch-on-demand model, so that I am not shown a real-time "new logs" indicator that no longer functions.

#### Acceptance Criteria

1. THE AuditLogsPage SHALL NOT display the New_Logs_Badge after the refactor, because the badge relied on real-time snapshot events to count incoming documents.
2. THE AuditLogsPage SHALL remove the `newLogsCount` state variable and the `lastViewedTimestamp` ref that were used exclusively to support the New_Logs_Badge.
3. THE AuditLogsPage SHALL remove the `clearNewLogsBadge` handler that was used exclusively to dismiss the New_Logs_Badge.

---

### Requirement 4: Preserve All Existing UI Functionality

**User Story:** As a system administrator, I want all existing audit log features to continue working after the refactor, so that my workflow is not disrupted.

#### Acceptance Criteria

1. WHEN data has loaded, THE AuditLogsPage SHALL support filtering by action, source, date preset, custom date range, actor, and module, producing the same filtered results as before the refactor.
2. WHEN data has loaded, THE AuditLogsPage SHALL support paginated display of filtered logs at 20 records per page, with the same pagination controls as before the refactor.
3. WHEN the user clicks "Export CSV", THE AuditLogsPage SHALL export the currently filtered log set to a CSV file using the existing `exportAuditLogsToCSV` utility.
4. WHEN the user clicks "Export PDF", THE AuditLogsPage SHALL export the currently filtered log set to a PDF file using the existing `exportAuditLogsToPDF` utility.
5. WHEN the user clicks the Eye icon on a log row, THE AuditLogsPage SHALL open the detail dialog for that log entry.
6. WHEN the user selects one or more log rows via checkboxes, THE AuditLogsPage SHALL enable bulk CSV export of the selected rows.
7. WHEN data has loaded, THE AuditLogsPage SHALL display the Analytics tab with the same activity timeline, top actors, action distribution, and hourly heatmap charts as before the refactor.
8. THE AuditLogsPage SHALL display the same seven stat cards (Total, Transferred, Created, Updated, Deleted, Auto-ID, Sessions) computed from the fetched data.

---

### Requirement 5: Firestore Import Cleanup

**User Story:** As a developer, I want the Firestore import list to only include symbols that are actually used, so that the codebase remains clean and tree-shakeable.

#### Acceptance Criteria

1. THE AuditLogsPage SHALL import `getDocs` from `firebase/firestore` after the refactor.
2. THE AuditLogsPage SHALL NOT import `onSnapshot` from `firebase/firestore` after the refactor.
3. THE AuditLogsPage SHALL retain all other currently-used Firestore imports (`collection`, `query`, `orderBy`, `Timestamp`, `limit`) unchanged.
