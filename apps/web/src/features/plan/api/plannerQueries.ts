import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { OutfitPreview } from '@closet/types'
import { graphqlRequest } from '../../../lib/graphql'
import { queryKeys } from '../../../lib/queryKeys'
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
    title: string | null
    occasion: string | null
    weatherSummary: string | null
    temperatureC: number | null
    outfit: {
      id: string
      name: string
      plannerOnly: boolean
      items: Array<{ wardrobeItemId: string }>
      generations: Array<{
        status: 'queued' | 'processing' | 'completed' | 'failed'
        imageAsset: { deliveryUrl: string | null } | null
      }>
    } | null
  }>
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
  previewImage?: OutfitPreview
  recommendationName?: string
  recommendationStyle?: string
}

export interface MovePlannerEntryVariables {
  weekStartsOn: string
  sourceDate: string
  targetDate: string
}

export interface OutfitWearRecord {
  outfitId: string
  date: string
}

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
    outfitId: entry.outfit?.id,
    plannerOnly: entry.outfit?.plannerOnly,
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
                date title occasion weatherSummary temperatureC
                outfit {
                  id name plannerOnly
                  items { wardrobeItemId }
                  generations { status imageAsset { deliveryUrl } }
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
              date title occasion weatherSummary temperatureC
              outfit {
                  id name plannerOnly
                items { wardrobeItemId }
                generations { status imageAsset { deliveryUrl } }
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
              outfitId date
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
                date title occasion weatherSummary temperatureC
                outfit {
                  id name plannerOnly
                  items { wardrobeItemId }
                  generations { status imageAsset { deliveryUrl } }
                }
              }
            }
          }
        `,
        { input },
      )
      return data.setDirectPlannerEntry.entries.map(toPlanEntry)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.planner.all }),
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
                date title occasion weatherSummary temperatureC
                outfit {
                  id name plannerOnly
                  items { wardrobeItemId }
                  generations { status imageAsset { deliveryUrl } }
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
      queryClient.invalidateQueries({ queryKey: queryKeys.planner.all }),
  })
}

export function useSavePlannerOutfitToLookbookMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (variables: {
      outfitId: string
      previewImage?: OutfitPreview
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
        variables,
      )
      return data.savePlannerOutfitToLookbook
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.outfits.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.planner.all })
    },
  })
}

export function useSetPlannerEntryMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SetPlannerEntryVariables) => {
      await graphqlRequest<
        { setPlannerEntry: { id: string } },
        { input: SetPlannerEntryVariables }
      >(
        `
          mutation SetPlannerEntry($input: SetPlannerEntryInput!) {
            setPlannerEntry(input: $input) { id }
          }
        `,
        { input },
      )
      return input
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.planner.all,
      }),
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
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.planner.all,
      }),
  })
}
