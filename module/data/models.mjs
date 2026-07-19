const { BooleanField, HTMLField, NumberField, SchemaField, StringField, ArrayField, ObjectField, TypedObjectField } = foundry.data.fields;

/* -------------------------------------------- */
/*  Actor Models                                */
/* -------------------------------------------- */

class ActorDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = {};

    const equipmentSlots = {};

    const sortedSlotSettings = game.settings.get(CONFIG.SystemId, 'equipment-slots').toSorted((a, b) => a.id - b.id);

    for (const slot of sortedSlotSettings) {
      let dataName = slot.slotName;
      dataName = dataName.replaceAll(' ', '');
      dataName = dataName.substring(0, 1).toLowerCase() + dataName.substring(1);
      equipmentSlots[dataName] = new SchemaField({
        name: new StringField({ required: true, initial: slot.slotName }),
        dataName: new StringField({ required: true, initial: dataName }),
        slots: new NumberField({ required: true, initial: slot.slotSlots, min: 0 }),
        id: new NumberField({ required: true, initial: slot.id, min: 0 }),
      });
    }

    schema.equipment = new SchemaField({
      slots: new SchemaField(equipmentSlots),
      loadouts: new SchemaField({}),
    });

    // All Actors have resources.
    return schema;
  }
}

class AttributeActorDataModel extends ActorDataModel {
  static defineSchema() {
    // Define attributes
    const requiredInteger = { required: true, nullable: false, integer: true };
    console.log("Defining attribute schema...");

    let attributes = {};

    game.settings.get(CONFIG.SystemId, 'attributes').forEach(a => {
      attributes[a.dataName] = new SchemaField({
        level: new NumberField({ required: true, initial: 0, min: 0, max: game.settings.get(CONFIG.SystemId, 'attribute-max-level') }),
        heroicLevel: new NumberField({ required: true, initial: 0, min: 0, max: game.settings.get(CONFIG.SystemId, 'attribute-max-level') }),
        bonusDice: new NumberField({ required: true, initial: 0 }),
        guaranteedSuccesses: new NumberField({ required: false, initial: 0 }),
      });
    });



    const schema = super.defineSchema();
    schema.attributes = new SchemaField(attributes);

    schema.xp = new NumberField({ required: true, initial: 200, min: 0 })

    schema.willpower = new SchemaField({
      value: new NumberField({ }),
      level: new NumberField({ required: true, initial: 3, min: 0, max: game.settings.get(CONFIG.SystemId, 'max-willpower') }),
      max: new NumberField({ required: true, initial: 3, min: 0, max: game.settings.get(CONFIG.SystemId, 'max-willpower') }),
      bonusDice: new NumberField({ required: true, initial: 0 }),
    });

    return schema;
  }
}

export class CharacterActorDataModel extends AttributeActorDataModel {
  static defineSchema() {

    const schema = super.defineSchema();
    const requiredInteger = { required: true, nullable: false, integer: true };

    let ac = new ArrayField(new SchemaField({
      keyword: new StringField({
        required: true,
        initial: "global",
      }),
      dcMod: new NumberField({
        ...requiredInteger,
        initial: 0,
      }),
      stacking: new BooleanField({
        initial: false,
        required: true,
      })
    }));

    schema.combat = new SchemaField({
      hp: new SchemaField({
        value: new NumberField({initial: 40}),
        min: new NumberField({initial: 0}),
        max: new NumberField({initial: 40}),
      }),
      guard: new SchemaField({
        value: new NumberField({initial: 0}),
        min: new NumberField({initial: 0}),
        max: new NumberField({initial: 40}),
      }),
      speed: new NumberField({ required: true, initial: 4 }),
      actionsPerTurn: new NumberField({ required: true, initial: game.settings.get(CONFIG.SystemId, 'default-actions-per-turn'), min: 0 }),
      actionPoints: new NumberField({ required: true, initial: game.settings.get(CONFIG.SystemId, 'default-actions-per-turn'), min: 0 }),
      armorMods: ac,

      baseDamage: new NumberField({ required: true, initial: 4 }),
      baseFray: new NumberField({ required: true, initial: 2 }),

      maxActivations: new NumberField({ required: true, initial: 1 }),
      timesActivatedThisRound: new NumberField({ required: true, initial: 0 }),
    });

    return schema;
  }
}

