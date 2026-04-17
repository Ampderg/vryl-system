const { api, sheets } = foundry.applications;
import * as effectsFunctions from '../helpers/effects.mjs';

export class VrylActorSheet extends api.HandlebarsApplicationMixin(sheets.ActorSheetV2) {

    constructor(options = {}) {
        super(options);

        Hooks.on(`vryl-rollDataUpdated`, () => {
            console.log("Roll data updated for actor: " + this.document.id);
            VrylActorSheet.renderSelectedAttributes(this.element, this.document.id);
        });

        Hooks.on("combatStart", (combat) => {
            this.render();
        });

        Hooks.on("deleteCombat", (combat, options, userId) => {
            this.render();
        });
    }


    /** @override */
    static DEFAULT_OPTIONS = {
        classes: ["vryl", "sheet", "actor", "character-sheet"],
        position: {
            width: 600,
            height: 800,
        },
        window: {
            resizable: true,
            title: 'Character Sheet' // Just the localization key
        },
        actions: {
            onEditImage: effectsFunctions.onEditImage,
            viewDoc: effectsFunctions.viewDoc,
            createDoc: effectsFunctions.createDoc,
            deleteDoc: effectsFunctions.deleteDoc,
            toggleEffect: effectsFunctions.toggleEffect,
            toggleInstantEffect: effectsFunctions.toggleInstantEffect,

            "attribute-roll": VrylActorSheet._attributeRoll,
            "edit-attribute-pips": VrylActorSheet._editAttributePips,

            "willpowerSpend": this._willpowerSpend,
            "willpowerRest": this._rest,
            "willpowerBurn": this._willpowerBurn,
            "conditionSave": this._conditionSave,
            "willpowerRoll": this._willpowerRoll,
            "edit-willpower-pips": this._editWillpowerPips,

            equipItem: this._equipItem,

        },
        // Custom property that's merged into `this.options`
        // dragDrop: [{ dragSelector: '.draggable', dropSelector: null }],
        form: {
            submitOnChange: true,
        },

    }

    /** @type {Record<string, foundry.applications.types.ApplicationTabsConfiguration>} */
    static TABS = {
        primary: {
            tabs: [
                {
                    id: "attribute-list",
                    icon: "fa fa-circle-user",
                },
                {
                    id: "inventory",
                    icon: "fa fa-suitcase",
                },
                {
                    id: "aspects",
                    icon: "fa fa-list",
                },
                {
                    id: "tactical",
                    icon: "fa fa-swords",
                }
                ,
                {
                    id: "notes",
                    icon: "fa fa-feather-pointed",
                }
                ,
                {
                    id: "effects",
                    icon: "fa-solid fa-wand-magic-sparkles",
                }
            ],
            labelPrefix: "vryl.tab", // Optional. Prepended to the id to generate a localization key
            initial: "attribute-list", // Set the initial tab
        },
    };

    static PARTS = {
        header: {
            template: `systems/vryl/templates/parts/header.hbs`
        },
        tabs: {
            // Foundry-provided generic template
            template: 'systems/vryl/templates/parts/side-tabs.hbs',
            // classes: ['sysclass'], // Optionally add extra classes to the part for extra customization
        },
        attribute: {
            template: `systems/vryl/templates/actor/attributes.hbs`
        },
        inventory: {
            template: `systems/vryl/templates/actor/inventory.hbs`
        },
        effects: {
            template: `systems/vryl/templates/actor/effects.hbs`
        },
    }

    //#region Rendering

    /** @override */
    _onFirstRender(context, options) {
        super._onFirstRender(context, options);

        console.log("Setting up context menu close listener...");
        document.addEventListener('click', (e) => {
            if (this.contextMenu && !e.defaultPrevented
                && !this.contextMenu.element.contains(e.target)) {
                console.log("Closing context menu for actor: " + this.document.id);
                this._closeContextMenu();
            }
        });

    }

    _onRender(context, options) {
        super._onRender(context, options);

        let xpElement = this.element.querySelector("input#xp-input");
        xpElement.addEventListener('change', (event) => { this.updateXP() });

        VrylActorSheet.renderSelectedAttributes(this.element, this.document.id);
    }

