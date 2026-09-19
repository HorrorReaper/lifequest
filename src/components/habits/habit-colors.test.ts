import { describe, expect, it } from 'vitest'
import {
  HABIT_COLORS,
  habitColorClass,
  habitTintClass,
} from '@/components/habits/HabitEditorDialog'

describe('habit colours', () => {
  it('offers both weights for every colour', () => {
    for (const option of HABIT_COLORS) {
      expect(habitColorClass(option.value)).toBe(option.className)
      expect(habitTintClass(option.value)).toBe(option.tint)
    }
  })

  it('keeps the two weights apart', () => {
    // The filled weight is for a control that reads as on; the tint is for a
    // surface that only labels which habit it is. Collapsing them is what
    // put a saturated block behind every emoji.
    for (const option of HABIT_COLORS) {
      expect(option.tint).not.toBe(option.className)
      expect(option.tint).toContain('/')
      expect(option.className).not.toContain('/')
    }
  })

  it('falls back rather than returning nothing for an unknown colour', () => {
    // A habit can carry a colour this build no longer offers.
    expect(habitColorClass('chartreuse')).toBeTruthy()
    expect(habitTintClass('chartreuse')).toBeTruthy()
  })
})
