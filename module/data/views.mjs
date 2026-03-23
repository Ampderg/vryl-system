const { api, sheets } = foundry.applications;

export class VrylActorSheet extends api.HandlebarsApplicationMixin(sheets.ActorSheetV2) {

    constructor(options = {}) {
        super(options);

        Hooks.on(`vryl-rollDataUpdated`, () => {
            console.log("Roll data updated for actor: " + this.document.id);
            this.renderSelectedAttributes();
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
            onEditImage: this._onEditImage,
            // viewDoc: this._viewDoc,
            // createDoc: this._createDoc,
            // deleteDoc: this._deleteDoc,
            // toggleEffect: this._toggleEffect,
            "attribute-roll": VrylActorSheet._attributeRoll,
            "edit-attribute-pips": VrylActorSheet._editAttributePips,

            "willpowerSpend": this._willpowerSpend,
            "willpowerRest": this._rest,
            "willpowerBurn": this._willpowerBurn,
            "conditionSave": this._conditionSave,
            "willpowerRoll": this._willpowerRoll,
            "edit-willpower-pips": this._editWillpowerPips,

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
            ],
            labelPrefix: "vryl.tab", // Optional. Prepended to the id to generate a localization key
            initial: "attribute-list", // Set the initial tab
        },
    };

    static PARTS = {
        header: {
            template: `systems/vryl/templates/parts/header.html`
        },
        tabs: {
            // Foundry-provided generic template
            template: 'systems/vryl/templates/parts/side-tabs.html',
            // classes: ['sysclass'], // Optionally add extra classes to the part for extra customization
        },
        attribute: {
            template: `systems/vryl/templates/parts/attributes-list.html`
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

        this.renderSelectedAttributes();
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
        
        // Prepare character data and items.
        if (context.actor.type == 'character') {
            // this._prepareItems(context);
            this._prepareCharacterData(context);
        }

        // Add the actor's data to context.data for easier access, as well as flags.
        context.system = context.actor.system;
        context.flags = context.actor.flags;

        context.system.attributeTypes = game.settings.get(CONFIG.SystemId, 'attribute_types');
        context.system.attributeCategories = game.settings.get(CONFIG.SystemId, 'attribute_categories');
        context.system.max_level = game.settings.get(CONFIG.SystemId, 'attribute_max_level');
        context.system.max_willpower = game.settings.get(CONFIG.SystemId, 'max_willpower');

        for(const a of context.system.attributes_array)
        {
            const combinedLevel = a.level + a.heroicLevel + a.bonusDice; 
            a.combinedLevel = Math.min(Math.max(combinedLevel, 0), 5);
            a.combinedHeroicLevel = Math.min(Math.max(combinedLevel - 5, 0), 5);
        }


        // Add roll data for TinyMCE editors.
        context.rollData = context.actor.getRollData();

        // Prepare active effects
        // context.effects = prepareActiveEffectCategories(
        //     // A generator that returns all effects stored on the actor
        //     // as well as any items
        //     this.actor.allApplicableEffects()
        // );


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
            default:
        }
        return context;
    }

    updateXP()
    {
        let xp = parseInt(this.element.querySelector("input#xp-input").value);
        if(isNaN(xp)){
            const xpField = CONFIG.Actor.dataModels.character.schema.getField('xp');
            xp = xpField.initial;
        }
        this.document.update({[`system.xp`]: xp});
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
        const items = [];

        // Iterate through items, allocating to containers
        for (let i of context.items) {
            i.img = i.img || DEFAULT_TOKEN;
            if (i.type === 'tactical_action') {
                gear.push(i);
            }
            else if (i.type === 'status') {
                statuses.push(i);
            }
            else if (i.type === 'item') {
                items.push(i);
            }
        }

        // Assign and return
        context.tacticalActions = tacticalActions;
        context.statuses = statuses;
        context.items = items;
    }

    /**
     * Organize and classify Items for Character sheets.
     *
     * @param {Object} actorData The actor to prepare.
     *
     * @return {undefined}
     */
    _prepareCharacterData(context) {
        let attributes = context.actor.system.attributes;
        const attributeData = game.settings.get(CONFIG.SystemId, 'attributes');
        const categoryData = game.settings.get(CONFIG.SystemId, 'attribute_categories');
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
        context.actor.system.attributes_array = Object.values(attributes);
    }

    prepareActiveEffectCategories(effects) {
        // Define effect header categories
        const categories = {
            temporary: {
                type: 'temporary',
                label: game.i18n.localize('VRYL.Effect.Temporary'),
                effects: [],
            },
            passive: {
                type: 'passive',
                label: game.i18n.localize('VRYL.Effect.Passive'),
                effects: [],
            },
            inactive: {
                type: 'inactive',
                label: game.i18n.localize('VRYL.Effect.Inactive'),
                effects: [],
            },
        };

        // Iterate over active effects, classifying them into categories
        for (let e of effects) {
            if (e.disabled) categories.inactive.effects.push(e);
            else if (e.isTemporary) categories.temporary.effects.push(e);
            else categories.passive.effects.push(e);
        }
        return categories;
    }

    //#endregion

    //#region Sheet interaction



