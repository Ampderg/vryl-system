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
            width: 450,
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
            equipSlotChanged: this._onEquipSlotChanged,
        },
        // Custom property that's merged into `this.options`
        // dragDrop: [{ dragSelector: '.draggable', dropSelector: null }],
        form: {
            submitOnChange: true,
        },

        // Custom property that's merged into `this.options`
        dragDrop: [{ dragSelector: '.draggable', dropSelector: null }],
    }

    static PARTS = {
        header: {
            template: `systems/vryl/templates/parts/header.hbs`
        },
        // summary: {
        //     template: 'systems/boilerplate/templates/item/description.hbs',
        // },
        description: {
            template: `systems/vryl/templates/items/description.hbs`
        },
        equipmentSettings: {
            template: `systems/vryl/templates/items/equipmentSettings.hbs`
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
    context.item = this.document;
    context.img = this.document.img;
    context.name = this.document.name;
    context.system = context.document.system;
    context.flags = context.document.flags;

    context.enrichedDescription = await TextEditor.enrichHTML(
          this.item.system.description,
          {
            // Whether to show secret blocks in the finished html
            secrets: this.document.isOwner,
            // Data to fill in for inline rolls
            rollData: this.item.getRollData(),
            // Relative UUID resolution
            relativeTo: this.item,
          }
        );

    context.effects = effectsFunctions.prepareActiveEffectCategories(this.document.effects);
    context.isItemSheet = true;

    return context;
  }


  /**
   * Actions performed after any render of the Application.
   * Post-render steps are not awaited by the render process.
   * @param {ApplicationRenderContext} context      Prepared context data
   * @param {RenderOptions} options                 Provided render options
   * @protected
   */
  async _onRender(context, options) {
    await super._onRender(context, options);
    new DragDrop.implementation({
      dragSelector: ".draggable",
      dropSelector: null,
      permissions: {
        dragstart: this._canDragStart.bind(this),
        drop: this._canDragDrop.bind(this)
      },
      callbacks: {
        dragstart: this._onDragStart.bind(this),
        dragover: this._onDragOver.bind(this),
        drop: this._onDrop.bind(this)
      }
    }).bind(this.element);
    // You may want to add other special handling here
    // Foundry comes with a large number of utility classes, e.g. SearchFilter
    // That you may want to implement yourself.
    const selectEquipSlotElement = this.element.querySelector(`select#equipSlotSelector`);
    selectEquipSlotElement.addEventListener("change", () => {
      this.document.update({ [`system.equipment.slotDataName`]: selectEquipSlotElement.value });
    });

    const selectEquipTimeElement = this.element.querySelector(`select#equipTimeSelector`);
    selectEquipTimeElement.addEventListener("change", () => {
      this.document.update({ [`system.equipment.equipTime`]: selectEquipTimeElement.value });
    });

    const equipSlotSlotsElement = this.element.querySelector(`input#equipSlotSlots`);
    equipSlotSlotsElement.addEventListener("change", () => {
      this.document.update({ [`system.equipment.slotsFilled`]: equipSlotSlotsElement.value });
    });
  }


  //#region Drag & Drop

  /**
   *
   * DragDrop
   *
   */

  /**
   * Define whether a user is able to begin a dragstart workflow for a given drag selector
   * @param {string} selector       The candidate HTML selector for dragging
   * @returns {boolean}             Can the current user drag this selector?
   * @protected
   */
  _canDragStart(selector) {
    // game.user fetches the current user
    return this.isEditable;
  }

  /**
   * Define whether a user is able to conclude a drag-and-drop workflow for a given drop selector
   * @param {string} selector       The candidate HTML selector for the drop target
   * @returns {boolean}             Can the current user drop on this selector?
   * @protected
   */
  _canDragDrop(selector) {
    // game.user fetches the current user
    return this.isEditable;
  }

  /**
   * Callback actions which occur at the beginning of a drag start workflow.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  _onDragStart(event) {
    const li = event.currentTarget;
    if ('link' in event.target.dataset) return;

    let dragData = null;

    // Active Effect
    if (li.dataset.effectId) {
      const effect = this.item.effects.get(li.dataset.effectId);
      dragData = effect.toDragData();
    }

    if (!dragData) return;

    // Set data transfer
    event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
  }

  /**
   * Callback actions which occur when a dragged element is over a drop target.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  _onDragOver(event) { }

  /**
   * Callback actions which occur when a dragged element is dropped on a target.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);
    const item = this.item;
    const allowed = Hooks.call('dropItemSheetData', item, this, data);
    if (allowed === false) return;

    // Although you will find implmentations to all doc types here, it is important to keep 
    // in mind that only Active Effects are "valid" for items.
    // Actors have items, but items do not have actors.
    // Items in items is not implemented on Foudry per default. If you need an implementation with that,
    // try to search how other systems do. Basically they will use the drag and drop, but they will store
    // the UUID of the item.
    // Folders can only contain Actors or Items. So, fall on the cases above.
    // We left them here so you can have an idea of how that would work, if you want to do some kind of
    // implementation for that.
    switch (data.type) {
      case 'ActiveEffect':
        return this._onDropActiveEffect(event, data);
      case 'Actor':
        return this._onDropActor(event, data);
      case 'Item':
        return this._onDropItem(event, data);
      case 'Folder':
        return this._onDropFolder(event, data);
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle the dropping of ActiveEffect data onto an Actor Sheet
   * @param {DragEvent} event                  The concluding DragEvent which contains drop data
   * @param {object} data                      The data transfer extracted from the event
   * @returns {Promise<ActiveEffect|boolean>}  The created ActiveEffect object or false if it couldn't be created.
   * @protected
   */
  async _onDropActiveEffect(event, data) {
    const aeCls = getDocumentClass('ActiveEffect');
    const effect = await aeCls.fromDropData(data);
    if (!this.item.isOwner || !effect) return false;

    if (this.item.uuid === effect.parent?.uuid)
      return this._onEffectSort(event, effect);
    return aeCls.create(effect, { parent: this.item });
  }

  /**
   * Sorts an Active Effect based on its surrounding attributes
   *
   * @param {DragEvent} event
   * @param {ActiveEffect} effect
   */
  _onEffectSort(event, effect) {
    const effects = this.item.effects;
    const dropTarget = event.target.closest('[data-effect-id]');
    if (!dropTarget) return;
    const target = effects.get(dropTarget.dataset.effectId);

    // Don't sort on yourself
    if (effect.id === target.id) return;

    // Identify sibling items based on adjacent HTML elements
    const siblings = [];
    for (let el of dropTarget.parentElement.children) {
      const siblingId = el.dataset.effectId;
      if (siblingId && siblingId !== effect.id)
        siblings.push(effects.get(el.dataset.effectId));
    }

    // Perform the sort
    const sortUpdates = SortingHelpers.performIntegerSort(effect, {
      target,
      siblings,
    });
    const updateData = sortUpdates.map((u) => {
      const update = u.update;
      update._id = u.target._id;
      return update;
    });

    // Perform the update
    return this.item.updateEmbeddedDocuments('ActiveEffect', updateData);
  }

  /* -------------------------------------------- */

  /**
   * Handle dropping of an Actor data onto another Actor sheet
   * @param {DragEvent} event            The concluding DragEvent which contains drop data
   * @param {object} data                The data transfer extracted from the event
   * @returns {Promise<object|boolean>}  A data object which describes the result of the drop, or false if the drop was
   *                                     not permitted.
   * @protected
   */
  async _onDropActor(event, data) {
    if (!this.item.isOwner) return false;
  }

  /* -------------------------------------------- */

  /**
   * Handle dropping of an item reference or item data onto an Actor Sheet
   * @param {DragEvent} event            The concluding DragEvent which contains drop data
   * @param {object} data                The data transfer extracted from the event
   * @returns {Promise<Item[]|boolean>}  The created or updated Item instances, or false if the drop was not permitted.
   * @protected
   */
  async _onDropItem(event, data) {
    if (!this.item.isOwner) return false;
  }

  /* -------------------------------------------- */

  /**
   * Handle dropping of a Folder on an Actor Sheet.
   * The core sheet currently supports dropping a Folder of Items to create all items as owned items.
   * @param {DragEvent} event     The concluding DragEvent which contains drop data
   * @param {object} data         The data transfer extracted from the event
   * @returns {Promise<Item[]>}
   * @protected
   */
  async _onDropFolder(event, data) {
    if (!this.item.isOwner) return [];
  }

  //#endregion
}

//#region Init

Hooks.once(`init`, () => {

});

Hooks.on("updateItem", (item, changes, options, userId) => {
  if (changes.system?.equipment !== undefined) {
    for(let effect of item.effects)
    {
      effect.update({ transfer: changes.system?.equipment.isEquipped });
    }
  }
});