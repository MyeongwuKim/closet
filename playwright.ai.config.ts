import { defineConfig } from '@playwright/test'

// 저장소 대체가 빠지더라도 실제 계정 DB로 연결할 수 없도록 테스트 프로세스의 연결을 막는다.
process.env.DATABASE_URL = 'mongodb://127.0.0.1:1/closet_ai_api_test?directConnection=true&serverSelectionTimeoutMS=100'

/** 요청할 때만 실행하는 실제 AI API 검사. 브라우저·웹 개발 서버·실제 계정 DB를 사용하지 않는다. */
export default defineConfig({
  testDir: './tests/ai-api',
  testMatch: '**/*.api.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  globalTimeout: 15 * 60_000,
  forbidOnly: Boolean(process.env.CI),
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: '.playwright-mcp/ai-api-report' }],
    ['json', { outputFile: '.playwright-mcp/ai-api-results.json' }],
  ],
  outputDir: '.playwright-mcp/ai-api-results',
})
