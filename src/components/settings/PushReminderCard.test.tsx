import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const push = vi.hoisted(() => ({
  pushSupport: vi.fn(),
  readReminders: vi.fn(),
  enablePush: vi.fn(),
  disableReminder: vi.fn(),
  sendTestPush: vi.fn(),
  vapidPublicKey: vi.fn(),
}))
vi.mock('@/lib/push-client', () => push)

import { PushReminderCard } from './PushReminderCard'

const MORNING = 'Morning planning reminder'
const EVENING = 'Evening review reminder'

beforeEach(() => {
  vi.clearAllMocks()
  push.pushSupport.mockReturnValue('supported')
  push.readReminders.mockResolvedValue({ daily_plan: false, evening_review: false })
  push.vapidPublicKey.mockReturnValue('public-key')
})

afterEach(() => {
  cleanup()
})

async function readySwitch(name: string) {
  const toggle = screen.getByRole('switch', { name })
  await waitFor(() => expect(toggle.hasAttribute('disabled') || toggle.getAttribute('data-disabled') !== null).toBe(false))
  return toggle
}

describe('PushReminderCard', () => {
  it('turns the evening reminder on and then offers a test notification', async () => {
    push.enablePush.mockResolvedValue({ ok: true })
    push.sendTestPush.mockResolvedValue({ ok: true })
    render(<PushReminderCard />)

    fireEvent.click(await readySwitch(EVENING))
    expect(await screen.findByText('Evening review reminder is on for this device.')).toBeTruthy()
    expect(push.enablePush).toHaveBeenCalledWith('evening_review')

    fireEvent.click(screen.getByRole('button', { name: 'Send test notification' }))
    expect(await screen.findByText(/Test notification sent/)).toBeTruthy()
  })

  it('turns the morning reminder on on its own', async () => {
    push.enablePush.mockResolvedValue({ ok: true })
    render(<PushReminderCard />)

    fireEvent.click(await readySwitch(MORNING))
    expect(await screen.findByText('Morning planning reminder is on for this device.')).toBeTruthy()
    expect(push.enablePush).toHaveBeenCalledWith('daily_plan')
    expect(screen.getByRole('switch', { name: MORNING }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('switch', { name: EVENING }).getAttribute('aria-checked')).toBe('false')
  })

  it('explains how to allow notifications when the browser blocks them', async () => {
    push.enablePush.mockResolvedValue({ ok: false, reason: 'denied' })
    render(<PushReminderCard />)

    fireEvent.click(await readySwitch(EVENING))
    expect(await screen.findByText(/Notifications are blocked for LifeQuest/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Send test notification' })).toBeNull()
  })

  it('shows the switches as the server has them for this device', async () => {
    push.readReminders.mockResolvedValue({ daily_plan: false, evening_review: true })
    render(<PushReminderCard />)

    await waitFor(() => expect(screen.getByRole('switch', { name: EVENING }).getAttribute('aria-checked')).toBe('true'))
    expect(screen.getByRole('switch', { name: MORNING }).getAttribute('aria-checked')).toBe('false')
  })

  it('keeps the subscription when the other reminder is still on', async () => {
    push.readReminders.mockResolvedValue({ daily_plan: true, evening_review: true })
    push.disableReminder.mockResolvedValue(true)
    render(<PushReminderCard />)

    const toggle = await readySwitch(MORNING)
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'))
    fireEvent.click(toggle)
    expect(await screen.findByText('Morning planning reminder is off for this device.')).toBeTruthy()
    expect(push.disableReminder).toHaveBeenCalledWith('daily_plan', true)
  })

  it('drops the subscription when the last reminder goes off', async () => {
    push.readReminders.mockResolvedValue({ daily_plan: false, evening_review: true })
    push.disableReminder.mockResolvedValue(true)
    render(<PushReminderCard />)

    const toggle = await readySwitch(EVENING)
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'))
    fireEvent.click(toggle)
    expect(await screen.findByText('Evening review reminder is off for this device.')).toBeTruthy()
    expect(push.disableReminder).toHaveBeenCalledWith('evening_review', false)
    expect(screen.queryByRole('button', { name: 'Send test notification' })).toBeNull()
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

  it('keeps the switches off while the server has no VAPID key', async () => {
    push.vapidPublicKey.mockReturnValue(null)
    render(<PushReminderCard />)
    expect(await screen.findByText('Push notifications are not configured on the server yet.')).toBeTruthy()
  })
})