    //#region Prepare Context
    /** @override */
    async _prepareContext(options) {
        // Retrieve the data structure from the base sheet. You can inspect or log
        // the context variable to see the structure, but some key properties for
        // sheets are the actor object, the data object, whether or not it's
        // editable, the items array, and the effects array.
        const context = await super._prepareContext(options);

        // Use a safe clone of the actor data for further operations.
        context.actor = this.actor;
        context.img = this.actor.img;
        context.name = this.actor.name;
        context.system = context.actor.system;
        context.flags = context.actor.flags;

        // Prepare character data and items.
        if (context.actor.type == 'character') {
            this._prepareItems(context);
            this._prepareCharacterData(context);
        }

        // Add the actor's data to context.data for easier access, as well as flags.



        // Add roll data for TinyMCE editors.
        context.rollData = context.actor.getRollData();

        // Prepare active effects
        context.effects = effectsFunctions.prepareActiveEffectCategories(
            // A generator that returns all effects stored on the actor
            // as well as any items
            this.actor.allApplicableEffects()
        );


        console.log("Preparing data for " + context.actor.name);
        console.log(context);

        context.tabs = this._prepareTabs("primary");
        this._preparePartContext('attribute-list', context);

        return context;
    }

    async _preparePartContext(partId, context) {
        super._preparePartContext(partId, context);
        switch (partId) {
            case 'attribute-list':
            case 'inventory':
            case 'aspects':
            case 'tactical':
            case 'notes':
                context.tab = context.tabs[partId];
                break;
            case 'effects':
                context.tab = context.tabs[partId];
                break;
            default:
        }
        return context;
    }

    updateXP() {
        let xp = parseInt(this.element.querySelector("input#xp-input").value);
        if (isNaN(xp)) {
            const xpField = CONFIG.Actor.dataModels.character.schema.getField('xp');
            xp = xpField.initial;
        }
        this.document.update({ [`system.xp`]: xp });
    }

    /**
     * Organize and classify Items for Character sheets.
     *
     * @param {Object} actorData The actor to prepare.
     *
     * @return {undefined}
     */
    _prepareItems(context) {
        // Initialize containers.
        const tacticalActions = [];
        const statuses = [];
        const gear = [];

        // Iterate through items, allocating to containers
        for (let i of context.document.items) {
            i.img = i.img || DEFAULT_TOKEN;
            if (i.type === 'combatAbility') {
                tacticalActions.push(i);
            }
            else if (i.type === 'status') {
                statuses.push(i);
            }
            else if (i.type === 'gear') {
                gear.push(i);
            }
        }

        // Assign and return
        context.tacticalActions = tacticalActions;
        context.statuses = statuses;
        context.gear = gear;
    }

    /**
     * Organize and classify Items for Character sheets.
     *
     * @param {Object} actorData The actor to prepare.
     *
     * @return {undefined}
     */
    _prepareCharacterData(context) {
        VrylActorSheet.prepareAttributeData(context.actor.system);
    }

    static prepareAttributeData(system) {
        let attributes = system.attributes;
        const attributeData = game.settings.get(CONFIG.SystemId, 'attributes');
        const typeData = game.settings.get(CONFIG.SystemId, 'attribute-types');
        const categoryData = game.settings.get(CONFIG.SystemId, 'attribute-categories');
        const keysArray = Object.keys(attributes);
        keysArray.forEach(k => {
            const attributeInfo = attributeData.find(a => a.dataName == k);
            if (attributeInfo) {
                attributes[k].exists = true;
                attributes[k].dataName = k;
                attributes[k].name = attributeInfo.name;
                attributes[k].sorting = attributeInfo.sorting;
                attributes[k].category = attributeInfo.category;
                attributes[k].categoryDataName = categoryData[attributes[k].category].dataName;
            }
            else {
                attributes[k].exists = false;
            }
        });

        system.attributes_array = Object.values(attributes);

        categoryData.forEach(category => {
            const typeInfo = typeData[category.type];
            category.typeDataName = typeInfo.dataName;
        });

        system.attributeTypes = typeData;
        system.attributeCategories = categoryData;
        system.maxLevel = game.settings.get(CONFIG.SystemId, 'attribute-max-level');
        system.maxWillpower = game.settings.get(CONFIG.SystemId, 'max-willpower');

        for (const a of system.attributes_array) {
            const combinedLevel = a.level + a.heroicLevel + a.bonusDice;
            a.combinedLevel = Math.min(Math.max(combinedLevel, 0), 5);
            a.combinedHeroicLevel = Math.min(Math.max(combinedLevel - 5, 0), 5);
        }
    }

    //#endregion

    //#region Sheet interaction



    _closeContextMenu() {
        if (!this.contextMenu) return;

        Hooks.callAll(`vryl-actor-context-menu-closed`);
        console.log("Closing context menu...");
        this.contextMenu.close({ animate: false });
        this.contextMenu = null;
    }

    /* -------------------------------------------- */

