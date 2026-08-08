export type Subject = 'math' | 'korean'
export type Status = 'idea' | 'prompted' | 'generated' | 'reviewing' | 'complete'
export type ResultLevel = 'pass' | 'warning' | 'error'

export interface ReviewResult { id: string; level: ResultLevel; label: string; detail: string }
export interface QualityRatings { satisfaction: number; novelty: number; neatness: number; thinking: number; naturalness: number; difficultyFit: number }
export interface ProblemProject {
  id: string; title: string; subject: Subject; grade: string; curriculum: string; unit: string; topic: string; difficulty: number; questionType: 'multiple' | 'short'; questionCount: number; questionDistribution: Record<string, number>;
  idea: string; traits: string[]; answerPreference: string; avoidTags: string[]; requiredElement: string; reference: string;
  calculationScope: string; koreanMode: 'provided' | 'generated'; passageTopic: string; passageLength: 'short' | 'medium' | 'long'; koreanReferenceEnabled: boolean; koreanReferenceType: string; koreanReferenceStyle: string;
  passage: string; abilities: string[]; distractorTypes: string[]; questionStyle: string;
  generatedPrompt: string; problem: string; choices: string[]; answer: string; solution: string; intention: string; memo: string;
  reviewResults: ReviewResult[]; reviewChecklist: Record<string, boolean>; qualityRatings: QualityRatings; likes: string; dislikes: string;
  status: Status; createdAt: string; updatedAt: string;
}

export const mathPrinciples = ['핵심은 계산량보다 사고 과정에 둔다.', '각 조건은 풀이에 의미가 있어야 한다.', '불필요한 분수와 지저분한 계산을 피한다.', '교육과정을 벗어나는 풀이를 요구하지 않는다.', '단순 공식 대입 문제를 피한다.', '답은 가능하면 깔끔하게 한다.', '의미 있는 추론을 한 번 이상 요구한다.', '문장은 간결하고 명확하게 쓴다.', '조건이 부족하거나 과도하지 않게 한다.', '정답은 유일해야 한다.']
export const koreanPrinciples = ['정답의 근거가 지문에서 명확히 확인되어야 한다.', '오답에는 명백한 오류 근거가 있어야 한다.', '표현의 애매함 때문에 정답이 갈리지 않게 한다.', '암기보다 이해와 추론을 평가한다.', '선지 간 수준과 길이가 지나치게 차이나지 않게 한다.', '말장난식 함정을 피한다.', '발문은 자연스럽고 시험 문항에 적절한 문체로 쓴다.']
export const mathChecklist = ['조건은 모두 필요한가?', '조건이 부족하지 않은가?', '정답이 유일한가?', '교육과정 안에서 풀 수 있는가?', '지나치게 계산 중심이지 않은가?', '핵심 발상이 명확한가?', '다른 쉬운 우회 풀이가 없는가?', '난이도가 의도와 맞는가?', '숫자가 인위적으로 보이지 않는가?', '발문이 자연스러운가?']
export const koreanChecklist = ['정답 근거가 지문에 존재하는가?', '복수 정답 가능성이 없는가?', '오답의 오류 근거가 명확한가?', '정답 선지가 지나치게 티 나지 않는가?', '발문이 자연스러운가?', '보기와 지문의 연결이 타당한가?', '단순 말장난 문제가 아닌가?', '난이도가 의도와 맞는가?', '선지 길이가 정답을 암시하지 않는가?']

export const emptyProject = (subject: Subject = 'math'): ProblemProject => ({
  id: crypto.randomUUID(), title: subject === 'math' ? '새 수학 문제' : '새 국어 문제', subject, grade: '고등학교', curriculum: '', unit: '', topic: '', difficulty: 3, questionType: 'multiple', questionCount: 1, questionDistribution: subject === 'math' ? { '추론형': 1 } : { '내용 일치': 1 }, idea: '', traits: [], answerPreference: '정수 선호', avoidTags: [], requiredElement: '', reference: '', calculationScope: '', koreanMode: 'provided', passageTopic: '', passageLength: 'medium', koreanReferenceEnabled: false, koreanReferenceType: '개념 적용', koreanReferenceStyle: '짧은 설명', passage: '', abilities: [], distractorTypes: [], questionStyle: '평가원형', generatedPrompt: '', problem: '', choices: ['', '', '', '', ''], answer: '', solution: '', intention: '', memo: '', reviewResults: [], reviewChecklist: {}, qualityRatings: { satisfaction: 3, novelty: 3, neatness: 3, thinking: 3, naturalness: 3, difficultyFit: 3 }, likes: '', dislikes: '', status: 'idea', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
})
