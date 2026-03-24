export const ROLL_ACTIONS = [
        {
            action: `narrative-result`,
            actionType: `preRoll`,
            actionOwner: `global`,
        },
        {
            action: `roll-level-zero`,
            actionType: `preRoll`,
            actionOwner: `global`,
        },
        {
            action: `explode-crits`,
            actionType: `preRoll`,
            actionOwner: `global`,
        },
        {
            action: `no-willpower-spend`,
            actionType: `preRoll`,
            actionOwner: `both`,
        },
        {
            action: `successes-regenerate-willpower`,
            functionName: `successesRegenerateWillpower`,
            actionType: `postRoll`,
            actionOwner: `actor`,
        },
        {
            action: `failures-lose-willpower`,
            functionName: `failuresLoseWillpower`,
            actionType: `postRoll`,
            actionOwner: `actor`,
        },
        {
            action: `group-roll`,
            actionType: `preRoll`,
            actionOwner: `global`,
            presentInMenu: false,
        },
    ];