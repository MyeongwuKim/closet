/** 브라우저 사진을 분류 API나 기기 브리지에 전달할 수 있는 데이터 URL로 읽는다. */
export function readImageDataUrl(image: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('이미지 파일을 읽지 못했어요.'))
    reader.readAsDataURL(image)
  })
}
