import { describe, it, expect } from 'vitest';
import {
  filterEmployees,
  sortEmployees,
  filterAndSortEmployees,
  type Employee,
} from '../employeeFilters';

/**
 * Unit tests for employee filtering and sorting logic.
 * Validates: Requirements 2.5, 2.6, 2.7
 */

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 1,
    username: 'Ion Popescu',
    role: 'employee',
    phone: '0712345678',
    unique_code: 'EMP001',
    createdAt: '2024-01-15T08:00:00.000Z',
    contract_ended_at: null,
    is_checked_in: false,
    ...overrides,
  };
}

const employees: Employee[] = [
  makeEmployee({ id: 1, username: 'Ana Admin', role: 'admin', phone: '0700000001', unique_code: 'ADM01', is_checked_in: true }),
  makeEmployee({ id: 2, username: 'Bogdan Lider', role: 'leader', phone: '0700000002', unique_code: 'LDR01', is_checked_in: true }),
  makeEmployee({ id: 3, username: 'Cristina Angajat', role: 'employee', phone: '0700000003', unique_code: 'EMP01', is_checked_in: false }),
  makeEmployee({ id: 4, username: 'Dan Angajat', role: 'employee', phone: '0700000004', unique_code: 'EMP02', is_checked_in: true }),
  makeEmployee({ id: 5, username: 'Elena Fost', role: 'employee', phone: '0700000005', unique_code: 'EMP03', contract_ended_at: '2024-06-01', is_checked_in: false }),
];

const noFilters = { searchQuery: '', roleFilter: null as const, statusFilter: null as const };

describe('filterEmployees', () => {
  describe('search query', () => {
    it('filters by username (case-insensitive)', () => {
      const result = filterEmployees(employees, { ...noFilters, searchQuery: 'ana' });
      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('Ana Admin');
    });

    it('filters by unique_code', () => {
      const result = filterEmployees(employees, { ...noFilters, searchQuery: 'LDR01' });
      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('Bogdan Lider');
    });

    it('filters by phone', () => {
      const result = filterEmployees(employees, { ...noFilters, searchQuery: '0700000003' });
      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('Cristina Angajat');
    });

    it('returns all when search query is empty', () => {
      const result = filterEmployees(employees, { ...noFilters, searchQuery: '' });
      expect(result).toHaveLength(5);
    });

    it('returns all when search query is whitespace', () => {
      const result = filterEmployees(employees, { ...noFilters, searchQuery: '   ' });
      expect(result).toHaveLength(5);
    });

    it('returns empty when no match', () => {
      const result = filterEmployees(employees, { ...noFilters, searchQuery: 'xyz999' });
      expect(result).toHaveLength(0);
    });
  });

  describe('role filter', () => {
    it('filters by admin role', () => {
      const result = filterEmployees(employees, { ...noFilters, roleFilter: 'admin' });
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('admin');
    });

    it('filters by leader role', () => {
      const result = filterEmployees(employees, { ...noFilters, roleFilter: 'leader' });
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('leader');
    });

    it('filters by employee role', () => {
      const result = filterEmployees(employees, { ...noFilters, roleFilter: 'employee' });
      expect(result).toHaveLength(3);
      result.forEach(u => expect(u.role).toBe('employee'));
    });

    it('returns all when role filter is null', () => {
      const result = filterEmployees(employees, { ...noFilters, roleFilter: null });
      expect(result).toHaveLength(5);
    });
  });

  describe('status filter', () => {
    it('filters checked_in employees', () => {
      const result = filterEmployees(employees, { ...noFilters, statusFilter: 'checked_in' });
      expect(result).toHaveLength(3);
      result.forEach(u => expect(u.is_checked_in).toBe(true));
    });

    it('filters not_checked_in employees (excludes contract ended)', () => {
      const result = filterEmployees(employees, { ...noFilters, statusFilter: 'not_checked_in' });
      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('Cristina Angajat');
      result.forEach(u => {
        expect(u.is_checked_in).toBe(false);
        expect(u.contract_ended_at).toBeNull();
      });
    });

    it('filters contract_ended employees', () => {
      const result = filterEmployees(employees, { ...noFilters, statusFilter: 'contract_ended' });
      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('Elena Fost');
      result.forEach(u => expect(u.contract_ended_at).not.toBeNull());
    });

    it('returns all when status filter is null', () => {
      const result = filterEmployees(employees, { ...noFilters, statusFilter: null });
      expect(result).toHaveLength(5);
    });
  });

  describe('combined filters', () => {
    it('combines search + role filter', () => {
      const result = filterEmployees(employees, {
        searchQuery: 'angajat',
        roleFilter: 'employee',
        statusFilter: null,
      });
      expect(result).toHaveLength(2);
      result.forEach(u => {
        expect(u.role).toBe('employee');
        expect(u.username.toLowerCase()).toContain('angajat');
      });
    });

    it('combines role + status filter', () => {
      const result = filterEmployees(employees, {
        searchQuery: '',
        roleFilter: 'employee',
        statusFilter: 'checked_in',
      });
      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('Dan Angajat');
    });

    it('combines all three filters', () => {
      const result = filterEmployees(employees, {
        searchQuery: 'dan',
        roleFilter: 'employee',
        statusFilter: 'checked_in',
      });
      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('Dan Angajat');
    });
  });
});

