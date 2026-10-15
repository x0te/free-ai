# 오늘의 무료 AI — 운영 지침

무료 계정으로 쓸 수 있는 생성형 AI(공식 서비스 + Freepik·Higgsfield 같은 wrapper 사이트)를 카테고리별로 정리하는 정적 사이트.
데이터는 `data/`의 JSON, `node scripts/build.mjs`가 `dist/`로 빌드, `main`에 푸시하면 GitHub Actions가 두 주소에 배포한다.
- https://x0te.github.io/free-ai/ — 이 저장소의 GitHub Pages (`BASE_PATH=/free-ai`)
- https://free-ai.today — `x0te/free-ai-today`의 gh-pages 브랜치 (배포 키로 자동 푸시, GoDaddy 도메인). 그 저장소는 직접 수정하지 않는다

- `data/tools/<category>.json` — 서비스 항목 배열 (category: image, video, music, voice, chat, code, 3d)
- `data/changelog.json` — 날짜별 변경 기록 (최신이 맨 앞)
- `data/categories.json` — 카테고리 이름/설명
- `data/logos.json` — 자동 수집이 안 되는 로고의 직접 URL (선택)
- `data/hot-terms.json` — 화제성(🔥) 검색어. 키는 logo 키 또는 항목 id(id 우선). 동음이의어는 구체적인 구로
- `data/hot.json` — `node scripts/hot.mjs` 결과 (디시·클리앙·Hacker News 최근 30일 언급량 → score). 목록 기본 정렬과 🔥 표시에 쓰임
- `public/logos/<logo>.<ext>` — 공식 아이콘 (`node scripts/fetch-logos.mjs` 로 수집)
- `data/marks.json` → `public/marks/*.svg` — 홈 배너에 흐르는 단색 로고 마크 (`node scripts/fetch-marks.mjs`, @lobehub/icons 아이콘 이름). 새 플랫폼에 마크가 있으면 매핑 추가
- `public/og.png`, `apple-touch-icon.png`, `icon-512.png` — 링크 미리보기 썸네일·앱 아이콘 (`node scripts/make-og.mjs`, 로컬 Chrome 필요)
- `site.config.json` — 사이트 이름, 주소, giscus 댓글 설정

## 매일 업데이트 절차

오늘 날짜는 **한국 시간(KST)** 기준으로 쓴다.

1. **새 소식 찾기** (지난 48시간 위주). **국가별로 나눠서** WebSearch 한다. 무료 정보는 미국·중국 커뮤니티가 가장 빠르니 둘을 가장 많이 본다 (영어 ≥ 중국어 > 한국어 > 일본어).
   - **커뮤니티는 짧은 검색어로 훑는다**: 커뮤니티 이름 + `무료`/`free`/`免费`/`白嫖`/`無料` 한두 단어면 충분하다 (예: `site:reddit.com/r/aivideo free`, `linux.do 免费`, `小红书 白嫖 AI`, `클리앙 무료 AI`, `無料 動画生成`). 긴 검색어는 놓치는 글이 많다. 아래 긴 검색어 예시는 특정 주제를 파고들 때 쓴다.
   - 🇺🇸 미국/영어권: Reddit(r/singularity, r/StableDiffusion, r/aivideo, r/SunoAI, r/GeminiAI, r/ChatGPT, r/LocalLLaMA, r/aiArt, r/ArtificialInteligence, r/SideProject), X, Hacker News, Product Hunt, There's An AI For That
     검색어 예: `free AI video generator new`, `free credits veo`, `nano banana free unlimited`, `suno free plan change`, `free credits on signup AI no credit card`, `<서비스명> free tier`, `site:reddit.com free credits AI video`
   - 🇨🇳 중국어권: 知乎, 小红书, V2EX, linux.do, 哔哩哔哩(B站), 即刻, 微博, 什么值得买, 少数派
     검색어 예: `免费 AI 视频生成 每日积分`, `AI 白嫖 注册送积分`, `新用户 免费额度 AI 绘画`, `免费 AI 音乐 生成`, `国际版 免费 积分`, `限时免费 AI`, `<서비스명> 免费额度`
   - 🇰🇷 한국: 디시 AI 관련 갤러리, 클리앙, 뽐뿌, 긱뉴스, 아카라이브 AI 채널 — 검색어 예: `무료 AI 이미지 생성 사이트`, `무료 이벤트 무제한 AI`, `가입 크레딧 무료 AI`
   - 🇯🇵 일본: X, note, 5ch — 검색어 예: `無料 AI 動画生成 クレジット`, `AI 無料 登録 クレジット`
   - 공식 채널: Google(blog.google, labs.google), OpenAI, xAI, Meta, ByteDance Seed/Dreamina, Kling, MiniMax/Hailuo, Alibaba Qwen/Wan, Suno, Udio, ElevenLabs, Freepik, Higgsfield, Krea 등의 블로그·changelog·X 계정
   - 찾을 것: 새로 나온 무료 서비스/모델, **가입 시 1회 무료 크레딧을 주는 곳**, 무료 한도 변경, 무료 폐지, **무료 계정 대상 기간 한정 이벤트**(무제한 주간, 출시 기념 무료 등)
