import { describe, it, expect } from 'vitest';
import { createDefaultElements, generateTemplateId, generateTemplateName, USER_FIELDS } from './printTypes';

describe('createDefaultElements', () => {
  it('should create default elements with correct structure', () => {
    const elements = createDefaultElements();

    expect(elements).toHaveLength(2);

    // First element should be a field
    expect(elements[0].type).toBe('field');
    expect(elements[0].source).toBe('sample');
    expect(elements[0].fieldName).toBe('ID');

    // Second element should be a QR code
    expect(elements[1].type).toBe('qrCode');
  });

  it('should create QR code element with contentParts', () => {
    const elements = createDefaultElements();
    const qrElement = elements[1];

    if (qrElement.type !== 'qrCode') {
      throw new Error('Expected qrCode element');
    }

    expect(qrElement.contentParts).toBeDefined();
    expect(qrElement.contentParts).toHaveLength(1);
    expect(qrElement.contentParts[0]).toEqual({
      type: 'field',
      source: 'sample',
      fieldName: 'ID',
    });
  });

  it('should not have fieldType in field elements', () => {
    const elements = createDefaultElements();
    const fieldElement = elements[0];

    if (fieldElement.type !== 'field') {
      throw new Error('Expected field element');
    }

    // fieldType is now optional and should not be defined by default
    expect('fieldType' in fieldElement).toBe(false);
  });
});

describe('generateTemplateId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateTemplateId();
    const id2 = generateTemplateId();

    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^tpl-/);
    expect(id2).toMatch(/^tpl-/);
  });

  it('should generate IDs with correct format', () => {
    const id = generateTemplateId();
    // Format: tpl-{timestamp}-{random}
    expect(id).toMatch(/^tpl-\d+-[a-z0-9]+$/);
  });
});

describe('generateTemplateName', () => {
  it('should generate sequential template names', () => {
    expect(generateTemplateName(0)).toBe('Template 1');
    expect(generateTemplateName(1)).toBe('Template 2');
    expect(generateTemplateName(4)).toBe('Template 5');
  });
});

describe('USER_FIELDS', () => {
  it('should contain name and email', () => {
    expect(USER_FIELDS).toContain('name');
    expect(USER_FIELDS).toContain('email');
    expect(USER_FIELDS).toHaveLength(2);
  });
});
