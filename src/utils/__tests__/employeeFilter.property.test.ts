import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { filterEmployees, type Employee, type RoleFilter, type StatusFilter } from '../employeeFilters';

/**
 * Feature: dashboard-ui-overhaul, Property 6: Employee filtering
 *
 * For any list of employees, any search query, and any combination of filters
 * (role, status), the filtered result must contain only employees that satisfy
 * ALL criteria simultaneously:
 * (a) name, unique_code, or phone contains the search query
 * (b) role matches the role filter
 * (c) status matches the status filter
 *
 * Validates: Requirements 2.5, 2.7
 */

const arbDateStr = fc
  .integer({ min: 1577836800000, max: 1893456000000 })
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

const arbRoleFilter: fc.Arbitrary<RoleFilter> = fc.constantFrom(null, 'admin', 'leader', 'employee');
const arbStatusFilter: fc.Arbitrary<StatusFilter> = fc.constantFrom(null, 'checked_in', 'not_checked_in', 'contract_ended');
const arbSearchQuery: fc.Arbitrary<string> = fc.oneof(
  fc.constant(''),
  fc.string({ minLength: 1, maxLength: 10 }),
);

describe('filterEmployees - Property Tests', () => {
  it('every result satisfies all filter criteria simultaneously', () => {
    fc.assert(
      fc.property(
        fc.array(arbEmployee, { minLength: 0, maxLength: 50 }),
        arbSearchQuery,
        arbRoleFilter,
        arbStatusFilter,
        (employees, searchQuery, roleFilter, statusFilter) => {
          const result = filterEmployees(employees, { searchQuery, roleFilter, statusFilter });

          // Invariant 1: result is a subset of input
          expect(result.length).toBeLessThanOrEqual(employees.length);
          for (const r of result) {
            expect(employees.some(e => e.id === r.id)).toBe(true);
          }

          // Invariant 2: every result matches the search query
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            for (const r of result) {
              const matchesName = r.username.toLowerCase().includes(q);
              const matchesCode = r.unique_code ? r.unique_code.toLowerCase().includes(q) : false;
              const matchesPhone = r.phone ? r.phone.toLowerCase().includes(q) : false;
              expect(matchesName || matchesCode || matchesPhone).toBe(true);
            }
          }

          // Invariant 3: every result matches the role filter
          if (roleFilter) {
            for (const r of result) {
              expect(r.role).toBe(roleFilter);
            }
          }

          // Invariant 4: every result matches the status filter
          if (statusFilter === 'checked_in') {
            for (const r of result) {
              expect(r.is_checked_in).toBe(true);
            }
          } else if (statusFilter === 'not_checked_in') {
            for (const r of result) {
              expect(r.is_checked_in).toBe(false);
              expect(r.contract_ended_at).toBeNull();
            }
          } else if (statusFilter === 'contract_ended') {
            for (const r of result) {
              expect(r.contract_ended_at).not.toBeNull();
            }
          }

          // Invariant 5: no employee that matches all criteria is excluded
          const q = searchQuery.toLowerCase().trim();
          for (const e of employees) {
            const matchesSearch = !q || (
              e.username.toLowerCase().includes(q) ||
              (e.unique_code ? e.unique_code.toLowerCase().includes(q) : false) ||
              (e.phone ? e.phone.toLowerCase().includes(q) : false)
            );
            const matchesRole = !roleFilter || e.role === roleFilter;
            let matchesStatus = true;
            if (statusFilter === 'checked_in') matchesStatus = e.is_checked_in;
            else if (statusFilter === 'not_checked_in') matchesStatus = !e.is_checked_in && !e.contract_ended_at;
            else if (statusFilter === 'contract_ended') matchesStatus = !!e.contract_ended_at;

            if (matchesSearch && matchesRole && matchesStatus) {
              expect(result.some(r => r.id === e.id)).toBe(true);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
