# Salimon Android 앱

Expo Development Build 기반 React Native 앱이다. Android 패키지명은
`com.salimon.app`이며 Android 10(API 29) 이상을 지원한다.

## 로컬 실행

루트에서 의존성을 설치한 뒤 개발 서버를 실행한다.

```bash
pnpm install
pnpm dev:mobile
```

Android 개발 빌드는 Android SDK와 연결된 기기가 필요하다.

```bash
pnpm android:mobile
```

Expo의 Continuous Native Generation을 사용하므로 생성된 `android` 디렉터리는
Git에 커밋하지 않는다. 네이티브 설정이 바뀌면 다음 명령으로 다시 생성한다.

```bash
pnpm prebuild:mobile --clean
```

## 1회차 범위

- Expo Router와 Development Client 기반 앱 셸
- Emotion Native와 공용 모바일 UI 토큰
- `@salimon/types`, `@salimon/domain`, `@salimon/ui-tokens` 연결
- Android API 29 최소 지원, API 36 대상 빌드 설정

Kotlin 알림 수신 모듈, 카카오 로그인, Supabase 모바일 연결은 후속 회차에서
구현한다.
