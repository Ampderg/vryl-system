import { VrylActorSheet } from "../data/views.mjs";

/**
 * For more information about FormApplications, see:
 * https://hackmd.io/UsmsgTj6Qb6eDw3GTi5XCg
 */
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

export class SubmenuAttributes extends HandlebarsApplicationMixin(ApplicationV2) {

  static PARTS = {
    form: {
      template: `systems/vryl/templates/menus/submenu-attributes.html`
    }
  }

  static DEFAULT_OPTIONS = {
    classes: ["settings"],
    position: {
      width: "auto",
      height: "auto"
    },
    window: {
      resizable: true,
      title: 'Character Attributes' // Just the localization key
    },
    // tag: 'form',  // REQUIRED for dialogs and forms
    // form: {
    //   //submitOnChange: false,
    //   //closeOnSubmit: false,
    // }
  }

  _bindListeners() {
    const clickable = this.element.querySelectorAll('.clickable.submenu-attributes:not(.listeners_bound)');
    for (let element of clickable) {
      element.classList.add('listeners_bound');
      if (element.classList.contains('delete'))
        element.addEventListener('click', this._deleteAttribute.bind(this));
      else if (element.classList.contains('edit'))
        element.addEventListener('click', this._editAttribute.bind(this));
      else if (element.classList.contains('move-up'))
        element.addEventListener('click', this._moveAttributeUp.bind(this));
      else if (element.classList.contains('move-down'))
        element.addEventListener('click', this._moveAttributeDown.bind(this));
      else if (element.classList.contains('categoryOptions'))
        element.addEventListener('click', this._openCategoryOptions.bind(this));
      else if (element.classList.contains('typeOptions'))
        element.addEventListener('click', this._openTypeOptions.bind(this));
    }

    const editable = this.element.querySelectorAll('.editable.submenu-attributes:not(.listeners_bound)');
    for (let element of editable) {
      element.classList.add('listeners_bound');
      element.addEventListener('change', this._changeAttributeName.bind(this));
    }

    const submit = this.element.querySelectorAll('.submit.submenu-attributes:not(.listeners_bound)')[0];
    submit.classList.add('listeners_bound');
    submit.addEventListener('click', this._submitForm.bind(this));
  }

  _onRender(context, options) {
    super._onRender(context, options);

    this._bindListeners();
  }

  _getIdFromClickEvent(event) {
    return event.srcElement.parentNode.id;
  }

  _deleteAttribute(event) {
    console.log("Delete Attribute");

    let id = this._getIdFromClickEvent(event);
    this.data.attributes = this.data.attributes.filter(function (a) {
      return a.dataName != id;
    });

    event.srcElement.parentNode.remove();

  }

  async _changeAttributeName(event) {
    console.log("Change Attribute Name");

    const objectToUpdateIndex = this.data.attributes.findIndex(a => a.dataName == event.srcElement.parentNode.id);
    const objectToUpdate = this.data.attributes[objectToUpdateIndex];
    objectToUpdate.name = event.srcElement.value;

    if (objectToUpdate.dataName.startsWith("attribute_")) {
      objectToUpdate.dataName = event.srcElement.value.toLowerCase().replace(/\s+/g, '_');
      event.srcElement.parentNode.id = objectToUpdate.dataName;
    }
    this.data.attributes[objectToUpdateIndex] = objectToUpdate;
  }

  async _editAttribute(event) {
    console.log("Edit Attribute");

    const data = await foundry.applications.api.DialogV2.input({
      window: { title: "Edit Attribute" },
      content: `<input type="text" name="dataName" placeholder="dataName" value="${event.srcElement.parentNode.id}" required>`,
      ok: {
        label: "Save",
        icon: "fa-solid fa-floppy-disk",
      }
    });
    if (!data) return;

    const objectToUpdateIndex = this.data.attributes.findIndex(a => a.dataName == event.srcElement.parentNode.id);
    const objectToUpdate = this.data.attributes[objectToUpdateIndex];
    objectToUpdate.dataName = data.dataName;
    event.srcElement.parentNode.id = data.dataName;
    this.data.attributes[objectToUpdateIndex] = objectToUpdate;
  }

  _moveAttributeUp(event) {
    console.log("Move Attribute Up");
    this._shiftUp(event.srcElement.parentNode);
  }

