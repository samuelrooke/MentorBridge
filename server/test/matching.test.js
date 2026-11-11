import { describe, expect, it } from 'vitest'
import { findKeywordMatches } from '../src/matching.js'

describe('findKeywordMatches', () => {
  it('matches exact case-insensitive keywords across student learning fields', () => {
    const matches = findKeywordMatches(
      [
        { id: 'student-1', field_of_study: 'Interactive Media', learning_goals: 'React, UX design' },
        { id: 'student-2', field_of_study: 'Finance', learning_goals: 'Excel' },
      ],
      [
        { id: 'mentor-1', expertise: 'react; ux design' },
        { id: 'mentor-2', expertise: 'financial analysis, Excel' },
      ],
    )

    expect(matches).toEqual([
      { student_id: 'student-1', mentor_id: 'mentor-1', keywords: ['react', 'ux design'] },
      { student_id: 'student-2', mentor_id: 'mentor-2', keywords: ['excel'] },
    ])
  })

  it('does not match partial words or profiles without keywords', () => {
    expect(findKeywordMatches(
      [{ id: 'student-1', learning_goals: 'design' }, { id: 'student-2', learning_goals: '' }],
      [{ id: 'mentor-1', expertise: 'designing' }],
    )).toEqual([])
  })
})