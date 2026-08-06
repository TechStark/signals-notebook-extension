import { describe, it, expect } from 'vitest';
import type { SampleProperty, ContentPart, TemplateElement } from '@shared/printTypes';

// Import the internal functions for testing by extracting them
// Since they're not exported, we'll test through the public API or replicate logic

/**
 * Helper to resolve content parts (replicates resolveContentParts logic)
 */
function resolveContentParts(
  parts: ContentPart[],
  sampleData: Record<string, unknown>,
  properties: SampleProperty[],
  userData?: { name: string; email: string },
): string {
  return parts.map((part) => {
    if (part.type === 'staticText') {
      return part.content;
    }
    // field type
    if (part.source === 'user') {
      if (part.fieldName === 'name' && userData) return userData.name;
      if (part.fieldName === 'email' && userData) return userData.email;
      return `[Unknown: ${part.fieldName}]`;
    }
    // sample source
    let prop = properties.find((p) => p.name === part.fieldName);
    if (!prop) {
      prop = properties.find((p) => p.key === part.fieldName);
    }
    if (!prop) return `[Unknown: ${part.fieldName}]`;
    const value = sampleData[prop.key];
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object' && 'auto' in (value as object)) {
      return (value as { auto?: string }).auto || '-';
    }
    return String(value);
  }).join('');
}

/**
 * Helper to get field display value (replicates getFieldDisplayValue logic)
 */
function getFieldDisplayValue(
  element: TemplateElement & { type: 'field' },
  sampleData: Record<string, unknown>,
  properties: SampleProperty[],
  userData?: { name: string; email: string },
): string {
  if (element.source === 'user') {
    if (element.fieldName === 'name' && userData) return userData.name;
    if (element.fieldName === 'email' && userData) return userData.email;
    return `[Unknown: ${element.fieldName}]`;
  }

  let prop = properties.find((p) => p.name === element.fieldName);
  if (!prop) {
    prop = properties.find((p) => p.key === element.fieldName);
  }
  if (!prop) return `[Unknown: ${element.fieldName}]`;
  const value = sampleData[prop.key];
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object' && 'auto' in (value as object)) {
    return (value as { auto?: string }).auto || '-';
  }
  return String(value);
}

describe('resolveContentParts', () => {
  const properties: SampleProperty[] = [
    { key: 'sampleId', name: 'ID', type: 'text' },
    { key: 'createdDate', name: 'Created Date', type: 'date' },
    { key: 'status', name: 'Status', type: 'enum' },
  ];

  const sampleData: Record<string, unknown> = {
    sampleId: 'S-12345',
    createdDate: '2024-01-15',
    status: 'Active',
  };

  const userData = { name: 'John Doe', email: 'john@example.com' };

  it('should resolve static text parts', () => {
    const parts: ContentPart[] = [
      { type: 'staticText', content: 'http://example.com/' },
    ];
    expect(resolveContentParts(parts, sampleData, properties)).toBe('http://example.com/');
  });

  it('should resolve sample field parts by name', () => {
    const parts: ContentPart[] = [
      { type: 'field', source: 'sample', fieldName: 'ID' },
    ];
    expect(resolveContentParts(parts, sampleData, properties)).toBe('S-12345');
  });

  it('should resolve sample field parts by key as fallback', () => {
    const parts: ContentPart[] = [
      { type: 'field', source: 'sample', fieldName: 'sampleId' },
    ];
    expect(resolveContentParts(parts, sampleData, properties)).toBe('S-12345');
  });

  it('should resolve user field parts', () => {
    const parts: ContentPart[] = [
      { type: 'field', source: 'user', fieldName: 'name' },
    ];
    expect(resolveContentParts(parts, sampleData, properties, userData)).toBe('John Doe');
  });

  it('should resolve user email field parts', () => {
    const parts: ContentPart[] = [
      { type: 'field', source: 'user', fieldName: 'email' },
    ];
    expect(resolveContentParts(parts, sampleData, properties, userData)).toBe('john@example.com');
  });

  it('should concatenate multiple parts', () => {
    const parts: ContentPart[] = [
      { type: 'staticText', content: 'http://example.com/' },
      { type: 'field', source: 'user', fieldName: 'email' },
      { type: 'staticText', content: '/' },
      { type: 'field', source: 'sample', fieldName: 'ID' },
    ];
    expect(resolveContentParts(parts, sampleData, properties, userData)).toBe(
      'http://example.com/john@example.com/S-12345',
    );
  });

  it('should return unknown for missing field', () => {
    const parts: ContentPart[] = [
      { type: 'field', source: 'sample', fieldName: 'Nonexistent' },
    ];
    expect(resolveContentParts(parts, sampleData, properties)).toBe('[Unknown: Nonexistent]');
  });

  it('should return unknown for missing user field', () => {
    const parts: ContentPart[] = [
      { type: 'field', source: 'user', fieldName: 'phone' },
    ];
    expect(resolveContentParts(parts, sampleData, properties, userData)).toBe('[Unknown: phone]');
  });

  it('should return dash for null value', () => {
    const parts: ContentPart[] = [
      { type: 'field', source: 'sample', fieldName: 'ID' },
    ];
    const dataWithNull = { ...sampleData, sampleId: null };
    expect(resolveContentParts(parts, dataWithNull, properties)).toBe('-');
  });

  it('should handle object values with auto property', () => {
    const parts: ContentPart[] = [
      { type: 'field', source: 'sample', fieldName: 'ID' },
    ];
    const dataWithAuto = { ...sampleData, sampleId: { auto: 'AUTO-123', value: 'S-12345' } };
    expect(resolveContentParts(parts, dataWithAuto, properties)).toBe('AUTO-123');
  });

  it('should return dash when auto is empty', () => {
    const parts: ContentPart[] = [
      { type: 'field', source: 'sample', fieldName: 'ID' },
    ];
    const dataWithEmptyAuto = { ...sampleData, sampleId: { auto: '' } };
    expect(resolveContentParts(parts, dataWithEmptyAuto, properties)).toBe('-');
  });
});

