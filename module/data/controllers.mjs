

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
    async prepareDerivedData() {
        const actorData = this;
        const systemData = actorData.system;
        const flags = actorData.flags.vryl || {};

        console.log("Preparing derived data for " + actorData.name);
        await this._prepareCharacterData(actorData);
        await this._prepareInventoryData(actorData);

        this.system = systemData;
        this.flags.vryl = flags;
    }

    /**
     * Prepare Character type specific data
     */
    async _prepareCharacterData(actorData) {
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

            systemData.combat.damage = systemData.combat.baseDamage;
            systemData.combat.fray = systemData.combat.baseFray;
        }
    }

    async _prepareInventoryData(actorData) {
        const systemData = actorData.system;
        const equipData = systemData.equipment;

        if (!equipData) return;

        equipData.slotItems = {};
        for (const [dataName, slot] of Object.entries(equipData.slots)) {
            let slotArray = new Array(slot.slots);
            let i = 0;
            for (const item of actorData.items.contents) {
                if (item.type != "gear")
                    continue;

                if (item.system.equipment.slotDataName == dataName && item.system.equipment.isEquipped) {
                    for (let j = 0; j < item.system.equipment.slotsFilled; j++) {
                        if (i >= slot.slots)
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

        const gear = [];
        const combatActions = [];

        // Iterate through items, allocating to containers
        for (let i of this.document.items) {
            // Append to gear.
            if (i.type === 'item') {
                gear.push(i);
            }
            // Append to features.
            else if (i.type === 'combatAction') {
                combatActions.push(i);
            }
        }

        // Sort then assign
        context.gear = gear.sort((a, b) => (a.sort || 0) - (b.sort || 0));
        context.combatActions = combatActions.sort((a, b) => (a.sort || 0) - (b.sort || 0));
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

            if (appliedRollActions) {
                for (const appliedRollAction of appliedRollActions) {
                    const actionArray = CONFIG.ui.rollBuilder.getActionArray(appliedRollAction.actor);
                    appliedRollAction.activeEffectAppliedByActor = this.id;
                    actionArray.push(appliedRollAction);
                }
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

    async prepareDerivedData() {
        const itemData = this;
        const systemData = itemData.system;
        const flags = itemData.flags.vryl || {};
        this.system = systemData;
        this.flags.vryl = flags;

        console.log("Preparing derived data for " + itemData.name);

        await this._prepareInventoryItemData(itemData);
        await this._prepareCombatActionData(itemData);
    }

    async _prepareInventoryItemData(itemData) {
        if (itemData.type != "gear") return;
        //TODO: this is kinda messy, maybe change how slots are handled to be a little better
        const defaultSlotSettings = {};

        const sortedSlotSettings = game.settings.get(CONFIG.SystemId, 'equipment-slots').toSorted((a, b) => a.id - b.id);

        for (const slot of sortedSlotSettings) {
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

    async _prepareCombatActionData(itemData) {
        if (itemData.type != "combatAction") return;

        const effects = itemData.system.combatAction.effects;

        const orderedEffects = {}

        for (const effect of effects) {
            if (!orderedEffects[effect.order])
                orderedEffects[effect.order] = [];

            orderedEffects[effect.order].push(effect);

            effect.enrichedDescription = CONFIG.ui.vrylEnrichText(effect.description, itemData.actor.system);
            effect.enrichedSummary = CONFIG.ui.vrylEnrichText(effect.summary, itemData.actor.system);
        }

        itemData.system.combatAction.orderedEffects = orderedEffects;

        let apString = "";

        switch (itemData.system.combatAction.frequency) {
            case "at-will":
                apString += "<i class='fas fa-arrow-right'></i>&nbsp;";
                break;
            case "encounter":
                apString += "<i class='fas fa-arrows-rotate'></i>";
                if(itemData.system.combatAction.charges == 0)
                {
                    apString += `<i class='fa-standard fa-square-xmark'></i>`;
                }
                else if(itemData.system.combatAction.charges <= 6)
                {
                    const numWords = ["", "one", "two", "three", "four", "five", "six"];
                    apString += `<i class='fa-standard fa-dice-${numWords[itemData.system.combatAction.charges]}'></i>`;
                }
                else
                {
                    apString += `<i class='fa-standard fa-square fa-stack-2x"></i><span class="fa-stack-1x number-overlay">${itemData.system.combatAction.charges}</span>`;
                }

                apString += "&nbsp;";
                break;
        }

        if (itemData.system.combatAction.cost == "actions") {
            const ap = itemData.system.combatAction.actionPointCost;
            for (let i = 0; i < ap; i++) {
                apString += "<i class='fas fa-diamond'></i>";
            }
        }
        else {
            switch (itemData.system.combatAction.cost) {
                case "free":
                    apString += "<i class='fal fa-diamond'></i>";
                    break;
                case "reaction":
                case "reaction_limited":
                    apString += "<i class='fas fa-diamond-turn-right'></i>";
                    break;
            }
        }

        itemData.system.combatAction.usesCharges = !(itemData.system.combatAction.frequency == "at-will" || itemData.system.combatAction.frequency == "passive");


        if(itemData.system.combatAction.usesCharges)
        {
            if(apString != "")
                apString += "<br>";
            apString += "<div id='actionCharges' style='text-wrap: balance;'>";
            for(let i = 0; i < itemData.system.combatAction.maxCharges; i++)
            {
                let title = itemData.system.combatAction.maxCharges > 1 ? `title="${i+1}"` : "";
                if(i < itemData.system.combatAction.charges)
                    apString += `<i ${title} class='fas fa-circle' data-action='setCombatActionCharges' data-item='${itemData.uuid}' id='${i}'></i>`;
                else
                    apString += `<i ${title} class='fal fa-circle' data-action='setCombatActionCharges' data-item='${itemData.uuid}' id='${i}'></i>`;
            }
            apString += "</div>";
        }

        itemData.system.combatAction.actionPointString = apString;
    }
}