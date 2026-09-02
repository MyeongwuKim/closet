/**
 * 용도:
 * 플래너와 착용 이력 GraphQL 요청을 서비스 계층으로 연결한다.
 *
 * 동작 방식:
 * 로그인 사용자를 확인한 뒤 날짜 기반 조회와 편집 요청을 전달하고,
 * 서비스 오류를 클라이언트가 구분할 수 있는 GraphQL 오류로 변환한다.
 */

import type { GraphQLContext } from '../../graphql/context.js'
import { toGraphQLError } from '../../graphql/errors.js'
import { toDateOnly } from '../../lib/date.js'
import {
  plannerService,
  type MovePlannerEntryInput,
  type RecentWearConflictInput,
  type SetDirectPlannerEntryInput,
  type SetPlannerEntryInput,
} from './planner.service.js'
import type { CreateOutfitInput } from '../outfit/outfit.service.js'

export const plannerResolvers = {
  PlannerWeek: {
    weekStartsOn: (week: { weekStartsOn: Date }) =>
      toDateOnly(week.weekStartsOn),
  },
  PlannerEntry: {
    date: (entry: { date: Date }) => toDateOnly(entry.date),
    createdAt: (entry: { createdAt: Date }) => entry.createdAt.toISOString(),
    updatedAt: (entry: { updatedAt: Date }) => entry.updatedAt.toISOString(),
  },
  OutfitWearRecord: {
    date: (record: { date: Date }) => toDateOnly(record.date),
  },
  Query: {
    plannerWeek: async (
      _parent: unknown,
      { weekStartsOn }: { weekStartsOn: string },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return plannerService.getWeek(viewer.id, weekStartsOn)
      } catch (error) {
        throw toGraphQLError(error, '플래너를 불러오지 못했습니다.', 'PLANNER_LOAD_FAILED')
      }
    },
    plannerEntries: async (
      _parent: unknown,
      { from, to }: { from: string; to: string },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return plannerService.getEntries(viewer.id, from, to)
      } catch (error) {
        throw toGraphQLError(
          error,
          '월간 플래너를 불러오지 못했습니다.',
          'PLANNER_LOAD_FAILED',
        )
      }
    },
    outfitWearHistory: async (
      _parent: unknown,
      { outfitIds }: { outfitIds: string[] },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return plannerService.getOutfitWearHistory(viewer.id, outfitIds)
      } catch (error) {
        throw toGraphQLError(
          error,
          '코디 착용 기록을 불러오지 못했습니다.',
          'OUTFIT_HISTORY_LOAD_FAILED',
        )
      }
    },
    recentWearConflict: async (
      _parent: unknown,
      { input }: { input: RecentWearConflictInput },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return plannerService.getRecentWearConflict(viewer.id, input)
      } catch (error) {
        throw toGraphQLError(
          error,
          '최근 착용 기록을 확인하지 못했습니다.',
          'RECENT_WEAR_CONFLICT_LOAD_FAILED',
        )
      }
    },
  },
  Mutation: {
    setPlannerEntry: async (
      _parent: unknown,
      { input }: { input: SetPlannerEntryInput },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return plannerService.setEntry(viewer.id, input)
      } catch (error) {
        throw toGraphQLError(error, '플래너를 저장하지 못했습니다.', 'PLANNER_UPDATE_FAILED')
      }
    },
    setDirectPlannerEntry: async (
      _parent: unknown,
      { input }: { input: SetDirectPlannerEntryInput },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return plannerService.setDirectEntry(viewer.id, input)
      } catch (error) {
        throw toGraphQLError(
          error,
          '직접 고른 코디를 플래너에 저장하지 못했습니다.',
          'PLANNER_DIRECT_OUTFIT_FAILED',
        )
      }
    },
    movePlannerEntry: async (
      _parent: unknown,
      { input }: { input: MovePlannerEntryInput },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return plannerService.moveEntry(viewer.id, input)
      } catch (error) {
        throw toGraphQLError(
          error,
          '코디 위치를 옮기지 못했습니다.',
          'PLANNER_MOVE_FAILED',
        )
      }
    },
    savePlannerOutfitToLookbook: async (
      _parent: unknown,
      {
        outfitId,
        previewImage,
      }: {
        outfitId: string
        previewImage?: CreateOutfitInput['previewImage']
      },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return plannerService.savePlannerOutfitToLookbook(
          viewer.id,
          outfitId,
          previewImage,
        )
      } catch (error) {
        throw toGraphQLError(
          error,
          '코디북에 저장하지 못했습니다.',
          'PLANNER_OUTFIT_PROMOTION_FAILED',
        )
      }
    },
    clearPlannerEntry: async (
      _parent: unknown,
      { weekStartsOn, date }: { weekStartsOn: string; date: string },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return plannerService.clearEntry(viewer.id, weekStartsOn, date)
      } catch (error) {
        throw toGraphQLError(error, '플래너를 비우지 못했습니다.', 'PLANNER_UPDATE_FAILED')
      }
    },
  },
}
