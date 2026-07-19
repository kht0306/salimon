# 환경 변수

Supabase 로그인과 선택 사항인 Gemini 영수증 인식을 설정하려면
`apps/web/.env.local`에 아래 값을 추가한다.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
GEMINI_API_KEY=
GEMINI_RECEIPT_MODEL=gemini-3.1-flash-lite
GEMINI_DATA_TIER=free
```

`GEMINI_API_KEY`는 서버 전용이며 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.
`GEMINI_DATA_TIER=free`에서는 Google 무료 서비스 데이터 사용 안내에 대한
사용자 동의를 요구한다. 운영 환경에서는 민감한 영수증 보호를 위해 결제 계정에
연결된 유료 Gemini API 키와 `GEMINI_DATA_TIER=paid` 사용을 권장한다.
