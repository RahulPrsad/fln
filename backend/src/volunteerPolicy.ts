import type { ScanPaperTemplate, Student, User } from './db';

export function canAccessStudent(user: User, student: Pick<Student, 'schoolId'>) {
  if (user.role === 'volunteer') return Boolean(user.assignedSchools?.includes(student.schoolId));
  if (user.role === 'teacher' || user.role === 'school') return user.schoolId === student.schoolId;
  return ['superadmin', 'admin', 'district_admin', 'block_admin'].includes(user.role);
}

export function validateScanReview(template: ScanPaperTemplate, reviewItems: any[]) {
  if (reviewItems.length !== template.questions.length) throw new Error('Review every question on this page before saving.');
  const seen = new Set<string>();
  return reviewItems.map(item => {
    const question = template.questions.find(q => q.questionId === item.questionId);
    if (!question || seen.has(item.questionId)) throw new Error('Review contains an unknown or duplicate question.');
    seen.add(item.questionId);
    if (!['correct', 'partial', 'incorrect'].includes(item.finalMark)) throw new Error('Mark every answer before saving.');
    const maxMarks = Number(question.marks ?? 1);
    const marks = item.finalMark === 'correct' ? maxMarks : item.finalMark === 'partial' ? maxMarks / 2 : 0;
    const confidence = Number(item.confidence ?? 0);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('Invalid answer confidence.');
    return { ...item, maxMarks, marks, confidence, expectedAnswer: question.answerKey || '', questionType: question.questionType };
  });
}