describe('sortEmployees', () => {
  it('sorts by username ascending', () => {
    const result = sortEmployees(employees, { sortColumn: 'username', sortDirection: 'asc' });
    const activeNames = result.filter(u => !u.contract_ended_at).map(u => u.username);
    for (let i = 1; i < activeNames.length; i++) {
      expect(activeNames[i].localeCompare(activeNames[i - 1], undefined, { sensitivity: 'base' })).toBeGreaterThanOrEqual(0);
    }
  });

  it('sorts by username descending', () => {
    const result = sortEmployees(employees, { sortColumn: 'username', sortDirection: 'desc' });
    const activeNames = result.filter(u => !u.contract_ended_at).map(u => u.username);
    for (let i = 1; i < activeNames.length; i++) {
      expect(activeNames[i].localeCompare(activeNames[i - 1], undefined, { sensitivity: 'base' })).toBeLessThanOrEqual(0);
    }
  });

  it('sorts by role ascending', () => {
    const result = sortEmployees(employees, { sortColumn: 'role', sortDirection: 'asc' });
    const activeRoles = result.filter(u => !u.contract_ended_at).map(u => u.role);
    for (let i = 1; i < activeRoles.length; i++) {
      expect(activeRoles[i].localeCompare(activeRoles[i - 1], undefined, { sensitivity: 'base' })).toBeGreaterThanOrEqual(0);
    }
  });

  it('always places contract-ended employees at the bottom', () => {
    const result = sortEmployees(employees, { sortColumn: 'username', sortDirection: 'asc' });
    const endedIndex = result.findIndex(u => !!u.contract_ended_at);
    if (endedIndex >= 0) {
      // All entries after the first contract-ended should also be contract-ended
      for (let i = endedIndex; i < result.length; i++) {
        expect(result[i].contract_ended_at).not.toBeNull();
      }
      // All entries before should be active
      for (let i = 0; i < endedIndex; i++) {
        expect(result[i].contract_ended_at).toBeNull();
      }
    }
  });

  it('contract-ended at bottom even with descending sort', () => {
    const result = sortEmployees(employees, { sortColumn: 'username', sortDirection: 'desc' });
    const lastActive = result.filter(u => !u.contract_ended_at);
    const ended = result.filter(u => !!u.contract_ended_at);
    // All active should come before all ended
    const lastActiveIdx = result.indexOf(lastActive[lastActive.length - 1]);
    if (ended.length > 0) {
      const firstEndedIdx = result.indexOf(ended[0]);
      expect(lastActiveIdx).toBeLessThan(firstEndedIdx);
    }
  });

  it('handles null values in sort column', () => {
    const emps = [
      makeEmployee({ id: 1, username: 'A', phone: null }),
      makeEmployee({ id: 2, username: 'B', phone: '0712345678' }),
    ];
    const result = sortEmployees(emps, { sortColumn: 'phone', sortDirection: 'asc' });
    expect(result).toHaveLength(2);
  });
});

describe('filterAndSortEmployees', () => {
  it('applies both filter and sort', () => {
    const result = filterAndSortEmployees(
      employees,
      { searchQuery: '', roleFilter: 'employee', statusFilter: null },
      { sortColumn: 'username', sortDirection: 'asc' },
    );
    expect(result.length).toBe(3);
    result.forEach(u => expect(u.role).toBe('employee'));
    // Contract-ended at bottom
    const active = result.filter(u => !u.contract_ended_at);
    const ended = result.filter(u => !!u.contract_ended_at);
    if (active.length > 0 && ended.length > 0) {
      expect(result.indexOf(active[active.length - 1])).toBeLessThan(result.indexOf(ended[0]));
    }
  });
});
