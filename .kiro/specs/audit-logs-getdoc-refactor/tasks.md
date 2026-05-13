# Implementation Plan: audit-logs-getdoc-refactor

## Overview

Replace the four persistent `onSnapshot` Firestore listeners in `app/audit-logs/page.tsx` with a single `fetchAllLogs` async function using `getDocs` + `Promise.allSettled`. Remove the New Logs Badge and its supporting state, wire the Refresh button to the new fetch function, update the subtitle text, add an error state, and clean up the Firestore import list. All downstream logic (filtering, pagination, analytics, export, bulk selection) is unchanged.

## Tasks

- [x] 1. Clean up Firestore imports and remove real-time state
  - [x] 1.1 Swap `onSnapshot` for `getDocs` in the `firebase/firestore` import
    - Remove `onSnapshot` from the import list
    - Add `getDocs` to the import list
    - Retain `collection`, `query`, `orderBy`, `Timestamp`, `limit` unchanged
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 1.2 Remove the New Logs Badge state and handler
    - Delete `const [newLogsCount, setNewLogsCount] = useState(0)`
    - Delete `const lastViewedTimestamp = useRef<number>(Date.now())`
    - Delete the `clearNewLogsBadge` handler function
    - _Requirements: 3.2, 3.3_

- [x] 2. Add `error` state and `fetchAllLogs` function
  - [x] 2.1 Add the `error` boolean state variable
    - Add `const [error, setError] = useState(false)` alongside the other state declarations
    - _Requirements: 1.6_

  - [x] 2.2 Implement the `fetchAllLogs` `useCallback` function
    - Add `fetchAllLogs` as a `useCallback(async () => { ... }, [])` replacing the four `useEffect`+`onSnapshot` blocks
    - Call `setError(false)` and `setLoading(true)` at the start of every invocation
    - Fetch `taskflow_customer_audit_logs` first with `getDocs`; on failure call `setError(true)`, `setLoading(false)`, and return early
    - Fetch the three optional collections (`activity_logs`, `systemAudits`, `audit_trails`) concurrently via `Promise.allSettled`
    - Apply the same `orderBy` + `limit(500)` query constraints that the removed `onSnapshot` queries used
    - Normalise each optional result using the same field-mapping logic extracted from the removed `onSnapshot` callbacks; use an empty array for any rejected promise
    - Call the four `set*` state setters and `setLoading(false)` after all fetches complete
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.2, 2.3_

  - [ ]* 2.3 Write property test for fetch merge completeness (Property 1)
    - **Property 1: Fetch results are fully merged into allLogs**
    - **Validates: Requirements 1.3**
    - Generate random document arrays for all four collections; mock `getDocs` to return them; verify `allLogs.length` equals the sum of all four arrays
    - Tag: `// Feature: audit-logs-getdoc-refactor, Property 1: Fetch results are fully merged into allLogs`
    - Minimum 100 iterations

  - [ ]* 2.4 Write property test for optional failure resilience (Property 2)
    - **Property 2: Optional collection failures do not prevent rendering**
    - **Validates: Requirements 1.5**
    - Generate random non-empty subsets of the three optional collections to fail; verify the component still renders with data from the remaining collections and `loading` is `false`
    - Tag: `// Feature: audit-logs-getdoc-refactor, Property 2: Optional collection failures do not prevent rendering`
    - Minimum 100 iterations

- [x] 3. Remove the four `onSnapshot` `useEffect` hooks and add the mount effect
  - [x] 3.1 Delete all four `onSnapshot` `useEffect` blocks
    - Remove the `useEffect` for `taskflow_customer_audit_logs`
    - Remove the `useEffect` for `activity_logs`
    - Remove the `useEffect` for `audit_trails`
    - Remove the `useEffect` for `systemAudits`
    - _Requirements: 1.2_

  - [x] 3.2 Add the single mount `useEffect`
    - Add `useEffect(() => { fetchAllLogs(); }, [fetchAllLogs])` in place of the four removed effects
    - _Requirements: 1.1_

  - [ ]* 3.3 Write property test for refresh data replacement (Property 3)
    - **Property 3: Refresh replaces all log data**
    - **Validates: Requirements 2.1**
    - Generate two random datasets; load the first, trigger refresh with the second; verify `allLogs` contains exactly the documents from the second fetch and none from the first
    - Tag: `// Feature: audit-logs-getdoc-refactor, Property 3: Refresh replaces all log data`
    - Minimum 100 iterations

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Wire the Refresh button and update subtitle text
  - [x] 5.1 Change the Refresh button `onClick` handler
    - Replace `onClick={() => window.location.reload()}` with `onClick={fetchAllLogs}`
    - The button must remain always-enabled and always-visible
    - _Requirements: 2.1, 2.4_

  - [x] 5.2 Update the subtitle text
    - Change `"Real-time activity trail from ..."` to `"Activity logs fetched on demand from ..."`
    - _Requirements: (design subtitle update)_

- [x] 6. Remove the New Logs Badge JSX and add the error state UI
  - [x] 6.1 Remove the New Logs Badge JSX block
    - Delete the `{newLogsCount > 0 && ( <Button onClick={clearNewLogsBadge}>...</Button> )}` block from the render output
    - _Requirements: 3.1_

  - [x] 6.2 Add the error state UI in the table area
    - When `error` is `true`, render an error message in place of the table (e.g., a card or alert indicating the primary collection failed to load and prompting the user to click Refresh)
    - The Refresh button must remain visible and enabled when the error state is shown
    - _Requirements: 1.6, 2.4_

- [ ] 7. Write remaining property-based tests
  - [ ]* 7.1 Write property test for filter soundness (Property 4)
    - **Property 4: Filter predicate is sound**
    - **Validates: Requirements 4.1**
    - Generate random log arrays and random combinations of active filters (action, source, date preset, custom date range, actor, module, search query); apply the filter memo; verify every result satisfies all active predicates and no qualifying log is absent
    - Tag: `// Feature: audit-logs-getdoc-refactor, Property 4: Filter predicate is sound`
    - Minimum 100 iterations

  - [ ]* 7.2 Write property test for pagination correctness (Property 5)
    - **Property 5: Pagination slice is correct**
    - **Validates: Requirements 4.2**
    - Generate random filtered list lengths N and valid page numbers P (1 ≤ P ≤ ceil(N/20)); verify the paginated slice contains exactly `min(20, N - (P-1)*20)` items at the correct offset `(P-1)*20`
    - Tag: `// Feature: audit-logs-getdoc-refactor, Property 5: Pagination slice is correct`
    - Minimum 100 iterations

  - [ ]* 7.3 Write property test for stats consistency (Property 6)
    - **Property 6: Stats counts are consistent with log data**
    - **Validates: Requirements 4.8**
    - Generate random logs with known action distributions; verify each of the seven stat values (total, transfers, creates, updates, deletes, autoids, sessions) equals the exact count of that action type in the log array
    - Tag: `// Feature: audit-logs-getdoc-refactor, Property 6: Stats counts are consistent with log data`
    - Minimum 100 iterations

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use [fast-check](https://github.com/dubzzz/fast-check) and must run a minimum of 100 iterations each
- The normalisation logic for optional collections is extracted verbatim from the removed `onSnapshot` callbacks — no semantic changes to field mapping
- The `error` state is reset to `false` at the start of every `fetchAllLogs` invocation so a subsequent Refresh can recover from a previous failure
- All downstream logic (filtering, pagination, analytics, export, bulk selection, detail dialog) is untouched by this refactor
