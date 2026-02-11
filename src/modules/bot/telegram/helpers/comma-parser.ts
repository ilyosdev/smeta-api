import { parseNumber } from './format';

export interface FormFieldDef {
  key: string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'enum';
  /** 'money' adds "so'm" suffix (default for numbers), 'plain' shows raw number */
  format?: 'money' | 'plain';
  enumValues?: string[];
  enumLabels?: Record<string, string>;
  default?: any;
}

const SHORTCUTS: Record<string, string> = {
  naqd: 'CASH',
  наличные: 'CASH',
  cash: 'CASH',
  otkazma: 'TRANSFER',
  "o'tkazma": 'TRANSFER',
  perechisleniye: 'TRANSFER',
  перевод: 'TRANSFER',
  transfer: 'TRANSFER',
  karta: 'TRANSFER',
  material: 'MATERIAL',
  ish: 'LABOR',
  'ish haqi': 'LABOR',
  labor: 'LABOR',
  uskuna: 'EQUIPMENT',
  equipment: 'EQUIPMENT',
  transport: 'TRANSPORT',
  boshqa: 'OTHER',
  other: 'OTHER',
  in: 'IN',
  kirim: 'IN',
  out: 'OUT',
  chiqim: 'OUT',
  berish: 'OUT',
};

function fuzzyMatchEnum(
  input: string,
  values: string[],
  labels?: Record<string, string>,
): string | null {
  const lower = input.toLowerCase().trim();

  for (const v of values) {
    if (v.toLowerCase() === lower) return v;
  }

  if (labels) {
    for (const [k, v] of Object.entries(labels)) {
      if (v.toLowerCase() === lower) return k;
    }
  }

  const mapped = SHORTCUTS[lower];
  if (mapped && values.includes(mapped)) return mapped;

  return null;
}

/**
 * Fallback parser: splits user text by comma or newline,
 * maps positionally to field definitions.
 */
export function parseCommaSeparated(
  text: string,
  fields: FormFieldDef[],
): Record<string, any> {
  const result: Record<string, any> = {};
  const parts = text.split(/[,\n]/).map((p) => p.trim()).filter(Boolean);

  for (let i = 0; i < Math.min(parts.length, fields.length); i++) {
    const field = fields[i];
    const part = parts[i];

    if (field.type === 'number') {
      const num = parseNumber(part);
      if (!isNaN(num)) result[field.key] = num;
    } else if (field.type === 'enum' && field.enumValues) {
      const matched = fuzzyMatchEnum(part, field.enumValues, field.enumLabels);
      if (matched) result[field.key] = matched;
      else result[field.key] = part; // keep raw for confirmation
    } else {
      result[field.key] = part;
    }
  }

  return result;
}
