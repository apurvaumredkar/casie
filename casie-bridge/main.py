"""
CASIE Bridge - FastAPI Application
A simple FastAPI server that acts as a bridge for CASIE bot operations.
This server runs locally and is exposed via Cloudflare Tunnel.
"""

import os
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from fastapi import FastAPI, HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import httpx

# Load environment variables
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ[key.strip()] = value.strip()

# Get API token from environment
API_AUTH_TOKEN = os.getenv("API_AUTH_TOKEN")
if not API_AUTH_TOKEN:
    raise ValueError("API_AUTH_TOKEN not set in .env file")

# Cloudflare KV configuration (optional - for syncing location data)
CLOUDFLARE_ACCOUNT_ID = os.getenv("CLOUDFLARE_ACCOUNT_ID")
CLOUDFLARE_API_TOKEN = os.getenv("CLOUDFLARE_API_TOKEN")
KV_NAMESPACE_ID = os.getenv("KV_NAMESPACE_ID")

KV_SYNC_ENABLED = all([CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, KV_NAMESPACE_ID])
if not KV_SYNC_ENABLED:
    print("Warning: Cloudflare KV credentials not configured. Location sync to KV disabled.")

# Security scheme
security = HTTPBearer()

app = FastAPI(title="CASIE Bridge", version="1.0.0")


async def sync_location_to_kv(location_data: dict) -> bool:
    """
    Sync location data to Cloudflare KV for use by GitHub Actions weather CRON.
    Returns True if successful, False if failed or disabled.
    """
    if not KV_SYNC_ENABLED:
        return False

    try:
        url = f"https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/{KV_NAMESPACE_ID}/values/location_cache"
        headers = {
            "Authorization": f"Bearer {CLOUDFLARE_API_TOKEN}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient() as client:
            response = await client.put(url, json=location_data, headers=headers, timeout=10.0)
            response.raise_for_status()
            print(f"Successfully synced location data to Cloudflare KV")
            return True
    except Exception as e:
        print(f"Failed to sync location to KV: {e}")
        return False


def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> str:
    """
    Verify the Bearer token from the Authorization header.
    Raises HTTPException if token is invalid.
    """
    if credentials.credentials != API_AUTH_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials


@app.get("/")
def root(token: str = Security(verify_token)):
    """Health check endpoint (requires authentication)"""
    return {"ok": True, "service": "CASIE Bridge"}


@app.get("/health")
def health(token: str = Security(verify_token)):
    """Detailed health check endpoint (requires authentication)"""
    return {
        "status": "healthy",
        "service": "CASIE Bridge",
        "version": "1.0.0",
        "authenticated": True
    }


@app.get("/videos")
def videos(token: str = Security(verify_token)):
    """
    Get TV shows index from videos.md file.
    Returns the markdown content of available TV shows.
    """
    videos_file = Path(__file__).parent / "videos.md"

    if not videos_file.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Videos index not found. Run videos.py to generate it."
        )

    try:
        with open(videos_file, 'r', encoding='utf-8') as f:
            content = f.read()

        return {
            "ok": True,
            "content": content,
            "file": "videos.md"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading videos index: {str(e)}"
        )


