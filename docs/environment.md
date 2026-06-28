# 환경 변수

1차 로컬 MVP는 외부 서비스 없이 동작한다.

Supabase와 Kakao 연결 시 `apps/web/.env.local`에 아래 값을 추가한다.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_KAKAO_REST_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

서버 전용 키는 클라이언트에 노출하지 않는다.
