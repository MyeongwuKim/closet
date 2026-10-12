/** 사용자가 붙여넣은 클립보드에서 이미지 파일만 반환한다. files와 items에 같은 이미지가 들어오는 브라우저에서는 files를 우선해 중복 추가를 막고, files가 비어 있으면 items에서 파일을 읽는다. 주소·HTML·텍스트는 이미지로 변환하거나 외부에서 다운로드하지 않는다. */
export function getClipboardImageFiles(
  clipboard: Pick<DataTransfer, 'files' | 'items'>,
): File[] {
  const files = Array.from(clipboard.files).filter((file) => file.type.startsWith('image/'))
  if (files.length > 0) return files

  return Array.from(clipboard.items)
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null)
}
