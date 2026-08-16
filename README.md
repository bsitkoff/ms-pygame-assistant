# coach-pygame-zero

Codio Custom Assistant ("PyGame Zero Coach") for 7th grade students learning PyGame Zero at Milton Academy.

It starts a new chat session on every button click, sees the student's open files and assignment guide (re-read before every question, so it always sees their latest edits), and answers questions without writing full solutions. The message history (last 4 exchanges) is kept in context as the conversation continues.

See the top-level `coaches/CLAUDE.md` for the shared architecture all eight coaches follow, and `coaches/codio-custom-assistants.md` for Codio's deployment/release docs. Deploy with `../publish_coaches.sh --publish` (release tags here are unprefixed, e.g. `2.3.0`).