    /**
     * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
     * @param {Event} event   The originating click event
     * @private
     */
    // async _onItemCreate(event) {
    //     event.preventDefault();
    //     const header = event.currentTarget;
    //     // Get the type of item to create.
    //     const type = header.dataset.type;
    //     // Grab any data associated with this control.
    //     const data = duplicate(header.dataset);
    //     // Initialize a default name.
    //     const name = `New ${type.capitalize()}`;
    //     // Prepare the item object.
    //     const itemData = {
    //         name: name,
    //         type: type,
    //         data: data
    //     };
    //     // Remove the type from the dataset since it's in the itemData.type prop.
    //     delete itemData.data["type"];

    //     // Finally, create the item!
    //     return await Item.create(itemData, { parent: this.actor });
    // }

    //#endregion

    //#region Roll

    static async renderSelectedAttributes(element, actorId) {
        if (!element) return;

        let allSelected = element.querySelectorAll(`.attribute-name.selected.actor-${actorId}.attribute-name, .willpower-roll`);
        for (const element of allSelected) {
            element.classList.remove(`selected`);
        }

        if (!CONFIG.ROLL_DATA.rollActors.has(actorId)) return;
        const actor = CONFIG.ROLL_DATA.rollActors.get(actorId);
        const selectedAttributes = actor.attributes;

        for (const a of selectedAttributes) {
            let selectedElements = element.querySelectorAll(`.attribute-name.actor-${actorId}.attribute-name-${a.dataName}`);

            for (let a of selectedElements) {
                a.classList.add(`selected`);
            }
        }

        if (actor.willpower && !isNaN(actor.willpower.level)) {
            element.querySelector(`.willpower-roll`).classList.add(`selected`);
        }
    }

    static async _attributeRoll(event, target) {
        const attributesArray = Object.values(this.document.system.attributes);
        const attribute = attributesArray.filter((a) => a.dataName == target.id)[0];
        await CONFIG.ui.rollBuilder.toggleAttribute(this.document, attribute, false);

        CONFIG.ui.rollBuilder.goToRollBuilder();
        CONFIG.ui.rollBuilder.updateRollData();
        VrylActorSheet.renderSelectedAttributes(this.element, this.document.id);
    }



    // #region Edit Attribute

    static async _editAttributePips(event, target) {
        this._closeContextMenu();
        event.preventDefault();
        console.log("Editing attribute pips");

        let data = {
            attribute: this.document.system.attributes[target.id],
            source: structuredClone(this.document._source.system.attributes[target.id]),
            maxLevel: game.settings.get(CONFIG.SystemId, 'attribute-max-level'),
        };

        const path = `systems/vryl/templates/menus/context-edit-attribute-pips.hbs`;

        const rect = target.parentElement.getBoundingClientRect();

        const dialog = new foundry.applications.api.DialogV2({
            window: {
                title: data.attribute.name,
            },
            content: await renderTemplate(path, data),
            buttons: [{
                action: "apply",
                label: "Apply",
                default: true,
                // callback: (event, button, dialog) => button.form.elements.choice.value
            }],
            position: {
                left: rect.left + 40,
                top: rect.top - 37,
                width: rect.width,
            },
        });

        this.contextMenu = await dialog.render({ force: true });
        let element = this.contextMenu.element;

        console.log(element);
        element.querySelectorAll(`.window-header`)[0].remove();
        element.querySelectorAll(`.form-footer`)[0].remove();

        const clickable = element.querySelectorAll('.clickable.context-edit-attribute-pips:not(.listeners_bound)');

        function updatePips() {
            const pips = element.querySelectorAll('.context-edit-attribute-pips.attribute-level-pip-large');
            pips.forEach((pip) => {
                const index = parseInt(pip.id);
                if (pip.classList.contains('fa-solid')) pip.classList.remove('fa-solid');
                if (pip.classList.contains('fa-regular')) pip.classList.remove('fa-regular');
                if (pip.classList.contains('fa-circle')) pip.classList.remove('fa-circle');
                if (pip.classList.contains('fa-plus-circle')) pip.classList.remove('fa-plus-circle');

                if (index < data.source.heroicLevel) pip.classList.add('fa-solid', 'fa-plus-circle');
                else if (index < data.source.level) pip.classList.add('fa-solid', 'fa-circle');
                else pip.classList.add('fa-regular', 'fa-circle');
            });
        }

        function updateBonusDice(bonusDice) {
            if (isNaN(bonusDice) || bonusDice == null) bonusDice = 0;
            const num = element.querySelector('.context-edit-attribute-pips .bonus-dice-num');
            num.innerHTML = ((bonusDice >= 0) ? "+" : "") + bonusDice;
        }

        for (let c of clickable) {
            c.addEventListener('click', async (event) => {
                let change = 0;
                if (c.classList.contains('plus')) change = 1;
                else if (c.classList.contains('minus')) change = -1;

                if (c.classList.contains(`attribute-level`)) {
                    console.log("Add pip");

                    data.source.level += change;
                    let diff = data.source.level - 5;
                    if (diff > 0) {
                        data.source.level = 5;
                        data.source.heroicLevel += diff;
                    }
                    else {
                        diff = Math.min(Math.abs(diff), data.source.heroicLevel)
                        data.source.heroicLevel -= diff;
                        data.source.level += diff;
                    }

                    this.document.update({ [`system.attributes.${data.attribute.dataName}.level`]: data.source.level });
                    this.document.update({ [`system.attributes.${data.attribute.dataName}.heroicLevel`]: data.source.heroicLevel });

                    //}
                    updatePips();
                }
                else if (c.classList.contains(`attribute-bonus-dice`)) {
                    const bonusDice = data.source.bonusDice + change;

                    updateBonusDice(bonusDice);
                    data.attribute.bonusDice = bonusDice;
                    data.source.bonusDice = bonusDice;
                    this.document.update({ [`system.attributes.${data.attribute.dataName}.bonusDice`]: bonusDice });
                }
            });

            c.classList.add('listeners_bound');

        }
        updatePips();
        updateBonusDice(data.source.bonusDice);
    }

