# Design Document

## Feature: audit-logs-getdoc-refactor

---

## Overview

The audit logs page (`app/audit-logs/page.tsx`) currently maintains four persistent Firestore `onSnapshot` WebSocket listeners — one per collection — that remain open for the entire lifetime of the page session. Each snapshot event bills a read for every document returned, even when no data has changed. This refactor replaces all four listeners with one-time `getDocs` fetches, reducing Firestore read costs while preserving every existing UI capability.

The change is purely in the data-fetching layer. All downstream logic — merging, filtering, pagination, analytics, bulk selection, CSV/PDF export, and the detail dialog — is unchanged. The existing Refresh button, which previously called `window.location.reload()`, becomes the sole mechanism for re-fetching data after the initial load.

### Goals

- Eliminate all `onSnapshot` subscriptions from the page.
- Fetch all four collections once on mount using `getDocs` + `Promise.allSettled`.
- Wire the Refresh button to re-invoke the same fetch function instead of reloading the page.
- Remove the New Logs Badge and its supporting state (`newLogsCount`, `lastViewedTimestamp`, `clearNewLogsBadge`) because they depended on real-time snapshot events.
- Update the subtitle text to reflect the fetch-on-demand model.
- Clean up the Firestore import list (`getDocs` in, `onSnapshot` out).

### Non-Goals

- No changes to the `UnifiedLog` type, normalisation logic, or any rendering component.
- No changes to filtering, pagination, analytics, export, or bulk-selection behaviour.
- No server-side or API-route changes.
- No introduction of polling or background refresh intervals.

---

## Architecture

The refactor is entirely contained within a single client component file. No new files, modules, or external services are introduced.

```
app/audit-logs/page.tsx
│
├── fetchAllLogs()          ← NEW: single async function replacing 4 useEffect+onSnapshot hooks
│   ├── getDocs(taskflow_customer_audit_logs)   [primary — error → error state]
│   ├── getDocs(activity_logs)                  [optional — error → silent skip]
│   ├── getDocs(systemAudits)                   [optional — error → silent skip]
│   └── getDocs(audit_trails)                   [optional — error → silent skip]
│
├── useEffect(fetchAllLogs, [])   ← called once on mount
│
├── <RefreshButton onClick={fetchAllLogs} />    ← replaces window.location.reload()
│
└── [all existing state, memos, render unchanged]
```

### Data Flow (Before → After)

| Aspect | Before (onSnapshot) | After (getDocs) |
|---|---|---|
| Connection type | Persistent WebSocket per collection | One-time HTTP fetch per collection |
| Trigger | Automatic on every Firestore write | Mount + explicit Refresh click |
| Concurrency | 4 independent listeners | 4 parallel getDocs via Promise.allSettled |
| Error handling | Per-listener error callback | Promise.allSettled result inspection |
| New data indicator | New Logs Badge (real-time count) | Removed — user clicks Refresh |
| Cleanup | `unsub()` in useEffect return | None needed (one-shot) |

---

## Components and Interfaces

### `fetchAllLogs` Function

This is the central addition. It replaces the four `useEffect` + `onSnapshot` blocks.

```typescript
const fetchAllLogs = useCallback(async () => {
  setLoading(true);

  // Primary collection — failure is fatal
  let primaryDocs: UnifiedLog[] = [];
  try {
    const q = query(
      collection(db, "taskflow_customer_audit_logs"),
      orderBy("timestamp", "desc"),
      limit(500),
    );
    const snap = await getDocs(q);
    primaryDocs = snap.docs.map((d) => ({
      id: d.id,
      source: "customer_audit" as const,
      ...(d.data() as Omit<UnifiedLog, "id" | "source">),
    }));
  } catch (err) {
    console.error("[taskflow_customer_audit_logs] getDocs failed:", err);
    setError(true);
    setLoading(false);
    return;
  }

  // Optional collections — failures are silent
  const [activityResult, systemResult, trailsResult] = await Promise.allSettled([
    getDocs(query(collection(db, "activity_logs"), orderBy("date_created", "desc"), limit(500))),
    getDocs(query(collection(db, "systemAudits"), orderBy("timestamp", "desc"), limit(500))),
    getDocs(query(collection(db, "audit_trails"), orderBy("timestamp", "desc"), limit(500))),
  ]);

  // Normalise optional results (same logic as existing onSnapshot handlers)
  const activityDocs = activityResult.status === "fulfilled"
    ? normaliseActivityLogs(activityResult.value)
    : [];
  const systemDocs = systemResult.status === "fulfilled"
    ? normaliseSystemAudits(systemResult.value)
    : [];
  const trailsDocs = trailsResult.status === "fulfilled"
    ? normaliseAuditTrails(trailsResult.value)
    : [];

  setCustomerAuditLogs(primaryDocs);
  setActivityLogs(activityDocs);
  setSystemAuditLogs(systemDocs);
  setAuditTrailLogs(trailsDocs);
  setLoading(false);
}, []);
```

