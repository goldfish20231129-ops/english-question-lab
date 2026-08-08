import { koreanPrinciples, mathPrinciples, type ProblemProject } from './types'
const lines = (items: string[]) => items.filter(Boolean).map((item) => `- ${item}`).join('\n')
export function generatePrompt(p: ProblemProject, customPrinciples?: string[]): string {
  const isMath = p.subject === 'math'; const principles = customPrinciples?.length ? customPrinciples : isMath ? mathPrinciples : koreanPrinciples
  const specifics = isMath
    ? `단원명: ${p.unit || '미정'}\n핵심 개념: ${p.topic || '미정'}\n계산 범위: ${p.calculationScope || '사용자 입력 범위 안'}\n난이도: ${p.difficulty}/5\n문항 형식: ${p.questionType === 'multiple' ? '객관식 5지선다' : '주관식'}`
    : p.koreanMode === 'provided'
      ? `출제 방식: 사용자가 등록한 지문 안에서 출제\n영역/갈래: ${p.unit || '미정'}\n핵심 개념: ${p.topic || '미정'}\n등록 지문 또는 작품:\n${p.passage || '(지문을 입력하세요)'}\n난이도: ${p.difficulty}/5\n문항 형식: ${p.questionType === 'multiple' ? '객관식 5지선다' : '주관식'}`
      : `출제 방식: AI가 새 지문을 만들고 그 지문 안에서 출제\n분야/갈래: ${p.unit || '미정'}\n지문 주제 또는 소재: ${p.passageTopic || '자연스럽고 교육적인 소재'}\n지문 길이: ${{ short: '짧음', medium: '보통', long: '김' }[p.passageLength ?? 'medium']}\n핵심 개념: ${p.topic || '미정'}\n난이도: ${p.difficulty}/5\n문항 형식: ${p.questionType === 'multiple' ? '객관식 5지선다' : '주관식'}`
  return `[역할]\n당신은 대한민국 고등학교 ${isMath ? '수학' : '국어'} 시험 문항을 전문적으로 설계하는 출제자이다.\n\n[출제 명세]\n${specifics}\n\n[출제 의도]\n${p.idea || '사용자가 아직 출제 의도를 작성하지 않았습니다. 기존 정보를 벗어나 임의로 주제를 확장하지 마십시오.'}\n\n[기타 요청]\n${p.reference || '없음'}\n\n[사용자의 출제 원칙]\n${lines(principles)}\n\n[제작 지침]\n사용자의 출제 의도를 최대한 보존하십시오. 먼저 문제 구조를 설계한 뒤 직접 풀어 보고, 정답의 유일성·조건의 충분성·난이도·계산의 적절성을 내부적으로 점검한 결과만 출력하십시오.${!isMath && p.koreanMode === 'generated' ? '\n새 지문을 먼저 제시하고, 반드시 그 지문만을 근거로 문제를 출제하십시오.' : ''}\n\n[출력 형식]\n1. ${!isMath && p.koreanMode === 'generated' ? '생성 지문\n2. ' : ''}최종 문제\n${!isMath && p.koreanMode === 'generated' ? '3' : '2'}. 선택지${p.questionType === 'multiple' ? ' (1~5)' : ''}\n${!isMath && p.koreanMode === 'generated' ? '4' : '3'}. 정답\n${!isMath && p.koreanMode === 'generated' ? '5' : '4'}. 상세 풀이\n${!isMath && p.koreanMode === 'generated' ? '6' : '5'}. 출제 의도`
}
