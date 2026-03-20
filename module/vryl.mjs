import { VrylActor, VrylItem } from "./data/controllers.mjs";
import { VrylActorSheet } from "./data/views.mjs";
import { CharacterActorDataModel } from "./data/models.mjs";
import { RollSidebar } from "./forms/rollBuilder.mjs";
import { AttributeRoll } from "./helpers/vrylRoll.mjs";

// Import helper/utility classes and constants.
import { DEFAULTS } from './helpers/systemDefaults.mjs';
import { SubmenuAttributes } from "./forms/submenuAttributes.mjs";

const collections = foundry.documents.collections;
const sheets = foundry.appv1.sheets;

Hooks.once("init", () => {
  _registerHandlebarsHelpers();
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

  // Register sheet application classes
  collections.Actors.unregisterSheet('core', sheets.ActorSheet);
  collections.Actors.registerSheet('vryl', VrylActorSheet, {
    makeDefault: true,
    label: 'VRYL.SheetLabels.Actor',
  });


  // Active Effects are never copied to the Actor,
  // but will still apply to the Actor from within the Item
  // if the transfer property on the Active Effect is true.
  CONFIG.ActiveEffect.legacyTransferral = false;


  // CONFIG.Item.dataModels = {
  //   weapon: WeaponDataModel,
  //   spell: SpellDataModel
  // };

  // Configure trackable attributes.
  // CONFIG.Actor.trackableAttributes = {
  //   hero: {
  //     bar: ["resources.health", "resources.power", "goodness"],
  //     value: ["progress"]
  //   }
  // };

  // Art sidebar tab
  CONFIG.ui.sidebar.TABS.rollBuilder = {
    active: false,
    icon: `fa-solid fa-dice-d20`,
    tooltip: `Roll`,
  };
  CONFIG.ui.rollBuilder = RollSidebar;
  CONFIG.ROLL_DATA = {
    rollActors: new Map(),
    bonusDice: 0,
    guaranteedSuccesses: 0,
  };

  _initSystemSettings();
});

function _initSystemSettings() {

  game.settings.register(CONFIG.SystemId, 'attribute_types', {
    name: 'Character Attribute Types',
    hint: "The naming of the attribute types. By default, you can't combine multiple attributes of the same type in one roll.",
    scope: 'world', // 'world' (all users) or 'client' (per user)
    config: false,   // true to show in settings UI
    type: Array,   // String, Number, Boolean, Object, Array
    default: DEFAULTS.attributeTypes, // The default value for the setting
    onChange: value => { // Callback function
      console.log(value);
    }
  });

  if (!game.settings.get(CONFIG.SystemId, 'attribute_types'))
    game.settings.set(CONFIG.SystemId, 'attribute_types', DEFAULTS.attributesTypes);

  game.settings.register(CONFIG.SystemId, 'attribute_categories', {
    name: 'Character Attribute Categories',
    hint: "The categories that attributes belong to, within the types.",
    scope: 'world', // 'world' (all users) or 'client' (per user)
    config: false,   // true to show in settings UI
    type: Array,   // String, Number, Boolean, Object, Array
    default: DEFAULTS.attributeCategories, // The default value for the setting
    onChange: value => { // Callback function
      console.log("Attributes Categories have been updated:");
      console.log(value);
    }
  });

  if (!game.settings.get(CONFIG.SystemId, 'attribute_categories'))
    game.settings.set(CONFIG.SystemId, 'attribute_categories', DEFAULTS.attributesCategories);

  game.settings.register(CONFIG.SystemId, 'attributes', {
    scope: 'world',     // "world" = sync to db, "client" = local storage
    config: false,      // we will use the menu above to edit this setting
    type: Array,
    default: DEFAULTS.attributes, // The default value for the setting
    onChange: value => { // Callback function
      console.log("Default attributes have been updated:");
      console.log(value);
    }
  });

  if (!game.settings.get(CONFIG.SystemId, 'attributes'))
    game.settings.set(CONFIG.SystemId, 'attributes', DEFAULTS.attributes);

  game.settings.registerMenu(CONFIG.SystemId, 'attributesMenu', {
    name: 'Character Attributes',
    hint: 'The attributes that all characters will have on their sheets',
    icon: "fas fa-bars",
    restricted: true,
    type: SubmenuAttributes,   // String, Number, Boolean, Object, Array
  });

  game.settings.register(CONFIG.SystemId, 'attribute_max_level', {
    scope: 'world',     // "world" = sync to db, "client" = local storage
    config: true,      // we will use the menu above to edit this setting
    type: Number,
    default: 5, // The default value for the setting
  });

}

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once("ready", function () {
  // Include steps that need to happen after Foundry has fully loaded here.
});

//#region Handlebars Helpers

function _registerHandlebarsHelpers() {
  Handlebars.registerHelper('for', function (from, to, incr, block) {
    var accum = '';
    for (var i = from; i < to; i += incr) {
      let data = {
        index: i,
        isFirst: i === from,
        isLast: i + incr >= to,
        from: from,
        to: to,
      };
      accum += block.fn(data);
    }
    return accum;
  });

  Handlebars.registerHelper('eachMap', function (context, options) {
    // Clone the array to avoid mutating the original data
    const arr = [...context.values()];

    let ret = "";
    for (let i = 0; i < arr.length; i++) {
      // Pass the sorted item back to the template block
      ret = ret + options.fn(arr[i]);
    }
    return ret;
  });


  Handlebars.registerHelper('eachAttribute', function (context, options) {
    // Clone the array to avoid mutating the original data
    const arr = context.toSorted((a, b) => {
      // Basic sorting logic (e.g., by a 'name' property)
      if (a.type && a.type != b.type) return 0;
      if (a.category && a.category != b.category) return 0;
      return a.sorting - b.sorting;
    });

    let ret = "";
    let rowIndices = new Map();
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].category != undefined) {
        rowIndices.set(arr[i].category, (rowIndices.get(arr[i].category) ?? 0) + 1);
        arr[i].indexOdd = rowIndices.get(arr[i].category) % 2 == 0;
      }
      else {
        arr[i].indexOdd = i % 2 == 0;
      }
      ret = ret + options.fn(arr[i]);
    }
    return ret;
  });

  Handlebars.registerHelper('eq', function (a, b) {
    var next = arguments[arguments.length - 1];
    return (a === b) ? next.fn(this) : next.inverse(this);
  });

  Handlebars.registerHelper('lt', function (a, b) {
    var next = arguments[arguments.length - 1];
    return (a < b) ? next.fn(this) : next.inverse(this);
  });
  Handlebars.registerHelper('lte', function (a, b) {
    var next = arguments[arguments.length - 1];
    return (a <= b) ? next.fn(this) : next.inverse(this);
  });
  Handlebars.registerHelper('gt', function (a, b) {
    var next = arguments[arguments.length - 1];
    return (a > b) ? next.fn(this) : next.inverse(this);
  });
  Handlebars.registerHelper('gte', function (a, b) {
    var next = arguments[arguments.length - 1];
    return (a >= b) ? next.fn(this) : next.inverse(this);
  });
  Handlebars.registerHelper('ne', function (a, b) {
    var next = arguments[arguments.length - 1];
    return (a !== b) ? next.fn(this) : next.inverse(this);
  });
}

//#endregion