(async function(codioIDE, window) {

  const VERSION = "2.4.1";

  const systemPrompt = `You are a friendly and helpful coding coach for 7th grade students learning PyGame Zero for the first time.

PyGame Zero basics for our classroom:
- Use "import pgzrun" at the top and "pgzrun.go()" at the bottom to run games.
- WIDTH and HEIGHT constants must be defined in each program.
- Standard functions: draw() to render, update(dt) to update game state, on_mouse_down(pos) for clicks, on_key_down(key) for key presses.
- Actor objects: alien = Actor('alien'), positioned via alien.pos or alien.x / alien.y.
- Collision detection: alien.collidepoint(pos), actor.colliderect(other_actor).
- Images go in the "images" folder.
- Screen methods: screen.clear(), screen.draw.text(), screen.fill().
- Timing: clock.schedule(), clock.schedule_unique().
- IMPORTANT: Sound and music do not work in Codio.

When helping students:
- Keep responses short — 2-3 sentences for simple questions, a short paragraph for bigger concepts.
- Use plain language: "This line tells PyGame to draw your character at..." not "This invokes the rendering pipeline..."
- Be encouraging: "Great question!", "You're really close!", "Nice start!"
- Always look at the student's actual code (in <files> tags) before answering.
- Reference the assignment guide (in <guide> tags) to understand what they're working on.

What you CAN do:
- Explain what an error message means in plain language.
- Point out bugs in their code and suggest specific fixes.
- Write short example snippets (3-5 lines) that show how a PyGame Zero concept works, with explanations.
- Help them think through game logic step by step.

What you CANNOT do:
- Write complete games or full solutions to assignments.
- Do their homework for them. If they ask, say: "I can't write that for you, but let me help you figure it out! What part are you stuck on?"
- Answer questions outside of course content.

## Diagnosing vs. solving

There are two very different kinds of help, and you should treat them differently.

**Diagnosing — be direct and specific. Point right at the problem:**
- Error messages and tracebacks (NameError, AttributeError, IndentationError, etc.) — explain what the error is saying in plain English and point to the exact line.
- Typos in function/method names (e.g. Actor vs actor, on_key_down vs on_keydown, draw() vs Draw()).
- Missing WIDTH/HEIGHT constants, or a missing "pgzrun.go()" at the bottom.
- Code placed after pgzrun.go() (it never runs).

For these, just tell them what's wrong and where. They can fix it themselves once they see it.

**Solving — make THEM do the work:**
- "How do I make the alien move?" / "How do I detect a collision?" / "How do I add a score?" / "How do I make the game restart?" — these are design questions, not bug questions. Don't write the answer. Teach the concept, then ask them to try.
- "Can you write update() for me?" — no. Walk them through what update() should do in plain English, one step at a time.
- "Make my game work" — break it into the smallest first step ("Let's start with just getting the alien to move right. What variable would change every frame?") and only help with that one step.`;

  const exitPhrases = ["thanks", "thank you", "bye", "done", "exit", "quit", "stop", "no thanks", "i'm good", "im good", "that's all", "thats all"];

  codioIDE.coachBot.register("pygameZeroHelp", "PyGame Zero Coach", onButtonPress);

  // Build the context-bearing first message from a fresh getContext() read.
  // Re-run before every ask() so the coach sees the student's latest edits,
  // not their code as of the button press.
  async function buildContextMessage(initialInput) {
    const context = await codioIDE.coachBot.getContext();

    const filesContent = (context.files && context.files.length > 0)
      ? context.files.map(f => `File: ${f.path}\n${f.content}`).join('\n\n')
      : "No files available.";

    const guideContent = (context.guidesPage && context.guidesPage.content && context.guidesPage.content.trim().length > 0)
      ? context.guidesPage.content.trim()
      : "No guide available.";

    const assignmentName = (context.assignmentData && context.assignmentData.name)
      ? context.assignmentData.name
      : null;

    return `Here are the student's files (current as of their latest question):
<files>
${filesContent}
</files>
Here is the assignment guide:
<guide>
${guideContent}
</guide>
${assignmentName ? `\nAssignment: ${assignmentName}\n` : ''}
The student says: ${initialInput}`;
  }

  // ============================================================
  // Session log — a hidden, shared workspace file (.coach-log.json) that every
  // coach appends to (one entry per session, tagged with `coach`), summarizing
  // how students use the coaches. Dot-prefixed so it never enters the LLM
  // context. Deliberately records the student's questions: Codio's own course
  // coach-log export logs only the userPrompt field, which is empty for
  // messages-based coaches like these — this file is where the questions live.
  // Sessions are never dropped (always appended). Logging is wrapped so it can
  // never break the coach.
  // ============================================================

  const SESSION_LOG_PATH = ".coach-log.json";
  const COACH_ID = "pygame-zero";
  const MAX_LOGGED_QUESTIONS = 50;

  async function loadSessionHistory() {
    const F = codioIDE.files;
    if (!F || typeof F.getContent !== "function") return [];
    try {
      const parsed = JSON.parse(await F.getContent(SESSION_LOG_PATH));
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  async function saveSessionHistory(history) {
    const F = codioIDE.files;
    if (!F || typeof F.add !== "function") return;
    const text = JSON.stringify(history, null, 2);
    try {
      await F.add(SESSION_LOG_PATH, text);
    } catch (e) {
      // add() rejects when the file exists — delete and re-add
      try {
        if (typeof F.deleteFiles !== "function") return;
        await F.deleteFiles([SESSION_LOG_PATH]);
        await F.add(SESSION_LOG_PATH, text);
      } catch (e2) {
        // Logging must never break the coach
      }
    }
  }

  // Never block the conversation on a log write — shared pattern, see the coaches
  // CLAUDE.md "Session Logging". saveSessionHistory() is a full read-modify-rewrite
  // (deleteFiles + add) of the shared log; awaiting it in the turn loop means a
  // stalled write freezes the coach with no input box. queueSave() serializes
  // writes on a promise chain (overlapping fire-and-forget saves can't corrupt the
  // file) and is called WITHOUT await each turn; only the end-of-session flush is awaited.
  let saveChain = Promise.resolve();
  function queueSave(history) {
    saveChain = saveChain.then(function() { return saveSessionHistory(history); }).catch(function() {});
    return saveChain;
  }


  async function onButtonPress() {
    codioIDE.coachBot.write(
      `PyGame Zero Coach v${VERSION} - Ask me questions about PyGame Zero!`,
      codioIDE.coachBot.MESSAGE_ROLES.ASSISTANT
    );

    let messages = [];

    let initialInput;
    while (true) {
      try {
        initialInput = await codioIDE.coachBot.input("What's your PyGame Zero question?");
      } catch (e) {
        codioIDE.coachBot.showMenu();
        return;
      }

      if (initialInput === "version") {
        codioIDE.coachBot.write(`Current version: ${VERSION}`, codioIDE.coachBot.MESSAGE_ROLES.ASSISTANT);
        continue;
      }

      break;
    }

    const sessionHistory = await loadSessionHistory();
    const session = {
      coach: COACH_ID,
      started: new Date().toISOString(),
      updated: null,
      ended: null,
      coachVersion: VERSION,
      exchanges: 0,
      questions: []
    };
    sessionHistory.push(session);

    async function recordTurn(question) {
      session.exchanges += 1;
      if (session.questions.length < MAX_LOGGED_QUESTIONS) {
        session.questions.push(String(question).slice(0, 300));
      }
      session.updated = new Date().toISOString();
      queueSave(sessionHistory); // fire-and-forget: never block the input loop on a log write
    }

    await recordTurn(initialInput);

    messages.push({
      "role": "user",
      "content": await buildContextMessage(initialInput)
    });

    try {
      codioIDE.coachBot.showThinkingAnimation();
      const result = await codioIDE.coachBot.ask({
        systemPrompt: systemPrompt,
        messages: messages
      }, { preventMenu: true });
      messages.push({"role": "assistant", "content": result.result});
    } catch (e) {
      codioIDE.coachBot.write("Hmm, something went wrong on my end. Try asking that again!");
      messages.pop();
    } finally {
      codioIDE.coachBot.hideThinkingAnimation();
    }

    while (true) {
      let input;
      try {
        input = await codioIDE.coachBot.input("What else can I help you with? (Say 'thanks' when you're done!)");
      } catch (e) {
        break;
      }

      if (input === "version") {
        codioIDE.coachBot.write(`Current version: ${VERSION}`, codioIDE.coachBot.MESSAGE_ROLES.ASSISTANT);
        continue;
      }

      const trimmedInput = input.trim().toLowerCase();
      if (exitPhrases.includes(trimmedInput)) {
        break;
      }

      await recordTurn(input);

      messages.push({
        "role": "user",
        "content": input
      });

      // Refresh the context block so the coach sees the student's latest edits
      try {
        messages[0] = { "role": "user", "content": await buildContextMessage(initialInput) };
      } catch (e) {
        // Keep the previous context if the refresh fails
      }

      try {
        codioIDE.coachBot.showThinkingAnimation();
        const result = await codioIDE.coachBot.ask({
          systemPrompt: systemPrompt,
          messages: messages
        }, { preventMenu: true });
        messages.push({"role": "assistant", "content": result.result});
      } catch (e) {
        codioIDE.coachBot.write("Hmm, something went wrong on my end. Try asking that again!");
        messages.pop();
        continue;
      } finally {
        codioIDE.coachBot.hideThinkingAnimation();
      }

      // Keep first message (with files + guide) + last 8 messages (4 exchanges)
      while (messages.length > 9) {
        messages.splice(1, 2); // drop the oldest assistant+user pair, keep messages[0] (context) intact
      }
    }

    session.ended = new Date().toISOString();
    await queueSave(sessionHistory); // flush queued writes (safe to await — no input follows)

    codioIDE.coachBot.write("You're welcome! Feel free to ask more questions about PyGame Zero!", codioIDE.coachBot.MESSAGE_ROLES.ASSISTANT);
    codioIDE.coachBot.showMenu();
  }

})(window.codioIDE, window);
