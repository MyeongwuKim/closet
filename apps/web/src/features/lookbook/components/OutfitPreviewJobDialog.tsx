import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import type { OutfitPreviewJob } from '@closet/types'
import { usePreviewJobNotification } from '../hooks/usePreviewJobNotification'

/** 모든 화면 위에 완료·실패 팝업을 한 번만 표시한다. 화면 흐름과 네이티브 푸시의 자동 이동은 훅에서 구분한다. */
export function OutfitPreviewJobDialog() {
  const notification = usePreviewJobNotification()
  return notification.job ? <PreviewJobDialogContent key={notification.job.id} job={notification.job} onLater={notification.dismiss} onOpen={notification.openResult} /> : null
}

function PreviewJobDialogContent({ job, onLater, onOpen }: { job: OutfitPreviewJob; onLater: () => void; onOpen: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const completed = job.status === 'completed'
  // 팝업 안에서 초점을 이동하고, 닫으면 열기 전 조작하던 화면으로 돌려준다.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeRef.current?.click() }
      if (event.key !== 'Tab') return
      const buttons = [...(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
      const first = buttons[0]; const last = buttons.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => { window.removeEventListener('keydown', onKeyDown, true); previous?.focus() }
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-ink/40 px-5 py-8 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.currentTarget === event.target) onLater() }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="preview-job-notification-title" aria-describedby="preview-job-notification-description" className="w-full max-w-sm rounded-3xl border border-line bg-surface p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-sage text-accent">{completed ? <CheckCircle2 size={25} /> : <AlertCircle size={25} />}</span>
          <button ref={closeRef} type="button" aria-label="AI 룩 완료 안내 닫기" onClick={onLater} className="rounded-full p-2 text-muted hover:bg-canvas"><X size={20} /></button>
        </div>
        <h2 id="preview-job-notification-title" className="mt-4 text-lg font-black">{completed ? 'AI 룩이 완성됐어요' : 'AI 룩을 만들지 못했어요'}</h2>
        <p id="preview-job-notification-description" className="mt-2 text-sm leading-6 text-muted">{completed ? '완성된 룩을 확인하고 코디에 저장해 보세요.' : job.errorMessage ?? '생성 결과를 확인하고 다시 시도해 주세요.'}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onLater} className="min-h-12 rounded-xl border border-line px-3 py-3 text-sm font-bold">나중에 보기</button>
          <button type="button" onClick={onOpen} className="min-h-12 rounded-xl bg-accent px-3 py-3 text-sm font-bold text-white">{completed ? '보러 가기' : '결과 확인'}</button>
        </div>
      </div>
    </div>, document.body,
  )
}
