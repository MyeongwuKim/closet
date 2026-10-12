import { useRef, useState } from 'react'
import type { ClipboardEvent, DragEvent } from 'react'
import { getClipboardImageFiles } from '../utils/clipboardImages'

/** 웹 사진 추가창에서 드롭한 파일과 붙여넣은 이미지를 받는다. 자식 요소를 지날 때 영역 강조가 깜박이지 않도록 드래그 진입 수를 세며, 사진의 형식·용량 검증과 분석은 onImagesSelected에 맡긴다. */
export function useWardrobeImageDrop(onImagesSelected: (files: File[]) => void) {
  const [isDragging, setIsDragging] = useState(false)
  /** 영역과 자식 요소에 겹쳐 들어온 dragenter 수. 마지막 dragleave나 drop에서 강조를 해제한다. */
  const dragDepthRef = useRef(0)

  const handleDragEnter = (event: DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current += 1
    setIsDragging(true)
  }

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setIsDragging(false)
  }

  /** 파일을 놓으면 브라우저의 파일 열기를 막고 강조를 해제한 뒤, 여러 파일을 함께 선택 흐름으로 전달한다. */
  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current = 0
    setIsDragging(false)
    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) onImagesSelected(files)
  }

  /** 창 안에서 ⌘V·Ctrl+V로 붙여넣은 이미지가 있을 때만 기본 붙여넣기를 막고 사진 선택 흐름으로 전달한다. 사용자의 paste 이벤트에 포함된 데이터만 읽으며 별도 클립보드 권한을 요청하지 않는다. */
  const handlePaste = (event: ClipboardEvent<HTMLElement>) => {
    const files = getClipboardImageFiles(event.clipboardData)
    if (files.length === 0) return
    event.preventDefault()
    event.stopPropagation()
    onImagesSelected(files)
  }

  return {
    isDragging,
    handlePaste,
    dropZoneHandlers: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
  }
}
