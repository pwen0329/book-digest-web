// Event Signup Intro Template types

export type SignupIntroTemplate = {
  name: string; // Primary key
  content: string; // Chinese intro text
  contentEn: string; // English intro text
  isFree: boolean; // Whether template is for free events
  createdAt: string;
  updatedAt: string;
};

// Database column names (snake_case) for Supabase queries
export type SignupIntroTemplateRow = {
  name: string;
  content: string;
  content_en: string;
  is_free: boolean;
  created_at: string;
  updated_at: string;
};

// Convert database row to application type
export function introTemplateFromRow(row: SignupIntroTemplateRow): SignupIntroTemplate {
  return {
    name: row.name,
    content: row.content,
    contentEn: row.content_en,
    isFree: row.is_free,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Convert application type to database row (for inserts/updates)
export function introTemplateToRow(
  template: Partial<SignupIntroTemplate>
): Partial<SignupIntroTemplateRow> {
  const row: Partial<SignupIntroTemplateRow> = {};
  if (template.name !== undefined) row.name = template.name;
  if (template.content !== undefined) row.content = template.content;
  if (template.contentEn !== undefined) row.content_en = template.contentEn;
  if (template.isFree !== undefined) row.is_free = template.isFree;
  return row;
}
