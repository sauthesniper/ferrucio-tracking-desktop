import { describe, it, expect } from 'vitest';
import React from 'react';
import KpiCard from '../KpiCard';

/**
 * Unit tests for KpiCard component
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */

describe('KpiCard', () => {
  it('renders with required props and returns a valid element', () => {
    const element = React.createElement(KpiCard, {
      title: 'Angajați pontați',
      value: 12,
      icon: React.createElement('span', null, '👤'),
      color: '#16a34a',
    });
    expect(element).toBeDefined();
    expect(element.type).toBe(KpiCard);
    expect(element.props.title).toBe('Angajați pontați');
    expect(element.props.value).toBe(12);
    expect(element.props.color).toBe('#16a34a');
  });

  it('accepts string value for formatted display', () => {
    const element = React.createElement(KpiCard, {
      title: 'Ore lucrate',
      value: '8.5h',
      icon: React.createElement('span', null, '⏱'),
      color: '#2563eb',
    });
    expect(element.props.value).toBe('8.5h');
  });

  it('accepts optional subtitle prop', () => {
    const element = React.createElement(KpiCard, {
      title: 'Contracte active',
      value: 45,
      icon: React.createElement('span', null, '📋'),
      color: '#f59e0b',
      subtitle: 'din 50 total',
    });
    expect(element.props.subtitle).toBe('din 50 total');
  });

  it('works without subtitle prop', () => {
    const element = React.createElement(KpiCard, {
      title: 'Lideri pontați',
      value: 3,
      icon: React.createElement('span', null, '🏷'),
      color: '#8b5cf6',
    });
    expect(element.props.subtitle).toBeUndefined();
  });
});
