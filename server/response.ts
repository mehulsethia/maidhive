import { NextResponse } from 'next/server'

export function ok(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function err(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status })
}

export function paginated(data: unknown[], total: number, page: number, pageSize: number) {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize),
    },
  })
}
