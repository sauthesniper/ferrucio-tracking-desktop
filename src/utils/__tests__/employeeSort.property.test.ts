import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { sortEmployees, type Employee, type SortColumn, type SortDirection } from '../employeeFilters';

/**
 * Feature: dashboard-ui-overhaul, Property 5: Employee sorting with contract-ended invariant
 *
 * For any list of employees and any sort column, employees with contract_ended_at set
 * must always appear after employees with active contracts, and within each group
 * the order must respect the selected sort column and direction.
 *
 * Validates: Requirements 2.4, 2.6
 */

const arbDateStr = fc
  .integer({ min: 1577836800000, max: 1893456000000 }) // 2020-01-01 to 2030-01-01
  .map(ts => new Date(ts).toISOString());

const arbDateOnlyStr = fc
  .integer({ min: 1577836800000, max: 1893456000000 })
  .map(ts => new Date(ts).toISOString().split('T')[0]);

const arbEmployee: fc.Arbitrary<Employee> = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  username: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
  role: fc.constantFrom('admin', 'leader', 'employee'),
  phone: fc.oneof(fc.constant(null), fc.stringMatching(/^07\d{8}$/)),
  unique_code: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 10 })),
  createdAt: arbDateStr,
  contract_ended_at: fc.oneof(fc.constant(null), arbDateOnlyStr),
  is_checked_in: fc.boolean(),
});

const arbSortColumn: fc.Arbitrary<SortColumn> = fc.constantFrom('username', 'role', 'phone', 'unique_code', 'createdAt');
const arbSortDirection: fc.Arbitrary<SortDirection> = fc.constantFrom('asc', 'desc');

describe('sortEmployees - Property Tests', () => {
  it('contract-ended employees always appear after active employees, and within each group sort order is respected', () => {
    fc.assert(
      fc.property(
        fc.array(arbEmployee, { minLength: 0, maxLength: 50 }),
        arbSortColumn,
        arbSortDirection,
        (employees, sortColumn, sortDirection) => {
          const sorted = sortEmployees(employees, { sortColumn, sortDirection });

          // Invariant 1: same length (no elements lost or added)
          expect(sorted).toHaveLength(employees.length);

          // Partition into active and ended
          const active = sorted.filter(e => !e.contract_ended_at);
          const ended = sorted.filter(e => !!e.contract_ended_at);

          // Invariant 2: all active come before all ended
          if (active.length > 0 && ended.length > 0) {
            const lastActiveIdx = sorted.lastIndexOf(active[active.length - 1]);
            const firstEndedIdx = sorted.indexOf(ended[0]);
            expect(lastActiveIdx).toBeLessThan(firstEndedIdx);
          }

          // Invariant 3: within active group, sort order is respected
          for (let i = 1; i < active.length; i++) {
            const aVal = String(active[i - 1][sortColumn] ?? '');
            const bVal = String(active[i][sortColumn] ?? '');
            const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
            if (sortDirection === 'asc') {
              expect(cmp).toBeLessThanOrEqual(0);
            } else {
              expect(cmp).toBeGreaterThanOrEqual(0);
            }
          }

          // Invariant 4: within ended group, sort order is respected
          for (let i = 1; i < ended.length; i++) {
            const aVal = String(ended[i - 1][sortColumn] ?? '');
            const bVal = String(ended[i][sortColumn] ?? '');
            const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
            if (sortDirection === 'asc') {
              expect(cmp).toBeLessThanOrEqual(0);
            } else {
              expect(cmp).toBeGreaterThanOrEqual(0);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
