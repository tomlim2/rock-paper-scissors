# 뽕짝 가위바위보 vs Claude ✨

three.js로 만든 트로트 무대 위에서 Claude랑 가위바위보 한 판!

- 🟧 네모네모 Claude: 둥근 모서리 큐브 몸에 도트 얼굴(표정 6종), 다리 네 개, Claude 별 더듬이(스프링), 마이크 든 큐브 팔
- 🧤 큐브 장갑 손: 서로 오른손! 님 손은 오른쪽 아래, Claude는 오른손(화면 왼쪽)을 엄지가 위로 오게 옆으로 내밈. 공개 순간 "쾅!"
- 🪩 가요무대: 햇살 배경, 금테 전구 액자, 네모 단상 디스코 타일, 미러 큐브, 빛줄기, 응원봉 흔드는 네모 관객
- 🥁 "가위! 바위! 보!"가 박자에 딱 맞춰 나옴 (배경음이 꺼져 있으면 바로 시작)
- 😎 Claude가 이기면 선글라스 끼고 노래, 지면 눈물 줄줄, 비기면 띠용 + 하트
- 🧐 Claude가 님의 패턴(직전 수 → 다음 수)을 슬쩍 학습해서 가끔 노리고 냄
- 🔈 배경음(BGM)은 기본 꺼짐, 효과음은 켜짐. 왼쪽 위 버튼으로 켜고 끄며 브라우저에 기억됨

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
| `Enter` · `Space` | 시작 |

## 구조

```
src/
  main.js    게임 흐름, Claude AI, 박자 동기화, 화면 비율별 카메라, HUD
  audio.js   뽕짝 음악 + 효과음 (WebAudio 합성, BGM 기본 꺼짐)
  claude.js  Claude 캐릭터 (큐브 몸, 도트 얼굴, 더듬이 스프링, 마이크 팔)
  hand.js    큐브 장갑 손 (손가락 관절 포즈, 엄지 세운 옆손)
  limb.js    큐브 팔 (어깨 → 팔꿈치 → 손목)
  stage.js   햇살 배경, 전구 액자, 네모 단상, 커튼, 미러 큐브, 빛줄기, 관객, 꽃가루/음표/쾅
  toon.js    툰 셰이딩, 외곽선, 림라이트, 글로우 텍스처
```

## 배포 (GitHub Pages)

https://tomlim2.github.io/rock-paper-scissors/

`v*` 태그를 push하면 GitHub Actions가 빌드해서 `gh-pages` 브랜치에 배포합니다.

```bash
npm version patch   # 0.1.0 → 0.1.1 커밋 + v0.1.1 태그 생성 후 자동 push → 배포
npm version minor   # 0.1.x → 0.2.0
```

Actions 없이 로컬에서 바로 올리려면 `npm run deploy`.
