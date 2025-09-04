# Build stage
# syntax=docker/dockerfile:1.6
FROM docker.io/library/node:20-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 \
  make \
  g++ \
  git \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

# Leverage dependency caching based on lockfile
WORKDIR /home/node/app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN --mount=type=cache,target=/root/.pnpm-store pnpm fetch

# Copy source code
COPY . .

# Install dependencies (offline using fetched store) and build packages with pnpm
RUN --mount=type=cache,target=/root/.pnpm-store pnpm install --frozen-lockfile --offline \
  && pnpm -r build \
  && bash -lc 'cd packages/cli && pnpm pack && mkdir -p dist && mv *.tgz dist/' \
  && bash -lc 'cd packages/core && pnpm pack && mkdir -p dist && mv *.tgz dist/'

# Runtime stage
FROM docker.io/library/node:20-slim

ARG SANDBOX_NAME="null-sandbox"
ARG CLI_VERSION_ARG
ENV SANDBOX="$SANDBOX_NAME"
ENV CLI_VERSION=$CLI_VERSION_ARG

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 \
  man-db \
  curl \
  dnsutils \
  less \
  jq \
  bc \
  gh \
  git \
  unzip \
  rsync \
  ripgrep \
  procps \
  psmisc \
  lsof \
  socat \
  ca-certificates \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Using npm in runtime layer for global install is fine

# Copy built packages from builder stage
COPY --from=builder /home/node/app/packages/cli/dist/*.tgz /tmp/
COPY --from=builder /home/node/app/packages/core/dist/*.tgz /tmp/

# Install built packages globally
RUN npm install -g /tmp/*.tgz \
  && npm cache clean --force \
  && rm -rf /tmp/*.tgz

# Default entrypoint when none specified
CMD ["null"]
