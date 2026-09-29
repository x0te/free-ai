# 오늘의 무료 AI

지금 무료 계정으로 쓸 수 있는 생성형 AI(이미지·영상·음악·음성·챗봇·코딩·3D)를 매일 찾아 정리하는 게시판형 사이트.
공식 서비스와 Freepik·Higgsfield 같은 wrapper 사이트를 모두 다룹니다.

- 사이트: https://free-ai.today (같은 내용: https://x0te.github.io/free-ai/)
- 틀린 정보·새 무료 AI 제보: 각 글의 댓글 또는 [토론 게시판](https://github.com/x0te/free-ai/discussions)

## 구조

- `data/tools/*.json` — 서비스 데이터 (스키마와 매일 업데이트 절차는 [CLAUDE.md](CLAUDE.md))
- `data/changelog.json` — 업데이트 로그
- `scripts/build.mjs` — 정적 사이트 빌드 (의존성 없음)
- `scripts/fetch-logos.mjs` — 공식 아이콘 수집
- `scripts/hot.mjs` — 커뮤니티 언급량(디시·클리앙·HN)으로 화제성 🔥 계산
- `.github/workflows/deploy.yml` — main 푸시 시 GitHub Pages 배포

```sh
npm run logos   # 로고 수집
npm run hot     # 화제성 갱신
npm run dev     # 빌드 후 http://localhost:4173/
```
