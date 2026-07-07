# TRC-226 토너먼트코드 MVP 봇 연동 계획 (trcgg_bot 파트)

> 티켓: [TRC-226](https://trcgg.atlassian.net/browse/TRC-226) (봇 파트 하위 작업)
> 공통 우산: [TRC-224](https://trcgg.atlassian.net/browse/TRC-224) `[공통] 토너먼트코드 MVP 도입`
> 백엔드 파트: [TRC-225](https://trcgg.atlassian.net/browse/TRC-225) — `loltrixbe/loltrix_be/docs/plans/TRC-225-토너먼트코드-MVP.md` 상호 참조.

## 배경 / 문제

토너먼트코드 MVP(재검토 Go, 2026-07-07)에서 봇의 역할:
① 내전 시작 시 코드 발급을 요청해 채널에 게시, ② 판 종료 시 다음 코드 자동 게시.

봇 repo 실사(2026-07-07) 결과:

- 명령은 `!` 프리픽스 방식 (`app/commands/*.js`, `{name, run}` 배열 export,
  `onMessage.js`가 디스패치). 슬래시 커맨드 미사용.
- 봇→백엔드: `app/utils/networkUtils.js` httpClient — `BASE_URL` env +
  `x-discord-bot: <DISCORD_BOT_SECRET>` 헤더. 도메인별 client는 `app/client/*.js`.
- **백엔드→봇 통신 부재**: 봇은 HTTP 서버를 열지 않고 폴링도 없음
  (유일한 능동 트리거는 `app/schedule/schedule.js`의 node-cron).
- 채널 지정 게시 패턴: `client.channels.cache.get(TRC_CHANNEL_ID).send(...)`
  (⚠️ `.env.prod`에 `TRC_CHANNEL_ID` 누락 — 운영 배포 시 추가 필요)
- 리플 업로드는 명령이 아닌 파일 첨부 이벤트(`onMessage.js:32-46`)로 처리.
  코드 방식에서는 리플 업로드 단계가 사라지므로 이 후크는 판 종료 신호로 못 씀.

## 목표 / 비목표

**목표**: 코드 발급 게시(수동) → 다음 코드 자동 게시(백엔드 주도)까지 2단계 인도

**비목표**: 슬래시 커맨드 전환, 기존 리플 업로드 플로우 변경(병행 유지)

## 설계 결정 (제안)

### 백엔드→봇 방향: (a) 봇에 경량 HTTP 서버 신설 — 권장

| 선택지 | 평가 |
|---|---|
| **(a) 봇에 localhost 전용 경량 HTTP 서버** | ✅ 권장. 봇과 백엔드는 같은 호스트(백엔드의 `restrictBotToLocalhost`가 전제). `x-discord-bot` 시크릿을 역방향에도 재사용. `POST /post-next-code {channelId, code}` 1개면 충분 |
| (b) 봇이 백엔드 폴링 | 지연·불필요 트래픽. 콜백이 이미 실시간 신호인데 폴링으로 격하됨 |
| (c) 백엔드가 Discord Webhook 직접 게시 | 봇 코드 불필요하지만 채널별 webhook 발급·관리가 새 부담, 게시 주체가 둘로 갈라짐 |

### 게시 채널 결정

`!내전시작`이 실행된 **그 채널**에 게시. 발급 요청 시 `channel_id`를 백엔드에 넘겨
`tournament_code.metadata`에 저장 → 콜백 수신 시 백엔드가 그 채널로 다음 코드 게시를 지시.
(고정 `TRC_CHANNEL_ID` 방식은 멀티 길드에 안 맞음)

## 변경 범위

| 항목 | 위치(제안) | 내용 |
|---|---|---|
| 내전 명령 | `app/commands/tournamentCommand.js` | `!내전시작 [판수]` → 발급 API 호출 → 첫 코드 게시. `!다음코드` → 수동으로 다음 코드 게시(1단계 폴백 겸용) |
| 백엔드 client | `app/client/tournamentClient.js` | `POST /tournament/codes` (guildId, channelId, count), `GET /tournament/next-code` |
| 수신 서버 | `app/server/botCallback.js` | localhost 바인드 express, `POST /post-next-code`, `x-discord-bot` 시크릿 검증 |
| env | `.env*` | `BOT_CALLBACK_PORT` 추가, `.env.prod`에 `TRC_CHANNEL_ID` 누락 보정 |

## 단계별 작업

- [ ] 1. tournamentClient + `!내전시작`/`!다음코드` 명령 (수동 플로우 완성 — 이것만으로 MVP 시연 가능)
- [ ] 2. localhost HTTP 서버 + `POST /post-next-code` (자동 게시)
- [ ] 3. 백엔드 콜백 처리에 봇 호출 연결 (백엔드 TRC-225 4단계와 접합)
- [ ] 4. E2E: 발급→게시→(시뮬 콜백)→다음 코드 자동 게시

구현 담당: **Opus**. 기획·리뷰: Fable.

## 영향받는 불변식 / 리스크

- 기존 리플 첨부 이벤트 처리(`onMessage.js`) 불변 — 병행 운영 전제
- 봇 HTTP 서버는 **반드시 localhost 바인드** + 시크릿 검증 (외부 노출 금지)
- 봇 재시작 시 서버 포트 충돌/미기동 → 자동 게시 실패해도 `!다음코드` 수동 폴백으로 운영 가능해야 함

## 검증 방법

- `!내전시작` → 채널에 코드 게시 확인 (stub 코드)
- 시크릿 없는/틀린 `POST /post-next-code` 거부 확인
- 백엔드 콜백 시뮬레이터 → 봇 채널에 다음 코드 자동 게시 E2E
