"""
CASIE Bridge - FastAPI Application
A simple FastAPI server that acts as a bridge for CASIE bot operations.
This server runs locally and is exposed via Cloudflare Tunnel.
"""

import os
import subprocess
from pathlib import Path
from fastapi import FastAPI, HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

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


