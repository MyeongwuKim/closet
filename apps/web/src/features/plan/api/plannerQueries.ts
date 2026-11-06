import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { WearFeeling } from '@closet/types'
import { GraphqlRequestError, graphqlRequest } from '../../../lib/graphql'
import { queryKeys } from '../../../lib/queryKeys'
import { usePlanStore } from '../stores/usePlanStore'
import { toOutfitPreviewImageInput, type OutfitPreviewImageInput } from '../../lookbook/utils/outfitPreviewInput'
import { invalidateCompletedOutfitPreviews } from '../../lookbook/utils/completedPreviewCache'
import { toWardrobeItem, wardrobeItemFields, type WardrobeItemPayload } from '../../closet/api/wardrobeQueries'
import {
  mergeWeeklyPlanEntries,
  moveWeeklyPlanOutfits,
  type PlanEntry,
} from '../data/weeklyPlan'

interface PlannerWeekPayload {
  id: string
  weekStartsOn: string
  entries: Array<{
    date: string
    wornAt?: string | null
    wearFeeling?: WearFeeling | null
    title: string | null
    occasion: string | null
    weatherSummary: string | null
    temperatureC: number | null
    outfit: {
      id: string
      name: string
      style: string
      plannerOnly: boolean
      items: Array<{ wardrobeItemId: string; wardrobeItem?: WardrobeItemPayload }>
      generations: Array<{
        status: 'queued' | 'processing' | 'completed' | 'failed'
        imageAsset: { id?: string; deliveryUrl: string | null } | null
      }>
    } | null
  }>
}

function invalidatePlannerAndWearStats(queryClient: QueryClient, refreshRecommendation = true) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.planner.all,
      predicate: ({ queryKey }) => refreshRecommendation ||
        (queryKey[1] !== 'today-recommendation' && queryKey[1] !== 'thermal-context'),
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.wardrobe.all }),
  ])
}

/** 플래너 구성을 저장·해제하면 참조가 바뀐 완료 이미지도 서버에서 다시 확인한다. 착용 기록만 바꾸는 경우에는 호출하지 않는다. */
function invalidatePlannerAndPreviews(queryClient: QueryClient) {
  return Promise.all([invalidatePlannerAndWearStats(queryClient), invalidateCompletedOutfitPreviews(queryClient)])
}

/** 다른 기기에서 먼저 착용을 완료했다면 다시 조회해 편집 화면에도 보호 상태를 반영한다. */
function refreshProtectedPlanner(queryClient: QueryClient, error: unknown) {
  if (error instanceof GraphqlRequestError && error.code === 'PLANNER_WEAR_CONFIRMED') {
    void queryClient.invalidateQueries({ queryKey: queryKeys.planner.all })
  }
}

/** 플래너 편집과 하루·기간 조회에 동일한 서버 결과를 반영한 뒤 착용 관련 조회를 갱신한다. */
function applyPlannerWearResult(queryClient: QueryClient, weekStartsOn: string, entries: PlanEntry[], refreshRecommendation = true) {
  queryClient.setQueryData(queryKeys.planner.week(weekStartsOn), entries)
  const entryByDate = new Map(entries.map((entry) => [entry.date, entry]))
  queryClient.setQueriesData<PlanEntry[]>({ queryKey: ['planner', 'entries'] }, (current) =>
    current?.map((entry) => entryByDate.get(entry.date) ?? entry),
  )
  usePlanStore.getState().hydrateEntries(entries)
  return invalidatePlannerAndWearStats(queryClient, refreshRecommendation)
}

/** 빈 하루에도 서버가 배정한 코디를 즉시 넣고, 같은 주의 상세와 착용 관련 조회를 갱신한다. */
function applyPlannerAssignmentResult(queryClient: QueryClient, input: { weekStartsOn: string; date: string }, entries: PlanEntry[]) {
  const savedEntry = entries.find((entry) => entry.date === input.date)
  if (savedEntry?.outfitId) {
    queryClient.setQueriesData<PlanEntry[]>(
      { queryKey: queryKeys.planner.entries(input.date, input.date), exact: true },
      [savedEntry],
    )
  }
  // 배정은 착용 근거를 바꾸지 않으므로 열린 추천을 새로 실행하지 않는다.
  void applyPlannerWearResult(queryClient, input.weekStartsOn, entries, false)
  void invalidateCompletedOutfitPreviews(queryClient)
}

export interface SetPlannerEntryVariables {
  weekStartsOn: string
  date: string
  outfitId: string
  title?: string
  occasion?: string
}

