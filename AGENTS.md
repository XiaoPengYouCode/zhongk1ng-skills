# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository purpose

Personal Claude Code skills repository. Skills extend Claude Code with specialized capabilities, domain knowledge, and tool integrations.

## Skill format

Each skill is a directory with a `SKILL.md` file containing YAML frontmatter:

```yaml
---
name: skill-name
description: "One-line description"
when_to_use: "触发词 / keywords for auto-activation"
user-invocable: true      # if the user can call /skill-name
allowed-tools: ["Bash", "Read"]  # restrict tools if needed
argument-hint: "[--flag]"  # optional
---
# Skill title

Markdown instructions that guide Claude Code when the skill is invoked.
```

Optional skill subdirectories:
- `scripts/` — executable scripts the skill may call
- `agents/` — sub-agents used by the skill
- `references/` — reference files loaded as context
- `prompts/` — reusable prompt templates
- `tools/` — tool definitions

## Skill categories

**Feishu suite (lark-*)** — 14 skills covering the full Feishu/Lark platform: lark-im (messaging), lark-calendar (calendar/meetings), lark-doc (documents), lark-sheets (spreadsheets), lark-base (multidimensional tables), lark-wiki (knowledge base), lark-drive (cloud space), lark-mail (email), lark-vc (video conferencing), lark-minutes (meeting minutes), lark-event (WebSocket event subscription), lark-whiteboard (whiteboards), lark-workflow-meeting-summary, lark-contact (contacts).

**Shared Feishu internals** — `lark-shared` contains common utilities used by lark-* skills (API client, auth, etc.).

**Core utility skills** — `check` (code review), `think` (planning/architecture), `hunt` (root cause analysis), `design` (UI generation), `write` (prose rewriting), `learn` (research workflow), `read` (web/PDF fetching), `health` (config auditing).

**Workflow skills** — `claude日报` (daily work journal in Chinese), `prd-read-impl-test` (PRD pipeline: read → implement → test → review), `create-colleague` (distill colleague into AI skill), `lark-workflow-standup-report`.

**Dev tools** — `gh-stack` (stacked PR management), `uv-package-manager`, `agent-browser`.

## Installation

Skills are symlinked into `~/.claude/skills/`:

```bash
ln -s /path/to/zhongk1ing-skills/<skill-name> ~/.claude/skills/<skill-name>
```

Many skills in this repo are installed via `~/.agents/skills/` and symlinked from `~/.claude/skills/`. The `update-config` skill manages `~/.claude/settings.json` for hook and permission configuration.

## Adding a new skill

1. Create a directory with the skill name
2. Add `SKILL.md` with required frontmatter (`name`, `description`, `when_to_use`)
3. Add `scripts/`, `references/`, or `agents/` subdirectories as needed
4. Symlink from `~/.claude/skills/<name>` to the skill directory
5. If the skill needs tool permissions, configure them in `~/.claude/settings.json`
