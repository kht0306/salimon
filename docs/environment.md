# 환경 변수

Supabase 로그인과 선택 사항인 Gemini 영수증 인식을 설정하려면
`apps/web/.env.local`에 아래 값을 추가한다.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
GEMINI_API_KEY=
GEMINI_RECEIPT_MODEL=gemini-3.1-flash-lite
GEMINI_RECEIPT_FALLBACK_MODEL=gemini-3.5-flash-lite
GEMINI_DATA_TIER=free
```

`GEMINI_API_KEY`는 서버 전용이며 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.
기본 모델의 모델별 일일 한도가 소진되면
`GEMINI_RECEIPT_FALLBACK_MODEL`을 한 번 호출한다. 두 모델이 같거나 대체 모델이
비어 있으면 대체 호출을 하지 않는다.
`GEMINI_DATA_TIER=free`에서는 Google 무료 서비스 데이터 사용 안내에 대한
사용자 동의를 요구한다. 운영 환경에서는 민감한 영수증 보호를 위해 결제 계정에
연결된 유료 Gemini API 키와 `GEMINI_DATA_TIER=paid` 사용을 권장한다.

## 모바일 앱

모바일 Supabase 연결에 사용할 변수 이름은 `apps/mobile/.env.local`에 둔다.
2회차부터 모바일 클라이언트가 아래 값을 읽는다. 실제 로그인과 세션 복원은
3회차에서 연결한다.

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

`EXPO_PUBLIC_*` 값은 앱 번들에 포함될 수 있으므로 서버 비밀 키를 넣지 않는다.
실제 값은 출력하거나 Git에 커밋하지 않는다.