> **Note:** The normalisation logic (field mapping, action coercion, actor construction) is extracted verbatim from the existing `onSnapshot` callbacks. No semantic changes are made to how documents are mapped to `UnifiedLog`.

### State Changes

| State / Ref | Before | After | Reason |
|---|---|---|---|
| `customerAuditLogs` | populated by onSnapshot | populated by fetchAllLogs | same shape |
| `activityLogs` | populated by onSnapshot | populated by fetchAllLogs | same shape |
| `systemAuditLogs` | populated by onSnapshot | populated by fetchAllLogs | same shape |
| `auditTrailLogs` | populated by onSnapshot | populated by fetchAllLogs | same shape |
| `loading` | set false in first onSnapshot | set false after all getDocs | same semantics |
| `error` | not present | **NEW** — set true on primary failure | required for Req 1.6 |
| `newLogsCount` | tracks real-time arrivals | **REMOVED** | no longer meaningful |
| `lastViewedTimestamp` | ref for badge threshold | **REMOVED** | no longer meaningful |

### Refresh Button

```tsx
// Before
<Button onClick={() => window.location.reload()}>
  <RefreshCw className="h-3.5 w-3.5" />
  Refresh
</Button>

// After
<Button onClick={fetchAllLogs}>
  <RefreshCw className="h-3.5 w-3.5" />
  Refresh
</Button>
```

The button remains always-enabled and always-visible (Req 2.4). The `loading` state already causes skeleton rows to appear in the table, providing visual feedback during refresh.

### Subtitle Text Update

```tsx
// Before
"Real-time activity trail from ..."

// After
"Activity logs fetched on demand from ..."
```

### New Logs Badge — Removed

The entire badge block and its three supporting items are deleted:

```tsx
// REMOVED from JSX:
{newLogsCount > 0 && (
  <Button onClick={clearNewLogsBadge}>
    {newLogsCount} new
  </Button>
)}

// REMOVED from state:
const [newLogsCount, setNewLogsCount] = useState(0);
const lastViewedTimestamp = useRef<number>(Date.now());

// REMOVED handler:
const clearNewLogsBadge = () => { ... };
```

### Firestore Import Cleanup

```typescript
// Before
import {
  collection, query, orderBy, onSnapshot, Timestamp, limit,
} from "firebase/firestore";

// After
import {
  collection, query, orderBy, getDocs, Timestamp, limit,
} from "firebase/firestore";
```

---

## Data Models

No data model changes. The `UnifiedLog` interface, all sub-types (`AuditActor`, `TransferDetail`, action union types), and the `PAGE_SIZE` constant remain identical.

The four state arrays retain the same TypeScript types:

```typescript
const [customerAuditLogs, setCustomerAuditLogs] = useState<UnifiedLog[]>([]);
const [activityLogs, setActivityLogs] = useState<UnifiedLog[]>([]);
const [systemAuditLogs, setSystemAuditLogs] = useState<UnifiedLog[]>([]);
const [auditTrailLogs, setAuditTrailLogs] = useState<UnifiedLog[]>([]);
```

One new state variable is added:

```typescript
const [error, setError] = useState(false);
```

This is set to `true` only when the primary collection (`taskflow_customer_audit_logs`) `getDocs` call throws. It is reset to `false` at the start of each `fetchAllLogs` invocation so that a subsequent Refresh can recover.

### Query Constraints (Preserved)

| Collection | orderBy field | limit |
|---|---|---|
| `taskflow_customer_audit_logs` | `timestamp` desc | 500 |
| `activity_logs` | `date_created` desc | 500 |
| `systemAudits` | `timestamp` desc | 500 |
| `audit_trails` | `timestamp` desc | 500 |

These are identical to the constraints used in the existing `onSnapshot` queries.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Fetch results are fully merged into allLogs

*For any* combination of document arrays returned by the four `getDocs` calls, every document from every collection should appear in the merged `allLogs` array, and `loading` should be `false` after the fetch completes.

**Validates: Requirements 1.3**

---

### Property 2: Optional collection failures do not prevent rendering

*For any* non-empty subset of the three optional collections (`activity_logs`, `systemAudits`, `audit_trails`) that fail, the component should still render with data from the remaining collections and `loading` should be `false`.

**Validates: Requirements 1.5**

---

### Property 3: Refresh replaces all log data

*For any* initial log dataset and *any* new log dataset returned on refresh, after the refresh completes the `allLogs` array should contain exactly the documents from the new fetch and none from the previous fetch.

**Validates: Requirements 2.1**

---

### Property 4: Filter predicate is sound

*For any* set of logs and *any* combination of active filters (action, source, date preset, custom date range, actor, module, search query), every log in the filtered result must satisfy all active filter predicates, and no log that satisfies all predicates should be absent from the result.

