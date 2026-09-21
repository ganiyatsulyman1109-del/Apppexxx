import { NextResponse } from 'next/server'

export type ApiErrorResponse = {
  error: string;
  details?: any;
};

export type ApiSuccessResponse<T> = {
  data: T;
  message?: string;
};

/**
 * Standardized success response
 */
export function apiSuccess<T>(data: T, status = 200, message?: string) {
  return NextResponse.json(
    { data, ...(message && { message }) },
    { status }
  )
}

/**
 * Standardized error response
 */
export function apiError(message: string, status = 500, details?: any) {
  return NextResponse.json(
    { error: message, ...(details && { details }) },
    { status }
  )
}

/**
 * Common HTTP error wrappers
 */
export function apiBadRequest(message = 'Bad Request', details?: any) {
  return apiError(message, 400, details)
}

export function apiUnauthorized(message = 'Unauthorized') {
  return apiError(message, 401)
}

export function apiForbidden(message = 'Forbidden') {
  return apiError(message, 403)
}

export function apiNotFound(message = 'Not Found') {
  return apiError(message, 404)
}
