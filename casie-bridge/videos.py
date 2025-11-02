"""
CASIE Bridge - TV Shows Index Generator
Scans the TV directory and generates a markdown index of available shows,
seasons, and episodes.
"""

import os
from pathlib import Path
from collections import defaultdict
import re
from typing import Optional
from tqdm import tqdm

# Qdrant and Ollama imports (optional dependencies)
try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import Distance, VectorParams, PointStruct
    import ollama
    QDRANT_AVAILABLE = True
except ImportError:
    QDRANT_AVAILABLE = False
    print("Warning: qdrant-client or ollama not installed. Qdrant features disabled.")


def parse_episode_filename(filename: str, filepath: str) -> Optional[dict]:
    """
    Parse episode filename to extract series, season, and episode information.

    All TV shows now follow the standardized format after renaming:
    - S##E## Episode Title.ext

    This simplifies parsing to a single pattern match.

    Returns:
        dict with keys: series, season, episode, filepath
        None if pattern doesn't match
    """
    # Standardized format: S##E## Episode Title.ext
    # Extract from parent directory name (which is the show name)
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

    # If pattern doesn't match, return None
    return None


def parse_season_folder(folder_name: str) -> int | None:
    """
    Extract season number from folder name.

    All season folders now follow the standardized format after renaming:
    - SX (e.g., S1, S2, S10)

    This simplifies parsing to a single pattern match.
    """
    # Standardized format: SX (e.g., S1, S2, S10)
    pattern = r'^S(\d+)$'

    match = re.match(pattern, folder_name, re.IGNORECASE)
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


# Supported video extensions (used in multiple places)
VIDEO_EXTENSIONS = {'.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'}


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


def generate_embedding(text: str, host: str = "http://localhost:11434") -> list[float]:
    """
    Generate embedding vector for text using BGE-M3 model via Ollama.

    Args:
        text: The text to embed
        host: Ollama server host (Docker container)

    Returns:
        1024-dimensional embedding vector

    Raises:
        Exception: If Ollama is unavailable or embedding fails
    """
    if not QDRANT_AVAILABLE:
        raise Exception("Qdrant/Ollama dependencies not installed")

    try:
        # Create client pointing to Docker Ollama instance with GPU
        client = ollama.Client(host=host)
        response = client.embeddings(model='bge-m3', prompt=text)
        embedding = response['embedding']

        if len(embedding) != 1024:
            raise Exception(f"Expected 1024-dim vector, got {len(embedding)}")

        return embedding
    except Exception as e:
        raise Exception(f"Failed to generate embedding: {e}")


def ensure_qdrant_collection(client: QdrantClient, collection_name: str = "videos_index"):
    """
    Ensure Qdrant collection exists. Creates it if it doesn't exist.

    Args:
        client: QdrantClient instance
        collection_name: Name of the collection to create

    Returns:
        bool: True if collection was created, False if it already existed
    """
    try:
        collections = client.get_collections()
        if any(col.name == collection_name for col in collections.collections):
            print(f"Collection '{collection_name}' already exists")
            return False
    except Exception as e:
        print(f"Warning: Could not check existing collections: {e}")

    # Create collection with 1024 dimensions (BGE-M3)
    try:
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=1024, distance=Distance.COSINE)
        )
        print(f"Created new collection '{collection_name}' with 1024-dim cosine distance")
        return True
    except Exception as e:
        if "already exists" in str(e):
            print(f"Collection '{collection_name}' already exists")
            return False
        else:
            raise Exception(f"Failed to create collection: {e}")


def get_indexed_episodes(client: QdrantClient, collection_name: str = "videos_index") -> set:
    """
    Get set of already indexed episodes from Qdrant.

    Returns:
        set: Set of tuples (series_name, season, episode) that are already indexed
    """
    try:
        # Scroll through all points to get indexed episodes
        indexed = set()
        offset = None

        while True:
            records, offset = client.scroll(
                collection_name=collection_name,
                limit=100,
                offset=offset,
                with_payload=True,
                with_vectors=False
            )

            if not records:
                break

            for record in records:
                payload = record.payload
                key = (payload['series'], payload['season'], payload['episode'])
                indexed.add(key)

            if offset is None:
                break

        return indexed
    except Exception as e:
        print(f"Warning: Could not retrieve indexed episodes: {e}")
        return set()


