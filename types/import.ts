export type RecipeImportErrorCode =
  | 'invalid_url'
  | 'network'
  | 'needs_input'
  | 'unsupported'
  | 'backend_unavailable'
  | 'auth_required'
  | 'quota_exceeded'
  | 'invalid_response';
