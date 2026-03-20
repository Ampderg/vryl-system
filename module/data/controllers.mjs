

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
        // Make separate methods for each Actor type (character, npc, etc.) to keep
        // things organized.
        this._prepareCharacterData(actorData);
    }

    /**
     * Prepare Character type specific data
     */
    _prepareCharacterData(actorData) {
        console.log("Preparing character data for " + actorData.name);

        if (actorData.type === 'character') {
            // Make modifications to data here. For example:
            const systemData = actorData.system;

            // Loop through ability scores, and add their modifiers to our sheet output.
            // for (let [key, attribute] of Object.entries(systemData.attributes)) {
            //     attribute.derivedDiceCount = attribute.level + attribute.heroicLevel + attribute.bonusDice;
            // }
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
}

export class VrylItem extends Item {

}