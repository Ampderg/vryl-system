import { VrylActor, VrylItem } from "./data/controllers.mjs";
import { VrylActorSheet } from "./data/views.mjs";
import { VrylItemSheet } from "./data/itemViews.mjs";
import { CharacterActorDataModel, VrylInventoryItem, VrylCombatAction } from "./data/models.mjs";
import "./data/active-effect.mjs";
import { RollSidebar } from "./forms/rollBuilder.mjs";
import { AttributeRoll } from "./helpers/vrylRoll.mjs";

// Import helper/utility classes and constants.
import { DEFAULTS } from './helpers/systemDefaults.mjs';
import * as effectsFunctions from './helpers/effects.mjs';

// Helpers
import { VrylHandlebarsHelpers } from "./helpers/handlebarsHelpers.mjs";
import { VrylLogsHelpers } from "./helpers/logs.mjs";

// Menus
import { SubmenuAttributes } from "./forms/submenuAttributes.mjs";
import { SubmenuEquipment } from "./forms/submenuEquipment.mjs";

const collections = foundry.documents.collections;
const sheets = foundry.appv1.sheets;

VrylLogsHelpers.hookChatExport();

Hooks.once("init", () => {
  game.vrylGlobalFunctions = {
    adjustNumberStepValue: function (element, amount, childrenDeep = 1) {
      let parent = element;
      for (let i = 0; i < childrenDeep; i++)
        parent = parent.parentElement;

      const input = parent.querySelector(':scope > input');
      input.value = parseInt(input.value) + parseInt(amount);
      input.dispatchEvent(new Event('change'));
    }
  }

  // Configure custom Document implementations.
  CONFIG.SystemId = 'vryl';
  CONFIG.Actor.documentClass = VrylActor;
  CONFIG.Item.documentClass = VrylItem;
  CONFIG.Dice.rolls.push(AttributeRoll);
  CONFIG.Dice.AttributeRoll = AttributeRoll;

  // Configure System Data Models.
  CONFIG.Actor.dataModels = {
    character: CharacterActorDataModel
  };

  CONFIG.Item.documentClass = VrylItem;
  CONFIG.Item.dataModels = {
    gear: VrylInventoryItem,
    //aspect
    combatAction: VrylCombatAction,
    //itemDeck: VrylItemDeck,
  };

  // Register sheet application classes
  collections.Actors.unregisterSheet('core', sheets.ActorSheet);
  collections.Actors.registerSheet('vryl', VrylActorSheet, {
    makeDefault: true,
    label: 'VRYL.SheetLabels.Actor',
  });

  collections.Items.unregisterSheet('core', sheets.ItemSheet);
  collections.Items.registerSheet('vryl', VrylItemSheet, {
    makeDefault: true,
    label: 'VRYL.SheetLabels.Item',
  });

  //#region Register Effects
  CONFIG.effectsFunctions = effectsFunctions;

  // Active Effects are never copied to the Actor,
  // but will still apply to the Actor from within the Item
  // if the transfer property on the Active Effect is true.
  CONFIG.ActiveEffect.legacyTransferral = false;


  // Configure trackable attributes.
  // CONFIG.Actor.trackableAttributes = {
  //   hero: {
  //     bar: ["resources.health", "resources.power", "goodness"],
  //     value: ["progress"]
  //   }
  // };

  //#region Register Tabs

  // Art sidebar tab
  CONFIG.ui.sidebar.TABS.rollBuilder = {
    active: false,
    icon: `fa-solid fa-dice-d20`,
    tooltip: `Roll`,
  };
  CONFIG.ui.rollBuilder = RollSidebar;
  CONFIG.ROLL_DATA = {
    rollActors: new Map(),
    rollItemEffects: [],
    bonusDice: 0,
    guaranteedSuccesses: 0,
  };

  CONFIG.Dice.functions["exposure"] = exposureDice;
  CONFIG.Dice.terms.d.prototype.constructor.MODIFIERS.exposure = exposureDice;

  _initSystemSettings();
});

