import { NextResponse } from 'next/server'
import { serialize } from './serialize'

function buildRequestId() {
  return `req_${crypto.randomUUID()}`
}

function withRequestMetadata<T extends Record<string, unknown>>(body: T, requestId: string) {
  return {
    ...body,
    request_id: requestId,
  }
}

export function ok(data: unknown, status = 200) {
  const requestId = buildRequestId()
  return NextResponse.json(withRequestMetadata({ success: true, data: serialize(data) }, requestId), {
    status,
    headers: { 'x-request-id': requestId },
  })
}

export function err(message: string, status = 400) {
  const requestId = buildRequestId()
  return NextResponse.json(withRequestMetadata({ success: false, message }, requestId), {
    status,
    headers: { 'x-request-id': requestId },
  })
}

export function paginated(data: unknown[], total: number, page: number, pageSize: number) {
  const requestId = buildRequestId()
  return NextResponse.json({
    ...withRequestMetadata(
      {
        success: true,
        data: serialize(data),
        pagination: {
          total,
          page,
          page_size: pageSize,
          total_pages: Math.ceil(total / pageSize),
        },
      },
      requestId,
    ),
  }, {
    headers: {
      'x-request-id': requestId,
    },
  })
}
