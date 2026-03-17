import { z } from 'zod';

function isValidAdminDocumentVersion(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export const adminDocumentVersionSchema = z.union([
  z.string().min(1).refine(isValidAdminDocumentVersion, 'Invalid datetime'),
  z.null(),
]).optional();
