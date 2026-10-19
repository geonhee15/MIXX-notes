# MIXX-notes

NMIXX(엔믹스) 비공식 팬 페이지. 순수 HTML/CSS/JS, 빌드 과정 없음.

- **Home** — 현재 컴백 앨범 정보. 발매 전엔 카운트다운 + 트레일러 배경, 발매 후엔 OUT NOW + 스트리밍 링크 + 타이틀곡 MV 배경
- **Music** — 앨범별 전곡, 콜라보 & OST, 멤버 참여곡. 앨범 커버와 곡마다 YouTube(M/V·오디오)·Spotify 링크
- **Calendar** — [MIXXlog](https://mixxlog.com) 캘린더 피드(`feed.ics`) 기반 월간 일정
- 라이트(화이트 글래스) / 다크(차콜 글래스) 테마

## 컴백 정보 바꾸기

[`data/comeback.json`](data/comeback.json)만 수정하면 됩니다.

| 필드 | 설명 |
| --- | --- |
| `releaseAt` | 발매 시각 (ISO 8601, 예: `2026-10-19T18:00:00+09:00`) — 이 시각을 기준으로 화면이 자동 전환 |
| `trailerYoutubeId` | 발매 전 배경 영상 (트레일러/티저) |
| `mvYoutubeId` | 발매 후 배경 영상 (타이틀곡 공식 MV). 비어 있으면 트레일러 유지 |
| `links` | 스트리밍 링크 (spotify, youtubeMusic, appleMusic, melon, smartlink) |

## 디스코그래피 갱신

새 앨범이 나오면 아래 명령을 실행해 `data/discography.json`을 다시 만들고 커밋하세요. Spotify에서 앨범·트랙·커버를, YouTube 검색에서 공식 M/V와 오디오 링크를 가져와요 (API 키 필요 없음).

```bash
python3 scripts/build_discography.py
```

릴리즈 이름표, 타이틀곡, 멤버 참여곡 목록, 자동 검색이 놓친 유튜브 링크는 [`scripts/build_discography.py`](scripts/build_discography.py) 위쪽 설정에서 고칠 수 있어요.

## 캘린더 피드

mixxlog.com 피드는 CORS 헤더가 없어 브라우저에서 직접 읽을 수 없어서, GitHub Actions가 30분마다 피드를 받아 `data/feed.ics`로 함께 배포합니다 ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).

## 로컬 실행

```bash
python3 -m http.server 5173
```
