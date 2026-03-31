(async function(codioIDE, window) {

  const VERSION = "2.0.0";

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
- Answer questions outside of course content.`;

  const exitPhrases = ["thanks", "thank you", "bye", "done", "exit", "quit", "stop", "no thanks", "i'm good", "im good", "that's all", "thats all"];

  codioIDE.coachBot.register("iNeedHelpButton", "PyGame Questions", onButtonPress);

  async function onButtonPress() {
    codioIDE.coachBot.write(
      `PyGame Zero Assistant v${VERSION} - Ask me questions about PyGame Zero!`,
      codioIDE.coachBot.MESSAGE_ROLES.ASSISTANT
    );

    let messages = [];

    // Get initial context
    const context = await codioIDE.coachBot.getContext();

    const initialInput = await codioIDE.coachBot.input("What's your PyGame Zero question?");

    if (initialInput === "version") {
      codioIDE.coachBot.write(`Current version: ${VERSION}`, codioIDE.coachBot.MESSAGE_ROLES.ASSISTANT);
    }

    // Build structured first message with student's files and guide
    const filesContent = (context.files && context.files.length > 0)
      ? context.files.map(f => `File: ${f.path}\n${f.content}`).join('\n\n')
      : "No files available.";

    const guideContent = (context.guidesPage && context.guidesPage.content && context.guidesPage.content.trim().length > 0)
      ? context.guidesPage.content.trim()
      : "No guide available.";

    const initialUserPrompt = `Here are the student's files:
<files>
${filesContent}
</files>
Here is the assignment guide:
<guide>
${guideContent}
</guide>

The student says: ${initialInput}`;

    messages.push({
      "role": "user",
      "content": initialUserPrompt
    });

    let result = await codioIDE.coachBot.ask({
      systemPrompt: systemPrompt,
      messages: messages
    }, { preventMenu: true, stream: true, modelSettings: { temperature: 0.7, maxTokens: 1024 } });

    messages.push({"role": "assistant", "content": result.result});

    while (true) {
      const input = await codioIDE.coachBot.input("What else can I help you with?");

      if (exitPhrases.some(phrase => input.toLowerCase().includes(phrase))) {
        break;
      }

      if (input === "version") {
        codioIDE.coachBot.write(`Current version: ${VERSION}`, codioIDE.coachBot.MESSAGE_ROLES.ASSISTANT);
        continue;
      }

      messages.push({
        "role": "user",
        "content": input
      });

      result = await codioIDE.coachBot.ask({
        systemPrompt: systemPrompt,
        messages: messages
      }, { preventMenu: true, stream: true, modelSettings: { temperature: 0.7, maxTokens: 1024 } });

      messages.push({"role": "assistant", "content": result.result});

      // Keep first message (with files + guide) + last 8 messages (4 exchanges)
      if (messages.length > 9) {
        messages = [messages[0], ...messages.slice(-8)];
      }
    }

    codioIDE.coachBot.write("You're welcome! Feel free to ask more questions about PyGame Zero!", codioIDE.coachBot.MESSAGE_ROLES.ASSISTANT);
    codioIDE.coachBot.showMenu();
  }

})(window.codioIDE, window);
