import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createOutfitComposerState,
  outfitComposerReducer,
} from '../src/features/lookbook/contexts/OutfitComposerContext'
import {
  createOutfitComposerPath,
  getOutfitComposerBackPath,
  shouldExitOutfitComposer,
} from '../src/features/lookbook/utils/outfitComposerNavigation'

function createState(
  itemIds: readonly string[],
  originItemIds: readonly string[] = itemIds,
) {
  return createOutfitComposerState(
    itemIds.map((wardrobeItemId, order) => ({ wardrobeItemId, order })),
    originItemIds,
  )
}

test('아이템과 원래 경로의 중첩 쿼리·해시를 코디 만들기 왕복 경로에 보존한다', () => {
  const itemIds = ['base-outer', 'bottom-black'] as const
  const originPaths = [
    '/closet/base-outer?from=%2Fplan%3Fdate%3D2026-08-28&filter=outer#item-info',
    '/plan?date=2026-08-28&week=2026-08-24#today',
  ]

  for (const fromPath of originPaths) {
    const url = new URL(
      createOutfitComposerPath(itemIds, fromPath),
      'https://closet.test',
    )

    assert.equal(url.pathname, '/lookbook/new')
    assert.equal(url.searchParams.get('items'), 'base-outer,bottom-black')
    assert.equal(url.searchParams.get('from'), fromPath)
    assert.equal(url.hash, '')
    assert.equal(getOutfitComposerBackPath(url.searchParams.get('from')), fromPath)
  }
})

test('미지정·상대 경로·외부 주소는 코디북으로 돌아간다', () => {
  const invalidPaths = [
    null,
    '',
    'lookbook',
    '../closet',
    'https://external.example/closet',
    'http://external.example/plan',
    '//external.example/closet',
    'javascript:history.back()',
    '/\\external.example/closet',
    '/\t/external.example/plan',
  ]

  for (const fromPath of invalidPaths) {
    assert.equal(
      getOutfitComposerBackPath(fromPath),
      '/lookbook',
      `돌아갈 경로: ${JSON.stringify(fromPath)}`,
    )
  }
})

test('아이템 하나를 전달받은 화면은 최초 카테고리 단계에서 바로 종료한다', () => {
  const initialItemIds = ['base-outer']
  const state = createState(initialItemIds)

  assert.equal(state.step, 'category')
  assert.equal(shouldExitOutfitComposer(state), true)
})

test('외부 기준 아이템을 제거하면 일반 첫 선택 흐름으로 전환한다', () => {
  let state = createState(['base-outer'])

  state = outfitComposerReducer(state, {
    type: 'REMOVE_ITEM',
    itemId: 'base-outer',
  })
  assert.equal(state.step, 'start')
  assert.deepEqual(state.originItemIds, [])
  assert.equal(shouldExitOutfitComposer(state), true)

  state = outfitComposerReducer(state, {
    type: 'ADD_ITEM',
    layer: { wardrobeItemId: 'fresh-top', order: 0 },
  })
  assert.equal(state.step, 'category')
  assert.equal(shouldExitOutfitComposer(state), false)

  state = outfitComposerReducer(state, { type: 'GO_BACK' })
  assert.equal(state.step, 'start')
  assert.deepEqual(state.layers, [])
  assert.equal(shouldExitOutfitComposer(state), true)
})

test('기준 아이템만 제거해도 남은 조합은 유지하고 외부 복귀 기준을 해제한다', () => {
  let state = createState(['base-outer'])
  state = outfitComposerReducer(state, {
    type: 'ADD_ITEM',
    layer: { wardrobeItemId: 'added-bottom', order: 1 },
  })

  state = outfitComposerReducer(state, {
    type: 'REMOVE_ITEM',
    itemId: 'base-outer',
  })
  assert.deepEqual(state.layers.map((layer) => layer.wardrobeItemId), [
    'added-bottom',
  ])
  assert.deepEqual(state.originItemIds, [])
  assert.equal(shouldExitOutfitComposer(state), false)

  state = outfitComposerReducer(state, { type: 'GO_BACK' })
  assert.equal(state.step, 'start')
})

