/**
 * Utility functions for filtering and sorting employees.
 * Extracted from EmployeesPage.tsx for testability.
 */

export interface Employee {
  id: number;
  username: string;
  role: string;
  phone: string | null;
  unique_code: string | null;
  createdAt: string;
  contract_ended_at: string | null;
  is_checked_in: boolean;
}

export type SortColumn = 'username' | 'role' | 'phone' | 'unique_code' | 'createdAt';
export type SortDirection = 'asc' | 'desc';
export type RoleFilter = 'admin' | 'leader' | 'employee' | null;
export type StatusFilter = 'checked_in' | 'not_checked_in' | 'contract_ended' | 'on_leave' | null;

export interface FilterOptions {
  searchQuery: string;
  roleFilter: RoleFilter;
  statusFilter: StatusFilter;
  leaveEmployeeIds?: Set<number>;
}

export interface SortOptions {
  sortColumn: SortColumn;
  sortDirection: SortDirection;
}

/**
 * Filters employees by search query (name, unique_code, phone),
 * role, and status. All filters are combinable.
 */
export function filterEmployees(employees: Employee[], options: FilterOptions): Employee[] {
  let result = [...employees];

  // Search filter
  if (options.searchQuery.trim()) {
    const q = options.searchQuery.toLowerCase().trim();
    result = result.filter(u =>
      u.username.toLowerCase().includes(q) ||
      (u.unique_code && u.unique_code.toLowerCase().includes(q)) ||
      (u.phone && u.phone.toLowerCase().includes(q))
    );
  }

  // Role filter
  if (options.roleFilter) {
    result = result.filter(u => u.role === options.roleFilter);
  }

  // Status filter
  if (options.statusFilter === 'checked_in') {
    result = result.filter(u => u.is_checked_in);
  } else if (options.statusFilter === 'not_checked_in') {
    result = result.filter(u => !u.is_checked_in && !u.contract_ended_at);
  } else if (options.statusFilter === 'contract_ended') {
    result = result.filter(u => !!u.contract_ended_at);
  } else if (options.statusFilter === 'on_leave') {
    const ids = options.leaveEmployeeIds || new Set();
    result = result.filter(u => ids.has(u.id));
  }

  return result;
}

/**
 * Sorts employees by the given column and direction.
 * Employees with contract_ended_at are always placed at the bottom,
 * regardless of sort column or direction.
 */
export function sortEmployees(employees: Employee[], options: SortOptions): Employee[] {
  const result = [...employees];

  result.sort((a, b) => {
    const aEnded = !!a.contract_ended_at;
    const bEnded = !!b.contract_ended_at;
    if (aEnded !== bEnded) return aEnded ? 1 : -1;

    const aVal = a[options.sortColumn] ?? '';
    const bVal = b[options.sortColumn] ?? '';
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' });
    return options.sortDirection === 'asc' ? cmp : -cmp;
  });

  return result;
}

/**
 * Applies both filtering and sorting in sequence.
 */
export function filterAndSortEmployees(
  employees: Employee[],
  filterOptions: FilterOptions,
  sortOptions: SortOptions,
): Employee[] {
  const filtered = filterEmployees(employees, filterOptions);
  return sortEmployees(filtered, sortOptions);
}
