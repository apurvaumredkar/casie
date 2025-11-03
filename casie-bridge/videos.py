"""
CASIE Bridge - TV Shows Management

This script handles both:
1. Markdown index generation (videos.md) for local TV show library
2. Cloudflare D1 database population for Discord bot queries

Usage:
    python videos.py [--markdown-only | --d1-only | --both]

Options:
    --markdown-only    Generate only videos.md index
    --d1-only          Populate only D1 database
    --both             Do both operations (default)
"""

import os
import argparse
import subprocess
from pathlib import Path
from collections import defaultdict
import re
from typing import Optional
from tqdm import tqdm
from dotenv import load_dotenv
import tempfile

# Load environment variables
load_dotenv()

# Supported video extensions
VIDEO_EXTENSIONS = {'.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'}


def parse_episode_filename(filename: str, filepath: str) -> Optional[dict]:
    """
    Parse episode filename to extract series, season, and episode information.

    All TV shows follow the standardized format:
    - S##E## Episode Title.ext

    Returns:
        dict with keys: series, season, episode, title, filepath
        None if pattern doesn't match
    """
    filepath_obj = Path(filepath)

    # Pattern: S##E## Episode Title.ext
    pattern = r'^S(\d{1,2})E(\d{1,2})\s+(.+)\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v)$'

    match = re.match(pattern, filename, re.IGNORECASE)
    if match:
        season_num = int(match.group(1))
        episode_num = int(match.group(2))
        episode_title = match.group(3)

        # Get series name from parent directory's parent
        # Structure: TV/Show Name/SX/S##E## Title.ext
        season_folder = filepath_obj.parent
        show_folder = season_folder.parent
        series_name = show_folder.name

        return {
            'series': series_name,
            'season': season_num,
            'episode': episode_num,
            'title': episode_title,
            'filepath': filepath
        }

    return None


def parse_season_folder(folder_name: str) -> int | None:
    """
    Extract season number from folder name.

    Format: SX (e.g., S1, S2, S10)
    """
    pattern = r'^S(\d+)$'

    match = re.match(pattern, folder_name, re.IGNORECASE)
    if match:
        return int(match.group(1))

    return None


def count_video_files(directory: Path) -> int:
    """Count video files in a directory."""
    count = 0

    try:
        for file in directory.iterdir():
            if file.is_file() and file.suffix.lower() in VIDEO_EXTENSIONS:
                count += 1
    except PermissionError:
        pass

    return count


