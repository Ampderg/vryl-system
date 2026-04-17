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

        //#region Crits
        {
            action: `explode-crits`,
            actionType: `preRoll`,
            actionOwner: `global`,
        },
        {
            action: `exposure`,
            actionType: `preRoll`,
            actionOwner: `global`,
            flags: {
                amount: {
                    initial: 1,
                    min: 1,
                    label: `<i class="fa-solid fa-bullseye-arrow"></i>`,
                    isAdjustable: true,
                }
            }
        },

        //#region Willpower
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

        //#region Group Rolls
        {
            action: `group-roll`,
            actionType: `preRoll`,
            actionOwner: `global`,
            // presentInMenu: false,
            flags: {
                targetGroupSize: {
                    initial: 1,
                    min: 1,
                    label: `<i class="fa-solid fa-user-group"></i>`,
                    isAdjustable: true,
                }
            }
        },
        {
            action: `is-attack`,
            actionType: `preRoll`,
            actionOwner: `global`,
        },
        
    ];