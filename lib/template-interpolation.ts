/**
 * Shared template interpolation utility
 * Can be used in both server and client contexts
 */

export type TemplateContext = Record<string, string | number | boolean | null | undefined>;

/**
 * Interpolate template string with context values
 * Replaces {{variable_name}} with corresponding context values
 *
 * @example
 * interpolateTemplate('Hello {{name}}!', { name: 'World' })
 * // => 'Hello World!'
 */
export function interpolateTemplate(template: string, context: TemplateContext): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const value = context[key];
    return value != null ? String(value) : '';
  });
}
