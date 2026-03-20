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
        level: new NumberField({ required: true, default: 0, min: 0, max: game.settings.get(CONFIG.SystemId, 'attribute_max_level') }),
        heroicLevel: new NumberField({ required: true, default: 0, min: 0, max: game.settings.get(CONFIG.SystemId, 'attribute_max_level') }),
        bonusDice: new NumberField({ required: true, default: 0 }),
      });
    });

    const schema = super.defineSchema();
    schema.attributes = new SchemaField(attributes);
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