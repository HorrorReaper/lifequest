import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const push = vi.hoisted(() => ({
  pushSupport: vi.fn(),
  currentSubscription: vi.fn(),
  enablePush: vi.fn(),
  disablePush: vi.fn(),
  sendTestPush: vi.fn(),
  vapidPublicKey: vi.fn(),
}))
vi.mock('@/lib/push-client', () => push)

import { PushReminderCard } from './PushReminderCard'

beforeEach(() => {
  push.pushSupport.mockReturnValue('supported')
  push.currentSubscription.mockResolvedValue(null)
  push.vapidPublicKey.mockReturnValue('public-key')
  vi.stubGlobal('Notification', { permission: 'default' })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function readySwitch() {
  const toggle = screen.getByRole('switch', { name: 'Evening review reminder' })
  await waitFor(() => expect(toggle.hasAttribute('disabled') || toggle.getAttribute('data-disabled') !== null).toBe(false))
  return toggle
}

describe('PushReminderCard', () => {
  it('turns reminders on and then offers a test notification', async () => {
    push.enablePush.mockResolvedValue({ ok: true })
    push.sendTestPush.mockResolvedValue({ ok: true })
    render(<PushReminderCard />)

    fireEvent.click(await readySwitch())
    expect(await screen.findByText('Reminders are on for this device.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Send test notification' }))
    expect(await screen.findByText(/Test notification sent/)).toBeTruthy()
  })

  it('explains how to allow notifications when the browser blocks them', async () => {
    push.enablePush.mockResolvedValue({ ok: false, reason: 'denied' })
    render(<PushReminderCard />)

    fireEvent.click(await readySwitch())
    expect(await screen.findByText(/Notifications are blocked for LifeQuest/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Send test notification' })).toBeNull()
  })

  it('shows the switch on for a device that is already subscribed with permission', async () => {
    push.currentSubscription.mockResolvedValue({ endpoint: 'https://push.example/1' })
    vi.stubGlobal('Notification', { permission: 'granted' })
    render(<PushReminderCard />)

    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Evening review reminder' }).getAttribute('aria-checked')).toBe('true')
    )
  })

  it('turns reminders off', async () => {
    push.currentSubscription.mockResolvedValue({ endpoint: 'https://push.example/1' })
    vi.stubGlobal('Notification', { permission: 'granted' })
    push.disablePush.mockResolvedValue(true)
    render(<PushReminderCard />)

    const toggle = await readySwitch()
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'))
    fireEvent.click(toggle)
    expect(await screen.findByText('Reminders are off for this device.')).toBeTruthy()
  })

  it('asks iPhone users to add LifeQuest to the home screen first', async () => {
    push.pushSupport.mockReturnValue('ios-needs-install')
    render(<PushReminderCard />)
    expect(await screen.findByText(/Add to Home Screen/)).toBeTruthy()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('says so when the browser has no notifications at all', async () => {
    push.pushSupport.mockReturnValue('unsupported')
    render(<PushReminderCard />)
    expect(await screen.findByText('This browser does not support notifications.')).toBeTruthy()
  })

  it('keeps the switch off while the server has no VAPID key', async () => {
    push.vapidPublicKey.mockReturnValue(null)
    render(<PushReminderCard />)
    expect(await screen.findByText('Push notifications are not configured on the server yet.')).toBeTruthy()
  })
})