function _initSystemSettings() {

  // #region Attributes
  game.settings.register(CONFIG.SystemId, 'attribute-types', {
    name: 'Character Attribute Types',
    hint: "The naming of the attribute types. By default, you can't combine multiple attributes of the same type in one roll.",
    scope: 'world', // 'world' (all users) or 'client' (per user)
    config: false,   // true to show in settings UI
    type: Array,   // String, Number, Boolean, Object, Array
    default: DEFAULTS.attributeTypes, // The default value for the setting
    restricted: true,
    onChange: value => { // Callback function
      console.log(value);
    }
  });

  game.settings.register(CONFIG.SystemId, 'attribute-categories', {
    name: 'Character Attribute Categories',
    hint: "The categories that attributes belong to, within the types.",
    scope: 'world', // 'world' (all users) or 'client' (per user)
    config: false,   // true to show in settings UI
    type: Array,   // String, Number, Boolean, Object, Array
    default: DEFAULTS.attributeCategories, // The default value for the setting
    restricted: true,
    onChange: value => { // Callback function
      console.log("Attributes Categories have been updated:");
      console.log(value);
    }
  });

  game.settings.register(CONFIG.SystemId, 'attributes', {
    scope: 'world',     // "world" = sync to db, "client" = local storage
    config: false,      // we will use the menu above to edit this setting
    type: Array,
    default: DEFAULTS.attributes, // The default value for the setting
    restricted: true,
    onChange: value => { // Callback function
      console.log("Default attributes have been updated:");
      console.log(value);
    }
  });

  game.settings.registerMenu(CONFIG.SystemId, 'attributesMenu', {
    name: 'Character Attributes',
    hint: 'The attributes that all characters will have on their sheets',
    icon: "fas fa-bars",
    restricted: true,
    type: SubmenuAttributes,   // String, Number, Boolean, Object, Array
  });

  game.settings.register(CONFIG.SystemId, 'attribute-max-level', {
    name: 'Max Attribute Level',
    hint: "",
    scope: 'world',     // "world" = sync to db, "client" = local storage
    config: true,      // we will use the menu above to edit this setting
    restricted: true,
    type: Number,
    default: 5, // The default value for the setting
  });

  // #region Willpower

  game.settings.register(CONFIG.SystemId, 'max-willpower', {
    name: 'Max Willpower Level',
    hint: "",
    scope: 'world',     // "world" = sync to db, "client" = local storage
    config: true,      // we will use the menu above to edit this setting
    restricted: true,
    type: Number,
    default: 10, // The default value for the setting
  });

  game.settings.register(CONFIG.SystemId, 'spend-willpower-coinflip', {
    name: 'Flip a coin to spend Willpower',
    hint: "When you spend Willpower to gain Guaranteed Successes on rolls, flip a coin for every spent Willpower. If they land on heads, the Willpower isn't spent.",
    scope: 'world',     // "world" = sync to db, "client" = local storage
    config: true,      // we will use the menu above to edit this setting
    restricted: true,
    type: Boolean,
    default: true, // The default value for the setting
  });

  //#region Inventory

  game.settings.register(CONFIG.SystemId, 'equipment-slots', {
    scope: 'world',     // "world" = sync to db, "client" = local storage
    config: false,      // we will use the menu above to edit this setting
    restricted: true,
    type: Array,
    default: DEFAULTS.equipmentSlots,
  });

  game.settings.registerMenu(CONFIG.SystemId, 'equipmentMenu', {
    name: 'Equipment Settings',
    hint: '',
    icon: "fas fa-bars",
    restricted: true,
    restricted: true,
    type: SubmenuEquipment,   // String, Number, Boolean, Object, Array
  });

  //#region Logs
  game.settings.register(CONFIG.SystemId, 'log-session', {
    name: 'Current Session Number for Log Exports',
    scope: 'world',     // "world" = sync to db, "client" = local storage
    config: true,      // we will use the menu above to edit this setting
    restricted: false,
    type: Number,
    default: 1,
  });

  VrylHandlebarsHelpers.registerHandlebarsHelpers();
}

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once("ready", function () {
  // Include steps that need to happen after Foundry has fully loaded here.
});


Hooks.on("createMacro", async (macro, options, userId) => {
  console.log(`Macro ${macro.name} was created by user ${userId}`);

  if (macro.command.startsWith(`await foundry.applications.ui.Hotbar.toggleDocumentSheet("`)) {
    let actorId = macro.command.replace(`await foundry.applications.ui.Hotbar.toggleDocumentSheet("`, '').slice(0, -3);
    let actor = await fromUuid(actorId);
    macro.update({ [`img`]: actor.img })
  }
});


//#region Dice Terms


function exposureDice(modifier) {
  const term = 'exposure';
  const match = modifier.split('|');
  const max = this.faces;

  let stacks = match[1];
  const dc = match[2];
  const critThreshold = match[3] ?? max;

  const currentResults = [...this.results].toSorted((a, b) => a.result - b.result);
  for (let r of currentResults) {
    if (stacks > 0 && r.result >= dc && r.result < critThreshold) {
      r.rerolled = true;
      r.active = false;
      r.hidden = true;
      stacks--;

      this.results.push({
        result: max,
        active: true
      })
    }
  }

  return this.results;
}

//#region Music & Sound
Hooks.on('updatePlaylist', (playlist, changes, options, userId) => {
  if (!changes.sounds)
    return;

  for (const soundChanges of changes.sounds) {
    if (!soundChanges.playing)
      continue;

    const sound = playlist.sounds.get(soundChanges._id);

    console.log(`Playing sound: ${sound.name}`);

    const flags = {
      vryl: {
        isAudioPlayEvent: true,
        audioSrcUuid: sound.uuid,
      }
    }

    const msg = ChatMessage.create({
      content: `<b>Now Playing...</b><br>${sound.name}`,
      flags: flags,
    });
  }

});