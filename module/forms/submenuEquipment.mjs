import { VrylActorSheet } from "../data/views.mjs";

/**
 * For more information about FormApplications, see:
 * https://hackmd.io/UsmsgTj6Qb6eDw3GTi5XCg
 */
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

export class SubmenuEquipment extends HandlebarsApplicationMixin(ApplicationV2) {

  static PARTS = {
    form: {
      template: `systems/vryl/templates/menus/submenu-equipment.html`
    },
  }

  static DEFAULT_OPTIONS = {
    classes: ["settings"],
    position: {
      width: "auto",
      height: "auto"
    },
    window: {
      resizable: true,
      title: 'Equipment Settings' // Just the localization key
    },
    tag: 'form',  // REQUIRED for dialogs and forms
    form: {
      handler: SubmenuEquipment.#onSubmitForm,
      closeOnSubmit: true,
      submitOnChange: true
    },
    actions: {
      addSlot: this._addSlot,
      removeSlot: this._removeSlot,
    },
  }

  _onRender(context, options) {
    super._onRender(context, options);

    //this._bindListeners();
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    this.equipmentSlots = game.settings.get(CONFIG.SystemId, 'equipment-slots');
    context.equipmentSlots = this.equipmentSlots;

    return context;
  }


  static async #onSubmitForm(event, form, formData) {
    for(const slot of this.equipmentSlots)
    {
      slot.slotName = form.querySelector(`#slotName[name="${slot.id}"]`).value;
      slot.slotSlots = parseInt(form.querySelector(`#slotSlots[name="${slot.id}"]`).value);
    }
    game.settings.set(CONFIG.SystemId, 'equipment-slots', this.equipmentSlots);
  }

  getNextId()
  {
    let max = 0;
    for(const slot in this.equipmentSlots)
    {
      if(slot.id > max)
        max = slot.id;
    }
    return max + 1;
  }

  static async _addSlot(event, target) {
    this.equipmentSlots.push({
      slotName: "Slot",
      slotSlots: 1,
      id: this.getNextId(),
    })
    
    game.settings.set(CONFIG.SystemId, 'equipment-slots', this.equipmentSlots);

    this.render(true);
  }

  static async _removeSlot(event, target) {
    
    const index = this.equipmentSlots.findIndex((a) => a.id == event.data.slot);

    if (index > -1) {
        this.equipmentSlots.splice(index, 1); // 2nd parameter means remove one item only

        game.settings.set(CONFIG.SystemId, 'equipment-slots', equipmentSlots);

    this.render(true);
    }

  }

}