test('추가한 아이템만 제거하면 외부 기준 아이템의 복귀 경계를 유지한다', () => {
  let state = createState(['base-outer'])
  state = outfitComposerReducer(state, {
    type: 'ADD_ITEM',
    layer: { wardrobeItemId: 'added-bottom', order: 1 },
  })

  state = outfitComposerReducer(state, {
    type: 'REMOVE_ITEM',
    itemId: 'added-bottom',
  })
  assert.deepEqual(state.originItemIds, ['base-outer'])
  assert.equal(shouldExitOutfitComposer(state), true)
})

test('전달받은 아이템 뒤에 추가한 옷만 역순으로 되돌린 뒤 원래 화면으로 종료한다', () => {
  const initialItemIds = ['base-outer']
  let state = createState(initialItemIds)
  state = outfitComposerReducer(state, {
    type: 'ADD_ITEM',
    layer: { wardrobeItemId: 'added-top', order: 1 },
  })
  state = outfitComposerReducer(state, {
    type: 'ADD_ITEM',
    layer: { wardrobeItemId: 'added-bottom', order: 2 },
  })

  assert.equal(shouldExitOutfitComposer(state), false)
  state = outfitComposerReducer(state, { type: 'GO_BACK' })
  assert.deepEqual(state.layers.map((layer) => layer.wardrobeItemId), [
    'base-outer',
    'added-top',
  ])
  assert.equal(shouldExitOutfitComposer(state), false)

  state = outfitComposerReducer(state, { type: 'GO_BACK' })
  assert.deepEqual(state.layers.map((layer) => layer.wardrobeItemId), initialItemIds)
  assert.equal(state.step, 'category')
  assert.equal(shouldExitOutfitComposer(state), true)
})

test('전달받은 두 옷 중 하나를 교체해 개수가 같아져도 새 옷부터 되돌린다', () => {
  const initialItemIds = ['seed-a', 'seed-b']
  let state = createState(initialItemIds)
  assert.equal(shouldExitOutfitComposer(state), true)

  state = outfitComposerReducer(state, { type: 'REMOVE_ITEM', itemId: 'seed-b' })
  state = outfitComposerReducer(state, {
    type: 'ADD_ITEM',
    layer: { wardrobeItemId: 'new-c', order: 1 },
  })

  assert.equal(state.layers.length, initialItemIds.length)
  assert.equal(shouldExitOutfitComposer(state), false)
  state = outfitComposerReducer(state, { type: 'GO_BACK' })
  assert.deepEqual(state.layers.map((layer) => layer.wardrobeItemId), ['seed-a'])
  assert.equal(state.step, 'category')
  assert.equal(shouldExitOutfitComposer(state), false)
  state = outfitComposerReducer(state, { type: 'GO_BACK' })
  assert.equal(state.step, 'start')
  assert.deepEqual(state.layers, [])
  assert.equal(shouldExitOutfitComposer(state), true)
})

test('아이템 목록에서 뒤로 가면 전달받은 옷을 유지하고 카테고리로 돌아간다', () => {
  const initialItemIds = ['base-outer']
  let state = outfitComposerReducer(createState(initialItemIds), {
    type: 'SELECT_CATEGORY',
    category: 'top',
  })

  assert.equal(state.step, 'items')
  assert.equal(shouldExitOutfitComposer(state), false)
  state = outfitComposerReducer(state, { type: 'GO_BACK' })
  assert.equal(state.step, 'category')
  assert.deepEqual(state.layers.map((layer) => layer.wardrobeItemId), initialItemIds)
  assert.equal(shouldExitOutfitComposer(state), true)
})

test('카테고리에서 연 저장 화면은 종료하지 않고 저장 화면만 닫는다', () => {
  const initialItemIds = ['base-outer']
  let state = outfitComposerReducer(createState(initialItemIds), { type: 'OPEN_SAVE' })

  assert.equal(state.step, 'save')
  assert.equal(shouldExitOutfitComposer(state), false)
  state = outfitComposerReducer(state, { type: 'GO_BACK' })
  assert.equal(state.step, 'category')
  assert.deepEqual(state.layers.map((layer) => layer.wardrobeItemId), initialItemIds)
  assert.equal(shouldExitOutfitComposer(state), true)
})

test('아이템 목록에서 연 저장 화면은 목록을 거쳐 돌아간다', () => {
  const initialItemIds = ['base-outer']
  let state = outfitComposerReducer(createState(initialItemIds), {
    type: 'SELECT_CATEGORY',
    category: 'bottom',
  })
  state = outfitComposerReducer(state, { type: 'OPEN_SAVE' })

  assert.equal(shouldExitOutfitComposer(state), false)
  state = outfitComposerReducer(state, { type: 'GO_BACK' })
  assert.equal(state.step, 'items')
  assert.equal(shouldExitOutfitComposer(state), false)
  state = outfitComposerReducer(state, { type: 'GO_BACK' })
  assert.equal(state.step, 'category')
  assert.equal(shouldExitOutfitComposer(state), true)
})

