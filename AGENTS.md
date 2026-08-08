# Agent Directives & Rules

## 1. Deployment Policy (배포 정책)
- 사용자가 **"배포"** 또는 **"배포해줘"**, **"배포 진행"** 등의 명시적인 요청을 한 경우에만 **GitHub 저장소(`https://github.com/yourjp/mart2.git`)에 최신 소스 코드를 스테이징(`git add .`), 커밋(`git commit`), 푸시(`git push -u origin main`)하는 과정**을 수행한다.
- 일반적인 코드 수정이나 기능 추가 요청 시에는 로컬 파일 수정 및 검증만 완료하고, **사용자가 "배포"하라고 명령할 때만** Git 커밋 후 GitHub `main` 브랜치로 푸시해야 한다.

## 2. Version & Modified Date Policy (버전 및 수정 날짜 표시 규칙)
- 코드를 수정하거나 기능을 업데이트할 때마다 `vX.X.X (YY-MM-DD)` 형식(예: `v1.3.117 (26-08-08)`)으로 버전을 변경한다.
- 변경된 버전과 수정 날짜 정보는 전광판 우측 상단(`#app-version-badge`), `public/app.js`(`APP_VERSION`), `package.json`에 반드시 함께 반영하여 표시해야 한다.

## 3. Change History Policy (변경 이력 관리 규칙)
- 코드를 수정하거나 신규 기능을 추가/업데이트할 때마다 `history.md` 파일에 해당 버전과 변경 내역(신규 기능, 정밀 알고리즘 개선, UI/UX 변경 등)을 누적하여 체계적으로 기록해야 한다.
- 개발 명세나 운영 기준이 바뀌면 `dev.md`에도 같은 변경 이력과 현재 기준을 반영한다.
- 사용자에게 보여지는 기능 설명, 버튼명, 업로드/다운로드 방식, 저장소 기준이 바뀌면 `README.md` 등 관련 Markdown 문서도 함께 갱신한다.
