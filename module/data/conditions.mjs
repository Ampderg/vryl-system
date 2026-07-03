export function prepareStatusEffects() {
    CONFIG.statusEffects = [
        {
            id: "stunned",
            statuses: ["stunned"],

            name: "Stunned",
            icon: "icons/svg/padlock.svg",
            isCondition: true,

            sortingCategory: "Action Economy",
            description:
`When you activate in the initiative order, lose all Action Points, lose all stacks of Stunned.
You cannot use Reactions.
`,
        },
        {
            id: "dazed",
            statuses: ["dazed"],

            name: "Dazed",
            icon: "icons/svg/daze.svg",
            isCondition: true,

            sortingCategory: "Action Economy",
            description:
`At the start of your turn, lose one Action Point for each stack of Dazed you have, down to a minimum of 1. For each Action Point lost this way, lose one stack of Dazed.
If you gain Dazed during your turn, lose one Action Point. If you have no Action Points to lose, you cannot save that stack of Dazed this turn.
`,
        },
        {
            id: "disoriented",
            statuses: ["disoriented"],

            name: "Disoriented",
            icon: "icons/svg/stoned.svg",
            isCondition: true,

            sortingCategory: "Success Manipulation",
            description:
`When you roll, lose half of your stacks of Disoriented (rounded up), and suffer -1 Bonus Dice for every stack lost.
`,
        },
        {
            id: "frightened",
            statuses: ["frightened"],

            name: "Frightened",
            icon: "icons/svg/light-off.svg",
            isCondition: true,

            sortingCategory: "Success Manipulation",
            description:
`Creatures that are Frightened have -1 Successes to their rolls.
`,
        },
        {
            id: "doom",
            statuses: ["doom"],

            name: "Doom",
            icon: "icons/svg/eye.svg",
            isCondition: true,

            sortingCategory: "Willpower",
            description:
`When making Willpower Rolls, treat your current Willpower as if it were one lower for each stack of Doom, to a minimum of 0.
When you Burn Willpower, each stack of Doom counts as a guaranteed Failure, since the number of dice you roll goes down.
Doom stays applied when you become Incapacitated, but you lose half of the stacks (rounded up) after you Burn Willpower.
`,
        },
        {
            id: "hex",
            statuses: ["hex"],

            name: "Hex",
            icon: "icons/svg/cancel.svg",
            isCondition: true,

            sortingCategory: "Willpower",
            description:
`During a Condition Save, you cannot remove any stacks of Conditions other than Hex.
If you would remove or transfer a stack of a Condition other than Hex, instead remove one stack of Hex.
`,
        },
        {
            id: "blinded",
            statuses: ["blinded"],

            name: "Blinded",
            icon: "icons/svg/blind.svg",
            isCondition: true,

            sortingCategory: "Denial",
            description:
`You cannot target creatures outside of Range 2.
`,
        },
        {
            id: "weakened",
            statuses: ["weakened"],

            name: "Weakened",
            icon: "icons/svg/downgrade.svg",
            isCondition: true,

            sortingCategory: "Damage Manipulation",
            description:
`Whenever an action your perform deals damage, decrease its damage by the number of Weakened stacks you have, to a minimum of half (rounded up).
`,
        },
        {
            id: "vulnerable",
            statuses: ["vulnerable"],

            name: "Vulnerable",
            icon: "icons/svg/poison.svg",
            isCondition: true,

            sortingCategory: "Damage Manipulation",
            description:
`Whenever a creature with Vulnerable takes damage, they take one additional damage for each stack of Vulnerable they have.
`,
        },
        {
            id: "exposure",
            statuses: ["exposure"],

            name: "Exposure",
            icon: "icons/svg/sword.svg",
            isCondition: true,

            sortingCategory: "Damage Manipulation",
            description:
`When a creature with Exposure is targeted, the attacker may choose (after rolling) to remove all stacks of Exposure and replace a number of Successes equal to the number of stacks removed with a Natural 20.
`,
        },
        {
            id: "bleeding",
            statuses: ["bleeding"],

            name: "Bleeding",
            icon: "icons/svg/blood.svg",
            isCondition: true,

            sortingCategory: "Damage",
            description:
`At the end of your turn, roll 1d10. If the result is less than or equal to your number of Bleeding stacks, take 2d6+4 damage and lose all stacks of Bleeding.
`,
        },
        {
            id: "burning",
            statuses: ["burning"],

            name: "Burning",
            icon: "icons/svg/fire.svg",
            isCondition: true,

            sortingCategory: "Damage",
            description:
`At the start of your turn, take 1 damage for every stack of Burning you have.
`,
            extraRules: [
`Entering Water: The first time a Burning creature is in water on their turn, they decrease their Burning stacks by half (rounded up).
`,
`Stop, Drop, and Roll: Once per turn, a Prone creature may spend one Action Point to decrease their Burning stacks by half (rounded up), or 2.
`,
]
        },
        {
            id: "shocked",
            statuses: ["shocked"],

            name: "Shocked",
            icon: "icons/svg/lightning.svg",
            isCondition: true,

            sortingCategory: "Damage",
            description:
`When any creature starts its turn, Shocked creatures deal 1 damage to all creatures within Range 2 other than themself, and then lose one stack of Shocked.
`,
            extraRules: [
`Entering Water: The first time a Shocked creature is in water on their turn, they decrease their Shocked stacks by half (rounded up), taking 1d4 damage for every stack removed.
`,
]
        },
        {
            id: "distracted",
            statuses: ["distracted"],

            name: "Distracted",
            icon: "icons/svg/sun.svg",
            isCondition: true,

            sortingCategory: "Denial",
            description:
`You cannot be granted Opportunities.
`,
        },
        {
            id: "slowed",
            statuses: ["slowed"],

            name: "Slowed",
            icon: "icons/svg/anchor.svg",
            isCondition: true,

            sortingCategory: "Movement",
            description:
`Your Speed is reduced by the number of Slowed stacks you have.
`,
        },
        {
            id: "immobilized",
            statuses: ["immobilized"],

            name: "Immobilized",
            icon: "icons/svg/trap.svg",
            isCondition: true,

            sortingCategory: "Movement",
            description:
`While Immobilized, your speed is set to 0, and you cannot move.
`,
        },

        //#region Afflictions

        {
            id: "prone",
            statuses: ["prone"],

            name: "Prone",
            icon: "icons/svg/falling.svg",
            isCondition: false,

            sortingCategory: "Affliction",
            description:
`While Prone…
- Your Speed cannot be higher than 2.
- You may spend an Action Point to become no longer Prone.
- Attacks from within Range 1 against you gain one Bonus Die.
You may choose to gain a stack of Prone as a free action on your turn.
`,
        },
        {
            id: "incapacitated",
            statuses: ["incapacitated"],

            name: "Incapacitated",
            icon: "icons/svg/skull.svg",
            isCondition: false,

            sortingCategory: "Affliction",
            description:
`When you fall to 0 Hit Points, you become Incapacitated.
While Incapacitated, unless otherwise specified, you cannot have Conditions and cannot perform actions normally. You must spend a Willpower for each Action or Reaction you perform. When you do so, roll Willpower and add the Successes to the Successes of the action. Spending multiple Action Points on one action still only spends one Willpower.
If you would lose Hit Points while Incapacitated, you must Burn Willpower. You can only be forced to Burn Willpower in this way once per turn.
You can heal while Incapacitated, but you do not recover from Incapacitation when you are healed. Incapacitation can only be recovered from at the end of the encounter, or from effects that specifically cleanse it.
If you run out of Willpower while Incapacitated, something bad happens to you, likely gaining a Temporary (or worse) status associated with an injury or ailment.
If you were Incapacitated but didn't run out of Willpower, you might gain an Aspect reflecting sustained harm.
`,
        },
    ];

    const sortingCategoryMap = {
        "Damage": 0,
        "Damage Manipulation": 1,
        "Denial": 2,
        "Movement": 3,
        "Success Manipulation": 49,
        "Action Economy": 50,
        "Willpower": 51,
        "Affliction": 10000,
    }

    CONFIG.statusEffects.sort(function(a, b) {
        const catCompare = sortingCategoryMap[a.sortingCategory] - sortingCategoryMap[b.sortingCategory];
        if(catCompare == 0)
        {
            return a.name.localeCompare(b.name);
        }
        return catCompare;
    });
}