2. **기존 항목 재확인**: `lastVerified`가 가장 오래된 항목 10~15개 + 이벤트(promo)가 걸린 항목 전부를 공식 요금제/도움말 페이지와 최근 커뮤니티 글로 다시 확인한다. 확인만 하고 바뀐 게 없으면 `lastVerified`만 오늘로.
3. **데이터 수정** (아래 스키마 준수)
   - 새 항목: `added`, `updated`, `lastVerified` = 오늘
   - 내용이 바뀐 항목: `updated` = 오늘, 바뀐 필드만 수정
   - 무료가 끝난 항목: 지우지 말고 `status: "ended"`, headline에 언제 끝났는지. 사이트에서 ended로 바꾼 날(`updated`)로부터 30일이 지나면 삭제 (실제 종료일 기준 아님 — 종료 소식도 한 달은 보여준다)
   - 만료된 이벤트(`promo.until` < 오늘)는 `promo` 필드를 지운다
   - id는 절대 바꾸지 않는다 (댓글이 id에 묶여 있음)
4. **변경 기록**: `data/changelog.json` 맨 앞에 오늘 항목 추가. 바뀐 게 없어도 점검 기록은 남긴다.
   ```json
   { "date": "2026-09-30", "summary": "한 줄 요약", "items": [
     { "type": "new", "id": "tool-id", "text": "Krea 영상 — Wan 2.5 무료 추가" }
   ] }
   ```
   type: `new`(신규) · `update`(변경) · `ended`(무료 종료) · `promo`(이벤트) · `fix`(정정) · `check`(점검, id 없이 "N개 항목 재확인")
5. **화제성·빌드**: 새 플랫폼을 넣었으면 `data/hot-terms.json`에 검색어 추가 → `node scripts/hot.mjs` (약 2~3분) → `node scripts/fetch-logos.mjs` (새 logo 키만 받아옴) → `node scripts/build.mjs`. 빌드가 데이터 오류를 출력하면 고친다.
6. **커밋·푸시**: `git add -A && git commit -m "update: YYYY-MM-DD <요약>" && git push`. 푸시하면 자동 배포된다.

## 판단 기준

- **포함**: 카드 등록 없이 가입만으로(또는 로그인 없이) 생성 가능한 것. 워터마크가 있어도 포함.
  - **계정당 1회만 주는 무료(가입 크레딧, 첫 생성 무료 등)도 포함한다.** 매일·매월 충전이 아니어도 된다. `reset: "가입 시 1회"`, `flags.reset: "once"`로 쓰고, headline에 "가입 시 1회 N크레딧 → ○○ 약 N개"처럼 한 번뿐이라는 걸 분명히 적는다. 기한 안에 소멸되면 그것도 적는다.
- **제외**: 카드 등록이 필요한 체험판, 생성 결과를 전혀 받을 수 없는 것, 중국 휴대폰(+86) 인증이 필수라 한국에서 가입할 수 없는 것 (국제판이 있으면 국제판으로 넣는다).
- 수치는 구체적으로 계산해서 headline에 쓴다: "월 100크레딧 → Veo 3.1 Fast 8초 영상 약 5개". 확실하지 않으면 "약", "보고됨"을 붙이고 `confidence`를 낮춘다. **추측으로 지어내지 않는다.**
- 같은 모델도 사이트마다 한도가 다르므로 사이트별로 별도 항목. 한 사이트가 여러 카테고리면 카테고리별로 별도 항목 (logo 키는 공유).
- 출처(`sources`)는 최소 1개, 가능하면 공식 1 + 커뮤니티/뉴스 1.
- 모든 설명은 한국어 (모델명·고유명사는 원문).

## 항목 스키마

```json
{
  "id": "google-flow-video",
  "category": "video",
  "platform": "Google Flow",
  "vendor": "Google",
  "access": "official | wrapper | opensource",
  "url": "https://labs.google/fx/tools/flow",
  "logo": "google-flow",
  "logoDomain": "labs.google",
  "models": ["Veo 3.1 Fast"],
  "headline": "무료 계정 → Veo 3.1 Fast로 8초 영상 월 약 N개",
  "description": "서비스 설명 2~4문장",
  "freeTier": {
    "quota": "구체적인 무료 한도",
    "reset": "매일 | 매월 | 가입 시 1회 | 무제한 | 불명 (+부연)",
    "watermark": "가시 워터마크 있음 / SynthID(비가시)만 / 없음 / 불명",
    "commercialUse": "가능 / 불가 / 불명 (+부연)",
    "signup": "Google 계정 / 이메일 / 로그인 불필요",
    "korea": "가능 / 불가 / VPN 필요 / 불명",
    "notes": "해상도, 길이, 대기열 등 기타 제약"
  },
  "flags": { "reset": "daily|weekly|monthly|once|unlimited|unknown", "watermark": "none|invisible|visible|unknown", "login": true, "commercial": false },
  "promo": { "text": "무료 계정도 Nano Banana Pro 무제한", "until": "2026-10-05" },
  "howTo": ["1단계", "2단계"],
  "tags": ["매일충전", "워터마크"],
  "confidence": "high | medium | low",
  "status": "active | limited | ended",
  "added": "2026-09-29",
  "updated": "2026-09-29",
  "lastVerified": "2026-09-29",
  "sources": [{ "title": "…", "url": "https://…", "type": "official | community | news", "date": "2026-09" }]
}
```

`flags`는 목록 필터(매일 충전, 워터마크 없음, 로그인 불필요, 상업 이용 가능)에 쓰인다. `freeTier` 문구를 바꾸면 `flags`도 맞춰 고친다. `promo`는 무료 계정에 적용되는 이벤트가 있을 때만.

## 로컬 미리보기

`npm run dev` → http://localhost:4173/
