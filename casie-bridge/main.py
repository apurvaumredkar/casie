"""
CASIE Bridge - FastAPI Application
A simple FastAPI server that acts as a bridge for CASIE bot operations.
This server runs locally and is exposed via Cloudflare Tunnel.
"""

import os
from pathlib import Path
from fastapi import FastAPI, HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

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

# Security scheme
security = HTTPBearer()

app = FastAPI(title="CASIE Bridge", version="1.0.0")


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
