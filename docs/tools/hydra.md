# Hydra Tool (`hydra_bruteforce`)



## Safety & Defaults

- Single target only (no lists)
- Low concurrency by default (`-t 4`), small wait between retries (`-w 2`)
- Stops on first success by default (`-f`)
- Verbose output enabled (`-V`) for clear evidence lines

## Parameters

- `target` (string, required): Hostname or IP; no wildcards
- `service` (enum, required): One of `ssh`, `ftp`, `telnet`, `smtp`, `imap`, `pop3`, `rdp`, `smb`
- `port` (number, optional): Explicit port (`-s`)
- `username` (string, optional): Single user (`-l`)
- `user_list` (string, optional): Path to username list (`-L`)
- `password` (string, optional): Single password (`-p`)
- `password_list` (string, optional): Path to password list (`-P`)
- `tasks` (number, optional): Parallel tasks (`-t`, default 4)
- `wait_time` (number, optional): Wait seconds between retries (`-w`, default 2)
- `exit_on_success` (boolean, optional): Stop on first success (`-f`, default true)
- `verbose` (boolean, optional): Verbose output (`-V`, default true)

At least one of `username`/`user_list` and one of `password`/`password_list` must be provided.

## Example

Tool: hydra_bruteforce

Params:

```
{
  "target": "10.0.0.5",
  "service": "ssh",
  "user_list": "wordlists/users.txt",
  "password_list": "wordlists/rockyou-1000.txt",
  "tasks": 4,
  "wait_time": 2,
  "exit_on_success": true
}
```

## Notes

- Ensure `hydra` is installed and on PATH. On Windows, `hydra.exe` should be available.
- Respect client ROE: rate limits, account lockout policies, and maintenance windows.
- Evidence lines typically include `login:` and `password:` when credentials are found.

