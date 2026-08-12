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

## 인증 환경 설정

`apps/mobile/.env.example`을 기준으로 로컬 환경변수를 설정한다. 실제 값은 Git에
커밋하지 않는다. Supabase Auth의 허용 리디렉션 URL에는 다음 앱 딥링크를 추가해야
한다.

```text
salimon://auth/callback
```

SecureStore와 WebBrowser 네이티브 모듈이 추가되었으므로 2회차 Development APK를
재사용하지 않고 새 개발 빌드를 설치해야 한다.

## 현재 구현 범위 (5회차)

- Expo Router와 Development Client 기반 앱 셸
- Emotion Native와 공용 모바일 UI 토큰
- `@salimon/types`, `@salimon/domain`, `@salimon/ui-tokens`,
  `@salimon/api-client` 연결
- Android API 29 최소 지원, API 36 대상 빌드 설정
- 웹·모바일 Supabase 환경변수 및 클라이언트 경계 분리
- 선택 월 거래와 해당 거래의 분할 내역만 불러오는 모바일 데이터 로더
- 카카오 OAuth와 `salimon://auth/callback` 딥링크 처리
- Android 암호화 저장소 기반 Supabase 세션 복원
- 앱 활성 상태에 따른 토큰 자동 갱신과 로그아웃 시 메모리 데이터 정리
- 프로필 확인, 최초 개인 가계부 생성, 필수 약관 동의 흐름
- 홈·설정 하단 탭과 인증·동의 라우팅 가드
- 기본 가계부 우선 전환과 선택 월 이동
- 확정 거래 기준 수입·지출·저축 합계와 예산 사용 현황
- 날짜별 거래 수·금액 요약과 선택 날짜 거래 목록
- 새로고침, 빈 데이터, 네트워크 오류와 마지막 조회 폴백
- 앱 실행 중 사용자·월별 최대 6개, 5분 유효 조회 캐시
- 월 거래 전체를 날짜별로 가상화해 표시하는 거래 탭
- 최근 기간·유형·상태·카테고리·거래자·키워드 조합 필터
- 필터 결과 기준 수입·지출·저축 합계
- 거래자·등록자·결제수단·태그·상태·분할 내역을 포함한 거래 상세
- 고정·할부·분할 거래의 조회 전용 안내
- 제외 거래, 삭제된 결제수단, 보관 카테고리 표시

조회 캐시는 일반 가계부 데이터를 기기 저장소에 남기지 않도록 메모리에서만
유지하며 로그아웃 시 즉시 삭제한다. 일반 거래 등록·수정·삭제는 6회차, Kotlin
알림 수신 모듈은 8회차 범위다.
