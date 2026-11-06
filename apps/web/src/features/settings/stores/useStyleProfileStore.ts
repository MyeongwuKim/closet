import { create } from 'zustand'
import type { OutfitStyle } from '../../../constants/styleOptions'

export type PreferredFit = 'wide' | 'regular' | 'skinny'
export type Gender = 'male' | 'female'
export type BodyBuild = 'slim' | 'average' | 'athletic' | 'broad'
export type PreferredStyle = OutfitStyle

export interface StyleProfile {
  gender: Gender | null
  bodyBuild: BodyBuild | null
  heightCm: string
  weightKg: string
  chestCircumferenceCm: string
  waistCircumferenceCm: string
  hipCircumferenceCm: string
  /** 몸의 허벅지를 한 바퀴 잰 둘레(cm). 미입력은 빈 문자열이다. */
  thighCircumferenceCm: string
  shoulderWidthCm: string
  inseamCm: string
  preferredFit: PreferredFit
  preferredStyles: PreferredStyle[]
}

interface StyleProfileState {
  profile: StyleProfile
  updateProfile: (profile: StyleProfile) => void
}

export const useStyleProfileStore = create<StyleProfileState>((set) => ({
  profile: {
    gender: null,
    bodyBuild: null,
    heightCm: '',
    weightKg: '',
    chestCircumferenceCm: '',
    waistCircumferenceCm: '',
    hipCircumferenceCm: '',
    thighCircumferenceCm: '',
    shoulderWidthCm: '',
    inseamCm: '',
    preferredFit: 'regular',
    preferredStyles: [],
  },
  updateProfile: (profile) => set({ profile }),
}))
