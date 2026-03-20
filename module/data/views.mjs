const { api, sheets } = foundry.applications;

export class VrylActorSheet extends api.HandlebarsApplicationMixin(sheets.ActorSheetV2) {

    /** @override */
    static DEFAULT_OPTIONS = {
        classes: ["vryl", "sheet", "actor"],
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
        },
        // Custom property that's merged into `this.options`
        // dragDrop: [{ dragSelector: '.draggable', dropSelector: null }],
        form: {
            submitOnChange: true,
        },

    }


    static PARTS = {
        header: {
            template: `systems/vryl/templates/parts/header.html`
        },
        attributes: {
            template: `systems/vryl/templates/parts/attributes-list.html`
        },
    }

    //#region Prepare data for rendering on character sheet. NOT for actor data processing
    /** @override */
    async _prepareContext(options) {
        // Retrieve the data structure from the base sheet. You can inspect or log
        // the context variable to see the structure, but some key properties for
        // sheets are the actor object, the data object, whether or not it's
        // editable, the items array, and the effects array.
        const context = await super._prepareContext(options)

        // Use a safe clone of the actor data for further operations.
        context.actor = this.actor;

        // Add the actor's data to context.data for easier access, as well as flags.
        context.system = context.actor.system;
        context.flags = context.actor.flags;

        context.system = {};
        context.system.attributeTypes = game.settings.get(CONFIG.SystemId, 'attribute_types');
        context.system.attributeCategories = game.settings.get(CONFIG.SystemId, 'attribute_categories');
        context.system.max_level = game.settings.get(CONFIG.SystemId, 'attribute_max_level');

        // Prepare character data and items.
        if (context.actor.type == 'character') {
            // this._prepareItems(context);
            this._prepareCharacterData(context);
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


        return context;
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

    /** @override */
    _onFirstRender(context, options) {
        super._onFirstRender(context, options);

        console.log("Setting up context menu close listener...");
        document.addEventListener('click', (e) => {
            if (this.contextMenu && !e.defaultPrevented
                && !this.contextMenu.element.contains(e.target)) {
                this._closeContextMenu();
            }
        });

        const rollActors = CONFIG.ROLL_DATA.rollActors;
        rollActors.forEach((value, key) => {
            if (key == this.document.id) {
                value.attributes.forEach((attribute) => {
                    let clickedElements = document.querySelectorAll(`.actor-${this.document.id}.attribute-name-${attribute.dataName}`);
                    for (let a of clickedElements) {
                        a.classList.add(`selected`);
                    }
                });
            }
        })

    }

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

    static async _attributeRoll(event, target) {
        if (!CONFIG.ROLL_DATA.rollActors.has(this.document.id))
            CONFIG.ROLL_DATA.rollActors.set(this.document.id, {
                name: this.document.name,
                attributes: []
            });

        const clickedAttribute = this.document.system.attributes[target.id];

        const attributeCategories = game.settings.get(CONFIG.SystemId, 'attribute_categories');
        const attributeTypes = game.settings.get(CONFIG.SystemId, 'attribute_types');

        const clickedType = attributeTypes[attributeCategories[clickedAttribute.category].type];

        if (!clickedType.multipleSkillsUsableAtOnce) {
            let allSelected = document.querySelectorAll(`.attribute-name.selected.actor-${this.document.id}.attribute-type-${clickedType.dataName}`);
            for (let a of allSelected) {
                CONFIG.ui.rollBuilder.deselectAttribute(this.document.id, a.parentElement.id, false);
            }
        }

        let clickedElements = document.querySelectorAll(`.attribute-name.actor-${this.document.id}.attribute-name-${clickedAttribute.dataName}`);
        for (let a of clickedElements) {
            a.classList.add(`selected`);
        }

        CONFIG.ROLL_DATA.rollActors.get(this.document.id).attributes.push(clickedAttribute);

        window.ui.sidebar.expand()
        window.ui.sidebar.changeTab("rollBuilder", "primary");
        CONFIG.ui.rollBuilder.updateRollData();
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
            content: await renderTemplate(`systems/vryl/templates/menus/context-edit-attribute-pips.html`, data),
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
        element.firstChild.remove();
        element.firstChild.firstChild.lastElementChild.remove();

        const clickable = element.querySelectorAll('.clickable.context-edit-attribute-pips:not(.listeners_bound)');

        function updatePips() {
            const pips = element.querySelectorAll('.attribute-level-pip-large');
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

        for (let c of clickable) {
            c.classList.add('listeners_bound');
            if (c.classList.contains('plus'))
                c.addEventListener('click', async (event) => {
                    console.log("Add pip");

                    if (data.attribute.level < data.max_level) {
                        data.attribute.level++;
                        this.document.update({ [`system.attributes.${data.attribute.dataName}.level`]: data.attribute.level });

                    }
                    else if (data.attribute.heroicLevel < data.max_level) {
                        data.attribute.heroicLevel++;
                        this.document.update({ [`system.attributes.${data.attribute.dataName}.heroicLevel`]: data.attribute.heroicLevel });
                    }
                    updatePips();
                });
            else if (c.classList.contains('minus'))
                c.addEventListener('click', async (event) => {
                    console.log("Subtract pip");

                    if (data.attribute.heroicLevel > 0) {
                        data.attribute.heroicLevel--;
                        this.document.update({ [`system.attributes.${data.attribute.dataName}.heroicLevel`]: data.attribute.heroicLevel });
                    }
                    else if (data.attribute.level > 0) {
                        data.attribute.level--;
                        this.document.update({ [`system.attributes.${data.attribute.dataName}.level`]: data.attribute.level });
                    }
                    updatePips();
                });
        }
    }

    static async _onEditImage(event, target) {
        const field = target.dataset.field || "img"
        const current = foundry.utils.getProperty(this.document, field)

        const fp = new foundry.applications.apps.FilePicker({
            type: "image",
            current: current,
            callback: (path) => this.document.update({ [field]: path })
        })

        fp.render(true)
    }
}