import type { Question } from './db';
import { resolveQuestionFormat } from './scanTemplatePaper';

/** Three written answers, one MCQ, and one matching activity on every paper. */
export function mixPaperQuestions(ranked: Question[], targetLevel: number): Question[] {
  const base = ranked.filter(q => resolveQuestionFormat(q) !== 'match_pair');
  const unique = base.filter((q, i) => base.findIndex(other => other.question.trim() === q.question.trim()) === i);
  if (unique.length < 3) throw new Error('At least three different printable questions are required for this level.');
  const written = [...unique].sort((a, b) => Number(resolveQuestionFormat(a) === 'multiple_choice') - Number(resolveQuestionFormat(b) === 'multiple_choice')).slice(0, 3).map(q => ({
    ...q, question_id: `${q.question_id}_written`, question_format: 'text' as const,
    question: q.choices?.length && !/\(Write [^)]+ or [^)]+\)/i.test(q.question) ? `${q.question} Choices: ${q.choices.join('; ')}. Write your answer.` : q.question,
    choices: undefined
  }));
  let mcq = unique.find(q => resolveQuestionFormat(q) === 'multiple_choice');
  if (targetLevel === 1) {
    mcq = { ...unique[0], question_id: 'L1_compare_groups', question: 'Which group has the most balls? Circle one answer.', choices: ['2 balls', '6 balls', '4 balls'], answer: '6 balls', source_level: 1 };
  }
  if (!mcq) {
    const numeric = unique.find(q => Number.isFinite(Number(q.answer)));
    if (numeric) {
      const answer = Number(numeric.answer);
      mcq = { ...numeric, choices: [String(answer + 1), String(answer), String(answer + 2)] };
    } else {
      const source = unique[0];
      const answers = [...new Set(unique.map(q => String(q.answer)))];
      if (answers.length < 2) throw new Error('This level needs a multiple-choice question with distinct options.');
      mcq = { ...source, choices: answers.slice(0, 4) };
    }
  }
  const choice: Question = { ...mcq, question_id: `${mcq.question_id}_mcq`, question_format: 'multiple_choice', answer_type: 'choice' };
  let matching = ranked.find(q => resolveQuestionFormat(q) === 'match_pair');
  if (!matching) {
    let pairs: string[];
    if (targetLevel === 1) {
      pairs = ['2 balls=Fewer than 5 balls', '5 balls=Same as 5 balls', '8 balls=More than 5 balls'];
    } else {
      const distinct = unique.filter((q, i) => unique.findIndex(other => String(other.answer) === String(q.answer)) === i).slice(0, 2);
      if (distinct.length < 2) throw new Error('This level needs a matching question with distinct answers.');
      pairs = distinct.map(q => `${q.question.replace(/\s*\([^)]*\)/g, '').replace(/=/g, ' is ')}=${q.answer}`);
    }
    matching = { ...unique[0], question_id: `L${targetLevel}_match`, question: 'Match each item on the left to the correct answer on the right.', answer: pairs.join(','), choices: pairs, answer_type: 'text', question_format: 'match_pair', source_level: targetLevel };
  }
  return [...written, choice, { ...matching, question_id: `${matching.question_id}_matching`, question_format: 'match_pair' }];
}
