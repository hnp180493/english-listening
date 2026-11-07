import { describe, expect, it } from 'vitest';
import { isStrictCompatible, parseJsonLoose, sanitizeSchemaName, toClosedSchema, validateJson } from './schema';
import type { JsonSchema } from './types';

const schema: JsonSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: { type: 'object', properties: { word: { type: 'string' }, level: { type: 'string', enum: ['a', 'b'] }, n: { type: 'integer' } }, required: ['word', 'level', 'n'] },
    },
    ok: { type: 'boolean' },
  },
  required: ['items', 'ok'],
};

describe('validateJson', () => {
  it('accepts a valid value', () => {
    expect(validateJson({ items: [{ word: 'x', level: 'a', n: 1 }], ok: true }, schema)).toEqual([]);
  });
  it('reports missing, wrong types, enum and bounds with paths', () => {
    const errs = validateJson({ items: [{ word: 1, level: 'z', n: 1.5 }, {}, {}, {}] }, schema);
    expect(errs).toContain('$.ok: missing required property');
    expect(errs).toContain('$.items: expected at most 3 items');
    expect(errs).toContain('$.items[0].word: expected string');
    expect(errs).toContain('$.items[0].level: must be one of a, b');
    expect(errs).toContain('$.items[0].n: expected integer');
    expect(errs).toContain('$.items[1].word: missing required property');
    expect(validateJson([], schema)).toEqual(['$: expected object']);
  });
});

describe('provider schema shaping', () => {
  it('closes objects and drops array bounds', () => {
    const c = toClosedSchema(schema) as { additionalProperties: boolean; properties: { items: { minItems?: number; items: { additionalProperties: boolean } } } };
    expect(c.additionalProperties).toBe(false);
    expect(c.properties.items.minItems).toBeUndefined();
    expect(c.properties.items.items.additionalProperties).toBe(false);
    // original untouched
    expect((schema as { additionalProperties?: boolean }).additionalProperties).toBeUndefined();
  });
  it('strict only when every property is required', () => {
    expect(isStrictCompatible(schema)).toBe(true);
    expect(isStrictCompatible({ type: 'object', properties: { a: { type: 'string' } } })).toBe(false);
  });
  it('sanitizes schema names', () => {
    expect(sanitizeSchemaName('bài tập 1')).toBe('b_i_t_p_1');
    expect(sanitizeSchemaName('')).toBe('result');
  });
});

describe('parseJsonLoose', () => {
  it('parses plain, fenced and embedded JSON', () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonLoose('Here:\n```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(parseJsonLoose('Sure! {"a":3} hope it helps')).toEqual({ a: 3 });
    expect(parseJsonLoose('[1,2]')).toEqual([1, 2]);
    expect(parseJsonLoose('nope')).toBeUndefined();
    expect(parseJsonLoose('')).toBeUndefined();
  });
});
