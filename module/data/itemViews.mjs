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
      toggleInstantEffectEvent: effectsFunctions.toggleInstantEffectEvent,
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
    combatActionSettings: {
      template: `systems/vryl/templates/items/combatActionSettings.hbs`
    },
    combatActionEffects: {
      template: `systems/vryl/templates/items/combatActionEffects.hbs`
    },
    itemCharges: {
      template: `systems/vryl/templates/items/itemCharges.hbs`
    },
    effects: {
      template: `systems/vryl/templates/items/effects.hbs`
    },
  }

  /** @override */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    // Not all parts always render
    options.parts = ['header', 'description'];
    // Don't show the other tabs if only limited view
    //if (this.document.limited) return;
    // Control which parts show based on document subtype
    switch (this.document.type) {
      case 'combatAction':
        options.parts.splice(1, 0, 'combatActionSettings');
        //options.parts.push('itemCharges');
        options.parts.push('combatActionEffects');
        break;
      case 'gear':
        options.parts.push('equipmentSettings');
        options.parts.push('effects');
        break;
      case 'aspect':
        options.parts.push('itemCharges');
        options.parts.push('effects');
        break;
    }

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
    selectEquipSlotElement?.addEventListener("change", () => {
      this.document.update({ [`system.equipment.slotDataName`]: selectEquipSlotElement.value });
    });

    const selectEquipTimeElement = this.element.querySelector(`select#equipTimeSelector`);
    selectEquipTimeElement?.addEventListener("change", () => {
      this.document.update({ [`system.equipment.equipTime`]: selectEquipTimeElement.value });
    });

    const equipSlotSlotsElement = this.element.querySelector(`input#equipSlotSlots`);
    equipSlotSlotsElement?.addEventListener("change", () => {
      this.document.update({ [`system.equipment.slotsFilled`]: equipSlotSlotsElement.value });
    });

    const chargesElement = this.element.querySelector(`input#charges`);
    chargesElement?.addEventListener("change", () => {
      this.document.update({ [`system.charges`]: chargesElement.value });
    });

    const chargeAutomationElement = this.element.querySelector(`select#chargeAutomationSelector`);
    chargeAutomationElement?.addEventListener("change", () => {
      this.document.update({ [`system.chargeAutomation`]: chargeAutomationElement.value });
    });


    //Combat action
    this.element.querySelector(`[data-action='addActionEffect']`)?.addEventListener("click", () => {
      this._addActionEffect();
    });

    const successCostElements = this.element.querySelectorAll(`[data-action='updateSuccessCost']`);
    for (const e of successCostElements) {
      e.addEventListener("change", () => {
        const effects = this.document.system.combatAction.effects;
        const effect = effects.find(f => f.id == e.id);
        effect.successCost = e.value;
        this.document.update({ [`system.combatAction.effects`]: effects });
      });
    }

    const effectDescriptionElements = this.element.querySelectorAll(`[data-action='updateEffectDescription']`);
    for (const e of effectDescriptionElements) {
      e.addEventListener("click", async () => {
        const effects = this.document.system.combatAction.effects;
        const effect = effects.find(f => f.id == e.id);

        new Dialog({
          title: "Edit Action Effect",
          content: `
<form>
  <div class="flexcol">
    <label>Card Summary</label>
    <input type="text" id='summary' value='${effect.summary ? effect.summary : ""}'>

    <label>Description</label>
    <!-- This div acts as the target for the editor -->
    <div class="editor-content">
    <prose-mirror id="description" value="${effect.description.replaceAll('"', '\"')}">
      ${effect.description}
    </prose-mirror>
    </div>
    <div class="flexrow">
      <label>Is this effect built-in to the action? (Mandatory)</label>
      <input type="checkbox" id="mandatory" name="mandatory" ${effect.mandatory ? "checked" : ""}>
    </div>
    <div class="flexrow">
      <label>Can this effect repeat?</label>
      <input type="checkbox" id="repeatable" name="repeatable" ${effect.repeatable ? "checked" : ""}}>
    </div>
  </div>
</form>
`,
          buttons: {
            save: {
              label: "Save",
              callback: (html) => {
                // Retrieve the updated HTML content
                effect.description = html.find('#description').val();
                effect.summary = html.find('#summary').val();
                effect.repeatable = html.find('#repeatable')[0].checked;
                effect.mandatory = html.find('#mandatory')[0].checked;

                this.document.update({ [`system.combatAction.effects`]: effects });
              }
            }
          },
        }, {
          width: 550,
          height: 400
        }).render(true);

      });
    }

    const effectDeleteElements = this.element.querySelectorAll(`[data-action='deleteEffect']`);
    for (const e of effectDeleteElements) {
      e.addEventListener("click", () => {
        const effects = this.document.system.combatAction.effects.filter(f => f.id != e.id);
        this.document.update({ [`system.combatAction.effects`]: effects });
      });
    }

    this.element.querySelectorAll(`[data-action='shiftEffectOrderUp']`).forEach((element, index, array) => {
      element.addEventListener("click", (event) => {
        const effects = this.document.system.combatAction.effects;
        const effect = effects.find(f => f.id == event.target.parentElement.id);

        let order = null;
        for (const e of effects) {
          if (e.order < effect.order && (order == null || e.order > order))
            order = e.order;
        }

        if (order == null)
          order = effect.order;

        if (order == effect.order) {
          let shared = 0;

          for (const e of effects) {
            if (e.order == order)
              shared++;
          }

          if (shared > 1)
            order--;
        }

        if(order < 0)
        {
          for (const e of effects) {
            e.order -= order;
          }
          order -= order;
        }

        effect.order = order;
        this.document.update({ [`system.combatAction.effects`]: effects });
      });
    });

    this.element.querySelectorAll(`[data-action='shiftEffectOrderDown']`).forEach((element, index, array) => {
      element.addEventListener("click", (event) => {
        const effects = this.document.system.combatAction.effects;
        const effect = effects.find(f => f.id == event.target.parentElement.id);

        let order = null;
        for (const e of effects) {
          if (e.order > effect.order && (order == null || e.order < order))
            order = e.order;
        }

        if (order == null)
          order = effect.order;

        if (order == effect.order) {
          let shared = 0;

          for (const e of effects) {
            if (e.order == order)
              shared++;
          }

          if (shared > 1)
            order++;
        }

        effect.order = order;
        this.document.update({ [`system.combatAction.effects`]: effects });
      });
    });

    const actionCostSelector = this.element.querySelector(`select#costSelector`);
    actionCostSelector?.addEventListener("change", () => {
      this.document.update({ [`system.combatAction.cost`]: actionCostSelector.value });
    });

    this.element.querySelector(`#increaseActionCost`)?.addEventListener("click", () => {
      this.document.update({ [`system.combatAction.actionPointCost`]: this.document.system.combatAction.actionPointCost + 1 });
    });
    this.element.querySelector(`#decreaseActionCost`)?.addEventListener("click", () => {
      this.document.update({ [`system.combatAction.actionPointCost`]: Math.max(1, this.document.system.combatAction.actionPointCost - 1) });
    });

    const actionFrequencySelector = this.element.querySelector(`select#frequencySelector`);
    actionFrequencySelector?.addEventListener("change", () => {
      this.document.update({ [`system.combatAction.frequency`]: actionFrequencySelector.value });
    });

    this.element.querySelector(`#increaseActionCharges`)?.addEventListener("click", () => {
      this.document.update({ [`system.combatAction.maxCharges`]: this.document.system.combatAction.maxCharges + 1 });
    });
    this.element.querySelector(`#decreaseActionCharges`)?.addEventListener("click", () => {
      this.document.update({ [`system.combatAction.maxCharges`]: Math.max(1, this.document.system.combatAction.maxCharges - 1) });
    });

    const actionIsRollCheckbox = this.element.querySelector(`#actionIsRollCheckbox`);
    actionIsRollCheckbox?.addEventListener("change", () => {
      this.document.update({ [`system.combatAction.isRoll`]: actionIsRollCheckbox.checked });
    });

    this.element.querySelector(`button#saveRoll`)?.addEventListener("click", () => {
      let json = CONFIG.ui.rollBuilder.serializeToJson();
      this.document.update({ [`system.combatAction.rollBuilderJson`]: json });
    });

    this.element.querySelector(`button#copySavedRoll`)?.addEventListener("click", () => {
      CONFIG.ui.rollBuilder.deserializeFromJson(this.document.system.combatAction.rollBuilderJson, false);
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

  //#region Combat

  async _addActionEffect() {
    if (this.document.type != "combatAction")
      return;

    const effects = this.document.system.combatAction.effects;

    let maxOrder = 0;
    let maxId = 0;
    for (const e of effects) {
      if (e.order > maxOrder)
        maxOrder = e.order;
      if (e.id > maxId)
        maxId = e.id;
    }

    const newEffect = {
      successCost: 0,
      order: maxOrder + 1,
      id: maxId + 1,
      description: "New Effect",
    };

    await this.document.update({
      "system.combatAction.effects": [...effects, newEffect]
    });
  }

}

//#region Init

Hooks.once(`init`, () => {

});

Hooks.on("updateItem", (item, changes, options, userId) => {
  if (changes.system?.equipment !== undefined) {
    for (let effect of item.effects) {
      effect.update({ transfer: changes.system?.equipment.isEquipped });
    }
  }
});