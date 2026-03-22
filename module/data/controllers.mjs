

export class VrylActor extends Actor {

    //#region Derived Data
    /**
     * @override
     * Augment the actor source data with additional dynamic data. Typically,
     * you'll want to handle most of your calculated/derived data in this step.
     * Data calculated in this step should generally not exist in template.json
     * (such as ability modifiers rather than ability scores) and should be
     * available both inside and outside of character sheets (such as if an actor
     * is queried and has a roll executed directly from it).
     */
    prepareDerivedData() {
        const actorData = this;
        const systemData = actorData.system;
        const flags = actorData.flags.vryl || {};

        console.log("Preparing derived data for " + actorData.name);
        this._prepareCharacterData(actorData);

        this.system = systemData;
        this.flags.vryl = flags;
    }

    /**
     * Prepare Character type specific data
     */
    _prepareCharacterData(actorData) {
        console.log("Preparing character data for " + actorData.name);

        if (actorData.type === 'character') {
            // Make modifications to data here. For example:
            const systemData = actorData.system;

            const maxLevel = game.settings.get(CONFIG.SystemId, 'attribute_max_level');
            let xpSpent = 0;
            const attributes = Object.entries(systemData.attributes);
            for (const entry of attributes) {
                let a = entry[1];
                let aData = CONFIG.ui.rollBuilder.getDefaultAttributeFromDataName(entry[0]);
                const xpMultiplier = CONFIG.ui.rollBuilder.getAttributeType(aData[0]).xpMultiplier;

                for (let i = 1; i <= a.level; i++) {
                    xpSpent += i * xpMultiplier;
                }
                for (let i = 1; i <= a.heroicLevel; i++) {
                    xpSpent += maxLevel * xpMultiplier * 2;
                }
            }
            systemData.xpSpent = xpSpent;
        }
    }
    //#endregion

    //#region Roll Data
    /**
     * Override getRollData() that's supplied to rolls.
     */
    getRollData() {
        console.log("Getting roll data for " + this.name);

        const data = super.getRollData();

        // Prepare character roll data.
        this._getCharacterRollData(data);

        return data;
    }

    /**
     * Prepare character roll data.
     */
    _getCharacterRollData(data) {
        if (this.type !== 'character') return;

        console.log("Cloning attributes for roll data.");
        if (data.attributes) {
            for (let [k, v] of Object.entries(data.attributes)) {
                data[k] = foundry.utils.deepClone(v);
            }
        }
    }
    //#endregion

    //#region Update
    async update(data = {}, operation = {}) {
        super.update(data, operation);
        //this.prepareDerivedData();
    }
}

export class VrylItem extends Item {

}