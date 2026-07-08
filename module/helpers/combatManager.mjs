
Hooks.on("combatStart", (combat) => {
    for (const actor of combat.combatants) {
        for (const item of actor.actor.items) {
            if (item.type != "combatAction")
                continue;

            if (item.system.combatAction.frequency == "encounter") {
                item.update({ [`system.combatAction.charges`]: item.system.combatAction.maxCharges });
            }
        }
    }
});

Hooks.on("deleteCombat", (combat, options, userId) => {

});

function dealDamage(actor, damage) {
    let remainingDamage = damage;

    let currentGuard = actor.system.combat.guard.value;
    if (currentGuard > 0) {
        actor.update({ [`system.combat.guard.value`]: Math.max(actor.system.combat.guard.min, currentGuard - remainingDamage) });
        remainingDamage -= currentGuard;
        if (remainingDamage <= 0)
            return;
    }

    let currentHp = actor.system.combat.hp.value;
    if (currentHp > 0) {
        actor.update({ [`system.combat.hp.value`]: Math.max(actor.system.combat.hp.min, currentHp - remainingDamage) });
        remainingDamage -= currentHp;
    }
}

function recoverHp(actor, hp) {
    let currentHp = actor.system.combat.hp.value;
    actor.update({ [`system.combat.hp.value`]: Math.min(actor.system.combat.hp.max, currentHp + hp) });
}

function gainGuard(actor, guard) {
    let currentGuard = actor.system.combat.guard.value;
    actor.update({ [`system.combat.guard.value`]: currentGuard });
}

Hooks.on('renderChatMessageHTML', (message, html, context) => {
    //Render buttons from flavor

    let buttons = message.flags?.vryl?.buttons ?? [];

    if (message.rolls?.length > 0) {

        if (message.flavor.toLowerCase().includes("damage")) {
            buttons.push(`damage ${Math.ceil(parseInt(message.content))}|Deal Damage`);
            buttons.push(`damage ${Math.ceil(parseInt(message.content) * 2)}|Deal Double Damage`);
            buttons.push(`damage ${Math.ceil(parseInt(message.content) * 0.5)}|Deal Half Damage`);
        }
        if (message.flavor.toLowerCase().includes("recover")) {
            buttons.push(`recover ${Math.ceil(parseInt(message.content))}|Recover Hit Points`);
        }
        if (message.flavor.toLowerCase().includes("guard")) {
            buttons.push(`addguard ${Math.ceil(parseInt(message.content))}|Gain Guard`);
            buttons.push(`addguard ${Math.ceil(parseInt(message.content) * 2)}|Gain Double Guard`);
        }
    }
    
    function createTargetedButton(name, applyCallbackToActors) {
        const button = document.createElement('button');
        button.classList.add("nolog");
        button.innerText = name;
        button.addEventListener('click', () => {

            if (!(message?.flags?.vryl?.selectedActorUuids?.length > 0)) {
                game.vrylGlobalFunctions.runTokenSelector({
                    callback: (tokens) => {
                        applyCallbackToActors(tokens.map(e => e.actor));
                    }
                });
            }
            else {
                let actors = new Array(message.flags.vryl.selectedActorUuids.length);
                for(let i = 0; i < actors.length; i++)
                {
                    actors[i] = fromUuid(message.flags.vryl.selectedActorUuids[i]);
                }
                Promise.all(actors)
                    .then((results) => {
                        applyCallbackToActors(results);
                    })
                
            }
        })
        html.appendChild(button);
    }

    buttons.forEach(b => {
        const elements = b.split("|");
        const tokens = elements[0].split(" ");
        const command = tokens[0];
        let buttonAlias = elements.length > 1 ? elements[1] : null;

        if (command == "damage") {
            let damage = parseInt(tokens[1]);
            if (!buttonAlias)
                buttonAlias = `Deal ${damage} Damage`;
            createTargetedButton(buttonAlias, (actors) => {
                let content = "";
                actors.forEach(actor => {
                    content += (content != "" ? "<br>" : "") + `${actor.name} took <b>${damage} damage</b>!`;
                    dealDamage(actor, damage);
                });
                ChatMessage.create({
                    content: content,
                });
            });
        }
        else if (command == "recover") {
            let hp = parseInt(tokens[1]);
            if (!buttonAlias)
                buttonAlias = `Recover ${hp} Hit Point${hp != 1 ? "s" : ""}`;
            createTargetedButton(buttonAlias, (actors) => {
                let hp = parseInt(tokens[1]);
                let content = "";
                actors.forEach(actor => {
                    content += (content != "" ? "<br>" : "") + `${actor.name} recovered <b>${hp} Hit Point${hp != 1 ? "s" : ""}</b>!`;
                    recoverHp(actor, hp);
                });
                ChatMessage.create({
                    content: content,
                });
            });
        }
        else if (command == "addguard") {
            let guard = parseInt(tokens[1]);
            if (!buttonAlias)
                buttonAlias = `Gain ${guard} Guard`;
            createTargetedButton(buttonAlias, (actors) => {
                let content = "";
                actors.forEach(token => {
                    content += (content != "" ? "<br>" : "") + `${token.actor.name} gained <b>${guard} Guard</b>! <i>(${token.actor.system.combat.guard.value + guard})</i>`;
                    gainGuard(token.actor, guard);
                });
                ChatMessage.create({
                    content: content,
                });
            });
        }
        else if (command == "setguard") {
            let guard = parseInt(tokens[1]);
            if (!buttonAlias)
                buttonAlias = `Set Guard to ${guard}`;
            createTargetedButton(buttonAlias, (actors) => {
                let content = "";
                actors.forEach(actor => {
                    content += (content != "" ? "<br>" : "") + `${actor.name}'s <b>Guard</b> has been set to <b>${guard}</b>.`;
                    actor.update({ [`system.combat.guard.value`]: guard });
                });
                ChatMessage.create({
                    content: content,
                });
            });
        }
    });
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
        let content = `It is no longer ${endingCombatant.name}'s turn!`;

        await ChatMessage.create({
            content: content,
            flags: {
                vryl: {
                    selectedActorUuids: [endingCombatant.actor.uuid]
                }
            }
        });
    }

    // Check if it's the start of the turn (ignores rewinding)
    if (current.round > prior.round) {
        await ChatMessage.create({
            content: `A new round has started!`,
        });
    }

    if (actor) {
        let content = `It is now ${actor.name}'s turn!`;
        let flags = {
            vryl: {
                selectedActorUuids: [actor.uuid],
                buttons: [],
            }
        };
        if (actor.system.combat.guard.value > 0) {
            flags.vryl.buttons.push("setguard 0");
        }
        await ChatMessage.create({
            content: content,
            flags: flags,
        });
    }
});