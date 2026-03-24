export const ROLL_ACTIONS = {
    globalActions: [
        {
            action: `narrative-result`,
            actionType: `preRoll`,
        },
        {
            action: `no-level-zero`,
            actionType: `preRoll`,
        },
        {
            action: `explode-crits`,
            actionType: `preRoll`,
        },
    ],
    actorActions: [
        {
            action: `successes-regenerate-willpower`,
            functionName: `successesRegenerateWillpower`,
            actionType: `postRoll`,
        },
        {
            action: `failures-lose-willpower`,
            functionName: `failuresLoseWillpower`,
            actionType: `postRoll`,

        },
    ],
};