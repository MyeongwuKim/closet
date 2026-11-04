import type { Prisma } from '@prisma/client'

/** 확인 시각이 실제로 저장된 일정만 착용 이력으로 조회한다. 기존 문서의 누락 필드·null은 미확정이다. */
export const confirmedWearWhere = {
  wornAt: { isSet: true, not: null },
} satisfies Prisma.PlannerEntryWhereInput
