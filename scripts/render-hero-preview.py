"""Render a silent looping camera move from the local concept still.

Requires Python, Pillow, and FFmpeg. This creates demo footage, not character animation.
The default encoder is the workspace-local imageio-ffmpeg executable in .tools/.
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path
import shutil
import subprocess

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]


def get_ffmpeg(override: str | None) -> str:
    if override:
        return override
    bundled = list((ROOT / ".tools" / "python-media" / "imageio_ffmpeg" / "binaries").glob("ffmpeg*.exe"))
    if bundled:
        return str(bundled[0])
    installed = shutil.which("ffmpeg")
    if installed:
        return installed
    raise SystemExit("FFmpeg is required. Pass --ffmpeg PATH, or install imageio-ffmpeg in .tools/python-media.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "assets" / "hero-concept.png")
    parser.add_argument("--output", type=Path, default=ROOT / "assets" / "videos" / "hero-reel.mp4")
    parser.add_argument("--ffmpeg")
    parser.add_argument("--duration", type=float, default=12.0)
    parser.add_argument("--fps", type=int, default=24)
    parser.add_argument("--width", type=int, default=1600)
    parser.add_argument("--height", type=int, default=900)
    args = parser.parse_args()
    if args.duration <= 0 or args.fps < 1 or args.width < 2 or args.height < 2:
        parser.error("Duration, frame rate, and dimensions must be positive.")
    if args.width % 2 or args.height % 2:
        parser.error("H.264 yuv420p output dimensions must be even.")

    with Image.open(args.source) as original:
        still = original.convert("RGB")
    source_width, source_height = still.size
    output_ratio = args.width / args.height
    base_width = min(source_width, source_height * output_ratio)
    base_height = base_width / output_ratio
    frames = round(args.duration * args.fps)
    args.output.parent.mkdir(parents=True, exist_ok=True)

    command = [
        get_ffmpeg(args.ffmpeg), "-hide_banner", "-loglevel", "warning", "-y",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{args.width}x{args.height}",
        "-r", str(args.fps), "-i", "pipe:0", "-an",
        "-c:v", "libx264", "-preset", "medium", "-crf", "23",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        "-metadata", "title=JO JUNG HO - concept background preview",
        "-metadata", "comment=Test clip: camera movement over AI-generated concept artwork; replace with portfolio footage.",
        str(args.output),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    try:
        assert process.stdin is not None
        for frame_index in range(frames):
            phase = 2.0 * math.pi * frame_index / frames
            # Periodic position and zoom make the end-to-start camera movement continuous.
            zoom = 1.04 + 0.025 * (1.0 - math.cos(phase))
            crop_width, crop_height = base_width / zoom, base_height / zoom
            center_x = source_width / 2.0 + 0.014 * base_width * math.sin(phase)
            center_y = source_height / 2.0 + 0.006 * base_height * math.sin(phase)
            box = (
                center_x - crop_width / 2.0, center_y - crop_height / 2.0,
                center_x + crop_width / 2.0, center_y + crop_height / 2.0,
            )
            frame = still.resize((args.width, args.height), Image.Resampling.LANCZOS, box=box)
            process.stdin.write(frame.tobytes())
        process.stdin.close()
        return_code = process.wait()
        if return_code:
            raise SystemExit(f"FFmpeg exited with status {return_code}.")
    except BaseException:
        if process.poll() is None:
            process.kill()
            process.wait()
        raise

    print(f"Saved {args.output}")
    print(f"{frames / args.fps:.2f}s | {args.width}x{args.height} | {args.fps} fps | H.264/yuv420p | no audio")
    print(f"{args.output.stat().st_size / 1_000_000:.2f} MB")


if __name__ == "__main__":
    main()
