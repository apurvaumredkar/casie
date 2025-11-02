"""
CASIE Bridge - TV Shows Index Generator
Scans the TV directory and generates a markdown index of available shows,
seasons, and episodes.
"""

import os
from pathlib import Path
from collections import defaultdict
import re


def parse_season_folder(folder_name: str) -> int | None:
    """Extract season number from folder name."""
    # Match patterns like: Season 1, Season 01, S01, s1, etc.
    patterns = [
        r'season\s*(\d+)',
        r's(\d+)',
        r'(\d+)'  # Fallback: any number
    ]

    folder_lower = folder_name.lower()
    for pattern in patterns:
        match = re.search(pattern, folder_lower)
        if match:
            return int(match.group(1))
    return None


def count_video_files(directory: Path) -> int:
    """Count video files in a directory."""
    video_extensions = {'.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'}
    count = 0

    try:
        for file in directory.iterdir():
            if file.is_file() and file.suffix.lower() in video_extensions:
                count += 1
    except PermissionError:
        pass

    return count


def scan_tv_directory(tv_path: str) -> dict:
    """
    Scan TV directory and return structured data.

    Returns:
        dict: {
            "Show Name": {
                1: episode_count,
                2: episode_count,
                ...
            }
        }
    """
    tv_dir = Path(tv_path)

    if not tv_dir.exists():
        print(f"Error: Directory not found: {tv_path}")
        return {}

    shows = defaultdict(dict)

    # Iterate through show directories
    for show_dir in sorted(tv_dir.iterdir()):
        if not show_dir.is_dir():
            continue

        show_name = show_dir.name
        print(f"Scanning: {show_name}")

        # Look for season folders
        season_folders = []
        for item in show_dir.iterdir():
            if item.is_dir():
                season_num = parse_season_folder(item.name)
                if season_num is not None:
                    season_folders.append((season_num, item))

        # If no season folders found, treat show folder as single season
        if not season_folders:
            episode_count = count_video_files(show_dir)
            if episode_count > 0:
                shows[show_name][1] = episode_count
        else:
            # Process each season folder
            for season_num, season_dir in sorted(season_folders):
                episode_count = count_video_files(season_dir)
                if episode_count > 0:
                    shows[show_name][season_num] = episode_count

    return dict(shows)


def generate_markdown(shows_data: dict, output_path: str):
    """Generate markdown file from shows data."""

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("# TV Shows Index\n\n")
        f.write("*Auto-generated index of available TV shows*\n\n")
        f.write("---\n\n")

        if not shows_data:
            f.write("No TV shows found.\n")
            return

        # Detailed listing
        f.write("## Available Shows\n\n")

        for index, show_name in enumerate(sorted(shows_data.keys()), 1):
            seasons = shows_data[show_name]
            season_count = len(seasons)
            episode_count = sum(seasons.values())

            f.write(f"### {index}. {show_name}\n\n")
            f.write(f"- **Seasons**: {season_count}\n")
            f.write(f"- **Total Episodes**: {episode_count}\n\n")

            # List each season
            if season_count > 1:
                f.write("**Season Breakdown**:\n")
                for season_num in sorted(seasons.keys()):
                    eps = seasons[season_num]
                    f.write(f"- Season {season_num}: {eps} episode{'s' if eps != 1 else ''}\n")
                f.write("\n")

            f.write("---\n\n")


def main():
    """Main execution."""
    tv_path = r"C:\Users\apoor\Videos\TV"
    output_path = Path(__file__).parent / "videos.md"

    print(f"Scanning TV directory: {tv_path}")
    print("-" * 60)

    shows_data = scan_tv_directory(tv_path)

    print("-" * 60)
    print(f"Found {len(shows_data)} show(s)")

    if shows_data:
        generate_markdown(shows_data, str(output_path))
        print(f"\nGenerated: {output_path}")
        print("\nSummary:")
        for show, seasons in sorted(shows_data.items()):
            print(f"  {show}: {len(seasons)} season(s), {sum(seasons.values())} episode(s)")
    else:
        print("\nNo shows found!")


if __name__ == "__main__":
    main()
