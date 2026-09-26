# 뽕짝 가위바위보 vs Claude ✨

three.js로 만든 트로트 무대 위에서 Claude랑 가위바위보 한 판!

- 🎺 WebAudio로 직접 합성한 뽕짝 비트 (쿵짝 드럼 + 꺾기 들어간 전자 올갠 리드)
- 🥁 "가위! 바위! 보!"가 음악 박자에 딱 맞춰 나옴
- 😎 Claude가 이기면 선글라스, 지면 ㅠㅠ, 비기면 띠용
- 🧐 Claude가 님의 패턴(직전 수 → 다음 수)을 슬쩍 학습해서 가끔 노리고 냄

## 실행

```bash
npm install
npm run dev
```

빌드: `npm run build` → `dist/` (상대경로라 GitHub Pages 등에 그대로 올려도 됨)

## 조작

| 키 | 동작 |
| --- | --- |
| `1` | ✌️ 가위 |
| `2` | ✊ 바위 |
| `3` | 🖐️ 보 |
| `Enter` | 시작 |

## 구조

```
src/
  main.js    게임 흐름, Claude AI, 박자 동기화, HUD
  audio.js   뽕짝 음악 + 효과음 (WebAudio 합성)
  claude.js  Claude 캐릭터 (표정 5종)
  hand.js    손가락 관절 애니메이션 손
  stage.js   햇살 배경, 디스코 바닥, 커튼, 미러볼, 꽃가루
  toon.js    툰 셰이딩 + 외곽선
```
