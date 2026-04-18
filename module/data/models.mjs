const { BooleanField, HTMLField, NumberField, SchemaField, StringField, ArrayField, ObjectField, TypedObjectField } = foundry.data.fields;

/* -------------------------------------------- */
/*  Actor Models                                */
/* -------------------------------------------- */

class ActorDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {

    const schema = {};

    const equipmentSlots = {};

    const sortedSlotSettings = game.settings.get(CONFIG.SystemId, 'equipment-slots').toSorted((a, b) => a.id - b.id);

    for(const slot of sortedSlotSettings)
    {
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
      level: new NumberField({ required: true, initial: 3, min: 0, max: game.settings.get(CONFIG.SystemId, 'max-willpower') }),
      max: new NumberField({ required: true, initial: 3, min: 0, max: game.settings.get(CONFIG.SystemId, 'max-willpower') }),
      bonusDice: new NumberField({ required: true, initial: 0 }),
    });

    return schema;
  }
}

export class CharacterActorDataModel extends AttributeActorDataModel {
  static defineSchema() {

    return {
      ...super.defineSchema()
    };
  }
}

// #region Items

export class VrylItemBase extends foundry.abstract
  .TypeDataModel {
  static defineSchema() {
    const schema = {};

    

    //schema.description = new fields.HTMLField();

    return schema;
  }
}

export class VrylItemCard extends VrylItemBase {
  static defineSchema() {
    const schema = {};
    
    schema.summary = new HTMLField();
    schema.description = new HTMLField();

    return schema;
  }
}

export class VrylUsableEffect extends VrylItemCard {

}

export class VrylUsableItem extends VrylItemCard {
}

export class VrylInventoryItem extends VrylUsableItem {

  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.count = new NumberField({
      ...requiredInteger,
      initial: 1,
      min: 0,
    });

    schema.maxCount = new NumberField({
      integer: true,
      initial: null,
      min: 0,
    });

    schema.isBulky = new BooleanField({
      required: true,
      nullable: false,
      initial: false,
    });

    // - weapon data
    const weaponSchema = {};

    weaponSchema.isWeapon = new BooleanField({
      required: true,
      nullable: false,
      initial: false,
    });

    weaponSchema.isActiveWeapon = new BooleanField({
      required: true,
      nullable: false,
      initial: false,
    });

    weaponSchema.diceNum = new NumberField({
      ...requiredInteger,
      initial: 1,
      min: 1,
    });

    weaponSchema.diceSize = new StringField({ initial: 'd6' });

    weaponSchema.frayDamage = new NumberField({
      ...requiredInteger,
      initial: 2,
      min: 0,
    });

    schema.weapon = new SchemaField(weaponSchema);

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
    // Build the formula dynamically using string interpolation
    if (this.weapon.isWeapon && this.weapon.isActiveWeapon) {
      this.damageDice = `${this.weapon.diceNum}${this.weapon.diceSize}`;
      this.frayDamage = this.weapon.frayDamage;
    }
    else
    {
      this.damageDice = ``;
      this.frayDamage = 0;
    }
  }
}

