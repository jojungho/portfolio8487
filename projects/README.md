# 카테고리 상세 페이지

홈페이지 2단의 6개 이미지는 각 HTML 파일로 연결됩니다. 여섯 페이지는 같은 레이아웃을 사용합니다.

| 페이지 | 이미지 파일 |
| --- | --- |
| `creature-rigging.html` | `../assets/projects/creature-rigging.png` |
| `cloth-simulation.html` | `../assets/projects/cloth-simulation.png` |
| `character-work.html` | `../assets/projects/character-work.png` |
| `destruction-fx.html` | `../assets/projects/destruction-fx.png` |
| `fluid-effects.html` | `../assets/projects/fluid-effects.png` |
| `procedural-rd.html` | `../assets/projects/procedural-rd.png` |

## 구성

큰 이미지 배너 → 6개 카테고리 탭 → 소개 → 좌우 이동 갤러리 → 작업 분야 → WORKS → 이전/다음 카테고리 순서입니다. 공통 스타일은 `../project.css`, 갤러리와 이미지 확대창은 `../project.js`에서 관리합니다.

카테고리 갤러리와 CONCEPT CROP 표시가 있는 WORKS는 AI 생성 테스트 이미지를 여러 구도로 보여주는 컨셉 시안입니다. 해당 이미지를 클릭하면 원본 테스트 이미지가 확대창으로 열립니다. Esc 또는 닫기 버튼으로 돌아옵니다.

CINEMATIC&VFX의 WORKS는 유튜브와 같은 16:9 비율이며, 화면 폭에 따라 4/3/2/1열로 배치됩니다. 이미지 위에 제목을 표시하고, 마우스를 올리면 약 4.5% 확대됩니다. `.works-grid--video` 스타일을 사용합니다.

BT21 카드는 `../work-preview.js`에서 YouTube IFrame API로 미리 재생 준비를 합니다. 마우스를 올리거나 키보드로 포커스하면 음소거 재생하며, 실제 PLAYING 상태가 확인될 때 썸네일을 영상으로 전환합니다. 마우스 이탈, 포커스 이탈, 화면 밖 이동, 탭 비활성화 시 정지하고 썸네일로 돌아갑니다. 클릭하면 상세 페이지로 이동합니다. 첫 로딩에는 네트워크 시간이 필요하며, 재생 실패 시 썸네일과 상세 링크가 유지됩니다. 터치 기기, 동작 줄이기 설정, 높이 200px 미만 카드에서는 자동 미리보기를 생략합니다. 다른 컨셉 카드는 연결된 영상이 없어 이미지로 표시합니다.

## BT21 영상 상세 화면

등록한 영상은 `../data/videos.json`에서 읽습니다. `../admin/`에서 YouTube 링크 또는 `assets/videos/`의 MP4를 추가·수정하면 각 카테고리 WORKS와 상세 페이지에 반영됩니다. 공통 영상 상세 템플릿은 `work.html?id=영상ID`, 기존 BT21 주소는 `bt21.html`을 유지합니다. `../portfolio-content.js`가 두 화면에 저장 데이터를 연결합니다.

CINEMATIC&VFX의 첫 작품은 `BT21`이며, 클릭하면 `bt21.html`로 이동합니다. 제목 → YouTube 영상 → 설명 및 정보 순서로 구성되어 있습니다. `../work-detail.css`에서 상세 화면 스타일을 조정합니다.

- 영상: https://www.youtube.com/watch?v=k6hnPMril98
- 이미지: YouTube의 `maxresdefault.jpg` 썸네일을 16:9로 표시합니다.
- 제목과 채널은 YouTube 공식 oEmbed 메타데이터를 바탕으로 작성했습니다.
- 설명은 공식 채널의 영상 소개이며, 담당 작업이나 기여도는 제공받은 뒤 `work-detail__description`과 `work-detail__credits`에 추가하면 됩니다.
- 영상은 다운로드하지 않고 YouTube 플레이어로 연결합니다. 외부 재생 제한 등이 있는 환경에서는 `YouTube에서 보기` 링크로 원본을 열 수 있습니다.

## 실제 작업으로 교체

1. 이미지 파일을 `assets/projects/`에 추가합니다.
2. 해당 HTML의 배너 `src`, 갤러리 `src`, WORKS `src`와 `data-study-image`를 새 파일 경로로 바꿉니다.
3. 제목, 설명, 이미지 `alt`와 `data-study-alt`를 실제 작업에 맞춥니다.
4. 실제 포트폴리오로 교체한 부분의 `CONCEPT STUDY`, `TEST IMAGES`, `CONCEPT CROP` 표시를 수정합니다.

BT21 미리보기에는 YouTube 공식 IFrame API를 사용합니다. 별도 설치나 빌드 과정은 필요하지 않습니다.
