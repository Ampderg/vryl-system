export const ROLL_ACTIONS = {
    globalActions: {
        preRoll: [
            {
                action: `narrative-result`,
            },
            {
                action: `no-level-zero`,
            },
            {
                action: `explode-crits`,
            },
        ],
        postRoll: [

        ],
    },
    actorActions: {
        preRoll: [
            
        ],
        postRoll: [
            {
                action: `successes-regenerate-willpower`,
                functionName: `successesRegenerateWillpower`,
            },
            {
                action: `failures-lose-willpower`,
                functionName: `failuresLoseWillpower`,
            },
        ],
    },
};