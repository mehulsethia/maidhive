import path from 'node:path'

export type E2ERole = 'client' | 'cleaner' | 'admin'

const AUTH_DIR = path.resolve(process.cwd(), 'tests/e2e/.auth')

export function authStatePath(role: E2ERole) {
  return path.join(AUTH_DIR, `${role}.json`)
}

export function authDirPath() {
  return AUTH_DIR
}
