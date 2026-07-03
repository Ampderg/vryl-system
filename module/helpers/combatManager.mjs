Hooks.on("combatStart", (combat) => {
    for (const actor of combat.combatants) {
        for (const item of actor.actor.items) {
            if(item.type != "combatAction")
                continue;

            if(item.system.combatAction.frequency == "encounter")
            {
                item.update({ [`system.combatAction.charges`]: item.system.combatAction.maxCharges });
            }
        }
    }
});

Hooks.on("deleteCombat", (combat, options, userId) => {

});


Hooks.on("combatTurnChange", async (combat, prior, current) => {

    // Ensure this is the *first* active GM client to prevent duplicates
    // TODO: allow this to run even if there are no GMs
    const primaryGM = game.users.find(u => u.isGM && u.active);
    if (primaryGM.id !== game.user.id) return;

    const activeCombatant = combat.combatant;
    const actor = activeCombatant?.actor;

    const endingCombatant = combat.turns[prior.turn];

    if (endingCombatant) {
        await ChatMessage.create({
            content: `It is no longer ${endingCombatant.name}'s turn!`,
        });
    }

    // Check if it's the start of the turn (ignores rewinding)
    if (current.round > prior.round) {
        await ChatMessage.create({
            content: `A new round has started!`,
        });
    }

    if (actor) {
        await ChatMessage.create({
            content: `It is now ${actor.name}'s turn!`,
        });
    }
});