# Agent Directives & Rules

## 1. Deployment Policy (배포 정책)
- 사용자가 **"배포"** 또는 **"배포해줘"**, **"배포 진행"** 등의 요청을 하는 경우, 이는 **GitHub 저장소(`https://github.com/yourjp/mart.git`)에 최신 소스 코드를 스테이징(`git add .`), 커밋(`git commit`), 푸시(`git push -u origin main`)하는 과정**을 의미한다.
- 배포 명령을 수신하면 모든 작업 내역을 정리하고 즉시 Git 커밋 후 GitHub `main` 브랜치로 푸시를 수행해야 한다.