**Validates: Requirements 4.1**

---

### Property 5: Pagination slice is correct

*For any* filtered list of length N and *any* page number P (1 ≤ P ≤ ceil(N/20)), the paginated slice should contain exactly `min(20, N - (P-1)*20)` items and should correspond to the correct offset `(P-1)*20` into the filtered list.

**Validates: Requirements 4.2**

---

### Property 6: Stats counts are consistent with log data

*For any* set of logs, the seven stat values (total, transfers, creates, updates, deletes, autoids, sessions) should equal the exact counts of each action type in the log array, and their sum (excluding total) should equal the total count of logs whose action falls into one of those categories.

**Validates: Requirements 4.8**

---

## Error Handling

### Primary Collection Failure

If `getDocs` for `taskflow_customer_audit_logs` throws (network error, permission denied, etc.):

1. `setError(true)` is called.
2. `setLoading(false)` is called.
3. The function returns early — no optional collection fetches are attempted.
4. The UI renders an error state (e.g., a message in place of the table).
5. The Refresh button remains visible and enabled so the user can retry.
6. On the next `fetchAllLogs` invocation, `setError(false)` is called first to reset the error state.

### Optional Collection Failures

`Promise.allSettled` is used for the three optional collections. A rejected promise results in an empty array for that collection's state — the component renders normally with data from whichever collections succeeded. No error state is set and no user-visible message is shown (consistent with the existing `onSnapshot` error handling which only `console.warn`s).

### Loading State During Refresh

`setLoading(true)` is called at the start of every `fetchAllLogs` invocation, including user-triggered refreshes. This causes the table to display skeleton rows, giving the user clear feedback that a fetch is in progress. The Refresh button is not disabled during this period (Req 2.4).

---

## Testing Strategy

### Unit Tests (Example-Based)

These cover specific scenarios and integration points:

- **Mount behaviour**: Verify `getDocs` is called exactly 4 times on mount; verify `onSnapshot` is never called.
- **Query constraints**: Verify each `getDocs` call receives a query with `orderBy` and `limit(500)`.
- **Primary failure**: Mock `getDocs` to reject for `taskflow_customer_audit_logs`; verify error state is shown and `loading` is `false`.
- **Refresh button wiring**: Verify clicking Refresh calls `fetchAllLogs` (not `window.location.reload()`).
- **Loading during refresh**: Verify `loading` is `true` while `getDocs` is pending.
- **Refresh button always enabled**: Verify the Refresh button is not `disabled` during loading.
- **New Logs Badge absent**: Verify no badge element with "new" text is rendered.
- **Export CSV**: Mock `exportAuditLogsToCSV`, click the button, verify it is called with the filtered logs.
- **Export PDF**: Mock `exportAuditLogsToPDF`, click the button, verify it is called with the filtered logs.
- **Detail dialog**: Click the Eye icon on a row, verify the dialog opens with the correct log entry.
- **Bulk export**: Select rows via checkboxes, verify the bulk export button appears and calls `exportAuditLogsToCSV` with only the selected rows.

### Property-Based Tests

Property-based testing is appropriate here because the core logic under test — merging, filtering, pagination, and stats computation — consists of pure functions over in-memory data structures. Input variation (different document counts, action types, filter combinations, page numbers) meaningfully exercises edge cases. Each property test should run a minimum of 100 iterations.

**Library**: [fast-check](https://github.com/dubzzz/fast-check) (TypeScript-native, works with Jest/Vitest).

**Tag format**: `// Feature: audit-logs-getdoc-refactor, Property {N}: {property_text}`

| Property | Test approach |
|---|---|
| P1: Fetch results fully merged | Generate random doc arrays for all 4 collections; mock getDocs; verify allLogs length = sum of all arrays |
| P2: Optional failures don't block render | Generate random subsets of optional collections to fail; verify component renders with remaining data |
| P3: Refresh replaces data | Generate two random datasets; load first, refresh with second; verify allLogs matches second dataset exactly |
| P4: Filter predicate is sound | Generate random log arrays and random filter values; apply filter; verify every result satisfies all predicates |
| P5: Pagination slice is correct | Generate random list lengths and page numbers; verify slice bounds and item count |
| P6: Stats counts consistent | Generate random logs with known action distributions; verify each stat count matches |

**Minimum iterations**: 100 per property test.

### Smoke Tests (Static / Code Review)

These verify code structure rather than runtime behaviour and are best checked via linting or code review:

- `getDocs` is imported from `firebase/firestore`.
- `onSnapshot` is not imported from `firebase/firestore`.
- `newLogsCount` state, `lastViewedTimestamp` ref, and `clearNewLogsBadge` handler are absent from the file.
- All other Firestore imports (`collection`, `query`, `orderBy`, `Timestamp`, `limit`) are present.
