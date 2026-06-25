/** OpenAPI-aligned pagination shapes (`PaginationMeta` in docs/api/openapi.yaml). */

export interface PaginationMeta {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
