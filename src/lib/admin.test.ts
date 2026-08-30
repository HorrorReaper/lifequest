import { afterEach, describe, expect, it, vi } from 'vitest'

const cookieStore = { get: vi.fn() }

vi.mock('next/headers', () => ({
  cookies: async () => cookieStore,
}))

const { PREVIEW_AS_USER_COOKIE, isAdminUser, isPreviewingAsUser, showAdminUi } = await import(
  '@/lib/admin'
)

function previewCookie(value: string | undefined) {
  cookieStore.get.mockImplementation((name: string) =>
    name === PREVIEW_AS_USER_COOKIE && value !== undefined ? { name, value } : undefined
  )
}

const trustedAdmin = { id: 'admin-1', email: 'a@example.com', app_metadata: { role: 'admin' } }
const normalUser = { id: 'user-1', email: 'u@example.com', app_metadata: {} }

afterEach(() => {
  cookieStore.get.mockReset()
  delete process.env.ADMIN_EMAILS
  delete process.env.ADMIN_USER_IDS
})

describe('isPreviewingAsUser', () => {
  it('is off when the cookie is absent', async () => {
    previewCookie(undefined)
    expect(await isPreviewingAsUser()).toBe(false)
  })

  it('is on only for the exact opt-in value', async () => {
    previewCookie('1')
    expect(await isPreviewingAsUser()).toBe(true)

    previewCookie('true')
    expect(await isPreviewingAsUser()).toBe(false)
  })
})

describe('showAdminUi', () => {
  it('shows admin interface to an admin who is not previewing', async () => {
    previewCookie(undefined)
    expect(await showAdminUi(trustedAdmin)).toBe(true)
  })

  it('hides admin interface from an admin who is previewing', async () => {
    previewCookie('1')
    expect(await showAdminUi(trustedAdmin)).toBe(false)
  })

  it('never grants admin interface to a normal user, cookie or not', async () => {
    previewCookie(undefined)
    expect(await showAdminUi(normalUser)).toBe(false)

    // The cookie only ever subtracts, so setting it cannot promote anyone.
    previewCookie('1')
    expect(await showAdminUi(normalUser)).toBe(false)
  })

  it('hides admin interface from a signed-out visitor', async () => {
    previewCookie(undefined)
    expect(await showAdminUi(null)).toBe(false)
  })

  it('leaves the underlying role untouched, so authorization is unaffected', async () => {
    previewCookie('1')

    // Preview is a view filter: the API routes and RLS still ask isAdminUser,
    // and it must keep answering yes.
    expect(isAdminUser(trustedAdmin)).toBe(true)
    expect(await showAdminUi(trustedAdmin)).toBe(false)
  })

  it('also applies to an allowlisted admin, not just a trusted-claim one', async () => {
    process.env.ADMIN_EMAILS = 'a@example.com'
    const allowlisted = { id: 'x', email: 'a@example.com', app_metadata: {} }

    previewCookie(undefined)
    expect(await showAdminUi(allowlisted)).toBe(true)

    previewCookie('1')
    expect(await showAdminUi(allowlisted)).toBe(false)
  })
})
