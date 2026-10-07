import { WardrobeEmptyStateIllustration } from '../../../components/WardrobeEmptyStateIllustration'

/** 로그인 화면에 옷장 일러스트와 브랜드, 어디서든 여는 내 작은 옷장 슬로건을 표시한다. 인증과 입력 상태는 로그인 페이지에서 관리한다. */
export function LoginWelcome() {
  return (
    <div className="flex flex-col items-center px-6 pt-8 pb-6 text-center sm:px-8">
      <WardrobeEmptyStateIllustration className="mb-5 h-36 w-40" />
      <h1 className="font-editorial text-[28px] tracking-[-0.06em]">wearroom<span className="text-accent">.</span></h1>
      <p className="mt-3 text-sm leading-5 text-muted">어디서든 여는 내 작은 옷장</p>
    </div>
  )
}