// #region Items

export class VrylItemBase extends foundry.abstract
  .TypeDataModel {
  static defineSchema() {
    const schema = {};

    schema.description = new HTMLField();

    return schema;
  }
}

export class VrylItemCard extends VrylItemBase {
  static defineSchema() {
    const schema = super.defineSchema();

    // schema.containedItems = new ArrayField({
    //   itemUuid: new StringField({ required: true }),
    // });

    return schema;
  }
}

export class VrylCombatAction extends VrylItemCard {
  static defineSchema() {
    const schema = super.defineSchema();

    const requiredInteger = { required: true, nullable: false, integer: true };

    let combatAction = {};
    
    combatAction.cost = new StringField({
      initial: "actions",
    });

    combatAction.actionPointCost = new NumberField({
      initial: 1,
      min: 0,
    });

    combatAction.reactionCharges = new NumberField({
      initial: 1,
      min: 0,
    });

    combatAction.maxReactionCharges = new NumberField({
      initial: 1,
      min: 0,
    });

    combatAction.frequency = new StringField({
      initial: "at-will",
    });

    combatAction.charges = new NumberField({
      initial: 1,
      min: 0,
    });

    combatAction.maxCharges = new NumberField({
      initial: 1,
      min: 0,
    });

    combatAction.isRoll = new BooleanField({
      initial: true,
    });

    combatAction.rollBuilderJson = new StringField({
      initial: "",
    });

    function createTargetAutomation() {
      return new SchemaField({
        doesTarget: new BooleanField({initial: false}),
        targetCount: new NumberField({initial: null, min: 0}),
        targetRange: new NumberField({initial: null, min: 0}),
      });
    }

    combatAction.targeting = createTargetAutomation();

    let effectAutomation = new ArrayField(new SchemaField({
      flag: new StringField({}),
    }));

    combatAction.effects = new ArrayField(new SchemaField({
      id: new NumberField({
        ...requiredInteger,
        initial: 0,
        min: 0,
      }),
      successCost: new NumberField({
        ...requiredInteger,
        initial: 0,
        min: 0,
      }),
      order: new NumberField({
        ...requiredInteger,
        initial: 0,
      }),
      targeting: createTargetAutomation(),
      description: new StringField({}),
      summary: new StringField({}),
      automation: effectAutomation,
      repeatable: new BooleanField({ required: true, initial: false }),
      mandatory: new BooleanField({ required: true, initial: false }),
      chatButtons: new ArrayField(new SchemaField({
        buttonText: new StringField({}),
      })),
    }));

    schema.combatAction = new SchemaField(combatAction);

    return schema;
  }
}

export class VrylUsableItem extends VrylItemCard {
  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.charges = new NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0,
    });

    schema.chargeAutomation = new StringField({
      required: true,
      initial: "manual",
    });

    return schema;
  }
}

export class VrylInventoryItem extends VrylUsableItem {

  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.isBulky = new BooleanField({
      required: true,
      nullable: false,
      initial: false,
    });

    // Equipment slots


    schema.equipment = new SchemaField({
      slotDataName: new StringField({ required: true }),
      equipTime: new StringField({ initial: "instant", required: true }),
      slotsFilled: new NumberField({ initial: 1, required: true }),
      isEquipped: new BooleanField({ initial: false, required: true }),
    });

    return schema;
  }

  prepareDerivedData() {
    // // Build the formula dynamically using string interpolation
    // if (this.weapon.isWeapon && this.weapon.isActiveWeapon) {
    //   this.damageDice = `${this.weapon.diceNum}${this.weapon.diceSize}`;
    //   this.frayDamage = this.weapon.frayDamage;
    // }
    // else
    // {
    //   this.damageDice = ``;
    //   this.frayDamage = 0;
    // }
  }

}