  _moveAttributeDown(event) {
    console.log("Move Attribute Down");
    if (event.srcElement.parentNode.nextElementSibling)
      this._shiftUp(event.srcElement.parentNode.nextElementSibling);
  }

  _shiftUp(element) {
    if (element.previousElementSibling) {
      // Insert the current element before its previous sibling
      element.parentNode.insertBefore(element, element.previousElementSibling);
      const objectToUpdateIndex = this.data.attributes.findIndex(a => a.dataName == element.id);
      const objectToUpdate = this.data.attributes[objectToUpdateIndex];

      let prev = objectToUpdate;
      let prevSort = 0;
      this.data.attributes.forEach(a => {
        if (a.category == objectToUpdate.category && a.sorting < objectToUpdate.sorting && a.sorting >= prevSort) {
          prev = a;
          prevSort = a.sorting;
        }
      });
      prev.sorting = objectToUpdate.sorting;
      objectToUpdate.sorting = prevSort;

      this.data.attributes[objectToUpdateIndex] = objectToUpdate;

      const prevIndex = this.data.attributes.findIndex(a => a.dataName == prev.dataName);
      this.data.attributes[prevIndex] = prev;
    }
  }

  _openCategoryOptions(event) {
    console.log("Open Category Options");
    this._createAttribute(event);
  }

  _createAttribute(event) {
    console.log("Create Attribute");

    let categoryId = this.data.attributeCategories.findIndex(a => a.dataName == event.srcElement.parentNode.id);
    let category = this.data.attributeCategories[categoryId];

    let max = 0;
    this.data.attributes.forEach(a => {
      if (a.dataName.startsWith("attribute_")) {
        let num = parseInt(a.dataName.replace("attribute_", ""));
        if (num > max)
          max = num;
      }
    });

    let maxSort = 0;
    this.data.attributes.forEach(a => {
      if (a.category == categoryId && a.sorting > maxSort) {
        maxSort = a.sorting;
      }
    });


    let a = {
      category: categoryId,
      dataName: "attribute_" + (max + 1),
      name: "Attribute",
      sorting: maxSort + 1,
    };
    let attributeHTML = document.createElement(`div`);
    attributeHTML.innerHTML = `<li id="${a.dataName}" class="attribute flexrow fitheight">
                    <input type="text" style="min-width: 150px" name="name" value="${a.name}" placeholder="Attribute Name">

                    <i class="fa-solid fa-gear flex-group-center clickable edit" ></i>
                    <i class="fa fa-trash flex-group-center clickable delete"></i>
                    <i class="fa-solid fa-angle-up flex-group-center clickable move-up"></i>
                    <i class="fa-solid fa-angle-down flex-group-center clickable move-down"></i>
                </li>`;
    event.srcElement.parentNode.appendChild(attributeHTML);
    this.data.attributes.push(a);

    this._bindListeners();
  }

  _openTypeOptions(event) {
    console.log("Open Type Options");
  }

  async _prepareContext(options) {
    this.data = {
      attributes: game.settings.get(CONFIG.SystemId, 'attributes').sort((a, b) => a.sorting > b.sorting),
      attributeCategories: game.settings.get(CONFIG.SystemId, 'attribute_categories').sort((a, b) => a.sorting > b.sorting),
      attributeTypes: game.settings.get(CONFIG.SystemId, 'attribute_types').sort((a, b) => a.sorting > b.sorting),
    }

    for (let attribute of this.data.attributes) {
      let category = this.data.attributeCategories[attribute.category];
      attribute.categoryName = category ? category.name : "Uncategorized";
      attribute.categoryDataName = category ? category.dataName : "uncategorized";
    }

    for (let category of this.data.attributeCategories) {
      let type = this.data.attributeTypes[category.type];
      category.typeName = type ? type.name : "Uncategorized";
      category.typeDataName = type ? type.dataName : "uncategorized";
    }

    console.log("Setting up submenu with data:");
    console.log(this.data);

    return this.data;
  }


  async _submitForm(event) {
    console.log("Submitting Form with data:");
    console.log(this.data);

    game.settings.set(CONFIG.SystemId, 'attributes', this.data.attributes);
    game.settings.set(CONFIG.SystemId, 'attribute_categories', this.data.attributeCategories);
    game.settings.set(CONFIG.SystemId, 'attribute_types', this.data.attributeTypes);

    this.close();
    foundry.utils.debouncedReload();
  }


}