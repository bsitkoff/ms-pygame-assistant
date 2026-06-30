(async function(codioIDE, window) {

  const VERSION = "2.1.0";

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

  async function onButtonPress() {
    codioIDE.coachBot.write(
      `PyGame Zero Coach v${VERSION} - Ask me questions about PyGame Zero!`,
      codioIDE.coachBot.MESSAGE_ROLES.ASSISTANT
    );

    let messages = [];

    // Get initial context
    const context = await codioIDE.coachBot.getContext();

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

    // Build structured first message with student's files and guide
    const filesContent = (context.files && context.files.length > 0)
      ? context.files.map(f => `File: ${f.path}\n${f.content}`).join('\n\n')
      : "No files available.";

    const guideContent = (context.guidesPage && context.guidesPage.content && context.guidesPage.content.trim().length > 0)
      ? context.guidesPage.content.trim()
      : "No guide available.";

    const assignmentName = (context.assignmentData && context.assignmentData.name)
      ? context.assignmentData.name
      : null;

    const initialUserPrompt = `Here are the student's files:
<files>
${filesContent}
</files>
Here is the assignment guide:
<guide>
${guideContent}
</guide>
${assignmentName ? `\nAssignment: ${assignmentName}\n` : ''}
The student says: ${initialInput}`;

    messages.push({
      "role": "user",
      "content": initialUserPrompt
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

      messages.push({
        "role": "user",
        "content": input
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
        continue;
      } finally {
        codioIDE.coachBot.hideThinkingAnimation();
      }

      // Keep first message (with files + guide) + last 8 messages (4 exchanges)
      while (messages.length > 9) {
        messages.splice(1, 2); // drop the oldest assistant+user pair, keep messages[0] (context) intact
      }
    }

    codioIDE.coachBot.write("You're welcome! Feel free to ask more questions about PyGame Zero!", codioIDE.coachBot.MESSAGE_ROLES.ASSISTANT);
    codioIDE.coachBot.showMenu();
  }

})(window.codioIDE, window);
