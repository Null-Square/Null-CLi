FROM golang:1.25-bookworm

ENV DEBIAN_FRONTEND=noninteractive
ENV GOBIN=/usr/local/bin

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    jq \
    nmap \
    nodejs \
    npm \
    python3 \
    python3-pip \
    python3-venv \
    unzip \
    && rm -rf /var/lib/apt/lists/*

RUN go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest \
    && go install github.com/projectdiscovery/httpx/cmd/httpx@latest \
    && go install github.com/projectdiscovery/katana/cmd/katana@latest \
    && go install github.com/zricethezav/gitleaks/v8@latest

RUN python3 -m venv /opt/null-cli-venv \
    && /opt/null-cli-venv/bin/pip install --no-cache-dir semgrep \
    && ln -s /opt/null-cli-venv/bin/semgrep /usr/local/bin/semgrep

RUN curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin

WORKDIR /workspace

CMD ["bash"]
