import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'

import type { FieldValue, TemplateField } from '@/lib/types'
import {
  advanceMobileJournalStep,
  buildMobileJournalSteps,
  isJournalFieldComplete,
  journalDraftKey,
  MobileJournalStepPanel,
  removeStoredJournalDraft,
  restoreJournalDraft,
  serializeJournalDraft,
} from './mobile-journal-wizard'

function field(
  id: string,
  fieldType: TemplateField['field_type'],
  overrides: Partial<TemplateField> = {}
): TemplateField {
  return {
    id,
    template_id: 'template-1',
    field_type: fieldType,
    label: id,
    description: null,
    placeholder: null,
    is_required: false,
    sort_order: 0,
    config: {},
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  window.sessionStorage.clear()
})

afterEach(() => {
  cleanup()
})

describe('buildMobileJournalSteps', () => {
  it('groups display-only fields with the next answerable field', () => {
    const heading = field('heading', 'heading')
    const prompt = field('prompt', 'prompt')
    const answer = field('answer', 'textarea')
    const divider = field('divider', 'divider')
    const mood = field('mood', 'mood')

    const steps = buildMobileJournalSteps([heading, prompt, answer, divider, mood])

    expect(steps).toHaveLength(2)
    expect(steps[0].fields.map((item) => item.id)).toEqual([
      'heading',
      'prompt',
      'answer',
    ])
    expect(steps[0].answerField?.id).toBe('answer')
    expect(steps[1].fields.map((item) => item.id)).toEqual(['divider', 'mood'])
    expect(
      steps.every(
        (step) =>
          step.fields.filter(
            (item) => !['divider', 'heading', 'prompt'].includes(item.field_type)
          ).length <= 1
      )
    ).toBe(true)
  })

  it('keeps trailing display content mounted with the final answer', () => {
    const steps = buildMobileJournalSteps([
      field('answer', 'text'),
      field('trailing-divider', 'divider'),
    ])

    expect(steps).toHaveLength(1)
    expect(steps[0].fields.map((item) => item.id)).toEqual([
      'answer',
      'trailing-divider',
    ])
  })
})

describe('mobile journal validation and navigation', () => {
  it('blocks a required unanswered step and advances once it is complete', () => {
    const required = field('required-answer', 'text', { is_required: true })
    const optional = field('optional-answer', 'textarea')
    const steps = buildMobileJournalSteps([required, optional])
    const emptyValue: FieldValue = {
      field_id: required.id,
      value_text: '',
    }

    expect(isJournalFieldComplete(required, emptyValue)).toBe(false)
    expect(
      advanceMobileJournalStep({
        activeStep: 0,
        steps,
        values: { [required.id]: emptyValue },
      })
    ).toEqual({ nextStep: 0, blockedFieldId: required.id })

    const completedValue = { ...emptyValue, value_text: 'A useful reflection' }
    expect(isJournalFieldComplete(required, completedValue)).toBe(true)
    expect(
      advanceMobileJournalStep({
        activeStep: 0,
        steps,
        values: { [required.id]: completedValue },
      })
    ).toEqual({ nextStep: 1, blockedFieldId: null })
  })

  it('allows an optional prompt to be skipped', () => {
    const steps = buildMobileJournalSteps([
      field('optional', 'textarea'),
      field('next', 'mood'),
    ])

    expect(
      advanceMobileJournalStep({
        activeStep: 0,
        steps,
        values: {},
      })
    ).toEqual({ nextStep: 1, blockedFieldId: null })
  })
})

describe('journal drafts', () => {
  it('uses user- and target-scoped keys', () => {
    const newKey = journalDraftKey({
      userId: 'user-1',
      templateId: 'template-1',
    })
    const otherUserKey = journalDraftKey({
      userId: 'user-2',
      templateId: 'template-1',
    })
    const editKey = journalDraftKey({
      userId: 'user-1',
      templateId: 'template-1',
      existingEntryId: 'entry-1',
    })

    expect(newKey).not.toBe(otherUserKey)
    expect(newKey).not.toBe(editKey)
  })

  it('restores known valid fields, ignores stale fields, and clamps the step', () => {
    const known = field('known', 'textarea')
    const rawDraft = JSON.stringify({
      version: 1,
      activeStep: 99,
      values: {
        known: { field_id: 'known', value_text: 'Recovered answer' },
        stale: { field_id: 'stale', value_text: 'Old template field' },
      },
    })

    expect(restoreJournalDraft(rawDraft, [known], 2)).toEqual({
      activeStep: 1,
      values: {
        known: { field_id: 'known', value_text: 'Recovered answer' },
      },
    })
  })

  it('rejects malformed drafts instead of partially applying them', () => {
    const known = field('known', 'number')
    const malformed = JSON.stringify({
      version: 1,
      activeStep: 0,
      values: {
        known: { field_id: 'known', value_number: 'not-a-number' },
      },
    })

    expect(restoreJournalDraft('{broken json', [known], 1)).toBeNull()
    expect(restoreJournalDraft(malformed, [known], 1)).toBeNull()
  })

  it('serializes and explicitly clears a stored draft', () => {
    const storageKey = 'journal-draft-test'
    window.sessionStorage.setItem(
      storageKey,
      serializeJournalDraft({
        activeStep: 1,
        values: {
          answer: { field_id: 'answer', value_text: 'Temporary answer' },
        },
      })
    )

    removeStoredJournalDraft(window.sessionStorage, storageKey)

    expect(window.sessionStorage.getItem(storageKey)).toBeNull()
  })
})

describe('MobileJournalStepPanel', () => {
  function StatefulAnswer() {
    const [answer, setAnswer] = useState('')

    return (
      <label>
        Answer
        <input
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
        />
      </label>
    )
  }

  it('keeps child-local state mounted while the panel becomes inactive', () => {
    const view = render(
      <MobileJournalStepPanel active>
        <StatefulAnswer />
      </MobileJournalStepPanel>
    )
    const input = view.getByLabelText('Answer') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Still here' } })

    view.rerender(
      <MobileJournalStepPanel active={false}>
        <StatefulAnswer />
      </MobileJournalStepPanel>
    )

    const mountedInput = view.container.querySelector('input') as HTMLInputElement
    expect(mountedInput.value).toBe('Still here')
    expect(view.container.firstElementChild?.className).toContain('hidden')
  })
})