test('미리보기가 열려 있으면 종료 가능한 단계에서도 미리보기만 먼저 닫는다', () => {
  for (const initialItemIds of [[], ['base-outer']]) {
    const initialState = createState(initialItemIds)
    let state = outfitComposerReducer(initialState, { type: 'OPEN_PREVIEW' })

    assert.equal(shouldExitOutfitComposer(state), false)
    state = outfitComposerReducer(state, { type: 'GO_BACK' })
    assert.equal(state.preview.isOpen, false)
    assert.equal(state.step, initialState.step)
    assert.deepEqual(state.layers, initialState.layers)
    assert.equal(shouldExitOutfitComposer(state), true)
  }
})

test('같은 코디에서 닫은 AI 미리보기는 생성 결과를 유지한 채 다시 연다', () => {
  let state = createState(['base-outer', 'base-bottom'])
  state = outfitComposerReducer(state, { type: 'OPEN_PREVIEW' })
  state = outfitComposerReducer(state, {
    type: 'PREVIEW_SUCCESS',
    imageUrl: 'data:image/jpeg;base64,preview',
    imageBase64: 'preview',
    mimeType: 'image/jpeg',
    model: 'test-model',
  })
  state = outfitComposerReducer(state, { type: 'CLOSE_PREVIEW' })

  assert.equal(state.preview.isOpen, false)
  assert.equal(state.preview.status, 'success')
  assert.equal(state.preview.imageUrl, 'data:image/jpeg;base64,preview')

  state = outfitComposerReducer(state, { type: 'REOPEN_PREVIEW' })

  assert.equal(state.preview.isOpen, true)
  assert.equal(state.preview.status, 'success')
  assert.equal(state.preview.imageBase64, 'preview')
})

test('전달받은 코디를 초기화한 뒤 새 옷에서 뒤로 가면 첫 단계로 돌아간다', () => {
  const initialItemIds = ['base-outer', 'base-bottom']
  let state = outfitComposerReducer(createState(initialItemIds), { type: 'RESET' })
  assert.equal(state.step, 'start')

  state = outfitComposerReducer(state, {
    type: 'SELECT_CATEGORY',
    category: 'top',
  })
  state = outfitComposerReducer(state, {
    type: 'ADD_ITEM',
    layer: { wardrobeItemId: 'fresh-top', order: 0 },
  })

  assert.equal(state.step, 'category')
  assert.deepEqual(state.layers.map((layer) => layer.wardrobeItemId), ['fresh-top'])
  assert.equal(shouldExitOutfitComposer(state), false)

  state = outfitComposerReducer(state, { type: 'GO_BACK' })
  assert.equal(state.step, 'start')
  assert.deepEqual(state.layers, [])
  assert.equal(shouldExitOutfitComposer(state), true)
})

test('빈 코디 만들기는 처음 단계로 시작하고 첫 선택을 되돌린 후에 종료한다', () => {
  const url = new URL(createOutfitComposerPath([], '/lookbook'), 'https://closet.test')
  const initialItemIds = (url.searchParams.get('items') ?? '').split(',').filter(Boolean)
  let state = createState(initialItemIds)

  assert.equal(state.step, 'start')
  assert.equal(shouldExitOutfitComposer(state), true)
  assert.equal(getOutfitComposerBackPath(url.searchParams.get('from')), '/lookbook')

  state = outfitComposerReducer(state, {
    type: 'SELECT_CATEGORY',
    category: 'top',
  })
  assert.equal(shouldExitOutfitComposer(state), false)
  state = outfitComposerReducer(state, {
    type: 'ADD_ITEM',
    layer: { wardrobeItemId: 'first-top', order: 0 },
  })
  assert.equal(state.step, 'category')
  assert.equal(shouldExitOutfitComposer(state), false)

  state = outfitComposerReducer(state, { type: 'GO_BACK' })
  assert.equal(state.step, 'start')
  assert.deepEqual(state.layers, [])
  assert.equal(shouldExitOutfitComposer(state), true)
})
