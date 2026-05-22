// Static configuration for the RevengeBench leaderboard.
// Edit this file to change arena names, model display names, or chart filters.

// Arenas in display order (matches paper Table 1).
const arenas = [
    { key: "battlesnake", name: "BattleSnake", language: "Python",     link: "https://codeclash.ai/arenas/battlesnake/" },
    { key: "halite",      name: "Halite",      language: "C",          link: "https://codeclash.ai/arenas/halite/" },
    { key: "huskybench",  name: "HuskyBench",  language: "Python",     link: "https://codeclash.ai/arenas/poker/" },
    { key: "robocode",    name: "RoboCode",    language: "Java",       link: "https://codeclash.ai/arenas/robocode/" },
    { key: "robotrumble", name: "RobotRumble", language: "JavaScript", link: "https://codeclash.ai/arenas/robotrumble/" }
];

const arenaDescriptions = {
    battlesnake: "Multi-snake survival on a grid; eat food, avoid walls and enemies.",
    halite:      "Resource-collection RTS; harvest energy with mobile ships on a grid.",
    huskybench:  "Heads-up no-limit Texas Hold'em poker.",
    robocode:    "Real-time tank duels; control velocity, turning, and gun aim.",
    robotrumble: "Turn-based unit combat in a small arena; one command per unit per turn."
};

// Elo tiers (filters the underlying targets, not the model list).
// Placeholder; wire to real data when results are generated.
const eloTiers = [
    { key: "all",  label: "All targets" },
    { key: "high", label: "High Elo (top 5 per arena)" },
    { key: "mid",  label: "Mid Elo (next 5 per arena)" },
    { key: "low",  label: "Low Elo (bottom 5 per arena)" }
];
