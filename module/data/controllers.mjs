

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
        this._prepareInventoryData(actorData);

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

            const maxLevel = game.settings.get(CONFIG.SystemId, 'attribute-max-level');
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

    _prepareInventoryData(actorData) {
        const systemData = actorData.system;
        const equipData = systemData.equipment;

        if(!equipData) return;

        equipData.slotItems = {};
        for(const [dataName, slot] of Object.entries(equipData.slots))
        {
            let slotArray = new Array(slot.slots);
            let i = 0;
            for(const item of actorData.items.contents)
            {
                if(item.system.equipment.slotDataName == dataName)
                {
                    for(let j = 0; j < item.system.equipment.slotsFilled; j++)
                    {
                        if(i >= slot.slots)
                            console.log(`ERROR: Slot ${slot.name} is full but is still getting equipped to by ${item.name}`);

                        slotArray[i] = item;
                        i++;
                        
                    }
                }
            }
            equipData.slotItems[dataName] = slotArray;
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

    //#region Items
    /**
   * Organize and classify Items for Actor sheets.
   *
   * @param {object} context The context object to mutate
   */
    _prepareItems(context) {
        // Initialize containers.
        // You can just use `this.document.itemTypes` instead
        // if you don't need to subdivide a given type like
        // this sheet does with spells
        const gear = [];

        // Iterate through items, allocating to containers
        for (let i of this.document.items) {
            // Append to gear.
            if (i.type === 'item') {
                gear.push(i);
            }
            // Append to features.
            else if (i.type === 'feature') {
                features.push(i);
            }
            // Append to spells.
            else if (i.type === 'spell') {
                if (i.system.spellLevel != undefined) {
                    spells[i.system.spellLevel].push(i);
                }
            }
        }

        for (const s of Object.values(spells)) {
            s.sort((a, b) => (a.sort || 0) - (b.sort || 0));
        }

        // Sort then assign
        context.gear = gear.sort((a, b) => (a.sort || 0) - (b.sort || 0));
        context.features = features.sort((a, b) => (a.sort || 0) - (b.sort || 0));
        context.spells = spells;
    }

    //#region Update
    async update(data = {}, operation = {}) {
        await super.update(data, operation);

        this._updateRollActorData();
        //this.prepareDerivedData();
    }

    _updateRollActorData() {
        const actorData = CONFIG.ROLL_DATA.rollActors.get(this.id);

        function updateLevels(attributeData, realAttribute) {
            if (!isNaN(attributeData.level))
                attributeData.level = realAttribute.level;
            if (!isNaN(attributeData.heroicLevel))
                attributeData.heroicLevel = realAttribute.heroicLevel;
            if (!isNaN(attributeData.bonusDice))
                attributeData.bonusDice = realAttribute.bonusDice;
            if (!isNaN(attributeData.guaranteedSuccesses))
                attributeData.guaranteedSuccesses = realAttribute.guaranteedSuccesses;
        }

        if (actorData) {
            if (actorData.willpower) {
                updateLevels(actorData.willpower, this.system.willpower);
            }
            for (const a of actorData.attributes) {
                updateLevels(a, this.system.attributes[a.dataName]);
            }
            CONFIG.ui.rollBuilder.updateRollData();
        }
    }

    applyActiveEffects() {
        const overrides = {};
        this.statuses.clear();

        CONFIG.ROLL_DATA.globalActions = CONFIG.ROLL_DATA.globalActions?.filter((a) => a.activeEffectAppliedByActor != this.id);
        const actorData = CONFIG.ROLL_DATA.rollActors?.get(this.id);
        if (actorData)
            actorData.actions?.filter((a) => a.activeEffectAppliedByActor != this.id);

        // Organize non-disabled effects by their application priority
        const allEffects = this.allApplicableEffects();
        const changes = [];

        for (const effect of allEffects) {
            if (!effect.active) continue;

            if (effect.getFlag(CONFIG.SystemId, `isInstant`) && !effect.getFlag(CONFIG.SystemId, `isInstantApplied`))
                continue;

            changes.push(...effect.changes.map(change => {
                const c = foundry.utils.deepClone(change);
                c.effect = effect;
                c.priority = c.priority ?? (c.mode * 10);
                return c;
            }));
            for (const statusId of effect.statuses) this.statuses.add(statusId);

            //Apply roll flags
            const appliedRollActions = effect.getFlag('vryl', 'appliedRollActions');

            for (const appliedRollAction of appliedRollActions) {
                const actionArray = CONFIG.ui.rollBuilder.getActionArray(appliedRollAction.actor);
                appliedRollAction.activeEffectAppliedByActor = this.id;
                actionArray.push(appliedRollAction);
            }
        }
        changes.sort((a, b) => a.priority - b.priority);

        // Apply all changes
        for (const change of changes) {
            if (!change.key) continue;
            const changes = change.effect.apply(this, change);
            Object.assign(overrides, changes);
        }

        // Expand the set of final overrides
        this.overrides = foundry.utils.expandObject(overrides);

        this._updateRollActorData();
    }
}

//#region Item

export class VrylItem extends Item {

    getRollData() {
        // Starts off by populating the roll data with a shallow copy of `this.system`
        const rollData = { ...this.system };

        // Quit early if there's no parent actor
        if (!this.actor) return rollData;

        // If present, add the actor's roll data
        rollData.actor = this.actor.getRollData();

        return rollData;
    }

    prepareDerivedData() {
        const itemData = this;
        const systemData = itemData.system;
        const flags = itemData.flags.vryl || {};

        console.log("Preparing derived data for " + itemData.name);

        this._prepareInventoryItemData(itemData);

        this.system = systemData;
        this.flags.vryl = flags;
    }

    _prepareInventoryItemData(itemData) {
        //TODO: this is kinda messy, maybe change how slots are handled to be a little better
        const defaultSlotSettings = {};

        const sortedSlotSettings = game.settings.get(CONFIG.SystemId, 'equipment-slots').toSorted((a, b) => a.id - b.id);

        for(const slot of sortedSlotSettings)
        {
            let dataName = slot.slotName;
            dataName = dataName.replaceAll(' ', '');
            dataName = dataName.substring(0, 1).toLowerCase() + dataName.substring(1);
            defaultSlotSettings[dataName] = {
                name: slot.slotName,
                dataName: dataName,
                slots: slot.slots,
                id: slot.id,
            }
        }

        itemData.system.equipment.defaultSlotSettings = defaultSlotSettings;
    }

}