    //#region Willpower

    static async _willpowerSpend(event, target) {
        CONFIG.ui.rollBuilder.populateRollActor(this.document);

        let rollActor = CONFIG.ROLL_DATA.rollActors.get(this.document.id);
        if (!rollActor.willpower)
            rollActor.willpower = {};

        if (!rollActor.willpower.guaranteedSuccesses)
            rollActor.willpower.guaranteedSuccesses = 0;

        if (rollActor.willpower.guaranteedSuccesses < this.document.system.willpower.level)
            rollActor.willpower.guaranteedSuccesses++;

        CONFIG.ui.rollBuilder.goToRollBuilder();
        CONFIG.ui.rollBuilder.updateRollData();
    }

    static async _conditionSave(event, target) {

    }

    static async _rest(event, target) {
        CONFIG.ui.rollBuilder.clearRoll(false);

        const missingWillpower = this.document.system.willpower.max - this.document.system.willpower.level;
        if (missingWillpower > 0) {
            CONFIG.ROLL_DATA.guaranteedSuccesses = 1;
            CONFIG.ROLL_DATA.bonusDice = missingWillpower - 1;
        }

        CONFIG.ui.rollBuilder.addAction(`no-willpower-spend`, this.document, false);
        CONFIG.ui.rollBuilder.addAction(`successes-regenerate-willpower`, this.document, false);

        CONFIG.ui.rollBuilder.goToRollBuilder();
        CONFIG.ui.rollBuilder.updateRollData();
    }


    static async _willpowerBurn(event, target) {
        CONFIG.ui.rollBuilder.clearRoll(false);

        let attribute = this.document.system.willpower;
        attribute.dataName = "willpower";
        attribute.name = "Willpower";

        await CONFIG.ui.rollBuilder.toggleAttribute(this.document, attribute, true);

        CONFIG.ui.rollBuilder.addAction(`no-willpower-spend`, this.document, false);
        CONFIG.ui.rollBuilder.addAction(`failures-lose-willpower`, this.document, false);

        CONFIG.ui.rollBuilder.goToRollBuilder();
        CONFIG.ui.rollBuilder.updateRollData();
    }

    static async _willpowerRoll(event, target) {
        let attribute = this.document.system.willpower;
        attribute.dataName = "willpower";
        attribute.name = "Willpower";

        await CONFIG.ui.rollBuilder.toggleAttribute(this.document, attribute, true);

        CONFIG.ui.rollBuilder.goToRollBuilder();

        await VrylActorSheet.renderSelectedAttributes(this.element, this.document.id);
    }

