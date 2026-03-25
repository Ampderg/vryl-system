export const DEFAULTS = {};

DEFAULTS.equipmentSlots = [
    {
        slotName: "Held",
        slotSlots: 2,
        id: 0,
    },
    {
        slotName: "Head",
        slotSlots: 1,
        id: 1,
    },
    {
        slotName: "Body",
        slotSlots: 1,
        id: 2,
    },
    {
        slotName: "Trinkets",
        slotSlots: 3,
        id: 3,
    },
]

/**
 * The set of Ability Scores used within the system.
 * @type {Object}
 */
DEFAULTS.attributes = [
    {
        category: 0,
        dataName: "strength",
        name: "Strength",
        sorting: 0,
    },
    {
        category: 0,
        dataName: "dexterity",
        name: "Dexterity",
        sorting: 1,
    },
    {
        category: 0,
        dataName: "stamina",
        name: "Stamina",
        sorting: 2,
    },
    // ----
    {
        category: 1,
        dataName: "charisma",
        name: "Charisma",
        sorting: 0,
    },
    {
        category: 1,
        dataName: "manipulation",
        name: "Manipulation",
        sorting: 1,
    },
    {
        category: 1,
        dataName: "appearance",
        name: "Appearance",
        sorting: 2,
    },
    // ----
    {
        category: 2,
        dataName: "perception",
        name: "Perception",
        sorting: 0,
    },
    {
        category: 2,
        dataName: "intelligence",
        name: "Intelligence",
        sorting: 1,
    },
    {
        category: 2,
        dataName: "wisdom",
        name: "Wisdom",
        sorting: 2,
    },
    // ----
    {
        category: 3,
        dataName: "art",
        name: "Art",
        sorting: 0,
    },
    {
        category: 3,
        dataName: "athletics",
        name: "Athletics",
        sorting: 1,
    },
    {
        category: 3,
        dataName: "awareness",
        name: "Awareness",
        sorting: 2,
    },
    {
        category: 3,
        dataName: "brawn",
        name: "Brawn",
        sorting: 3,
    },
    {
        category: 3,
        dataName: "deception",
        name: "Deception",
        sorting: 4,
    },
    {
        category: 3,
        dataName: "empathy",
        name: "Empathy",
        sorting: 5,
    },
    {
        category: 3,
        dataName: "intimidation",
        name: "Intimidation",
        sorting: 6,
    },
    {
        category: 3,
        dataName: "leadership",
        name: "Leadership",
        sorting: 7,
    },
    {
        category: 3,
        dataName: "mysticism",
        name: "Mysticism",
        sorting: 8,
    },
    {
        category: 3,
        dataName: "rhetoric",
        name: "Rhetoric",
        sorting: 9,
    },
    // ----
    {
        category: 4,
        dataName: "martial_arts",
        name: "Martial Arts",
        sorting: 0,
    },
    {
        category: 4,
        dataName: "ranged_weapons",
        name: "Ranged Weapons",
        sorting: 1,
    },
    {
        category: 4,
        dataName: "commerce",
        name: "Commerce",
        sorting: 2,
    },
    {
        category: 4,
        dataName: "crafts",
        name: "Crafts",
        sorting: 3,
    },
    {
        category: 4,
        dataName: "etiquette",
        name: "Etiquette",
        sorting: 4,
    },
    {
        category: 4,
        dataName: "finesse",
        name: "Finesse",
        sorting: 5,
    },
    {
        category: 4,
        dataName: "meditation",
        name: "Meditation",
        sorting: 6,
    },
    {
        category: 4,
        dataName: "research",
        name: "Research",
        sorting: 7,
    },
    {
        category: 4,
        dataName: "stealth",
        name: "Stealth",
        sorting: 8,
    },
    {
        category: 4,
        dataName: "survival",
        name: "Survival",
        sorting: 9,
    },
    // ----
    {
        category: 5,
        dataName: "academics",
        name: "Academics",
        sorting: 0,
    },
    {
        category: 5,
        dataName: "arcane",
        name: "Arcane",
        sorting: 1,
    },
    {
        category: 5,
        dataName: "cosmology",
        name: "Cosmology",
        sorting: 2,
    },
    {
        category: 5,
        dataName: "religion",
        name: "Religion",
        sorting: 3,
    },
    {
        category: 5,
        dataName: "esoterica",
        name: "Esoterica",
        sorting: 4,
    },
    {
        category: 5,
        dataName: "governance",
        name: "Governance",
        sorting: 5,
    },
    {
        category: 5,
        dataName: "investigation",
        name: "Investigation",
        sorting: 6,
    },
    {
        category: 5,
        dataName: "medicine",
        name: "Medicine",
        sorting: 7,
    },
    {
        category: 5,
        dataName: "reasoning",
        name: "Reasoning",
        sorting: 8,
    },
    {
        category: 5,
        dataName: "streetwise",
        name: "Streetwise",
        sorting: 9,
    },
];

DEFAULTS.attributeTypes = [
    {
        dataName: "primary",
        name: "Primary",
        sorting: 0,
        xpMultiplier: 5,
        canSelectMultipleAttributesAtOnce: false,
    },
    {
        dataName: "secondary",
        name: "Secondary",
        sorting: 1,
        xpMultiplier: 2,
        canSelectMultipleAttributesAtOnce: false,
    },
]

DEFAULTS.attributeCategories = [
    {
        type: 0,
        dataName: "physical",
        name: "Physical",
        sorting: 0,
    },
    {
        type: 0,
        dataName: "social",
        name: "Social",
        sorting: 1,
    },
    {
        type: 0,
        dataName: "mental",
        name: "Mental",
        sorting: 2,
    },
    {
        type: 1,
        dataName: "talents",
        name: "Talents",
        sorting: 0,
    },
    {
        type: 1,
        dataName: "skills",
        name: "Skills",
        sorting: 1,
    },
    {
        type: 1,
        dataName: "knowledges",
        name: "Knowledges",
        sorting: 2,
    },
]