# 첫 화면 배경 영상

`hero-reel.mp4`와 `hero-reel-02.mp4`는 현재 화면을 확인하기 위한 테스트 영상입니다. 첫 화면 하단의 **01 / 02** 버튼으로 전환합니다.

- 01 원본: 이 프로젝트에서 AI로 생성한 `../hero-concept.png` (성 배경)
- 02 원본: 이 프로젝트에서 AI로 생성한 `../projects/creature-rigging.png` (크리처)
- 표현: 정지 콘셉트 이미지에 느린 카메라 이동과 확대를 적용한 12초 반복 영상
- 실제 포트폴리오 작업물이나 캐릭터 애니메이션을 의미하지 않습니다.
- 형식: 1600 × 900, 24fps, H.264, yuv420p, 무음 MP4

## 실제 포트폴리오 영상으로 교체

첫 번째 실제 영상은 **`hero-reel.mp4`**, 두 번째는 **`hero-reel-02.mp4`**라는 이름으로 이 폴더에 넣고 기존 테스트 영상을 덮어쓰면 됩니다. 홈페이지 코드 수정은 필요 없습니다. 브라우저에서 새로고침하면 적용됩니다.

브라우저 재생 호환성을 위해 H.264 MP4와 `yuv420p` 색상 형식을 사용하세요. 선택한 배경 영상은 무음 반복 재생됩니다. 영상이 로드되지 않을 때 보여줄 포스터는 `index.html`의 각 영상 `poster` 속성에서 지정합니다.

## 테스트 영상 다시 만들기

제작 스크립트: `scripts/render-hero-preview.py` (프로젝트 최상위 폴더 기준)

Python, Pillow, FFmpeg가 필요합니다. 현재 작업 환경에서는 FFmpeg를 프로젝트 안의 `.tools/python-media/`에만 설치했습니다. 사이트 공개 시 `.tools/`와 `scripts/`는 업로드할 필요가 없습니다.

```powershell
python scripts/render-hero-preview.py
python scripts/render-hero-preview.py --source assets/projects/creature-rigging.png --output assets/videos/hero-reel-02.mp4
```

FFmpeg를 따로 설치했다면 경로를 지정할 수 있습니다.

```powershell
python scripts/render-hero-preview.py --ffmpeg "C:/path/to/ffmpeg.exe"
```

현재 테스트 영상의 제작에는 외부 영상 서비스 업로드나 외부 영상 다운로드를 사용하지 않았습니다.
