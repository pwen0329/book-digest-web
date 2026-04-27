// Library for managing event signup intro templates

import 'server-only';

import type { SignupIntroTemplate, SignupIntroTemplateRow } from '@/types/signup-intro';
import { introTemplateFromRow, introTemplateToRow } from '@/types/signup-intro';
import { interpolateTemplate, type TemplateContext } from './template-interpolation';
import type { Event } from '@/types/event';
import {
  fetchRows,
  fetchSingleRow,
  insertRow,
  updateRow,
  deleteRow,
} from '@/lib/supabase-utils';
import { SUPABASE_CONFIG } from '@/lib/env';

const TABLE_NAME = SUPABASE_CONFIG.TABLES.EVENT_SIGNUP_INTROS;

/**
 * Get all signup intro templates
 */
export async function getAllIntroTemplates(): Promise<SignupIntroTemplate[]> {
  const rows = await fetchRows<SignupIntroTemplateRow>(TABLE_NAME, '*', 'order=name');
  return rows.map(introTemplateFromRow);
}

/**
 * Get a specific intro template by name
 */
export async function getIntroTemplateByName(name: string): Promise<SignupIntroTemplate | null> {
  const row = await fetchSingleRow<SignupIntroTemplateRow>(
    TABLE_NAME,
    '*',
    `name=eq.${encodeURIComponent(name)}`
  );
  return row ? introTemplateFromRow(row) : null;
}

/**
 * Validate that paid templates include required payment variables
 */
export function validatePaidIntroTemplate(content: string, contentEn: string): string[] {
  const errors: string[] = [];
  const requiredVars = ['payment_currency', 'payment_amount'];

  for (const varName of requiredVars) {
    const pattern = new RegExp(`\\{\\{\\s*${varName}\\s*\\}\\}`);

    if (!pattern.test(content)) {
      errors.push(`Chinese content must include {{${varName}}}`);
    }

    if (!pattern.test(contentEn)) {
      errors.push(`English content must include {{${varName}}}`);
    }
  }

  return errors;
}

/**
 * Create a new intro template
 */
export async function createIntroTemplate(
  template: Omit<SignupIntroTemplate, 'createdAt' | 'updatedAt'>
): Promise<SignupIntroTemplate> {
  // Validate paid templates
  if (!template.isFree) {
    const errors = validatePaidIntroTemplate(template.content, template.contentEn);
    if (errors.length > 0) {
      throw new Error(`Template validation failed: ${errors.join(', ')}`);
    }
  }

  const row = introTemplateToRow(template);
  const result = await insertRow<SignupIntroTemplateRow>(TABLE_NAME, row);
  return introTemplateFromRow(result);
}

/**
 * Update an existing intro template
 */
export async function updateIntroTemplate(
  name: string,
  updates: Partial<Omit<SignupIntroTemplate, 'name' | 'createdAt' | 'updatedAt'>>
): Promise<SignupIntroTemplate> {
  // If updating content or isFree, validate paid templates
  const existing = await getIntroTemplateByName(name);
  if (!existing) {
    throw new Error(`Intro template '${name}' not found`);
  }

  const isFree = updates.isFree !== undefined ? updates.isFree : existing.isFree;
  const content = updates.content !== undefined ? updates.content : existing.content;
  const contentEn = updates.contentEn !== undefined ? updates.contentEn : existing.contentEn;

  if (!isFree) {
    const errors = validatePaidIntroTemplate(content, contentEn);
    if (errors.length > 0) {
      throw new Error(`Template validation failed: ${errors.join(', ')}`);
    }
  }

  const row = introTemplateToRow(updates);
  const result = await updateRow<SignupIntroTemplateRow>(
    TABLE_NAME,
    `name=eq.${encodeURIComponent(name)}`,
    row
  );
  return introTemplateFromRow(result);
}

/**
 * Delete an intro template
 * NOTE: Will fail if template is referenced by events (ON DELETE RESTRICT)
 */
export async function deleteIntroTemplate(name: string): Promise<void> {
  try {
    await deleteRow(TABLE_NAME, `name=eq.${encodeURIComponent(name)}`);
  } catch (error) {
    // Check if it's a foreign key constraint error
    if (error instanceof Error && error.message.includes('foreign key')) {
      throw new Error('Cannot delete template: it is currently used by one or more events');
    }
    throw error;
  }
}

/**
 * Interpolate intro template with event data
 */
export function interpolateIntroTemplate(
  template: SignupIntroTemplate,
  event: Event,
  locale: 'zh' | 'en'
): string {
  const content = locale === 'en' ? template.contentEn : template.content;

  const context: TemplateContext = {
    payment_currency: event.paymentCurrency,
    payment_amount: event.paymentAmount.toString(),
    event_name: locale === 'en' ? (event.titleEn || event.title) : event.title,
    venue_name: locale === 'en' ? (event.venueNameEn || event.venueName || '') : (event.venueName || ''),
    venue_location: event.venueLocation,
    event_date: new Date(event.eventDate).toLocaleDateString(
      locale === 'zh' ? 'zh-TW' : 'en-US',
      { year: 'numeric', month: 'long', day: 'numeric' }
    ),
  };

  return interpolateTemplate(content, context);
}