def scan_tv_directory_for_markdown(tv_path: str) -> dict:
    """
    Scan TV directory and return structured data for markdown generation.

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


def scan_tv_directory_for_d1(tv_path: str) -> list[dict]:
    """
    Scan TV directory and extract episode information for D1 population.

    Returns:
        list of dicts: [{'series': str, 'season': int, 'episode': int, 'filepath': str}]
    """
    episodes = []
    unparseable = []

    print(f"\nScanning TV directory: {tv_path}")
    print("-" * 60)

    tv_dir = Path(tv_path)
    if not tv_dir.exists():
        print(f"Error: Directory does not exist: {tv_path}")
        return episodes

    # Scan all subdirectories
    for show_dir in sorted(tv_dir.iterdir()):
        if not show_dir.is_dir():
            continue

        print(f"Scanning: {show_dir.name}")

        # Scan all season subdirectories
        for season_dir in show_dir.iterdir():
            if not season_dir.is_dir():
                continue

            # Scan all video files in season directory
            for video_file in season_dir.glob('*'):
                if video_file.suffix.lower() not in VIDEO_EXTENSIONS:
                    continue

                parsed = parse_episode_filename(video_file.name, str(video_file))
                if parsed:
                    episodes.append(parsed)
                else:
                    unparseable.append(video_file.name)

    print("-" * 60)
    print(f"Found {len(episodes)} parseable episodes")
    if unparseable:
        print(f"Warning: {len(unparseable)} unparseable files")

    return episodes


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


def populate_d1(episodes: list[dict], database_id: str):
    """Populate Cloudflare D1 database with episodes data."""
    print(f"\n{'=' * 60}")
    print(f"POPULATING D1 DATABASE")
    print(f"{'=' * 60}")
    print(f"Database ID: {database_id}")
    print(f"Total episodes to insert: {len(episodes)}")

    # Clear existing data first
    print("\nClearing existing data...")
    subprocess.run(
        'npx wrangler d1 execute videos-db --remote --command "DELETE FROM episodes;"',
        cwd="../casie-core",
        shell=True,
        check=True
    )
    print("[OK] Existing data cleared")

    # Insert episodes in batches (D1 has a limit on statement size)
    batch_size = 100
    total_batches = (len(episodes) + batch_size - 1) // batch_size

    print(f"\nInserting episodes in {total_batches} batches...")

    for i in tqdm(range(0, len(episodes), batch_size), desc="Inserting batches"):
        batch = episodes[i:i+batch_size]

        # Build INSERT statement
        values = []
        for ep in batch:
            # Escape single quotes in strings
            series = ep['series'].replace("'", "''")
            filepath = ep['filepath'].replace("'", "''")
            values.append(f"('{series}', {ep['season']}, {ep['episode']}, '{filepath}')")

        insert_sql = f"""
        INSERT INTO episodes (series, season, episode, filepath)
        VALUES {', '.join(values)};
        """

        # Execute batch insert
        try:
            # Write SQL to temporary file to avoid command line length limits
            with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False, encoding='utf-8') as f:
                f.write(insert_sql)
                temp_sql_file = f.name

            try:
                subprocess.run(
                    f'npx wrangler d1 execute videos-db --remote --file="{temp_sql_file}"',
                    cwd="../casie-core",
                    shell=True,
                    check=True,
                    capture_output=True
                )
            finally:
                # Clean up temp file
                os.unlink(temp_sql_file)
        except subprocess.CalledProcessError as e:
            print(f"\nError inserting batch {i//batch_size + 1}")
            if e.stderr:
                print(f"Error: {e.stderr.decode('utf-8', errors='ignore')}")
            continue

    print(f"\n[OK] Successfully inserted {len(episodes)} episodes")

    # Verify count
    print("\nVerifying insertion...")
    count_result = subprocess.run(
        'npx wrangler d1 execute videos-db --remote --command "SELECT COUNT(*) as count FROM episodes;"',
        cwd="../casie-core",
        shell=True,
        capture_output=True,
        text=True
    )

    print(f"[OK] Database verification complete")
    print(count_result.stdout)

    print(f"{'=' * 60}")


def generate_markdown_index(tv_path: str):
    """Generate markdown index of TV shows."""
    print("=" * 60)
    print("GENERATING MARKDOWN INDEX")
    print("=" * 60)

    output_path = Path(__file__).parent / "videos.md"

    print(f"Scanning TV directory: {tv_path}")
    print("-" * 60)

    shows_data = scan_tv_directory_for_markdown(tv_path)

    print("-" * 60)
    print(f"Found {len(shows_data)} show(s)")

    if shows_data:
        generate_markdown(shows_data, str(output_path))
        print(f"\n[OK] Generated: {output_path}")
        print("\nSummary:")
        for show, seasons in sorted(shows_data.items()):
            print(f"  {show}: {len(seasons)} season(s), {sum(seasons.values())} episode(s)")
    else:
        print("\nNo shows found!")

    return bool(shows_data)


def populate_d1_database(tv_path: str, database_id: str):
    """Populate D1 database with episode data."""
    episodes = scan_tv_directory_for_d1(tv_path)

    if not episodes:
        print("\nNo episodes found!")
        return False

    populate_d1(episodes, database_id)
    print("\n[OK] D1 population complete!")
    return True


def main():
    """Main execution with CLI argument parsing."""
    parser = argparse.ArgumentParser(
        description="CASIE TV Shows Management - Generate markdown index and/or populate D1 database"
    )
    parser.add_argument(
        '--markdown-only',
        action='store_true',
        help='Generate only videos.md index'
    )
    parser.add_argument(
        '--d1-only',
        action='store_true',
        help='Populate only D1 database'
    )
    parser.add_argument(
        '--both',
        action='store_true',
        help='Do both operations (default)'
    )

    args = parser.parse_args()

    # Default to both if no specific flag is set
    if not (args.markdown_only or args.d1_only):
        args.both = True

    # Get configuration from environment variables
    tv_path = os.getenv("TV_DIRECTORY", r"C:\path\to\your\TV")
    database_id = os.getenv("D1_DATABASE_ID", "your-database-id")

    # Validate configuration
    if not os.path.exists(tv_path):
        print(f"Error: TV_DIRECTORY not found: {tv_path}")
        print("Please set TV_DIRECTORY environment variable in .env file")
        return

    print(f"\nTV Directory: {tv_path}\n")

    # Execute requested operations
    if args.markdown_only or args.both:
        generate_markdown_index(tv_path)

    if args.d1_only or args.both:
        if args.both:
            print()  # Add spacing between operations
        populate_d1_database(tv_path, database_id)

    print("\n[OK] All operations complete!")


if __name__ == "__main__":
    main()
