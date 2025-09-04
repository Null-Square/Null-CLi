# Local DeepSeek R1 (OpenAI-compatible)

This guide runs DeepSeek R1 locally and exposes an OpenAI-compatible API so Null CLI can connect via the “Local DeepSeek (OpenAI-compatible)” auth option.

Important: You are responsible for complying with the model license and any “uncensored” distribution terms. If the model requires gated access, you’ll need a valid Hugging Face token.

## Requirements

- NVIDIA GPU with recent drivers (recommended for performance)
- Docker and NVIDIA Container Toolkit (`--gpus all`)
- A DeepSeek R1 “uncensored” model you’re authorized to use (Hugging Face ID or local path)
### Option A :Pre-download to local path (no token inside Docker)

If the repo is gated, you can still avoid prompts inside Docker by downloading on the host first and serving from a local path.


Windows (PowerShell):

```powershell
pip install "huggingface_hub[cli]"
hf login  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
hf download `
  --repo-type model `
  huihui-ai/DeepSeek-R1-Distill-Qwen-1.5B-abliterated `
  --local-dir .\models\deepseek-r1-8B `
  --local-dir-use-symlinks False

docker run --rm -it `
  --gpus all `
  --ipc=host `
  -p 8000:8000 `
  -v ${PWD}\models:/models `
  vllm/vllm-openai:latest `
  --model /models/deepseek-r1-8B `
  --served-model-name deepseek-r1-8B `
  --host 0.0.0.0 `
  --port 8000 `
  --trust-remote-code `
  --dtype float16 `
  --gpu-memory-utilization 0.5 `
  --dtype float16 `
  --max-model-len 2048  `
  --max-num-seqs 1 `
  --enforce-eager`
  --enable-auto-tool-choice `
 --tool-call-parser qwen3_coder

```
## Option B: vLLM (OpenAI-compatible server)

vLLM exposes an OpenAI-compatible endpoint at `/v1` out of the box.

Example docker run (downloads from Hugging Face):
This repo ID matches the Hugging Face page variant you referenced. It typically does not require a separate revision flag; use the default branch unless the model card states otherwise.

Docker (PowerShell):

```powershell
docker run --rm -it `
  --gpus all `
  --ipc=host `
  -p 8000:8000 `
  -e HUGGING_FACE_HUB_TOKEN=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`
  vllm/vllm-openai:latest `
  --model huihui-ai/DeepSeek-R1-Distill-Qwen-1.5B-abliterated `
  --served-model-name deepseek-r1 `
  --host 0.0.0.0 `
  --port 8000 `
  --trust-remote-code `
  --dtype float16 `
  --gpu-memory-utilization 0.5 `
  --dtype float16 `
  --max-model-len 2048  `
  --max-num-seqs 1 `
  --enforce-eager
```



## Docker Compose (Null CLI + DeepSeek)

A ready-to-run compose file is provided at the repo root: `docker-compose.yml`.

- Starts two services:
  - `deepseek`: vLLM serving DeepSeek R1 on `http://localhost:8000/v1`
  - `null`: the Null CLI, preconfigured to talk to `deepseek`

Usage:

```bash
# Optional if the HF repo is gated
export HUGGING_FACE_HUB_TOKEN=hf_...

# Build the Null CLI image and start both containers
docker compose up --build

# Or start model only, then run CLI on demand
docker compose up -d deepseek
docker compose run --rm null
```

Notes:
- GPU required: Docker Engine + NVIDIA Container Toolkit. Compose requests GPU via `deploy.resources.reservations.devices`.
- The compose mounts a named volume `hf-cache` to persist HF downloads.
- To serve from a pre-downloaded local directory, uncomment `./models:/models` and change the `deepseek` command to `--model /models/deepseek-r1`.


Check the server’s docs for exact flags and compatibility with your GGUF.
