import { VrylActor, VrylItem } from "./data/controllers.mjs";
import { VrylActorSheet } from "./data/views.mjs";
import { VrylItemSheet } from "./data/itemViews.mjs";
import { CharacterActorDataModel, VrylInventoryItem, VrylUsableEffect } from "./data/models.mjs";
import "./data/active-effect.mjs";
import { RollSidebar } from "./forms/rollBuilder.mjs";
import { AttributeRoll } from "./helpers/vrylRoll.mjs";

// Import helper/utility classes and constants.
import { DEFAULTS } from './helpers/systemDefaults.mjs';

// Helpers
import { VrylHandlebarsHelpers } from "./helpers/handlebarsHelpers.mjs";

// Menus
import { SubmenuAttributes } from "./forms/submenuAttributes.mjs";
import { SubmenuEquipment } from "./forms/submenuEquipment.mjs";

const collections = foundry.documents.collections;
const sheets = foundry.appv1.sheets;

Hooks.once("init", () => {
  game.vrylGlobalFunctions = {
      adjustNumberStepValue: function(element, amount, childrenDeep = 1) {
        let parent = element;
        for(let i = 0; i < childrenDeep; i++)
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
    usableEffect: VrylUsableEffect,
    gear: VrylInventoryItem,
    //aspect
    //tactical ability
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

  VrylHandlebarsHelpers.registerHandlebarsHelpers();
}

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once("ready", function () {
  // Include steps that need to happen after Foundry has fully loaded here.
});

