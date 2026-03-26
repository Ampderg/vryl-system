const { api, sheets } = foundry.applications;
import { prepareActiveEffectCategories } from '../helpers/effects.mjs';

export class VrylItemSheet extends api.HandlebarsApplicationMixin(sheets.ItemSheetV2) {

    constructor(options = {}) {
        super(options);

        Hooks.on(`vryl-rollDataUpdated`, () => {
            console.log("Roll data updated for actor: " + this.document.id);
            VrylActorSheet.renderSelectedAttributes(this.element, this.document.id);
        });
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
            onEditImage: this._onEditImage,
            viewDoc: this._viewDoc,
            createDoc: this._createDoc,
            deleteDoc: this._deleteDoc,
            toggleEffect: this._toggleEffect,

            toggleInstantEffect: this._toggleInstantEffect,

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
            template: `systems/vryl/templates/parts/effects.hbs`
        },
    }

    /** @override */
  async _prepareContext(options) {
    const context = {
      // Validates both permissions and compendium status
      editable: this.isEditable,
      owner: this.document.isOwner,
      limited: this.document.limited,
      // Add the item document.
      item: this.document,
      // Adding system and flags for easier access
      system: this.document.system,
      flags: this.document.flags,
    };

    context.img = this.document.img;
    context.name = this.document.name;

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