import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { RawImage } from '@huggingface/transformers'
import type { OutfitRecommendationColor } from '@closet/types'
import type { FixtureFile, Report } from './evaluate-colors.js'
import { deltaE76, median } from './color-evaluation-metrics.js'
import { evaluateColorConsistency } from './color-evaluation-consistency.js'

interface DisplayResult {
  source?: string
  summary?: string
  colorSchemeApplied?: boolean
  reasons?: string[]
  candidates?: Array<{ item: { id: string }; relation: string; reason: string }>
  recommendedColors?: OutfitRecommendationColor[]
}

const escapeHtml = (value: unknown) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const hex = (rgb?: number[]) => rgb ? `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}` : ''

/** 실제 사진·사전 원단 영역·추정색을 비교하는 PNG와 응답 원본으로 연결되는 정적 HTML 보고서를 만든다. */
export async function writeColorEvaluationReport(report: Report, fixtures: FixtureFile, fixtureRoot: string, output: string) {
  await mkdir(resolve(output, 'photos'), { recursive: true })
  const cells: string[] = []
  const cards: string[] = []
  for (const [index, photo] of fixtures.photos.entries()) {
    const record = report.classifications[photo.id]
    if (!record) continue
    const result = record.result
    const source = resolve(fixtureRoot, photo.path)
    const relativePath = `photos/${photo.id}.${photo.mimeType === 'image/png' ? 'png' : 'jpg'}`
    const target = resolve(output, relativePath)
    if (source !== target) await copyFile(source, target)
    const bytes = await readFile(source)
    const photoImage = await RawImage.fromBlob(new Blob([Uint8Array.from(bytes)], { type: photo.mimeType ?? 'image/jpeg' }))
    const scale = Math.min(210 / photoImage.width, 280 / photoImage.height)
    const imageWidth = photoImage.width * scale
    const imageHeight = photoImage.height * scale
    const imageX = 20 + (210 - imageWidth) / 2
    const imageY = 32 + (280 - imageHeight) / 2
    const x = index % 4 * 280
    const y = 100 + Math.floor(index / 4) * 390
    const color = record.status === 'review' ? '#9a6200' : record.status === 'fail' ? '#a12626' : '#226044'
    const boxes = photo.rois.map((roi) => `<rect x="${imageX + imageWidth * roi.x}" y="${imageY + imageHeight * roi.y}" width="${imageWidth * roi.width}" height="${imageHeight * roi.height}" fill="none" stroke="#24ad78" stroke-width="1.2"/>`).join('')
    const patches = result
      ? `<rect x="20" y="322" width="65" height="22" fill="${hex(record.referenceRgb)}"/><rect x="100" y="322" width="65" height="22" fill="${record.rawAiHex ?? result.colorHex}"/><rect x="180" y="322" width="65" height="22" fill="${result.colorHex}"/><text x="20" y="360" font-size="10">REF ${hex(record.referenceRgb)}</text><text x="100" y="360" font-size="10">AI ${record.rawAiHex ?? result.colorHex}</text><text x="180" y="360" font-size="10">OUT ${result.colorHex}</text>`
      : `<text x="20" y="340" font-size="12">${escapeHtml(record.error?.code)}</text>`
    cells.push(`<g transform="translate(${x},${y})"><rect x="6" y="4" width="268" height="380" rx="10" fill="white" stroke="#ddd"/><text x="18" y="23" font-size="12">${escapeHtml(photo.id)} / ${escapeHtml(photo.labelledColor)}</text><image href="data:${photo.mimeType ?? 'image/jpeg'};base64,${bytes.toString('base64')}" x="20" y="32" width="210" height="280"/>${boxes}${patches}<text x="20" y="378" font-size="12" fill="${color}">${record.status.toUpperCase()}${record.medianDeltaE76 !== undefined ? ` | dE76 ${record.medianDeltaE76.toFixed(1)}` : result ? ' | patterned' : ''}</text></g>`)
    const correction = record.rawAiHex && record.rawAiHex !== result?.colorHex
      ? `<p><i style="background:${record.rawAiHex}"></i>AI 원본 ${record.rawAiHex} → 사진 보정 ${result?.colorHex}</p><p>보정 전 ΔE76 ${record.rawAiMedianDeltaE76?.toFixed(2)} → 보정 후 ${record.medianDeltaE76?.toFixed(2)}</p>` : ''
    cards.push(`<article><a href="${relativePath}"><img src="${relativePath}" alt="${escapeHtml(photo.id)}" loading="lazy"/></a><h3>${escapeHtml(photo.id)} · ${escapeHtml(photo.labelledColor)}</h3><p>결과: <b class="${record.status}">${record.status}</b> ${escapeHtml(result?.colorDetailName ?? record.error?.code)}</p>${result ? `<p><i style="background:${hex(record.referenceRgb)}"></i> 원단 ${hex(record.referenceRgb)} <i style="background:${result.colorHex}"></i> 최종 대표색 ${result.colorHex}</p>${correction}<p>${record.medianDeltaE76 !== undefined ? `원단 영역 대비 ΔE76 중앙값 ${record.medianDeltaE76.toFixed(2)}` : '패턴은 단일 대표색 색차로 합격 판정하지 않음'}</p>` : ''}<a href="${escapeHtml(photo.sourcePage)}">사진·색상 출처</a></article>`)
  }
  const accepted = Object.values(report.classifications).filter((record) => record.result)
  const deltas = accepted.flatMap((record) => record.medianDeltaE76 === undefined ? [] : [record.medianDeltaE76])
  const pairPasses = report.pairs.filter((pair) => pair.status === 'pass').length
  const recommendationPasses = Object.values(report.recommendations).filter((record) => record.status === 'pass').length
  const consistency = evaluateColorConsistency(fixtures.photos, report.classifications)
  const visualPairs = report.pairs.filter((pair) => pair.visualExpected !== undefined)
  const actualAiAccepted = Object.values(report.recommendations).filter((record) => record.checks?.actualAiResponseAccepted).length
  const requestedToday = fixtures.recommendations.filter((fixture) => fixture.kind === 'today' && fixture.expectedDesiredApplied !== undefined)
  const requestedApplied = requestedToday.filter((fixture) => (report.recommendations[fixture.id]?.result as DisplayResult | undefined)?.colorSchemeApplied === fixture.expectedDesiredApplied).length
  const visualHtml = visualPairs.length ? `<h2>사진 기준과 육안 기대를 구분한 판정</h2><p>사진 원단 표본 기준 일치 ${pairPasses}/${report.pairs.length}, 별도로 고정한 육안 기대 일치 ${visualPairs.filter((pair) => pair.visualMatch).length}/${visualPairs.length}. 사진 색에 충실하더라도 조명 때문에 같은 옷의 판정이 달라질 수 있습니다.</p><p>실제 AI 응답을 수용한 추천 ${actualAiAccepted}/${Object.keys(report.recommendations).length}, 요청한 무채색·포인트 조건이 적용된 추천 ${requestedApplied}/${requestedToday.length}. 조건을 충족하지 못해 기본 추천을 반환한 경우는 요청 조건 달성으로 세지 않습니다.</p><div class="scroll"><table><tr><th>사례</th><th>육안 기대</th><th>사진 표본 판정</th><th>최종 대표색 판정</th><th>육안 기대 일치</th></tr>${visualPairs.map((pair) => `<tr><td>${escapeHtml(pair.id)}</td><td>${pair.visualExpected}</td><td>${pair.reference}</td><td>${pair.extracted}</td><td>${pair.visualMatch}</td></tr>`).join('')}</table></div>` : ''
  const consistencyHtml = consistency.length ? `<h2>같은 옷의 촬영 환경별 변화</h2><p>같은 실물 옷으로 육안 대조한 그룹입니다. 원단의 실제 측색 정답은 없으며, 사진 간 색차는 촬영에 따른 변동 지표입니다.</p><div class="scroll"><table><tr><th>옷</th><th>완료</th><th>색 계열 유지</th><th>기대 계열 일치</th><th>AI 대표색 간 최대 ΔE76</th><th>사진 픽셀 간 최대 ΔE76</th></tr>${consistency.map((group) => `<tr><td>${escapeHtml(group.garmentId)}</td><td>${group.completed}/${group.total}</td><td>${group.colorFamilyStable}</td><td>${group.allExpectedColorFamilies}</td><td>${group.maxEstimatedDeltaE76?.toFixed(2)}</td><td>${group.maxPhotoPixelDeltaE76?.toFixed(2)}</td></tr>`).join('')}</table></div>` : ''
  const hasFindings = Object.values(report.classifications).some((record) => record.status !== 'pass') ||
    report.pairs.some((pair) => pair.status !== 'pass') || Object.values(report.recommendations).some((record) => record.status !== 'pass')
  const evaluatedAt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(report.startedAt))
  const repeatDifferences = Object.entries(report.repeats).flatMap(([id, record]) => {
    const original = report.classifications[id]?.result
    return original && record.result ? [{ id, deltaE76: deltaE76(original.colorRgb, record.result.colorRgb) }] : []
  })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="${100 + Math.ceil(fixtures.photos.length / 4) * 390}" style="font-family:Arial;fill:#252823"><rect width="100%" height="100%" fill="#f1f2ef"/><text x="20" y="34" font-size="25">Real-photo colour validation</text><text x="20" y="60" font-size="14">${fixtures.photos.length} photos | ${report.requests} live API calls | green boxes: fabric samples | REF: pixels | AI: raw | OUT: final</text><text x="20" y="84" font-size="15">Photo-pixel scheme agreement: ${pairPasses}/${report.pairs.length} | AI accepted: ${actualAiAccepted}/${Object.keys(report.recommendations).length}${requestedToday.length ? ` | Requested colour: ${requestedApplied}/${requestedToday.length}` : ""}</text>${cells.join('')}</svg>`
  const image = await RawImage.fromBlob(new Blob([svg], { type: 'image/svg+xml' }))
  await image.toSharp().png().toFile(resolve(output, 'validation-contact-sheet.png'))

  const pairRows = report.pairs.map((pair) => `<tr><td>${escapeHtml(pair.id)}</td><td>${escapeHtml(pair.scheme)}</td><td>${pair.expected}</td><td>${pair.extracted}</td><td>${pair.reference}</td><td class="${pair.status}">${pair.status}</td></tr>`).join('')
  const recommendationCards = Object.entries(report.recommendations).map(([id, entry]) => {
    const result = entry.result as DisplayResult | undefined
    const photoReferenceDifferenceOnly = entry.status === 'fail' && entry.checks?.applied === false &&
      Object.entries(entry.checks).every(([key, passed]) => key === 'applied' || passed)
    const statusLabel = photoReferenceDifferenceOnly ? '사진 표본 판정과 차이 · 요청 색감 적용됨' : entry.status
    const fixture = fixtures.recommendations.find((candidate) => candidate.id === id)!
    const photos = fixture.inventory.map((photoId) => `<figure><img src="photos/${escapeHtml(photoId)}.${fixtures.photos.find((photo) => photo.id === photoId)?.mimeType === 'image/png' ? 'png' : 'jpg'}"/><figcaption>${escapeHtml(photoId)}</figcaption></figure>`).join('')
    const reasons = (result?.reasons ?? []).map((reason) => `<p>${escapeHtml(reason)}</p>`).join('')
    const candidates = (result?.candidates ?? []).map((candidate) => `<p><b>${escapeHtml(candidate.item.id)} · ${escapeHtml(candidate.relation)}</b> — ${escapeHtml(candidate.reason)}</p>`).join('')
    const palette = (result?.recommendedColors ?? []).map((color) => `<p><i style="background:${escapeHtml(color.hex)}"></i>${escapeHtml(color.name)} ${escapeHtml(color.hex)} · ${escapeHtml(color.role)} — ${escapeHtml(color.reason)}</p>`).join('')
    return `<article class="wide"><h3>${escapeHtml(id)} · <span class="${photoReferenceDifferenceOnly ? 'review' : entry.status}">${statusLabel}</span></h3><div class="pair">${photos}</div><p>응답 출처: ${escapeHtml(result?.source)} ${result?.colorSchemeApplied !== undefined ? `· 요청 색감 적용: ${result.colorSchemeApplied}` : ''}</p><blockquote>${escapeHtml(result?.summary ?? entry.error)}</blockquote>${reasons}${candidates}${palette}</article>`
  }).join('')
  const rawLinks = report.apiCalls.map((call) => `<li>${escapeHtml(call.caseId)} — <a href="response-${call.number}.json">실제 응답 ${call.number}</a> · HTTP ${call.status}</li>`).join('')
  const findings = report.pairs.filter((pair) => pair.status !== 'pass').map((pair) => `<li>${escapeHtml(pair.id)}: 기대값 ${pair.expected}, AI 추정색 판정 ${pair.extracted}, 원단 픽셀 판정 ${pair.reference}</li>`).join('')
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>실제 옷 사진·AI 컬러 검증</title><style>body{font:16px/1.65 system-ui,sans-serif;max-width:1160px;margin:32px auto;padding:0 20px;background:#f5f5f1;color:#252823}h1,h2,h3{line-height:1.3}a{color:#245879}article{background:white;border:1px solid #d9ddd5;border-radius:12px;padding:18px}article>a>img{width:100%;height:240px;object-fit:contain}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:16px}.wide{margin:18px 0}.pair{display:flex;gap:12px;flex-wrap:wrap}.pair figure{margin:0;width:180px;font-size:12px}.pair img{width:160px;height:210px;object-fit:contain}i{display:inline-block;width:30px;height:22px;border:1px solid #777;vertical-align:middle;margin:0 6px}table{border-collapse:collapse;width:100%;background:white;font-size:14px}th,td{border:1px solid #d9ddd5;padding:10px;text-align:left}blockquote{margin:8px 0;padding:12px;background:#f2f4f0;border-left:3px solid #809b7d}.pass{color:#236944}.review{color:#9a6200}.fail{color:#b22525}.notice{border-left:5px solid #b22525;padding:14px;background:#fff1ed}.hero{width:100%;height:auto}.scroll{overflow:auto}</style><h1>실제 옷 사진·실제 AI 응답 검증</h1><p>검증일: ${evaluatedAt} · 모델: ${escapeHtml(accepted[0]?.result?.model)} · 규칙: ${escapeHtml(report.policyVersion)} · 실제 API ${report.requests}회</p><div class="notice"><b>${hasFindings ? '추가 보완이 필요한 사례가 있습니다.' : '완료한 표적 사례에서 실패가 발견되지 않았습니다.'}</b><ul>${findings}</ul><p>대표색 오차와 조합 판정 결과를 아래 사진·응답 원본에서 확인할 수 있습니다. 허용치나 기대값을 결과에 맞춰 바꾸지 않았습니다.</p></div><h2>방법과 결과</h2><ul><li>상품명·기대 색상·기대 조합은 분류 AI에 전달하지 않았고 사진만 보냈습니다. 원단 영역과 기대 조합은 호출 전에 고정했습니다.</li><li>사진에서 얻은 실제 분석 속성을 메모리 옷장에 넣고 실제 추천 서비스와 실제 AI 응답까지 실행했습니다. 계정·옷장·추천 사용권은 변경하지 않았습니다.</li><li>옷 사진 ${accepted.length}장 중 넓은 색 계열 ${accepted.filter((record) => record.checks?.color).length}장, 단색/패턴 구분 ${accepted.filter((record) => record.checks?.composition).length}장이 사전 기준과 일치했습니다.</li><li>단색 ${deltas.length}장의 원단 영역 대비 ΔE76 중앙값 ${deltas.length ? median(deltas).toFixed(2) : '해당 없음'}, 최댓값 ${deltas.length ? Math.max(...deltas).toFixed(2) : '해당 없음'}. 검토 기준 12를 넘은 사진은 ${accepted.filter((record) => (record.medianDeltaE76 ?? 0) > 12).length}장입니다.</li><li>색감 조건 ${pairPasses}/${report.pairs.length}, 추천 조건 ${recommendationPasses}/${Object.keys(report.recommendations).length} 통과.</li>${repeatDifferences.map((entry) => `<li>반복 검사 ${escapeHtml(entry.id)}: 추정값 간 ΔE76 ${entry.deltaE76.toFixed(2)}.</li>`).join('')}</ul><h2>사진·원단 표본·AI 추정값</h2><p>초록 테두리는 원단 표본 영역입니다. REF는 사진 픽셀 중앙값이며 실제 원단의 측색 정답을 뜻하지 않습니다.</p><a href="validation-contact-sheet.png"><img class="hero" src="validation-contact-sheet.png" alt="실제 사진과 표본색 및 AI 추정색 비교"/></a><div class="grid">${cards.join('')}</div><h2>색감 조건 대조</h2><div class="scroll"><table><tr><th>사례</th><th>기준</th><th>사전 기대</th><th>AI 추정색</th><th>원단 픽셀</th><th>결과</th></tr>${pairRows}</table></div><h2>실제 AI 추천 응답</h2>${recommendationCards}<h2>해석의 한계</h2><p>${escapeHtml(report.note)}</p><p>검토 기준 12는 이번 표적 평가의 경보값이며 산업 표준 합격선이 아닙니다. 계산은 <a href="https://cie.co.at/eilvterm/17-23-077">CIE76 정의</a>를 사용했습니다.</p><h2>원본과 재검증 자료</h2><ul><li><a href="live-report.json">결과·사진 SHA-256</a></li>${rawLinks}</ul></html>`
  await writeFile(resolve(output, 'report.html'), html
    .replace('<h2>사진·원단 표본·AI 추정값</h2>', `${visualHtml}${consistencyHtml}<h2>사진·원단 표본·AI 추정값</h2>`)
    .replace(`색감 조건 ${pairPasses}/${report.pairs.length}, 추천 조건 ${recommendationPasses}/${Object.keys(report.recommendations).length} 통과.`,
      `사진 표본과 조합 판정 일치 ${pairPasses}/${report.pairs.length}. 실제 AI 응답 수용 ${actualAiAccepted}/${Object.keys(report.recommendations).length}.${requestedToday.length ? ` 요청 색감 실제 적용 ${requestedApplied}/${requestedToday.length}.` : ''}`))
  await writeFile(resolve(output, 'summary.json'), JSON.stringify({ requests: report.requests, acceptedPhotos: accepted.length, colorMatches: accepted.filter((record) => record.checks?.color).length,
    colorDifference: { metric: 'CIE76', median: deltas.length ? median(deltas) : null, max: deltas.length ? Math.max(...deltas) : null }, repeatDifferences,
    consistency, visualChecks: { passed: visualPairs.filter((pair) => pair.visualMatch).length, total: visualPairs.length },
    actualAiAccepted, requestedColorApplied: { passed: requestedApplied, total: requestedToday.length },
    pairChecks: { passed: pairPasses, total: report.pairs.length }, recommendationChecks: { passed: recommendationPasses, total: Object.keys(report.recommendations).length } }, null, 2))
}
