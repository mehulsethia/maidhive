export const seededUsers = {
  client: {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'client@test.local',
    name: 'Client User',
    role: 'client',
    isActive: true,
    deletedAt: null,
  },
  cleaner: {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'cleaner@test.local',
    name: 'Cleaner User',
    role: 'cleaner',
    isActive: true,
    deletedAt: null,
  },
  admin: {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'admin@test.local',
    name: 'Admin User',
    role: 'admin',
    isActive: true,
    deletedAt: null,
  },
} as const
