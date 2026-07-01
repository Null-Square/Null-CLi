#!/usr/bin/env bash
# NullSquare — Null AI CLI installer
# Usage: curl -fsSL https://raw.githubusercontent.com/Null-Square/Null-CLi/main/scripts/install.sh | bash
set -euo pipefail

PKG="@nullsquare/null-cli"
YELLOW='\033[38;2;245;209;58m'
DIM='\033[2m'
RED='\033[38;2;229;72;77m'
GREEN='\033[38;2;47;178;122m'
NC='\033[0m'

printf "%b\n" "${YELLOW}NULLSQUARE${NC} ${DIM}· Null AI CLI installer${NC}"

if ! command -v node >/dev/null 2>&1; then
  printf "%b\n" "${RED}error${NC} Node.js is required (>=20). Install from https://nodejs.org and retry." >&2
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "${NODE_MAJOR}" -lt 20 ]; then
  printf "%b\n" "${RED}error${NC} Node.js >=20 required, found $(node -v)." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  printf "%b\n" "${RED}error${NC} npm is required but was not found." >&2
  exit 1
fi

printf "%b\n" "${DIM}Installing ${PKG} globally via npm...${NC}"
npm install -g "${PKG}"

printf "%b\n" "${GREEN}installed${NC} Run ${YELLOW}null-ai --help${NC} to get started."
printf "%b\n" "${DIM}Managed platform → https://nullsquare.net${NC}"
