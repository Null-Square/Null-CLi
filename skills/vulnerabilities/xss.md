---
slug: vuln-xss-basic
name: Basic XSS review
description: Shallow public guidance for evidence-backed XSS reporting.
category: vulnerability
---

Look for reflected or stored script execution only within the declared target.

Evidence floor:

- A request URL or form path.
- The reflected or stored input location.
- A safe proof such as a harmless marker or browser-observed DOM behavior.

Do not submit aggressive payloads, steal cookies, or attempt account compromise.
