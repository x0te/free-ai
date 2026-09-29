# 오늘의 무료 AI — 운영 지침

무료 계정으로 쓸 수 있는 생성형 AI(공식 서비스 + Freepik·Higgsfield 같은 wrapper 사이트)를 카테고리별로 정리하는 정적 사이트.
데이터는 `data/`의 JSON, `node scripts/build.mjs`가 `dist/`로 빌드, `main`에 푸시하면 GitHub Actions가 GitHub Pages로 배포한다.

- `data/tools/<category>.json` — 서비스 항목 배열 (category: image, video, music, voice, chat, code, 3d)
- `data/changelog.json` — 날짜별 변경 기록 (최신이 맨 앞)
- `data/categories.json` — 카테고리 이름/설명
- `data/logos.json` — 자동 수집이 안 되는 로고의 직접 URL (선택)
- `public/logos/<logo>.<ext>` — 공식 아이콘 (`node scripts/fetch-logos.mjs` 로 수집)
- `site.config.json` — 사이트 이름, 주소, giscus 댓글 설정

## 매일 업데이트 절차

오늘 날짜는 **한국 시간(KST)** 기준으로 쓴다.

1. **새 소식 찾기** (지난 48시간 위주). 영어·한국어 둘 다 WebSearch 한다.
   - 검색어 예: `free AI video generator new`, `free credits veo`, `nano banana free unlimited`, `suno free plan change`, `무료 AI 이미지 생성 사이트`, `무료 이벤트 무제한 AI`, `<서비스명> free tier` 등
   - 커뮤니티: Reddit(r/singularity, r/StableDiffusion, r/aivideo, r/SunoAI, r/GeminiAI, r/ChatGPT, r/LocalLLaMA), X, 디시 AI 관련 갤러리, 클리앙, 뽐뿌, 긱뉴스, Hacker News, Product Hunt
   - 공식 채널: Google(blog.google, labs.google), OpenAI, xAI, Meta, ByteDance Seed/Dreamina, Kling, MiniMax/Hailuo, Alibaba Qwen/Wan, Suno, Udio, ElevenLabs, Freepik, Higgsfield, Krea 등의 블로그·changelog·X 계정
   - 찾을 것: 새로 나온 무료 서비스/모델, 무료 한도 변경, 무료 폐지, **무료 계정 대상 기간 한정 이벤트**(무제한 주간, 출시 기념 무료 등)
2. **기존 항목 재확인**: `lastVerified`가 가장 오래된 항목 10~15개 + 이벤트(promo)가 걸린 항목 전부를 공식 요금제/도움말 페이지와 최근 커뮤니티 글로 다시 확인한다. 확인만 하고 바뀐 게 없으면 `lastVerified`만 오늘로.
3. **데이터 수정** (아래 스키마 준수)
   - 새 항목: `added`, `updated`, `lastVerified` = 오늘
   - 내용이 바뀐 항목: `updated` = 오늘, 바뀐 필드만 수정
   - 무료가 끝난 항목: 지우지 말고 `status: "ended"`, headline에 언제 끝났는지. ended 된 지 30일 넘은 항목은 삭제
   - 만료된 이벤트(`promo.until` < 오늘)는 `promo` 필드를 지운다
   - id는 절대 바꾸지 않는다 (댓글이 id에 묶여 있음)
4. **변경 기록**: `data/changelog.json` 맨 앞에 오늘 항목 추가. 바뀐 게 없어도 점검 기록은 남긴다.
   ```json
   { "date": "2026-09-30", "summary": "한 줄 요약", "items": [
     { "type": "new", "id": "tool-id", "text": "Krea 영상 — Wan 2.5 무료 추가" }
   ] }
   ```
   type: `new`(신규) · `update`(변경) · `ended`(무료 종료) · `promo`(이벤트) · `fix`(정정) · `check`(점검, id 없이 "N개 항목 재확인")
5. **빌드 검증**: `node scripts/fetch-logos.mjs` (새 logo 키만 받아옴) → `node scripts/build.mjs`. 빌드가 데이터 오류를 출력하면 고친다.
6. **커밋·푸시**: `git add -A && git commit -m "update: YYYY-MM-DD <요약>" && git push`. 푸시하면 자동 배포된다.

## 판단 기준

- **포함**: 카드 등록 없이 가입만으로(또는 로그인 없이) 생성 가능한 것. 워터마크가 있어도 포함.
- **제외**: 카드 등록이 필요한 체험판, 생성 결과를 전혀 받을 수 없는 것.
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

`npm run dev` → http://localhost:4173/free-ai/