    static async _editWillpowerPips(event, target) {
        this._closeContextMenu();
        event.preventDefault();
        console.log("Editing willpower pips");

        let data = {
            attribute: this.document.system.willpower,
            source: structuredClone(this.document._source.system.willpower),
            maxLevel: game.settings.get(CONFIG.SystemId, 'max-willpower'),
        };

        const path = `systems/vryl/templates/menus/context-edit-willpower-pips.hbs`;

        const rect = target.parentElement.getBoundingClientRect();

        const dialog = new foundry.applications.api.DialogV2({
            window: {
                title: "Willpower",
            },
            content: await renderTemplate(path, data),
            buttons: [{
                action: "apply",
                label: "Apply",
                default: true,
                // callback: (event, button, dialog) => button.form.elements.choice.value
            }],
            position: {
                left: rect.left + 2,
                top: rect.top - 17,
                width: 50,
            },
        });

        this.contextMenu = await dialog.render({ force: true });
        let element = this.contextMenu.element;

        console.log(element);
        element.querySelectorAll(`.window-header`)[0].remove();
        element.querySelectorAll(`.form-footer`)[0].remove();

        const clickable = element.querySelectorAll('.clickable.context-edit-willpower-pips:not(.listeners_bound)');

        function updatePips() {
            const pips = element.querySelectorAll('.context-edit-willpower-pips.attribute-level-pip-large');
            pips.forEach((pip) => {
                const index = parseInt(pip.id);
                if (pip.classList.contains('fa-solid')) pip.classList.remove('fa-solid');
                if (pip.classList.contains('fa-regular')) pip.classList.remove('fa-regular');
                if (pip.classList.contains('fa-circle')) pip.classList.remove('fa-circle');
                if (pip.classList.contains('fa-circle-dot')) pip.classList.remove('fa-circle-dot');

                if (index < data.source.level) pip.classList.add('fa-solid', 'fa-circle');
                else if (index < data.source.max) pip.classList.add('fa-regular', 'fa-circle-dot');
                else pip.classList.add('fa-regular', 'fa-circle');
            });
        }

        function updateBonusDice(bonusDice) {
            if (isNaN(bonusDice) || bonusDice == null) bonusDice = 0;
            const num = element.querySelector('.context-edit-willpower-pips .bonus-dice-num');
            num.innerHTML = ((bonusDice >= 0) ? "+" : "") + bonusDice;
        }

        updatePips();
        updateBonusDice(data.source.bonusDice);

        for (let c of clickable) {
            c.classList.add('listeners_bound');
            c.addEventListener('click', async (event) => {
                let prop = '';
                if (c.classList.contains('willpowerCurrent'))
                    prop = 'level';
                else if (c.classList.contains('willpowerMax'))
                    prop = 'max';
                else if (c.classList.contains('willpower-bonus-dice'))
                    prop = 'bonusDice';

                let change = 0;
                if (c.classList.contains('plus'))
                    change = 1;
                else if (c.classList.contains('minus'))
                    change = -1;

                const oldVal = data.source[prop];
                const oldSpent = data.source.max - data.source.level;
                data.source[prop] += change;

                if (prop != 'bonusDice')
                    data.source[prop] = Math.max(Math.min(data.source[prop], 10), 0)

                if (prop == 'level')
                    data.source.level = Math.min(data.source.level, data.source.max);

                if (data.source[prop] != oldVal) {
                    this.document.update({ [`system.willpower.${prop}`]: data.source[prop] });

                    if (prop == 'max') {
                        data.source.level = data.source.max - oldSpent;

                        if (data.source.max < data.source.level)
                            data.source.level = data.source.level = data.source.max;

                        if (data.source.level < 0) data.source.level = 0;

                        this.document.update({ [`system.willpower.level`]: data.source.level });
                    }
                    else if (prop == 'bonusDice') {
                        updateBonusDice(data.source.bonusDice);
                    }

                    data.attribute.level = data.source.level;
                    data.attribute.max = data.source.max;
                    data.attribute.bonusDice = data.source.bonusDice;

                    this.document.system.willpower = data.attribute;
                }
                updatePips();
            });

        }
    }

    //#region Inventory & Items

    static async _equipItem(event, target) {
        const item = effectsFunctions.getEmbeddedDocument(target, this);
        const equipSlot = this.document.system.equipment.slots[`${item.system.equipment.slotDataName}`];
        if(!equipSlot)
        {
            item.update({[`system.equipment.isEquipped`]: false });
            return;
        }
        const equipItemSlot = this.document.system.equipment.slotItems[`${item.system.equipment.slotDataName}`];
        let occupiedSlots = 0;
        for(let slot of equipItemSlot)
        {
            if(slot != undefined && slot != null)
                occupiedSlots++;
        }
        if(occupiedSlots + item.system.equipment.slotsFilled > equipSlot.slots)
        {
            item.update({[`system.equipment.isEquipped`]: false });
            ui.notifications.info(`There are not enough ${equipSlot.name} slots available to equip that item!`);
            return;
        }
        
        item.update({[`system.equipment.isEquipped`]: !item.system.equipment.isEquipped });
    }

    //#endregion

}

//#region Init

Hooks.once(`init`, () => {

});