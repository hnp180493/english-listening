// JSON helpers shared by adapters and the client: provider-specific schema shaping, a small
// validator for the JsonSchema subset, and tolerant parsing of model output.

import type { JsonObjectSchema, JsonSchema } from './types';

/** Validates `value` against the subset. Returns human-readable problems (English, sent back to the model on repair); [] = valid. */
export function validateJson(value: unknown, schema: JsonSchema, path = '$'): string[] {
  const errs: string[] = [];
  switch (schema.type) {
    case 'object': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return [`${path}: expected object`];
      const obj = value as Record<string, unknown>;
      for (const k of schema.required ?? []) {
        if (!(k in obj) || obj[k] === undefined) errs.push(`${path}.${k}: missing required property`);
      }
      for (const [k, sub] of Object.entries(schema.properties)) {
        if (k in obj && obj[k] !== undefined) errs.push(...validateJson(obj[k], sub, `${path}.${k}`));
      }
      return errs;
    }
    case 'array': {
      if (!Array.isArray(value)) return [`${path}: expected array`];
      if (schema.minItems != null && value.length < schema.minItems) errs.push(`${path}: expected at least ${schema.minItems} items`);
      if (schema.maxItems != null && value.length > schema.maxItems) errs.push(`${path}: expected at most ${schema.maxItems} items`);
      value.forEach((v, i) => errs.push(...validateJson(v, schema.items, `${path}[${i}]`)));
      return errs;
    }
    case 'string':
      if (typeof value !== 'string') return [`${path}: expected string`];
      if (schema.enum && !schema.enum.includes(value)) return [`${path}: must be one of ${schema.enum.join(', ')}`];
      return [];
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? [] : [`${path}: expected number`];
    case 'integer':
      return Number.isInteger(value) ? [] : [`${path}: expected integer`];
    case 'boolean':
      return typeof value === 'boolean' ? [] : [`${path}: expected boolean`];
  }
}

type Plain = { [k: string]: unknown };

function mapSchema(schema: JsonSchema, fn: (node: Plain) => Plain): Plain {
  const node: Plain = { ...schema };
  if (schema.type === 'object') {
    node.properties = Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, mapSchema(v, fn)]));
  } else if (schema.type === 'array') {
    node.items = mapSchema(schema.items, fn);
  }
  return fn(node);
}

/**
 * Schema for OpenAI json_schema / Anthropic output_config.format: every object gets
 * additionalProperties:false (required by Anthropic, by OpenAI strict mode) and array bounds are
 * dropped (Anthropic only supports minItems 0/1; validated locally instead).
 */
export function toClosedSchema(schema: JsonSchema): Plain {
  return mapSchema(schema, (n) => {
    if (n.type === 'object') n.additionalProperties = false;
    if (n.type === 'array') {
      delete n.minItems;
      delete n.maxItems;
    }
    return n;
  });
}

/** OpenAI strict mode needs every property listed in `required`; only then do we ask for strict. */
export function isStrictCompatible(schema: JsonSchema): boolean {
  if (schema.type === 'object') {
    const req = new Set(schema.required ?? []);
    return Object.entries(schema.properties).every(([k, v]) => req.has(k) && isStrictCompatible(v));
  }
  if (schema.type === 'array') return isStrictCompatible(schema.items);
  return true;
}

/**
 * Providers only accept an OBJECT root (OpenAI json_schema, Anthropic structured outputs and tool
 * input_schema). A non-object root is wrapped as {value: <schema>} for the request; `unwrap`
 * returns the inner value (and tolerates a model that answered with the bare value anyway).
 */
export function toObjectRoot(schema: JsonSchema): { schema: JsonObjectSchema; unwrap: (v: unknown) => unknown } {
  if (schema.type === 'object') return { schema, unwrap: (v) => v };
  return {
    schema: { type: 'object', properties: { value: schema }, required: ['value'] },
    unwrap: (v) => (v && typeof v === 'object' && !Array.isArray(v) && 'value' in v ? (v as { value: unknown }).value : v),
  };
}

/** json_schema `name` / Anthropic tool name rule: ^[a-zA-Z0-9_-]{1,64}$. */
export function sanitizeSchemaName(name: string): string {
  const s = name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return s || 'result';
}

/** Instruction appended when a server has no native structured output (fallback path). */
export function jsonInstruction(schema: JsonSchema): string {
  return (
    'Respond with ONLY one JSON value (no markdown fences, no commentary) that matches this JSON Schema:\n' +
    JSON.stringify(schema)
  );
}

/**
 * Parses model output that should be JSON: tolerates ```json fences and leading/trailing prose.
 * Returns undefined when nothing parses.
 */
export function parseJsonLoose(text: string): unknown {
  const t = text.trim();
  if (!t) return undefined;
  const tryParse = (s: string): unknown => {
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  };
  const direct = tryParse(t);
  if (direct !== undefined) return direct;
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  if (fence) {
    const v = tryParse(fence[1].trim());
    if (v !== undefined) return v;
  }
  for (const [open, close] of [['{', '}'], ['[', ']']] as const) {
    const a = t.indexOf(open);
    const b = t.lastIndexOf(close);
    if (a !== -1 && b > a) {
      const v = tryParse(t.slice(a, b + 1));
      if (v !== undefined) return v;
    }
  }
  return undefined;
}
