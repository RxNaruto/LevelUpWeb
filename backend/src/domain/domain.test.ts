import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isoWeekday, localTime, recentDays, today, weekKey, weekStart } from '../lib/dates.js'
import { formatDuration, reminderSlots } from '../lib/reminders.js'
import { cappedXp, levelForXp, levelProgress } from './xp.js'

describe('dates', () => {
  it('computes the calendar day in the given timezone', () => {
    const instant = new Date('2026-03-01T22:30:00Z')
    assert.equal(today('UTC', instant), '2026-03-01')
    assert.equal(today('Asia/Kolkata', instant), '2026-03-02')
    assert.equal(today('America/Los_Angeles', instant), '2026-03-01')
  })

  it('reads wall-clock time in the given timezone', () => {
    assert.deepEqual(localTime('Asia/Kolkata', new Date('2026-03-01T15:30:00Z')), { hour: 21, minute: 0 })
  })

  it('uses ISO weekdays and Monday-anchored weeks', () => {
    assert.equal(isoWeekday('2026-10-18'), 7)
    assert.equal(isoWeekday('2026-10-19'), 1)
    assert.equal(weekStart('2026-10-18'), '2026-10-12')
    assert.equal(weekKey('2026-10-14'), 'week:2026-10-12')
  })

  it('lists recent days oldest first', () => {
    assert.deepEqual(recentDays(3, '2026-03-01'), ['2026-02-27', '2026-02-28', '2026-03-01'])
  })
})

describe('xp', () => {
  it('levels on a square-root curve', () => {
    assert.equal(levelForXp(0), 1)
    assert.equal(levelForXp(99), 1)
    assert.equal(levelForXp(100), 2)
    assert.equal(levelForXp(400), 3)
    assert.deepEqual(levelProgress(150), { level: 2, xpTotal: 150, xpInLevel: 50, xpToNext: 300 })
  })

  it('respects the daily and weekly caps', () => {
    assert.equal(cappedXp(20, 0, 0), 20)
    assert.equal(cappedXp(20, 90, 0), 10)
    assert.equal(cappedXp(20, 0, 395), 5)
    assert.equal(cappedXp(20, 100, 0), 0)
  })
})

describe('reminders', () => {
  it('expands an hourly chain up to the last hour before midnight', () => {
    assert.deepEqual(reminderSlots('21:15', true), [
      { hour: 21, minute: 15 },
      { hour: 22, minute: 15 },
      { hour: 23, minute: 15 },
    ])
    assert.deepEqual(reminderSlots('21:15', false), [{ hour: 21, minute: 15 }])
  })

  it('formats durations compactly', () => {
    assert.equal(formatDuration(45), '45m')
    assert.equal(formatDuration(120), '2h')
    assert.equal(formatDuration(150), '2h 30m')
  })
})
