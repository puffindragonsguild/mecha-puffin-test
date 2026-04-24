// messages.js
module.exports = {
    // 🛑 Rejections when the gates are closed
    closedGates: [
        "⚠️ **Rejected:** Sorry! Sign-ups are closed until the Queen's weekend announcement!",
        "🛑 **Halt!** The Gatekeeper is resting. Wait for the official announcement.",
        "⚙️ *Mechanical whirring...* The lever is locked. Come back later!"
    ],

    // 🤡 The Monk Roasts
    monkRoasts: [
        "🚨 **MONK ALERT:** Trying to join a raid as a Monk? Absolute clown behavior. 🤡",
        "Oh look, a Monk signed up. Did you bring your own popcorn or should we provide it? 🤡",
        "A Monk? Really? The Queen is not amused. 🤡"
    ],

    // 👑 Leader Hyping
    leaderHype: [
        "The Great **Fortuna Felis** has graced the roster! Bow down!",
        "Make way! The Queen herself has arrived to pull the lever! 👑",
        "All Hail! Fortuna Felis is locked in for battle!"
    ],

    // ⚔️ Standard Sign-up Hype
    standardHype: [
        "is ready for battle!",
        "has joined the fray!",
        "is sharpening their weapons!",
        "has successfully navigated the gates."
    ],

    // Lazy Option
    lazySnark: [
        "Oh, too busy hunting rabbits to type a sentence? Fine.",
        "A Lazy Option? The Queen is unimpressed by your lack of effort.",
        "Laziness is a Monk-like trait, but here we are.",
        "Wow, the absolute bare minimum. Truly inspiring."
    ],
    lazyQueenMessages: [
        "I'm only here for the loot.",
        "My sword is yours, but my words are expensive.",
        "I forgot my speech at home.",
        "Hail to the Queen, I guess."
    ],
    // A handy function to pick a random message from the lists above
    getRandom: function(array) {
        return array[Math.floor(Math.random() * array.length)];
    }    
};