    _closeContextMenu() {
        if (!this.contextMenu) return;

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

    async renderSelectedAttributes() {
        if (!this.element) return;
        if (!CONFIG.ROLL_DATA.rollActors.has(this.document.id)) return;
        const selectedAttributes = CONFIG.ROLL_DATA.rollActors.get(this.document.id).attributes;

        let allSelected = this.element.querySelectorAll(`.attribute-name.selected.actor-${this.document.id}.attribute-name`);
        for (const element of allSelected) {
            element.classList.remove(`selected`);
        }

        for (const a of selectedAttributes) {
            let selectedElements = this.element.querySelectorAll(`.attribute-name.actor-${this.document.id}.attribute-name-${a.dataName}`);

            for (let a of selectedElements) {
                a.classList.add(`selected`);
            }
        }
    }

    static async _attributeRoll(event, target) {
        const attributesArray = Object.values(this.document.system.attributes);
        const attribute = attributesArray.filter((a) => a.dataName == target.id)[0];
        await CONFIG.ui.rollBuilder.toggleAttribute(this.document, attribute, false);

        CONFIG.ui.rollBuilder.goToRollBuilder();
        CONFIG.ui.rollBuilder.updateRollData();
        await this.renderSelectedAttributes();
    }



    // #region Edit Attribute

    static async _editAttributePips(event, target) {
        this._closeContextMenu();
        event.preventDefault();
        console.log("Editing attribute pips");

        let data = {
            attribute: this.document.system.attributes[target.id],
            max_level: game.settings.get(CONFIG.SystemId, 'attribute_max_level'),
        };

        const path = `systems/vryl/templates/menus/context-edit-attribute-pips.html`;

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

                if (index < data.attribute.heroicLevel) pip.classList.add('fa-solid', 'fa-plus-circle');
                else if (index < data.attribute.level) pip.classList.add('fa-solid', 'fa-circle');
                else pip.classList.add('fa-regular', 'fa-circle');
            });
        }

        function updateBonusDice(bonusDice)
        {
            const num = element.querySelector('.context-edit-attribute-pips .bonus-dice-num');
            num.innerHTML = ((bonusDice >= 0) ? "+" : "") + bonusDice;
        }

        for (let c of clickable) {
            c.addEventListener('click', async (event) => {
                let change = 0;
                if (c.classList.contains('plus')) change = 1;
                else if (c.classList.contains('minus')) change = -1;

                if(c.classList.contains(`attribute-level`))
                {
                    console.log("Add pip");
                    
                    let combinedLevel = data.attribute.level + data.attribute.heroicLevel + change;
                    combinedLevel = Math.min(Math.max(combinedLevel, 0), 10);

                    if(combinedLevel != data.attribute.level + data.attribute.heroicLevel)
                    {
                        this.document.update({ [`system.attributes.${data.attribute.dataName}.level`]: Math.min(Math.max(combinedLevel, 0), 5) });
                        this.document.update({ [`system.attributes.${data.attribute.dataName}.heroicLevel`]: Math.min(Math.max(combinedLevel - 5, 0), 5) });
                        
                    }
                    updatePips();
                }
                else if (c.classList.contains(`attribute-bonus-dice`))
                {
                    const bonusDice = data.attribute.bonusDice + change;

                    updateBonusDice(bonusDice);
                    data.attribute.bonusDice = bonusDice;
                    this.document.update({ [`system.attributes.${data.attribute.dataName}.bonusDice`]: bonusDice});
                }
            });

            c.classList.add('listeners_bound');
            
        }

        updateBonusDice(data.attribute.bonusDice);
    }

    //#region Edit Image

    static async _onEditImage(event, target) {
        const attr = target.dataset.edit;
        const current = foundry.utils.getProperty(this.document, attr);
        const { img } =
            this.document.constructor.getDefaultArtwork?.(this.document.toObject()) ??
            {};
        const fp = new FilePicker({
            current,
            type: 'image',
            redirectToRoot: img ? [img] : [],
            callback: (path) => {
                this.document.update({ [attr]: path });
            },
            top: this.position.top + 40,
            left: this.position.left + 10,
        });
        return fp.browse();
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

    }

    static async _willpowerBurn(event, target) {

    }

    static async _willpowerRoll(event, target) {

    }

    static async _editWillpowerPips(event, target) {
        this._closeContextMenu();
        event.preventDefault();
        console.log("Editing willpower pips");

        let data = {
            attribute: this.document.system.willpower,
            max_level: game.settings.get(CONFIG.SystemId, 'max_willpower'),
        };

        const path = `systems/vryl/templates/menus/context-edit-willpower-pips.html`;

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

                if (index < data.attribute.level) pip.classList.add('fa-solid', 'fa-circle');
                else if (index < data.attribute.max) pip.classList.add('fa-regular', 'fa-circle-dot');
                else pip.classList.add('fa-regular', 'fa-circle');
            });
        }

        function updateBonusDice(bonusDice)
        {
            const num = element.querySelector('.context-edit-willpower-pips .bonus-dice-num');
            num.innerHTML = ((bonusDice >= 0) ? "+" : "") + bonusDice;
        }

        updateBonusDice(data.attribute.bonusDice);

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

                const oldVal = data.attribute[prop];
                const oldSpent = data.attribute.max - data.attribute.level;
                data.attribute[prop] += change;

                data.attribute[prop] = Math.max(Math.min(data.attribute[prop], 10), 0)
                if (prop == 'level')
                    data.attribute.level = Math.min(data.attribute.level, data.attribute.max);

                if (data.attribute[prop] != oldVal) {
                    this.document.update({ [`system.willpower.${prop}`]: data.attribute[prop] });

                    if (prop == 'max') {
                        data.attribute.level = data.attribute.max - oldSpent;

                        if (data.attribute.max < data.attribute.level)
                            data.attribute.level = data.attribute.max;

                        if (data.attribute.level < 0) data.attribute.level = 0;

                        this.document.update({ [`system.willpower.level`]: data.attribute.level });
                    }
                    else if (prop == 'bonusDice')
                    {
                        updateBonusDice(data.attribute.bonusDice);
                    }

                    this.document.system.willpower = data.attribute;
                }
                updatePips();
            });

        }
    }
}

//#region Init

Hooks.once(`init`, () => {

});