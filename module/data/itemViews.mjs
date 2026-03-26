const { api, sheets } = foundry.applications;
import * as effectsFunctions from '../helpers/effects.mjs';

export class VrylItemSheet extends api.HandlebarsApplicationMixin(sheets.ItemSheetV2) {

    constructor(options = {}) {
        super(options);
    }

    /** @override */
    static DEFAULT_OPTIONS = {
        classes: ["vryl", "sheet", "item", "character-sheet"],
        position: {
            width: 400,
            height: 500,
        },
        window: {
            resizable: true,
            title: 'Item Sheet' // Just the localization key
        },
        actions: {
            onEditImage: effectsFunctions.onEditImage,
            viewDoc: effectsFunctions.viewDoc,
            createDoc: effectsFunctions.createDoc,
            deleteDoc: effectsFunctions.deleteDoc,
            toggleEffect: effectsFunctions.toggleEffect,
            toggleInstantEffect: effectsFunctions.toggleInstantEffect,

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
        effects: {
            template: `systems/vryl/templates/items/effects.hbs`
        },
    }

    /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    // const context = {
    //   // Validates both permissions and compendium status
    //   editable: this.isEditable,
    //   owner: this.document.isOwner,
    //   limited: this.document.limited,
    //   // Add the item document.
    //   item: this.document,
    //   actor: this.document,
    //   // Adding system and flags for easier access
    //   system: this.document.system,
    //   flags: this.document.flags,
    // };


    context.actor = this.document;
    context.img = this.document.img;
    context.name = this.document.name;
    context.system = context.document.system;
    context.flags = context.document.flags;

    context.effects = effectsFunctions.prepareActiveEffectCategories(this.document.effects);
    context.isItemSheet = true;

    return context;
  }

  /** @override */
  async _preparePartContext(partId, context) {
    
    return context;
  }
}

//#region Init

Hooks.once(`init`, () => {

});