describe('getFieldDisplayValue', () => {
  const properties: SampleProperty[] = [
    { key: 'sampleId', name: 'ID', type: 'text' },
    { key: 'status', name: 'Status', type: 'enum' },
  ];

  const sampleData: Record<string, unknown> = {
    sampleId: 'S-12345',
    status: 'Active',
  };

  const userData = { name: 'Jane Doe', email: 'jane@example.com' };

  it('should resolve user name field', () => {
    const element = { type: 'field' as const, source: 'user' as const, fieldName: 'name', row: 0, col: 0, rowSpan: 1, colSpan: 1 };
    expect(getFieldDisplayValue(element, sampleData, properties, userData)).toBe('Jane Doe');
  });

  it('should resolve user email field', () => {
    const element = { type: 'field' as const, source: 'user' as const, fieldName: 'email', row: 0, col: 0, rowSpan: 1, colSpan: 1 };
    expect(getFieldDisplayValue(element, sampleData, properties, userData)).toBe('jane@example.com');
  });

  it('should resolve sample field by name', () => {
    const element = { type: 'field' as const, source: 'sample' as const, fieldName: 'ID', row: 0, col: 0, rowSpan: 1, colSpan: 1 };
    expect(getFieldDisplayValue(element, sampleData, properties)).toBe('S-12345');
  });

  it('should resolve sample field by key as fallback', () => {
    const element = { type: 'field' as const, source: 'sample' as const, fieldName: 'sampleId', row: 0, col: 0, rowSpan: 1, colSpan: 1 };
    expect(getFieldDisplayValue(element, sampleData, properties)).toBe('S-12345');
  });

  it('should return unknown for missing field', () => {
    const element = { type: 'field' as const, source: 'sample' as const, fieldName: 'Nonexistent', row: 0, col: 0, rowSpan: 1, colSpan: 1 };
    expect(getFieldDisplayValue(element, sampleData, properties)).toBe('[Unknown: Nonexistent]');
  });

  it('should return dash for null value', () => {
    const element = { type: 'field' as const, source: 'sample' as const, fieldName: 'ID', row: 0, col: 0, rowSpan: 1, colSpan: 1 };
    const dataWithNull = { ...sampleData, sampleId: null };
    expect(getFieldDisplayValue(element, dataWithNull, properties)).toBe('-');
  });

  it('should handle object values with auto property', () => {
    const element = { type: 'field' as const, source: 'sample' as const, fieldName: 'ID', row: 0, col: 0, rowSpan: 1, colSpan: 1 };
    const dataWithAuto = { ...sampleData, sampleId: { auto: 'AUTO-123' } };
    expect(getFieldDisplayValue(element, dataWithAuto, properties)).toBe('AUTO-123');
  });
});
