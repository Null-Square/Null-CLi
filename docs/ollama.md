# Ollama (OpenAI-compatible) Setup

Use Ollama to run local models and connect Null CLI over an OpenAI-compatible HTTP API. This works whether Null runs on your host or inside Docker.

## Prerequisites

- Install Ollama on the host: https://ollama.com/download
- Ensure the Ollama service is running (`ollama serve` usually starts automatically)

## Pull and Run a Model

Examples (pick any model you prefer):

```powershell
# Windows PowerShell examples
ollama pull llama3.1:8b
ollama pull qwen2.5-coder:7b

# Start a chat locally to verify things work
ollama run llama3.1:8b "Say hello"
```

Note: Model names vary; use `ollama list` to see what you have locally.

## Configure Null CLI

Inside Null CLI, run `/auth` and choose the OpenAI-compatible option (named â€œLocal DeepSeek (OpenAI-compatible)â€ in current UI). Enter:

- Base URL: `http://localhost:11434/v1`
- Model: the exact Ollama model name (e.g., `llama3.1:8b`) use `ollama list`
- API key: any non-empty value if required by your setup; most local Ollama installs accept any token. You can leave it blank if not required.



## Use Null CLI in Docker, Connect to Host Ollama

When the CLI runs in Docker but Ollama runs on the host, point the CLI at the host from inside the container:

- Windows/macOS: `host.docker.internal` works by default
- Linux: add a host entry or use the Docker gateway IP

Examples:

```powershell
# Windows/macOS - map to host Ollama
docker run --rm -it `
  -e NULL_EXPERIMENTAL_LOCAL=1 `
  -e OPENAI_BASE_URL=http://host.docker.internal:11434/v1 `
  -e OPENAI_MODEL=llama3.1:8b `
  -v "${PWD}:/workspace" -w /workspace `
  null-cli:local null



docker-compose.yml tip (Linux):

```yaml
services:
  null:
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      - NULL_EXPERIMENTAL_LOCAL=1
      - OPENAI_BASE_URL=http://host.docker.internal:11434/v1
      - OPENAI_MODEL=llama3.1:8b
```

## Security Notes

- Ollamaâ€™s API is local by default and typically unauthenticated. Do not expose `11434` to untrusted networks.
- For remote access, front Ollama with a reverse proxy that adds auth (e.g., Caddy/Traefik/Nginx) or use a secure tunnel/VPN.
- If you put Ollama behind an OpenAI-compatible proxy, set `OPENAI_BASE_URL` to that proxy instead.


