// Static configuration for the RevengeBench leaderboard.
// Edit this file to change arena names, model display names, or chart filters.

// Arenas in display order (matches paper Table 1).
const arenas = [
    { key: "battlesnake", name: "BattleSnake", language: "Python",     link: "https://codeclash.ai/arenas/battlesnake/" },
    { key: "halite",      name: "Halite",      language: "C",          link: "https://codeclash.ai/arenas/halite/" },
    { key: "poker",  name: "Poker",  language: "Python",     link: "https://codeclash.ai/arenas/poker/" },
    { key: "robocode",    name: "RoboCode",    language: "Java",       link: "https://codeclash.ai/arenas/robocode/" },
    { key: "robotrumble", name: "RobotRumble", language: "JavaScript", link: "https://codeclash.ai/arenas/robotrumble/" }
];

const arenaDescriptions = {
    battlesnake: "Multi-snake survival: eat food, avoid walls and enemies.",
    halite:      "Resource collection: harvest mineral deposits with a fleet of ships.",
    poker:       "Heads-up Texas Hold'em: bet, call, fold, or raise against a single opponent.",
    robocode:    "Tank duels: control velocity, direction, and turret heading.",
    robotrumble: "Robot swarm combat: command each unit on every turn."
};
