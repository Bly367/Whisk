import { RecipeImportErrorCode } from '../../types/import';
import { AuthenticatedRequestError } from './authenticatedRequest';

export class RecipeImportError extends Error {
  constructor(
    message: string,
    public readonly code: RecipeImportErrorCode,
  ) {
    super(message);
    this.name = 'RecipeImportError';
  }
}

type ImportKind = 'recipe' | 'photo';

function backendMessage(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const message = (body as { message?: unknown }).message;
  return typeof message === 'string' && message.trim() ? message : undefined;
}

export function mapImportResponseError(
  status: number,
  body: unknown,
  kind: ImportKind,
): RecipeImportError {
  const subject = kind === 'photo' ? 'photo' : 'recipe';

  if (status === 401) {
    return new RecipeImportError(
      'Your session expired. Sign in again to continue importing.',
      'auth_required',
    );
  }
  if (status === 429) {
    return new RecipeImportError(
      'You have reached your import limit. Try again after your quota resets.',
      'quota_exceeded',
    );
  }
  if (status === 422 || status === 400) {
    return new RecipeImportError(
      backendMessage(body) ?? `Whisk needs more information to import this ${subject}.`,
      'needs_input',
    );
  }
  if (kind === 'photo' && status === 413) {
    return new RecipeImportError(
      'This photo is too large. Choose an image smaller than 4.5 MB.',
      'needs_input',
    );
  }
  if (kind === 'photo' && status === 415) {
    return new RecipeImportError('The selected file is not a supported photo.', 'unsupported');
  }

  return new RecipeImportError(
    backendMessage(body) ?? `The ${subject} import service is temporarily unavailable.`,
    'network',
  );
}

export function mapAuthenticatedRequestError(error: unknown): RecipeImportError {
  if (error instanceof RecipeImportError) return error;
  if (error instanceof AuthenticatedRequestError) {
    return new RecipeImportError(
      error.message,
      error.code === 'auth_required' ? 'auth_required' : 'backend_unavailable',
    );
  }
  return new RecipeImportError('Whisk could not prepare the authenticated request.', 'network');
}
