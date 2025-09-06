# Orangepie Tool (`orangepie`)

Runs Evilginx2 (or Evilginx) with safe, confirm-first wrappers to manage phishlets, lures, sessions, and proxy/developer modes.

Note: Evilginx typically requires privileged ports (80/443). On Linux, run as root or grant capabilities (e.g., `setcap cap_net_bind_service=+ep $(which evilginx2)`), and ensure phishlet/config paths are accessible.

## Modes

- phishlet: manage phishlets (e.g., `get-hosts`, `enable`, `disable`)
- lure: manage lures (e.g., `create`, `get-url`)
- session: manage sessions (e.g., `list`, `remove <id>`)
- proxy: start/stop proxy
- developer: developer helpers

## Parameters

- `mode` (enum, required): `phishlet|lure|session|proxy|developer`
- `command` (string, optional): subcommand for the mode
- `phishlet` (string, optional): name for phishlet mode
- `domain` (string, optional): domain for lure create
- `redirect_url` (string, optional): redirect url for lure create
- `hide_form` (boolean, optional): hide form for lure create
- `session_id` (string, optional): session id for session ops
- `verbose` (boolean, optional): adds `-debug`
- `binary` (enum, optional): `evilginx2` or `evilginx` (forces binary name)
- `cwd` (string, optional): working directory to run from (phishlets/config path)

## Examples

- Get hosts for a phishlet:
```
{
  "mode": "phishlet",
  "command": "get-hosts",
  "phishlet": "github"
}
```

- Create a lure:
```
{
  "mode": "lure",
  "command": "create",
  "domain": "example.com",
  "redirect_url": "https://example.com/login",
  "hide_form": true
}
```

- Start proxy (debug) using binary fallback to `evilginx` and a custom cwd:
```
{
  "mode": "proxy",
  "command": "start",
  "verbose": true,
  "binary": "evilginx",
  "cwd": "/opt/evilginx"
}
```

## Notes

- Confirms before execution and shows the full command.
- On Linux, some packages install the binary as `evilginx` (not `evilginx2`). The tool auto-falls back to `evilginx` if `evilginx2` is not found.
- Ensure DNS, TLS certificates, and phishlet files are correctly configured in the working directory.

