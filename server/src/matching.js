function normaliseKeyword(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function collectKeywords(profile, fields) {
  return new Set(fields
    .flatMap((field) => (profile[field] ?? '').split(/[,;|\n]+/))
    .map(normaliseKeyword)
    .filter(Boolean))
}

export function findKeywordMatches(students, mentors) {
  const matches = []
  for (const student of students) {
    const studentKeywords = collectKeywords(student, ['field_of_study', 'internship_type', 'interests', 'learning_goals'])
    if (!studentKeywords.size) continue
    for (const mentor of mentors) {
      const mentorKeywords = collectKeywords(mentor, ['expertise'])
      const keywords = [...studentKeywords].filter((keyword) => mentorKeywords.has(keyword))
      if (keywords.length) matches.push({ student_id: student.id, mentor_id: mentor.id, keywords })
    }
  }
  return matches
}