@app.get("/location")
async def location(token: str = Security(verify_token)):
    """
    Get cached location data from ip-api.com.
    Returns location data with 3-hour cache TTL.
    Auto-refreshes cache when expired or missing.
    """
    location_file = Path(__file__).parent / "location.json"
    cache_ttl_hours = 3

    # Check if cache exists and is fresh
    if location_file.exists():
        try:
            with open(location_file, 'r', encoding='utf-8') as f:
                cached_data = json.load(f)

            # Check cache age
            last_updated = datetime.fromisoformat(cached_data.get("last_updated", ""))
            age_hours = (datetime.now(timezone.utc) - last_updated).total_seconds() / 3600

            if age_hours < cache_ttl_hours:
                # Cache is fresh, return it
                return {
                    "ok": True,
                    "location": cached_data.get("location"),
                    "cached": True,
                    "last_updated": cached_data.get("last_updated"),
                    "age_hours": round(age_hours, 2)
                }
        except (json.JSONDecodeError, KeyError, ValueError):
            # Cache is corrupted, will fetch fresh data
            pass

    # Fetch fresh location data
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "http://ip-api.com/json/?fields=status,country,regionName,city,zip,lat,lon,timezone,offset",
                timeout=10.0
            )
            response.raise_for_status()
            location_data = response.json()

        # Check if API returned an error
        if location_data.get("status") == "fail":
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"IP API error: {location_data.get('message', 'Unknown error')}"
            )

        # Save to cache
        now = datetime.now(timezone.utc).isoformat()
        cache_data = {
            "location": location_data,
            "last_updated": now
        }

        with open(location_file, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, indent=2)

        # Sync location data to Cloudflare KV (async, non-blocking)
        await sync_location_to_kv(location_data)

        return {
            "ok": True,
            "location": location_data,
            "cached": False,
            "last_updated": now,
            "age_hours": 0
        }

    except httpx.HTTPError as e:
        # If fetch fails and we have stale cache, return it with warning
        if location_file.exists():
            try:
                with open(location_file, 'r', encoding='utf-8') as f:
                    cached_data = json.load(f)

                return {
                    "ok": True,
                    "location": cached_data.get("location"),
                    "cached": True,
                    "stale": True,
                    "last_updated": cached_data.get("last_updated"),
                    "warning": "Using stale cache due to API error"
                }
            except:
                pass

        # No cache and API failed
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch location data: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving location: {str(e)}"
        )


# Request models
class OpenFileRequest(BaseModel):
    path: str


@app.post("/open")
def open_file(request: OpenFileRequest, token: str = Security(verify_token)):
    """
    Open a file using the default Windows application.
    Uses 'start' command on Windows to open files with their associated programs.
    """
    file_path = request.path

    # Validate that the path exists
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found: {file_path}"
        )

    try:
        # Use Windows 'start' command to open the file with default application
        # shell=True is required for 'start' command on Windows
        subprocess.Popen(["cmd", "/c", "start", "", file_path], shell=False)

        return {
            "ok": True,
            "path": file_path,
            "message": "File opened successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to open file: {str(e)}"
        )


@app.post("/lock")
def lock_pc(token: str = Security(verify_token)):
    """
    Lock the Windows PC (equivalent to Win+L).
    Uses rundll32.exe to call the LockWorkStation function.
    """
    try:
        # Lock the workstation using rundll32
        # This is the programmatic equivalent of pressing Win+L
        subprocess.Popen(
            ["rundll32.exe", "user32.dll,LockWorkStation"],
            shell=False
        )

        return {
            "ok": True,
            "message": "PC locked successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to lock PC: {str(e)}"
        )


@app.post("/restart")
def restart_pc(token: str = Security(verify_token)):
    """
    Restart the Windows PC.
    Uses shutdown command with restart flag.
    """
    try:
        # Restart the PC with a 0 second delay
        # /r = restart, /t 0 = timeout 0 seconds, /f = force close apps
        subprocess.Popen(
            ["shutdown", "/r", "/t", "0", "/f"],
            shell=False
        )

        return {
            "ok": True,
            "message": "PC restart initiated"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to restart PC: {str(e)}"
        )


@app.post("/shutdown")
def shutdown_pc(token: str = Security(verify_token)):
    """
    Shutdown the Windows PC.
    Uses shutdown command with shutdown flag.
    """
    try:
        # Shutdown the PC with a 0 second delay
        # /s = shutdown, /t 0 = timeout 0 seconds, /f = force close apps
        subprocess.Popen(
            ["shutdown", "/s", "/t", "0", "/f"],
            shell=False
        )

        return {
            "ok": True,
            "message": "PC shutdown initiated"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to shutdown PC: {str(e)}"
        )


@app.post("/sleep")
def sleep_pc(token: str = Security(verify_token)):
    """
    Put the Windows PC to sleep.
    Uses rundll32 to call SetSuspendState function.
    """
    try:
        # Put PC to sleep using powercfg
        # This uses the Windows power configuration command
        subprocess.Popen(
            ["rundll32.exe", "powrprof.dll,SetSuspendState", "0", "1", "0"],
            shell=False
        )

        return {
            "ok": True,
            "message": "PC sleep initiated"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to put PC to sleep: {str(e)}"
        )


