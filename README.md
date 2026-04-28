# zhongk1ng-skills

Personal Claude Code skills repository.

## Skills

- **plain-speech** -- 对落盘文档做二次清洗，删掉绕路语法，改成直接、自然的表达。
- **trip-planner** -- 私人出行规划：结合实时票务、假日安排和请假成本，给出最优方案。

## Structure

Each skill is a directory containing a `SKILL.md` with YAML frontmatter, plus optional `scripts/`, `references/`, and `agents/` subdirectories.

## Installation

```bash
ln -s /path/to/zhongk1ng-skills/<skill-name> ~/.claude/skills/<skill-name>
```
