# 살림온 가족 알파 APK 비공개 배포 가이드

## 배포 원칙

- Google Play 계정 없이 가족 기기에 APK를 직접 전달한다.
- 권장 전달 방식은 USB 또는 Quick Share이며 공개 다운로드 링크에 올리지 않는다.
- 패키지명은 `com.salimon.app`, 첫 가족 알파는 `0.2.0`·`versionCode 2`다.
- 모든 가족 APK는 하나의 전용 서명 키를 계속 사용한다. 키를 잃으면 기존 앱을
  삭제하지 않고 업데이트할 수 없다.
- APK, 체크섬, 인증서 지문은 공유해도 되지만 키 파일과 비밀번호는 공유하지 않는다.

## 최초 전용 서명 키 준비

이 작업은 프로젝트 소유자가 자신의 Mac 터미널에서 한 번만 수행한다. 키 파일은
저장소 밖에 만들고 암호화된 별도 저장장치에 백업한다.

```bash
mkdir -p "$HOME/.salimon/signing"
keytool -genkeypair -v \
  -keystore "$HOME/.salimon/signing/salimon-family.jks" \
  -alias salimon-family \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000
```

`keytool`이 요청하는 비밀번호는 채팅, GitHub, 이슈, 빌드 로그에 입력하지 않는다.
키 파일과 비밀번호를 각각 별도의 안전한 위치에 백업한다.

## 로컬 Gradle 서명 설정

`~/.gradle/gradle.properties`에 아래 네 이름을 로컬로 추가한다. `<...>` 부분은
본인 값으로 바꾸되 저장소 파일에는 작성하지 않는다.

```properties
SALIMON_RELEASE_STORE_FILE=/Users/<mac-user>/.salimon/signing/salimon-family.jks
SALIMON_RELEASE_STORE_PASSWORD=<로컬 키 저장소 비밀번호>
SALIMON_RELEASE_KEY_ALIAS=salimon-family
SALIMON_RELEASE_KEY_PASSWORD=<로컬 키 비밀번호>
```

설정 파일은 본인 계정만 읽을 수 있게 제한한다.

```bash
chmod 600 "$HOME/.gradle/gradle.properties"
```

빌드는 같은 이름의 환경변수도 지원한다. 환경변수를 사용할 때도 값을 명령 인자,
채팅 또는 CI 로그에 남기지 않는다.

## APK 생성과 검증

프로젝트 루트에서 실행한다.

```bash
pnpm build:mobile:family-alpha
```

빌드 스크립트는 다음을 자동 수행한다.

1. Expo Android 프로젝트 생성 및 `app.json` 버전 반영
2. 전용 키가 없으면 릴리스 빌드 중단
3. 프로덕션 JavaScript를 포함한 릴리스 APK 생성
4. `apksigner`로 서명 유효성 검사
5. Android Debug 인증서 사용 차단
6. `dist/mobile/salimon-<version>-<versionCode>.apk` 생성
7. 같은 이름의 `.sha256` 체크섬 생성

APK를 전달하기 전에 체크섬을 확인한다.

```bash
cd dist/mobile
shasum -a 256 -c salimon-0.2.0-2.sha256
```

## 개발 서명 앱에서 최초 전환

현재 S25 Ultra에 설치된 11회차 APK는 개발용 서명을 사용한다. Android는 패키지명이
같아도 서명이 다르면 덮어쓰기를 거부하므로, 첫 가족 알파 설치 때만 기존 앱을
제거해야 한다.

1. 미처리 알림 후보나 등록 대기가 없는지 확인한다.
2. 서버에 저장할 거래는 모두 등록한다. 서버 가계부 데이터는 앱 제거로 삭제되지
   않는다.
3. 기존 살림온 앱을 제거한다. 로컬 로그인 세션과 미처리 후보는 삭제된다.
4. 가족 알파 APK를 설치하고 카카오 로그인을 다시 진행한다.
5. 사용할 경우 개인정보 안내를 다시 확인하고 알림 접근을 허용한다.

전용 서명 APK로 전환한 뒤에는 앱을 제거하지 않고 업데이트한다.

```bash
adb install -r dist/mobile/salimon-0.2.0-2.apk
```

## 가족 기기 설치

1. APK와 `.sha256` 파일을 USB 또는 Quick Share로 전달한다.
2. 파일 앱에서 APK를 선택한다.
3. Android가 요청하면 해당 파일 앱의 `출처를 알 수 없는 앱 설치`를 이번 설치에만
   허용한다.
4. Google Play 프로텍트 경고가 표시되면 앱 이름과 전달받은 파일명을 다시 확인한
   뒤 설치한다.
5. 설치가 끝나면 출처 허용을 다시 끈다.
6. 살림온을 열어 버전, 로그인, 가계부, 주요 탭을 확인한다.

## 업데이트 규칙

- `versionCode`는 배포할 때마다 반드시 증가시킨다.
- `versionName`은 가족이 확인할 수 있는 표시 버전이다.
- 패키지명과 전용 서명 키는 변경하지 않는다.
- 업데이트 전후 로그인 세션, 알림 후보, 선택 가계부가 정책대로 유지되는지 S25에서
  먼저 검증한다.
- S24는 최종 APK 설치·업데이트·로그인·5개 탭 스모크 테스트만 수행한다.
- Fold5는 전체 기능 완료 후 접기·펼치기와 상태 유지를 포함해 검증한다.

## 문제 제보

다음 정보만 기록한다.

- 앱 표시 버전과 `versionCode`
- 기기 모델·Android·One UI 버전
- 발생 시각과 재현 순서
- 기대 결과와 실제 결과
- 민감정보를 가린 화면

카드 알림 원문, 카드번호, 인증 토큰, 전체 거래 내역, 서명 키와 비밀번호는 제보에
포함하지 않는다.
