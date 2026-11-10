const settings = {
    "minecraft_version": "26.1", // pinned: the bot cluster and installed protocol stack target 26.1
    "host": "127.0.0.1", // or "localhost", "your.ip.address.here"
    "port": 56730, // must match bots/config.json server.port
    "auth": "offline", // "offline" for cracked/offline servers, "microsoft" for premium accounts
    "profilesFolder": "auth", // where the Microsoft login is cached (only used with auth: microsoft)
    "profile": "ENI1", // profile name inside the profiles folder
    "proxy": "", // optional tunnel: socks5://host:port or http://user:pass@host:port (comma separated = failover list)
    "via_proxy": {
        "enabled": false, // opt in only when a separate ViaProxy instance is already configured for the target server
        "host": "127.0.0.1",
        "port": 25568,
        "client_version": "26.1" // Mineflayer's protocol version on the client-facing side of ViaProxy
    },

    "server_password": "", // optional server login password (prefer process.env.MC_SERVER_PASSWORD or keys.json)
    "auto_lifesteal_pipeline": false, // when true: auto-login -> wait 2000ms -> /server lifesteal -> on world spawn -> /randomtp

    // the mindserver manages all agents and hosts the UI
    "mindserver_port": 8080,
    "auto_open_ui": true, // opens UI in browser on startup
    
    "base_profile": "assistant", // survival, assistant, creative, or god_mode
    "profiles": [
        "./profiles/foreman.json",
        // "./andy.json",
        // "./profiles/gpt.json",
        // "./profiles/claude.json",
        // "./profiles/gemini.json",
        // "./profiles/llama.json",
        // "./profiles/qwen.json",
        // "./profiles/grok.json",
        // "./profiles/mistral.json",
        // "./profiles/deepseek.json",
        // "./profiles/mercury.json",
        // "./profiles/andy-4.json", // Supports up to 75 messages!

        // using more than 1 profile requires you to /msg each bot indivually
        // individual profiles override values from the base profile
    ],

    "load_memory": false, // load memory from previous session
    "init_message": "", // empty string = completely silent on spawn, no greeting sent
    "only_chat_with": ["sujal24", "52hx", "ADMIN"], // users that the bots listen to and send general messages to.
    "silent_spawn": true, // never announce presence or blurt out greetings on spawn

    "speak": false,
    // allows all bots to speak through text-to-speech. 
    // specify speech model inside each profile with format: {provider}/{model}/{voice}.
    // if set to "system" it will use basic system text-to-speech. 
    // Works on windows and mac, but linux requires you to install the espeak package through your package manager eg: `apt install espeak` `pacman -S espeak`.

    "chat_ingame": true, // bot responses are shown in minecraft chat
    "language": "en", // translate to/from this language. Supports these language names: https://cloud.google.com/translate/docs/languages
    "render_bot_view": false, // show bot's view in browser
    "render_bot_view_port": 3005, // base port for browser viewer (3000 is reserved by docker/web apps)

    "allow_insecure_coding": true, // allows newAction command and model can write/run code on your computer. enable at own risk
    "allow_vision": false, // allows vision model to interpret screenshots as inputs
    "blocked_actions" : ["!checkBlueprint", "!checkBlueprintLevel", "!getBlueprint", "!getBlueprintLevel"] , // commands to disable and remove from docs. Ex: ["!setMode"]
    "code_timeout_mins": -1, // minutes code is allowed to run. -1 for no timeout
    "relevant_docs_count": 5, // number of relevant code function docs to select for prompting. -1 for all

    "max_messages": 15, // max number of messages to keep in context
    "num_examples": 2, // number of examples to give to the model
    "max_commands": -1, // max number of commands that can be used in consecutive responses. -1 for no limit
    "show_command_syntax": "full", // "full", "shortened", or "none"
    "narrate_behavior": true, // chat simple automatic actions ('Picking up item!')
    "chat_bot_messages": true, // publicly chat messages to other bots

    "spawn_timeout": 60, // num seconds allowed for the bot to spawn before throwing error. Increase when spawning takes a while.
    "block_place_delay": 0, // delay between placing blocks (ms) if using newAction. helps avoid bot being kicked by anti-cheat mechanisms on servers.
  
    "log_all_prompts": false, // log ALL prompts to file

}

export default settings;