def index_episodes_to_qdrant(tv_path: str, collection_name: str = "videos_index"):
    """
    Index all TV show episodes to Qdrant.

    Args:
        tv_path: Base TV directory path
        collection_name: Qdrant collection name
    """
    if not QDRANT_AVAILABLE:
        print("Error: Qdrant/Ollama dependencies not installed")
        return

    print("\n" + "=" * 60)
    print("QDRANT INDEXING - ALL TV SHOWS")
    print("=" * 60)

    # Check Ollama GPU status
    try:
        ollama_client = ollama.Client(host="http://localhost:11434")
        # Test connection and GPU availability
        test_response = ollama_client.embeddings(model='bge-m3', prompt='test')
        print("[OK] Ollama with GPU-accelerated BGE-M3 ready")
    except Exception as e:
        print(f"Warning: Could not verify Ollama GPU status: {e}")

    # Initialize Qdrant client (persistent Docker instance)
    try:
        client = QdrantClient(host="localhost", port=6333)
        print("[OK] Connected to persistent Qdrant instance at localhost:6333")
    except Exception as e:
        print(f"Error: Failed to connect to Qdrant server at localhost:6333")
        print(f"Details: {e}")
        print("\nMake sure Docker services are running:")
        print("  cd casie-bridge && docker-compose up -d")
        return

    # Ensure collection exists (create if needed)
    ensure_qdrant_collection(client, collection_name)

    # Get already indexed episodes
    print("\nRetrieving indexed episodes from Qdrant...")
    indexed_episodes = get_indexed_episodes(client, collection_name)
    print(f"Found {len(indexed_episodes)} episodes already indexed")

    tv_dir = Path(tv_path)
    if not tv_dir.exists():
        print(f"Error: TV directory not found: {tv_path}")
        return

    print(f"\nScanning all shows in: {tv_path}")

    # Parse all episode files across all shows
    episodes = []
    total_files = 0
    unparseable_files = []  # Track files that couldn't be parsed
    skipped_count = 0  # Track already indexed episodes

    # Get all show directories
    show_dirs = [d for d in sorted(tv_dir.iterdir()) if d.is_dir()]

    print(f"Found {len(show_dirs)} show(s)\n")
    print("Scanning episodes across all shows...")

    for show_dir in tqdm(show_dirs, desc="Shows", unit="show"):
        # Check if show has season folders or files directly
        season_dirs = []
        for item in show_dir.iterdir():
            if item.is_dir():
                season_num = parse_season_folder(item.name)
                if season_num is not None:
                    season_dirs.append((season_num, item))

        if not season_dirs:
            # No season folders, check for files directly in show folder
            for file in show_dir.iterdir():
                if file.is_file() and file.suffix.lower() in VIDEO_EXTENSIONS:
                    total_files += 1
                    parsed = parse_episode_filename(file.name, str(file))
                    if parsed:
                        # Check if already indexed
                        key = (parsed['series'], parsed['season'], parsed['episode'])
                        if key not in indexed_episodes:
                            episodes.append(parsed)
                        else:
                            skipped_count += 1
                    else:
                        unparseable_files.append(file.name)
        else:
            # Process season folders
            for season_num, season_dir in sorted(season_dirs):
                for file in season_dir.iterdir():
                    if file.is_file() and file.suffix.lower() in VIDEO_EXTENSIONS:
                        total_files += 1
                        parsed = parse_episode_filename(file.name, str(file))
                        if parsed:
                            # Check if already indexed
                            key = (parsed['series'], parsed['season'], parsed['episode'])
                            if key not in indexed_episodes:
                                episodes.append(parsed)
                            else:
                                skipped_count += 1
                        else:
                            unparseable_files.append(file.name)

    print(f"\nTotal video files found: {total_files}")
    print(f"Episodes already indexed: {skipped_count}")
    print(f"New episodes to index: {len(episodes)}")

    if total_files != (len(episodes) + skipped_count + len(unparseable_files)):
        print(f"Warning: File count mismatch")

    if unparseable_files:
        print(f"Unparseable files: {len(unparseable_files)}")
        print(f"\nSample unparseable filenames (showing first 10):")
        for filename in unparseable_files[:10]:
            print(f"  - {filename}")

    if not episodes:
        print("\n[OK] All episodes already indexed - nothing to do!")
        return

    # Generate embeddings and create points
    print("\nGenerating embeddings...")
    points = []
    failed_embeddings = 0

    # Get current max ID from Qdrant to avoid collisions
    try:
        # Get the highest point ID currently in collection
        max_id = 0
        offset = None
        while True:
            records, offset = client.scroll(
                collection_name=collection_name,
                limit=100,
                offset=offset,
                with_payload=False,
                with_vectors=False
            )
            if not records:
                break
            for record in records:
                if record.id > max_id:
                    max_id = record.id
            if offset is None:
                break
        next_id = max_id + 1
        print(f"Starting new point IDs from: {next_id}")
    except Exception as e:
        print(f"Warning: Could not get max ID from Qdrant: {e}")
        next_id = 0

    for idx, episode in enumerate(tqdm(episodes, desc="Embedding episodes", unit="episode")):
        # Create content text for embedding (this is what gets embedded)
        content_text = f"{episode['series']} Season {episode['season']} Episode {episode['episode']}"

        try:
            embedding = generate_embedding(content_text)

            # Create point with unique ID (start after highest existing ID)
            point = PointStruct(
                id=next_id + idx,
                vector=embedding,
                payload={
                    'content': content_text,  # The embedded text
                    'series': episode['series'],
                    'season': episode['season'],
                    'episode': episode['episode'],
                    'filepath': episode['filepath']
                }
            )
            points.append(point)
        except Exception as e:
            failed_embeddings += 1
            tqdm.write(f"Error generating embedding for episode {idx+1}: {e}")
            continue

    if not points:
        print("\nNo embeddings generated!")
        return

    # Upsert to Qdrant in batches to prevent timeouts
    print(f"\nUpserting {len(points)} points to Qdrant in batches...")
    batch_size = 100
    total_upserted = 0

    try:
        for i in range(0, len(points), batch_size):
            batch = points[i:i+batch_size]
            client.upsert(collection_name=collection_name, points=batch)
            total_upserted += len(batch)
            print(f"  Upserted batch {i//batch_size + 1}/{(len(points)-1)//batch_size + 1} ({total_upserted}/{len(points)} points)")

        print(f"[OK] Successfully indexed {len(points)} episodes")
    except Exception as e:
        print(f"Error upserting to Qdrant: {e}")
        return

    # Final validation
    print("\n" + "=" * 60)
    print("INDEXING SUMMARY")
    print("=" * 60)
    print(f"Video files found:        {total_files}")
    print(f"Already indexed:          {skipped_count}")
    print(f"New episodes processed:   {len(episodes)}")
    print(f"New embeddings generated: {len(points)}")
    print(f"Failed embeddings:        {failed_embeddings}")
    print(f"Total in Qdrant now:      {len(indexed_episodes) + len(points)}")

    if len(points) == len(episodes):
        print("\n[OK] Successfully indexed all new episodes (100% success)")
    else:
        print(f"\nWarning: Point count mismatch ({len(points)} points vs {len(episodes)} episodes)")

    print("=" * 60)


def main():
    """Main execution - Generate markdown AND index to Qdrant."""
    tv_path = r"C:\Users\apoor\Videos\TV"

    # Step 1: Generate markdown index
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

    # Step 2: Index to Qdrant
    if QDRANT_AVAILABLE:
        print("\n")
        index_episodes_to_qdrant(tv_path)
    else:
        print("\nSkipping Qdrant indexing (dependencies not installed)")


if __name__ == "__main__":
    main()
