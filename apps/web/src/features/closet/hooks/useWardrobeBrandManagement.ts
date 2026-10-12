import { useState } from 'react'
import { useUiStore } from '../../../stores/useUiStore'
import { useDeleteWardrobeBrandMutation } from '../api/wardrobeQueries'
import { getWardrobeBrandKey } from '../utils/wardrobeBrands'

interface WardrobeBrandManagementOptions {
  selectedBrand: string | null
  onSelectedBrandDeleted: () => void
}

/** 브랜드 창의 관리 모드와 삭제 확인 대상을 관리한다. 선택 중인 브랜드를 삭제하면 부모에 필터 변경을 맡기고, 실패하면 확인 대상을 유지해 재시도할 수 있게 한다. */
export function useWardrobeBrandManagement({ selectedBrand, onSelectedBrandDeleted }: WardrobeBrandManagementOptions) {
  const [isManaging, setIsManaging] = useState(false)
  /** 확인창에 표시할 브랜드명. null이면 삭제를 요청하지 않은 상태다. */
  const [brandToDelete, setBrandToDelete] = useState<string | null>(null)
  const deleteMutation = useDeleteWardrobeBrandMutation()
  const pushToast = useUiStore((state) => state.pushToast)

  /** 삭제 중이 아니면 관리 모드를 바꾸고 남아 있는 삭제 확인 대상을 비운다. */
  function toggleManagement() {
    if (deleteMutation.isPending) return
    setIsManaging((current) => !current)
    setBrandToDelete(null)
  }

  /** 브랜드의 삭제 확인창을 연다. 이 시점에는 옷 정보를 변경하지 않는다. */
  function requestDelete(brand: string) {
    if (!deleteMutation.isPending) setBrandToDelete(brand)
  }

  /** 삭제 요청 전에는 확인창을 닫을 수 있고, 처리 중에는 대상 변경을 막는다. */
  function cancelDelete() {
    if (!deleteMutation.isPending) setBrandToDelete(null)
  }

  /** 확인한 브랜드를 서버에서 해제한다. 성공하면 선택한 브랜드 필터를 전환하고, 오류는 안내한 뒤 재시도할 수 있게 한다. */
  async function confirmDelete() {
    if (!brandToDelete || deleteMutation.isPending) return
    try {
      await deleteMutation.mutateAsync(brandToDelete)
      if (selectedBrand && getWardrobeBrandKey(selectedBrand) === getWardrobeBrandKey(brandToDelete)) {
        onSelectedBrandDeleted()
      }
      setBrandToDelete(null)
      pushToast('브랜드를 삭제했어요. 연결된 옷은 브랜드 미지정으로 바뀌었어요.', 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '브랜드를 삭제하지 못했어요.', 'error')
    }
  }

  return { isManaging, brandToDelete, isDeleting: deleteMutation.isPending, toggleManagement, requestDelete, cancelDelete, confirmDelete }
}
