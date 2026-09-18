import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { usePromptDismissal } from './prompt-dismissal'
import { installLocalStorageStub } from '../../../test/local-storage-stub'

const KEY = 'lifequest-test-prompt-dismissed-2026-09-20'

beforeEach(() => {
  installLocalStorageStub()
})

afterEach(() => {
  cleanup()
})

describe('usePromptDismissal', () => {
  it('starts not dismissed when nothing is stored', () => {
    const { result } = renderHook(() => usePromptDismissal(KEY))

    expect(result.current.dismissed).toBe(false)
  })

  it('reports dismissed when the key was stored earlier', () => {
    window.localStorage.setItem(KEY, '1')

    const { result } = renderHook(() => usePromptDismissal(KEY))

    expect(result.current.dismissed).toBe(true)
  })

  it('stores the key and re-renders as dismissed in the same tab', () => {
    const { result } = renderHook(() => usePromptDismissal(KEY))

    act(() => result.current.dismiss())

    expect(result.current.dismissed).toBe(true)
    expect(window.localStorage.getItem(KEY)).toBe('1')
  })

  it('keeps keys independent, so dismissing one prompt leaves another open', () => {
    const other = renderHook(() => usePromptDismissal('lifequest-other-prompt'))
    const { result } = renderHook(() => usePromptDismissal(KEY))

    act(() => result.current.dismiss())

    expect(other.result.current.dismissed).toBe(false)
  })
})
