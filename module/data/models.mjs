const { HTMLField, NumberField, SchemaField, StringField, ArrayField, ObjectField, TypedObjectField} = foundry.data.fields;

/* -------------------------------------------- */
/*  Actor Models                                */
/* -------------------------------------------- */

class ActorDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {

    // All Actors have resources.
    return {
      
    };
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