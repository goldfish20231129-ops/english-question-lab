# Provided Passage Vocabulary Policy V0.1

어휘 정책은 새로 생성하는 영어 선지, 삽입 문장, 부가 영어 표현에만 적용한다. 권위 원문, 고유명사, 직접 인용 evidence, 한국어 해설, fingerprint에는 적용하지 않는다.

- `source_matched`: 원문과 비슷한 추상도·복잡도로 관계를 재진술한다.
- `grade_1`: 불필요한 희귀어·고추상 학술어를 피한다.
- `grade_2`: 중간 수준 추상어와 학술 표현을 허용한다.
- `grade_3_csat`: 자연스러운 수능 학술 영어와 개념 관계 재진술을 허용한다.

이는 사용자 지정 생성 정책이며 통계 기반 절대 난이도 모델이 아니다. EBS Vocabulary Runtime Profile은 목표 등재율이나 필수 단어 목록이 아니다.
