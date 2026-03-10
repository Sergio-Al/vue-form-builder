import sanitize from 'sanitize-html';
import { BadRequestException } from '@nestjs/common';
import { evaluateRules, Rule } from './evaluate-conditions';

/**
 * Validate that response data matches the form schema:
 * - Strip keys not present in the schema
 * - Strip hidden fields (determined by rules)
 * - Ensure required fields (static + conditional) have non-empty values
 * - Recurse into group fields
 */
export function validateResponseData(
  schema: Record<string, any>,
  data: Record<string, any>,
  rules: Rule[] = [],
): Record<string, any> {
  // Evaluate rules to get conditional required/hidden maps
  const { requiredMap, hiddenFields } = evaluateRules(rules, data);

  const validKeys = Object.entries(schema)
    .filter(([, config]) => config.type !== 'button')
    .map(([key]) => key);

  // Whitelist: keep only keys that exist in the schema
  const sanitizedData: Record<string, any> = {};
  for (const key of validKeys) {
    if (key in data) {
      sanitizedData[key] = data[key];
    }
  }

  // Strip hidden fields from submitted data
  for (const field of hiddenFields) {
    delete sanitizedData[field];
  }

  // Check required fields and recurse into groups
  const missingFields: string[] = [];
  for (const key of validKeys) {
    // Skip hidden fields — they are stripped and should not be validated
    if (hiddenFields.has(key)) continue;

    const config = schema[key];

    // Recurse into group types
    if (config.type === 'group' && config.schema) {
      const groupData =
        sanitizedData[key] && typeof sanitizedData[key] === 'object' && !Array.isArray(sanitizedData[key])
          ? sanitizedData[key]
          : {};
      sanitizedData[key] = validateResponseData(config.schema, groupData);
      continue;
    }

    // Determine if field is required: conditional rules override static schema
    let isRequired = false;
    if (key in requiredMap) {
      isRequired = requiredMap[key];
    } else {
      const rulesStr: string = config.rules || '';
      isRequired = rulesStr.split('|').includes('required');
    }

    if (isRequired) {
      const value = sanitizedData[key];
      if (value === undefined || value === null || value === '') {
        const label = config.label || key;
        missingFields.push(label);
      }
    }
  }

  if (missingFields.length > 0) {
    throw new BadRequestException(
      `Missing required fields: ${missingFields.join(', ')}`,
    );
  }

  return sanitizedData;
}

/**
 * Recursively strip HTML/script tags from all string values in the data object.
 */
export function sanitizeResponseData(
  data: Record<string, any>,
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      result[key] = sanitize(value, { allowedTags: [], allowedAttributes: {} });
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'string'
          ? sanitize(item, { allowedTags: [], allowedAttributes: {} })
          : item,
      );
    } else if (value && typeof value === 'object') {
      result[key] = sanitizeResponseData(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