export interface SetDirectPlannerEntryVariables {
  weekStartsOn: string
  date: string
  itemIds: string[]
  previewImage?: OutfitPreviewImageInput
  recommendationName?: string
  recommendationStyle?: string
  weatherSummary?: string
  temperatureC?: number
}

export interface MovePlannerEntryVariables {
  weekStartsOn: string
  sourceDate: string
  targetDate: string
}

/** 화면에 보이는 날짜·코디의 착용 확인 여부를 변경한다. outfitId는 다른 코디로 교체된 뒤의 오래된 조작을 막는다. */
export interface SetPlannerEntryWornVariables {
  weekStartsOn: string
  date: string
  outfitId: string
  worn: boolean
}

/** 체감을 남길 때 화면에서 확인한 착용 시각까지 전달해 취소·재확인 전의 오래된 요청을 구분한다. null은 체감 기록 삭제다. */
export interface SetPlannerEntryWearFeelingVariables {
  weekStartsOn: string
  date: string
  outfitId: string
  wornAt: string
  feeling: WearFeeling | null
}

export interface OutfitWearRecord {
  outfitId: string
  date: string
  temperatureC: number | null
  wornAt?: string | null
}

/** 날짜 코디의 옷 관계를 함께 보관해 활성 옷장 목록에 없는 옷도 플래너에서 표시한다. */
function toPlanEntry(
  entry: PlannerWeekPayload['entries'][number],
): PlanEntry {
  const date = new Date(`${entry.date}T00:00:00`)
  const weather = [
    entry.temperatureC === null ? null : `${entry.temperatureC}°`,
    entry.weatherSummary,
  ]
    .filter(Boolean)
    .join(' · ')

  return {
    date: entry.date,
    dayLabel: new Intl.DateTimeFormat('ko-KR', { weekday: 'short' })
      .format(date)
      .replace('요일', ''),
    dayNumber: date.getDate(),
    title: entry.title ?? entry.outfit?.name ?? '',
    occasion: entry.occasion ?? '',
    weather,
    itemIds: entry.outfit?.items.map((item) => item.wardrobeItemId) ?? [],
    outfitItems: entry.outfit?.items.flatMap((item) => item.wardrobeItem ? [toWardrobeItem(item.wardrobeItem)] : []) ?? [],
    outfitId: entry.outfit?.id,
    wornAt: entry.wornAt ?? null,
    wearFeeling: entry.wornAt ? entry.wearFeeling ?? null : null,
    outfitStyle: entry.outfit?.style,
    plannerOnly: entry.outfit?.plannerOnly,
    previewImageAssetId: entry.outfit?.generations.find(
      (generation) => generation.status === 'completed' && generation.imageAsset?.deliveryUrl,
    )?.imageAsset?.id,
    previewImageUrl:
      entry.outfit?.generations.find(
        (generation) =>
          generation.status === 'completed' &&
          generation.imageAsset?.deliveryUrl,
      )?.imageAsset?.deliveryUrl ?? undefined,
  }
}

export function usePlannerWeekQuery(weekStartsOn: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.planner.week(weekStartsOn),
    queryFn: async ({ signal }) => {
      const data = await graphqlRequest<
        { plannerWeek: PlannerWeekPayload | null },
        { weekStartsOn: string }
      >(
        `
          query PlannerWeek($weekStartsOn: String!) {
            plannerWeek(weekStartsOn: $weekStartsOn) {
              id weekStartsOn
              entries {
                date title occasion weatherSummary temperatureC wornAt wearFeeling
                outfit {
                  id name style plannerOnly
                  items { wardrobeItemId wardrobeItem { ${wardrobeItemFields} } }
                  generations { status imageAsset { id deliveryUrl } }
                }
              }
            }
          }
        `,
        { weekStartsOn },
        signal,
      )
      return mergeWeeklyPlanEntries(
        weekStartsOn,
        data.plannerWeek?.entries.map(toPlanEntry) ?? [],
      )
    },
    enabled: enabled && Boolean(weekStartsOn),
  })
}

export function usePlannerEntriesQuery(
  from: string,
  to: string,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.planner.entries(from, to),
    queryFn: async ({ signal }) => {
      const data = await graphqlRequest<
        { plannerEntries: PlannerWeekPayload['entries'] },
        { from: string; to: string }
      >(
        `
          query PlannerEntries($from: String!, $to: String!) {
            plannerEntries(from: $from, to: $to) {
              date title occasion weatherSummary temperatureC wornAt wearFeeling
              outfit {
                  id name style plannerOnly
                items { wardrobeItemId wardrobeItem { ${wardrobeItemFields} } }
                generations { status imageAsset { id deliveryUrl } }
              }
            }
          }
        `,
        { from, to },
        signal,
      )
      return data.plannerEntries.map(toPlanEntry)
    },
    enabled: enabled && Boolean(from) && Boolean(to),
  })
}

