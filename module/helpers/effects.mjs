/**
 * Prepare the data structure for Active Effects which are currently embedded in an document or Item.
 * @param {ActiveEffect[]} effects    A collection or generator of Active Effect documents to prepare sheet data for
 * @return {object}                   Data for rendering
 */
export function prepareActiveEffectCategories(effects) {
  // Define effect header categories
  const categories = {
    // temporary: {
    //   type: 'temporary',
    //   label: game.i18n.localize('VRYL.Effect.Temporary'),
    //   effects: [],
    // },
    instant: {
      type: 'instant',
      label: "Instant",
      effects: [],
    },
    passive: {
      type: 'passive',
      label: "Passive",
      effects: [],
    },
    // inactive: {
    //   type: 'inactive',
    //   label: game.i18n.localize('VRYL.Effect.Inactive'),
    //   effects: [],
    // },
  };

  // Iterate over active effects, classifying them into categories
  for (const e of effects) {
    //if (e.disabled) categories.inactive.effects.push(e);
    if (e.getFlag(CONFIG.SystemId, `isInstant`)) categories.instant.effects.push(e);
    //else if (e.isTemporary) categories.temporary.effects.push(e);
    else categories.passive.effects.push(e);
  }

  // Sort each category
  for (const c of Object.values(categories)) {
    c.effects.sort((a, b) => (a.sort || 0) - (b.sort || 0));
  }
  return categories;
}


//#region Embedded Documents

/**
* Fetches the embedded document representing the containing HTML element
*
* @param {HTMLElement} target    The element subject to search
* @returns {Item | ActiveEffect} The embedded Item or ActiveEffect
*/
export function getEmbeddedDocument(target, sheet) {
  const docRow = target.closest('[data-document-class]');
  if (docRow.dataset.documentClass === 'Item') {
    return sheet.document.items.get(docRow.dataset.itemId);
  } else if (docRow.dataset.documentClass === 'ActiveEffect') {
    const parent =
      docRow.dataset.parentId === sheet.document.id
        ? sheet.document
        : sheet.document.items.get(docRow?.dataset.parentId);
    return parent.effects.get(docRow?.dataset.effectId);
  } else return console.warn('Could not find document class');
}

export async function viewDoc(event, target) {
  const doc = getEmbeddedDocument(target, this);
  doc.sheet.render(true);
}

export async function deleteDoc(event, target) {

  const proceed = await foundry.applications.api.DialogV2.confirm({
    content: "Are you sure you want to delete this?",
    rejectClose: false,
    modal: true
  });
  if (!proceed) return;

  const doc = getEmbeddedDocument(target, this);
  await doc.delete();
}

export async function createDoc(event, target) {
  // Retrieve the configured document class for Item or ActiveEffect
  const docCls = getDocumentClass(target.dataset.documentClass);
  // Prepare the document creation data by initializing it a default name.
  const docData = {
    name: docCls.defaultName({
      // defaultName handles an undefined type gracefully
      type: target.dataset.type,
      parent: this.document,
    }),
  };

  const flags = {
  };

  // Loop through the dataset and add it to our docData
  for (const [dataKey, value] of Object.entries(target.dataset)) {
    if (dataKey.startsWith("vrylFlags")) {
      const flagKey = dataKey.replace("vrylFlags.", "");
      flags[flagKey] = value;
    }
    else {
      // These data attributes are reserved for the action handling
      if (['action', 'documentClass'].includes(dataKey)) continue;
      // Nested properties require dot notation in the HTML, e.g. anything with `system`
      // An example exists in spells.hbs, with `data-system.spell-level`
      // which turns into the dataKey 'system.spellLevel'
      foundry.utils.setProperty(docData, dataKey, value);
    }
  }

  // Finally, create the embedded document!
  const embDoc = await docCls.create(docData, { parent: this.document });

  for (const flag of Object.entries(flags)) {
    embDoc.setFlag(CONFIG.SystemId, flag[0], flag[1]);
  }
}

export async function toggleEffectByUUID(uuid) {
  const effect = await fromUuid(uuid);
  toggleInstantEffect(effect);
}

export async function toggleEffect(event, target) {
  const effect = getEmbeddedDocument(target, this);
  await effect.update({ disabled: !effect.disabled });
}

export async function toggleInstantEffectEvent(event, target) {
  const effect = getEmbeddedDocument(target, this);
  toggleInstantEffect(effect);
  //CONFIG.ui.rollBuilder.updateRollData();
}

export function toggleInstantEffect(effect) {
  const isApplied = !effect.getFlag(CONFIG.SystemId, `isInstantApplied`);
  effect.setFlag(CONFIG.SystemId, `isInstantApplied`, isApplied);
  CONFIG.ui.rollBuilder.populateRollActor(effect.target);
}

//#region Edit Image

export async function onEditImage(event, target) {
  if (!window.Tokenizer || event.shiftKey || this.document.constructor.name == "VrylItem") {
    const attr = 'img';
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
  else if(window.Tokenizer) {
    window.Tokenizer.tokenizeActor(this.document);
  }
}

Hooks.once("init", () => {

});