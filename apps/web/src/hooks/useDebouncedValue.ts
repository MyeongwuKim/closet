import { useEffect, useState } from 'react'

/** 입력이 delayMs 동안 바뀌지 않은 뒤 조회에 사용할 값을 갱신한다. 새 입력과 화면 이탈은 이전 예약을 취소하며 입력창 자체의 값은 지연하지 않는다. */
export function useDebouncedValue<T>(value: T, delayMs = 180) {
  const [settledValue, setSettledValue] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setSettledValue(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return settledValue
}
