import { z } from 'zod';

type ParseJsonRequestOptions = {
  maxBytes?: number;
};

export class JsonRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'JsonRequestError';
    this.status = status;
  }
}

export async function parseJsonRequest<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema,
  options: ParseJsonRequestOptions = {}
): Promise<z.infer<TSchema>> {
  const maxBytes = options.maxBytes ?? 5_000_000;
  const contentLength = request.headers.get('content-length');

  if (contentLength) {
    const declaredLength = Number.parseInt(contentLength, 10);
    if (!Number.isFinite(declaredLength) || declaredLength < 0) {
      throw new JsonRequestError('Invalid content length.', 400);
    }
    if (declaredLength > maxBytes) {
      throw new JsonRequestError('Payload too large.', 413);
    }
  }

  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    throw new JsonRequestError('Invalid request body.', 400);
  }

  const actualBytes = new TextEncoder().encode(rawText).length;
  if (actualBytes > maxBytes) {
    throw new JsonRequestError('Payload too large.', 413);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    throw new JsonRequestError('Invalid JSON payload.', 400);
  }

  try {
    return schema.parse(parsedJson);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new JsonRequestError(error.issues[0]?.message || 'Invalid payload.', 400);
    }

    throw error;
  }
}