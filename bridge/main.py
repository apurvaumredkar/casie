"""
CASIE Bridge - FastAPI Application with ngrok Tunnel
A Python daemon that runs FastAPI server + ngrok tunnel for CASIE bot operations.
This server runs locally on Windows and is exposed via ngrok static domain.
"""

import os
import sys
import signal
import logging
import subprocess
import threading
from pathlib import Path
from fastapi import FastAPI, HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import uvicorn
from pyngrok import ngrok, conf

# Configure logging (stdout only - no log files)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("casie-bridge")

# Load environment variables
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    logger.info("Loading environment variables from .env")
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ[key.strip()] = value.strip()
else:
    logger.error(".env file not found")
    sys.exit(1)

# Get configuration from environment
API_AUTH_TOKEN = os.getenv("API_AUTH_TOKEN")
NGROK_AUTHTOKEN = os.getenv("NGROK_AUTHTOKEN")
NGROK_DOMAIN = os.getenv("NGROK_DOMAIN")

if not API_AUTH_TOKEN:
    logger.error("API_AUTH_TOKEN not set in .env file")
    sys.exit(1)

if not NGROK_AUTHTOKEN:
    logger.error("NGROK_AUTHTOKEN not set in .env file")
    sys.exit(1)

if not NGROK_DOMAIN:
    logger.error("NGROK_DOMAIN not set in .env file")
    sys.exit(1)

# Security scheme
security = HTTPBearer()

# FastAPI app
app = FastAPI(title="CASIE Bridge", version="2.0.0")

# Global tunnel reference for cleanup
tunnel = None


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
    return {"ok": True, "service": "CASIE Bridge", "version": "2.0.0"}


@app.get("/health")
def health(token: str = Security(verify_token)):
    """Detailed health check endpoint (requires authentication)"""
    return {
        "status": "healthy",
        "service": "CASIE Bridge",
        "version": "2.0.0",
        "authenticated": True,
        "tunnel": "ngrok"
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

    logger.info(f"Opening file: {file_path}")

    # Validate that the path exists
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found: {file_path}"
        )

    try:
        # Use Windows 'start' command to open the file with default application
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


def start_ngrok_tunnel():
    """Start ngrok tunnel with static domain and hide console window on Windows."""
    global tunnel

    try:
        logger.info("Configuring ngrok...")
        conf.get_default().auth_token = NGROK_AUTHTOKEN
        conf.get_default().region = "us"

        # On Windows, pyngrok spawns a new ngrok.exe window — this forces it hidden
        if os.name == "nt":
            import pyngrok.process
            import subprocess

            original_popen = subprocess.Popen

            def hidden_popen(*args, **kwargs):
                # Hide the window
                si = subprocess.STARTUPINFO()
                si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                kwargs["startupinfo"] = si
                kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
                return original_popen(*args, **kwargs)

            pyngrok.process.subprocess.Popen = hidden_popen

        logger.info(f"Starting ngrok tunnel to localhost:8000 with domain: {NGROK_DOMAIN}")
        tunnel = ngrok.connect(
            addr=8000,
            proto="http",
            domain=NGROK_DOMAIN,
            bind_tls=True
        )

        tunnel_url = tunnel.public_url
        logger.info(f"[OK] ngrok tunnel established: {tunnel_url}")
        logger.info("CASIE Bridge is now accessible via ngrok!")
        return tunnel_url

    except Exception as e:
        logger.error(f"Failed to start ngrok tunnel: {e}")
        sys.exit(1)



def stop_ngrok_tunnel():
    """Stop ngrok tunnel"""
    global tunnel

    if tunnel:
        try:
            logger.info("Stopping ngrok tunnel...")
            ngrok.disconnect(tunnel.public_url)
            logger.info("[OK] ngrok tunnel stopped")
        except Exception as e:
            logger.error(f"Error stopping ngrok tunnel: {e}")


def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    logger.info(f"Received signal {signum}, shutting down...")
    stop_ngrok_tunnel()
    sys.exit(0)


def main():
    """Main entry point for CASIE Bridge daemon"""
    logger.info("========================================")
    logger.info("   CASIE Bridge Starting...")
    logger.info("========================================")
    logger.info(f"Version: 2.0.0")
    logger.info(f"FastAPI Port: 8000")
    logger.info(f"ngrok Domain: {NGROK_DOMAIN}")
    logger.info("")

    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Start ngrok tunnel in background thread
    tunnel_thread = threading.Thread(target=start_ngrok_tunnel, daemon=True)
    tunnel_thread.start()

    # Wait a moment for tunnel to establish
    import time
    time.sleep(3)

    logger.info("Starting FastAPI server...")
    logger.info("========================================")

    # Start FastAPI server (blocking call)
    try:
        uvicorn.run(
            app,
            host="127.0.0.1",
            port=8000,
            log_level="critical",
            access_log=False,
            log_config=None
        )
    except Exception as e:
        logger.error(f"FastAPI server error: {e}")
        stop_ngrok_tunnel()
        sys.exit(1)


if __name__ == "__main__":
    main()
