# 리그 오브 레전드 내전 관리 Discord Bot

리그 오브 레전드 클랜 내전(인하우스)을 관리하는 Discord Bot입니다.
`.rofl` 리플레이 파일 자동 등록, 개인 전적 조회, 클랜 통계 등 다양한 기능을 제공합니다.

---

## 기술 스택

- **Runtime**: Node.js
- **Framework**: discord.js ^14.18.0
- **Libraries**: dotenv, node-cron, csv-writer
- **Backend**: 외부 REST API 연동 (`BASE_URL` 환경변수로 설정)

---

## 프로젝트 구조

```
trcgg_bot/
├── bot.js                        # 진입점 - Discord 클라이언트 초기화 및 로드
├── app/
│   ├── commands/                 # 명령어 정의 레이어 (!prefix 명령어)
│   │   ├── recordCommand.js      # 전적, 결과
│   │   ├── statisticsCommand.js  # 장인, 클랜통계
│   │   ├── manageCommand.js      # 부캐 관리, 탈퇴/복귀, drop, doc
│   │   └── guildCommand.js       # 길드 관리 (관리자 전용)
│   ├── services/                 # 비즈니스 로직 레이어
│   │   ├── recordService.js      # 전적 Embed 생성
│   │   ├── replayService.js      # 리플레이 저장/삭제
│   │   ├── statisticsService.js  # 통계 및 CSV 생성
│   │   ├── managementService.js  # 부캐, 계정 상태 관리
│   │   └── guildService.js       # 길드 목록, 클랜원 관리
│   ├── client/                   # API 호출 레이어
│   │   ├── recordClient.js       # 전적 API (/matches)
│   │   ├── replayClient.js       # 리플레이 API (/replays)
│   │   ├── statisticsClient.js   # 통계 API
│   │   ├── managementClient.js   # 관리 API
│   │   └── guildClient.js        # 길드 API
│   ├── events/                   # Discord 이벤트 핸들러
│   │   ├── ready.js              # 봇 시작 시 스케줄 등록
│   │   ├── onMessage.js          # 메시지 명령어 처리 + .rofl 파일 자동 등록
│   │   └── interactionCreate.js  # 버튼 / 모달 / 셀렉트박스 인터랙션
│   ├── schedule/
│   │   └── schedule.js           # 크론 스케줄 (내전 시작 알림)
│   └── utils/
│       ├── networkUtils.js       # HTTP 클라이언트 (fetch 래퍼)
│       ├── stringUtils.js        # 공통 유틸 (Embed 생성, 닉네임 파싱, 권한 체크 등)
│       ├── responseHandler.js    # 성공/에러/권한없음 응답 처리
│       ├── commandUtilis.js      # 명령어 공통 유틸
│       └── selectBoxUtils.js     # 셀렉트박스 이벤트 처리
```

---

## 명령어 목록

> 모든 명령어는 `!` prefix로 사용합니다.

### 전적 조회

| 명령어 | 설명 |
|--------|------|
| `!전적` | 본인 전적 조회 (Discord 별명 자동 인식) |
| `!전적 닉네임#태그` | 특정 소환사 전적 조회 |
| `!결과 게임ID` | 특정 게임 결과 상세 조회 (팀별 챔피언, KDA) |
| `!장인 챔피언명` | 해당 챔피언 장인 조회 |

### 통계

| 명령어 | 설명 | 권한 |
|--------|------|------|
| `!클랜통계` | 전체 기간 클랜 통계 CSV 파일 다운로드 | 관리자 |
| `!클랜통계 2025 12` | 특정 월 클랜 통계 CSV 파일 다운로드 | 관리자 |

### 계정 관리

| 명령어 | 설명 | 권한 |
|--------|------|------|
| `!부캐목록` | 등록된 부계정 목록 조회 | 누구나 |
| `!부캐저장 부캐닉#태그/본캐닉#태그` | 부계정 등록 | 관리자 |
| `!부캐삭제 부캐닉#태그` | 부계정 삭제 | 관리자 |
| `!탈퇴 닉네임#태그` | 계정 탈퇴 처리 | 관리자 |
| `!복귀 닉네임#태그` | 계정 복귀 처리 | 관리자 |

### 리플레이 관리

| 명령어 | 설명 | 권한 |
|--------|------|------|
| `.rofl 파일 첨부` | 채팅에 리플레이 파일 업로드 시 자동 등록 | 누구나 |
| `!drop 게임ID` | 게임 기록 삭제 | 관리자 |

### 길드 관리 (슈퍼 어드민 전용)

| 명령어 | 설명 |
|--------|------|
| `!길드목록` | DB에 저장된 길드 목록 조회 |
| `!디스코드길드목록` | 봇이 입장한 Discord 서버 목록 조회 |
| `!길드떠나기 길드ID` | 봇이 특정 서버 퇴장 |
| `!클랜원목록` | 클랜원 목록 엑셀 파일 다운로드 |

### 기타

| 명령어 | 설명 |
|--------|------|
| `!doc` | 봇 사용 가이드 문서 |

---

## 권한 체계

| 구분 | 조건 |
|------|------|
| **누구나** | 일반 조회 명령어 |
| **관리자** | Discord 역할 `내전봇관리자` 또는 `난민개발부` 보유, 또는 서버 관리/관리자 권한 보유 |
| **슈퍼 어드민** | `ADMIN_ID` 환경변수에 지정된 Discord 사용자 ID |

---

## 환경변수 설정

`.env` 파일을 프로젝트 루트에 생성 후 아래 내용을 추가하세요.

```env
DISCORD_TOKEN=          # Discord 봇 토큰
BASE_URL=               # 백엔드 API 베이스 URL
DISCORD_BOT_SECRET=     # API 인증 헤더값 (x-discord-bot)
ADMIN_ID=               # 슈퍼 어드민 Discord 사용자 ID
TRC_CHANNEL_ID=         # 스케줄 알림 메시지 발송 채널 ID
NODE_ENV=               # development 설정 시 dev.gmok.kr 사용
BOT_CALLBACK_PORT=      # (선택) 백엔드 콜백 수신 포트 (기본 19902)
```

---

## 실행

```bash
node bot.js
```