export function useOutfitWearHistoryQuery(
  outfitIds: string[],
  enabled = true,
) {
  const normalizedOutfitIds = [...new Set(outfitIds)].sort()

  return useQuery({
    queryKey: queryKeys.planner.outfitWearHistory(normalizedOutfitIds),
    queryFn: async ({ signal }) => {
      const data = await graphqlRequest<
        { outfitWearHistory: OutfitWearRecord[] },
        { outfitIds: string[] }
      >(
        `
          query OutfitWearHistory($outfitIds: [ID!]!) {
            outfitWearHistory(outfitIds: $outfitIds) {
              outfitId date temperatureC wornAt
            }
          }
        `,
        { outfitIds: normalizedOutfitIds },
        signal,
      )
      return data.outfitWearHistory
    },
    enabled: enabled && normalizedOutfitIds.length > 0,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  })
}

export function useSetDirectPlannerEntryMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SetDirectPlannerEntryVariables) => {
      const data = await graphqlRequest<
        { setDirectPlannerEntry: PlannerWeekPayload },
        { input: SetDirectPlannerEntryVariables }
      >(
        `
          mutation SetDirectPlannerEntry($input: SetDirectPlannerEntryInput!) {
            setDirectPlannerEntry(input: $input) {
              id weekStartsOn
              entries {
                date title occasion weatherSummary temperatureC wornAt wearFeeling
                outfit {
                  id name style plannerOnly
                  items { wardrobeItemId wardrobeItem { ${wardrobeItemFields} } }
                  generations { status imageAsset { id deliveryUrl } }
                }
              }
            }
          }
        `,
        { input: { ...input, previewImage: toOutfitPreviewImageInput(input.previewImage) } },
      )
      return data.setDirectPlannerEntry.entries.map(toPlanEntry)
    },
    onError: (error) => refreshProtectedPlanner(queryClient, error),
    onSuccess: (entries, input) => {
      applyPlannerAssignmentResult(queryClient, input, mergeWeeklyPlanEntries(input.weekStartsOn, entries))
    },
  })
}

/** 실제 착용 확인·취소 결과를 주간·기간 조회와 편집 Store에 반영하고 착용 통계·최근 착용·하이라이트를 갱신한다. */
export function useSetPlannerEntryWornMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SetPlannerEntryWornVariables) => {
      const data = await graphqlRequest<
        { setPlannerEntryWorn: PlannerWeekPayload },
        { input: SetPlannerEntryWornVariables }
      >(`
        mutation SetPlannerEntryWorn($input: SetPlannerEntryWornInput!) {
          setPlannerEntryWorn(input: $input) {
            id weekStartsOn
            entries {
              date title occasion weatherSummary temperatureC wornAt wearFeeling
              outfit {
                id name style plannerOnly
                items { wardrobeItemId wardrobeItem { ${wardrobeItemFields} } }
                generations { status imageAsset { id deliveryUrl } }
              }
            }
          }
        }
      `, { input })
      return mergeWeeklyPlanEntries(
        data.setPlannerEntryWorn.weekStartsOn,
        data.setPlannerEntryWorn.entries.map(toPlanEntry),
      )
    },
    onSuccess: (entries, input) => applyPlannerWearResult(queryClient, input.weekStartsOn, entries),
  })
}

/** 착용 완료한 현재 코디의 추위·적당함·더위 체감을 저장하거나 지운 뒤 기존 플래너 조회와 Store에 반영한다. */
export function useSetPlannerEntryWearFeelingMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SetPlannerEntryWearFeelingVariables) => {
      const data = await graphqlRequest<
        { setPlannerEntryWearFeeling: PlannerWeekPayload },
        { input: SetPlannerEntryWearFeelingVariables }
      >(`
        mutation SetPlannerEntryWearFeeling($input: SetPlannerEntryWearFeelingInput!) {
          setPlannerEntryWearFeeling(input: $input) {
            id weekStartsOn
            entries {
              date title occasion weatherSummary temperatureC wornAt wearFeeling
              outfit {
                id name style plannerOnly
                items { wardrobeItemId wardrobeItem { ${wardrobeItemFields} } }
                generations { status imageAsset { id deliveryUrl } }
              }
            }
          }
        }
      `, { input })
      return mergeWeeklyPlanEntries(
        data.setPlannerEntryWearFeeling.weekStartsOn,
        data.setPlannerEntryWearFeeling.entries.map(toPlanEntry),
      )
    },
    onSuccess: (entries, input) => applyPlannerWearResult(queryClient, input.weekStartsOn, entries),
  })
}

export function useMovePlannerEntryMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: MovePlannerEntryVariables) => {
      const data = await graphqlRequest<
        { movePlannerEntry: PlannerWeekPayload },
        { input: MovePlannerEntryVariables }
      >(
        `
          mutation MovePlannerEntry($input: MovePlannerEntryInput!) {
            movePlannerEntry(input: $input) {
              id weekStartsOn
              entries {
                date title occasion weatherSummary temperatureC wornAt wearFeeling
                outfit {
                  id name style plannerOnly
                  items { wardrobeItemId wardrobeItem { ${wardrobeItemFields} } }
                  generations { status imageAsset { id deliveryUrl } }
                }
              }
            }
          }
        `,
        { input },
      )

      return mergeWeeklyPlanEntries(
        data.movePlannerEntry.weekStartsOn,
        data.movePlannerEntry.entries.map(toPlanEntry),
      )
    },
    onMutate: async (input) => {
      const queryKey = queryKeys.planner.week(input.weekStartsOn)
      await queryClient.cancelQueries({ queryKey })
      const previousEntries = queryClient.getQueryData<PlanEntry[]>(queryKey)

      if (previousEntries) {
        queryClient.setQueryData(
          queryKey,
          moveWeeklyPlanOutfits(
            previousEntries,
            input.sourceDate,
            input.targetDate,
          ),
        )
      }

      return { previousEntries }
    },
    onError: (_error, input, context) => {
      if (context?.previousEntries) {
        queryClient.setQueryData(
          queryKeys.planner.week(input.weekStartsOn),
          context.previousEntries,
        )
      }
    },
    onSuccess: (entries, input) => {
      queryClient.setQueryData(
        queryKeys.planner.week(input.weekStartsOn),
        entries,
      )
    },
    onSettled: () =>
      invalidatePlannerAndWearStats(queryClient),
  })
}

export function useSavePlannerOutfitToLookbookMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (variables: {
      outfitId: string
      previewImage?: OutfitPreviewImageInput
    }) => {
      const data = await graphqlRequest<
        { savePlannerOutfitToLookbook: { id: string } },
        typeof variables
      >(
        `
          mutation SavePlannerOutfitToLookbook(
            $outfitId: ID!
            $previewImage: OutfitPreviewImageInput
          ) {
            savePlannerOutfitToLookbook(
              outfitId: $outfitId
              previewImage: $previewImage
            ) { id }
          }
        `,
        { ...variables, previewImage: toOutfitPreviewImageInput(variables.previewImage) },
      )
      return data.savePlannerOutfitToLookbook
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.outfits.all })
      void invalidatePlannerAndPreviews(queryClient)
    },
  })
}

/** 배정 시 서버가 만든 날짜별 복사본을 캐시와 편집 Store에 반영한다. 원본 코디북 ID로 다시 덮지 않는다. */
export function useSetPlannerEntryMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SetPlannerEntryVariables) => {
      const data = await graphqlRequest<
        { setPlannerEntry: PlannerWeekPayload },
        { input: SetPlannerEntryVariables }
      >(`
        mutation SetPlannerEntry($input: SetPlannerEntryInput!) {
          setPlannerEntry(input: $input) {
            id weekStartsOn
            entries {
              date title occasion weatherSummary temperatureC wornAt wearFeeling
              outfit {
                id name style plannerOnly
                items { wardrobeItemId wardrobeItem { ${wardrobeItemFields} } }
                generations { status imageAsset { id deliveryUrl } }
              }
            }
          }
        }
      `, { input })
      return mergeWeeklyPlanEntries(data.setPlannerEntry.weekStartsOn, data.setPlannerEntry.entries.map(toPlanEntry))
    },
    onError: (error) => refreshProtectedPlanner(queryClient, error),
    onSuccess: (entries, input) => applyPlannerAssignmentResult(queryClient, input, entries),
  })
}

export function useClearPlannerEntryMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (variables: {
      weekStartsOn: string
      date: string
    }) => {
      await graphqlRequest<
        { clearPlannerEntry: { id: string } | null },
        typeof variables
      >(
        `
          mutation ClearPlannerEntry($weekStartsOn: String!, $date: String!) {
            clearPlannerEntry(weekStartsOn: $weekStartsOn, date: $date) { id }
          }
        `,
        variables,
      )
      return variables
    },
    onError: (error) => refreshProtectedPlanner(queryClient, error),
    onSuccess: () =>
      invalidatePlannerAndPreviews(queryClient),
  })
}
