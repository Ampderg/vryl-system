
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
    damage = Math.max(damage, 0);
    if (damage <= 0)
        return;

    let remainingDamage = damage;

    //AUTOMATION Vulnerable

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
    actor.update({ [`system.combat.guard.value`]: currentGuard + guard });
}

Hooks.on('renderChatMessageHTML', async (message, html, context) => {
    //Render buttons from flavor
    let selectedActors = message.flags.vryl?.selectedActorUuids?.length > 0 ? new Array(message.flags.vryl.selectedActorUuids.length) : [];
    for (let i = 0; i < selectedActors.length; i++) {
        selectedActors[i] = await fromUuid(message.flags.vryl.selectedActorUuids[i]);
    }

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

    function createButton(name, callback) {
        const button = document.createElement('button');
        button.classList.add("nolog");
        button.innerHTML = `<span>${name}</span>`;
        button.addEventListener('click', () => {
            callback();
        })
        html.appendChild(button);
    }

    function createTargetedButton(name, applyCallbackToActors, selectedActorUuids = []) {
        const button = document.createElement('button');
        button.classList.add("nolog");
        button.innerHTML = `<span>${name}</span>`;
        button.addEventListener('click', () => {

            if (selectedActorUuids.length == 0) {
                game.vrylGlobalFunctions.runTokenSelector({
                    callback: (tokens) => {
                        applyCallbackToActors(tokens.map(e => e.actor));
                    },
                    userToken: message.speakerActor?.getActiveTokens()?.filter(e => e.id == message.speaker.token)[0] ?? null,
                });
            }
            else {
                let actors = new Array(selectedActorUuids.length);
                for (let i = 0; i < actors.length; i++) {
                    actors[i] = fromUuid(selectedActorUuids[i]);
                }
                Promise.all(actors)
                    .then((results) => {
                        applyCallbackToActors(results);
                    })

            }
        })
        html.appendChild(button);
    }

    // AUTOMATION Weakened
    let damageButtons = buttons.filter(e => e.startsWith("damage"));
    if (damageButtons.length > 0) {
        const controlledActor = message.speakerActor;
        if (controlledActor) {
            let weakenedEffect = controlledActor.effects.find(e => e.statuses.has('weakened'));
            if (weakenedEffect) {
                let weakenedStacks = weakenedEffect.flags.statuscounter.value ?? 1;
                buttons.unshift(`weakened ${weakenedStacks}`);
            }
        }
    }

    buttons.forEach(b => {
        const elements = b.split("|");
        const tokens = elements[0].split(" ");
        const command = tokens[0];
        let buttonAlias = elements.length > 1 ? elements[1] : null;

        //#region Damage
        if (command == "damage") {
            let damage = parseInt(tokens[1]);
            let target = selectedActors;
            if (tokens.length > 2)
                target = [tokens[2]];

            damage = Math.max(damage, 0);
            if (!buttonAlias)
                buttonAlias = `Deal ${damage} Damage`;
            createTargetedButton(buttonAlias, (actors) => {
                let content = "";
                actors.forEach(actor => {
                    let actorDamage = damage;
                    //AUTOMATION Vulnerable
                    {
                        let effect = actor.effects.find(e => e.statuses.has('vulnerable'));
                        if (effect) {
                            let stacks = effect.flags.statuscounter.value ?? 1;
                            actorDamage += stacks;
                        }
                    }

                    content += (content != "" ? "<br>" : "") + `${actor.name} took <b>${actorDamage} damage</b>!`;
                    dealDamage(actor, actorDamage, target ?? message.flags.vryl.selectedActorUuids);
                });
                ChatMessage.create({
                    content: content,
                });
            }, target);
        }
        //#endregion
        //#region Recover
        else if (command == "recover") {
            let hp = parseInt(tokens[1]);
            hp = Math.max(hp, 0);
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
        //#endregion
        //#region Guard
        else if (command == "addguard") {
            let guard = parseInt(tokens[1]);
            if (!buttonAlias)
                buttonAlias = `Gain ${guard} Guard`;
            createTargetedButton(buttonAlias, (actors) => {
                let content = "";
                actors.forEach(actor => {
                    content += (content != "" ? "<br>" : "") + `${actor.name} gained <b>${guard} Guard</b>! <i>(${actor.system.combat.guard.value + guard})</i>`;
                    gainGuard(actor, guard);
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
        //#endregion
        //#region Conditions
        else if (command == "weakened") {
            //AUTOMATION Weakened
            let weakened = parseInt(tokens[1]);
            if (!buttonAlias)
                buttonAlias = `Apply Weakened x${weakened}`;
            createButton(buttonAlias, () => {
                let roll = parseInt(message.content);
                message.update({ content: Math.max(Math.ceil(roll / 2), roll - weakened) });
                message.update({ flavor: message.flavor + "<br>" + "Weakened x" + weakened })
            });
        }
        if (command == "loseCondition") {
            let effectId = tokens[1];
            let effectData = CONFIG.statusEffects.filter(e => e.id == effectId)[0];
            let stacksLost = parseInt(tokens[2]);
            if (!buttonAlias)
                buttonAlias = `Lose ${effectData.name} x${stacksLost}`;

            let target = selectedActors;
            if (tokens.length > 3)
                target = [tokens[3]];

            createTargetedButton(buttonAlias, (actors) => {
                let content = "";
                actors.forEach(actor => {
                    let actorEffect = actor.effects.find(e => e.statuses.has(effectId));
                    if (actorEffect) {
                        let stacks = actorEffect.flags.statuscounter?.value ?? 1;
                        stacks -= stacksLost;
                        if (stacks <= 0)
                            actorEffect.delete();
                        else
                            actorEffect.statusCounter.setValue(stacks);
                        content += (content != "" ? "<br>" : "") + `${actor.name}'s has lost <b>${stacksLost}</b> stack${stacksLost != 1 ? "s" : ""} of <b>${effectData.name}</b>. <i>(${stacks})</i>`;
                    }
                });
                ChatMessage.create({
                    content: content,
                });
            }, target);

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
        let flags = {
            vryl: {
                selectedActorUuids: [endingCombatant.actor.uuid],
                buttons: [],
            }
        }

        let content = `It is no longer ${endingCombatant.name}'s turn!`;
        const endingActor = await fromUuid(endingCombatant.actor.uuid);

        let conditions = await endOfTurnConditions(endingActor, flags.vryl.buttons, combat);
        if (conditions && conditions != "")
            content = "<br>" + conditions;

        await ChatMessage.create({
            content: content,
            flags: flags,
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

        let conditions = await startOfTurnConditions(actor, flags.vryl, combat, activeCombatant);
        if (conditions && conditions != "")
            content += "<br>" + conditions;

        if (actor.system.combat.guard.value > 0) {
            flags.vryl.buttons.push("setguard 0");
        }
        await ChatMessage.create({
            content: content,
            flags: flags,
        });
    }
});

async function endOfTurnConditions(actor, flags, combat, token) {
    //AUTOMATION Condition Save
}

async function startOfTurnConditions(actor, flags, combat, token) {
    let content = "";
    //AUTOMATION Stunned
    //AUTOMATION Dazed

    //AUTOMATION Burning

    let burningEffect = actor.effects.find(e => e.statuses.has('burning'));
    if (burningEffect) {
        let burningStacks = burningEffect.flags.statuscounter.value ?? 1;
        flags.buttons.push(`damage ${burningStacks} ${actor.uuid}|Apply ${burningStacks} Burning Damage`);
    }
    //AUTOMATION Bleeding
    let bleedingEffect = actor.effects.find(e => e.statuses.has('bleeding'));
    if (bleedingEffect) {
        let bleedingStacks = bleedingEffect.flags.statuscounter.value ?? 1;
        let r = new Roll("1d10");
        await r.evaluate();
        content += (content != "" ? "<br>" : "") + `Bleeding: Rolled a ${r.total} vs ${bleedingStacks} stacks`;
        if (r.total <= bleedingStacks) {
            content += `<br><b>Bleeding Hit!</b>`;
            let lostStacks = Math.min(10, bleedingStacks);
            flags.buttons.push(`loseCondition bleeding ${lostStacks} ${actor.uuid}|Lose Bleeding x${lostStacks}`);
            let bleedDamage = new Roll("2d6+4");
            await bleedDamage.evaluate();
            flags.buttons.push(`damage ${bleedDamage.total} ${actor.uuid}|Apply ${bleedDamage.total} Bleeding Damage`);
        }
    }
    //AUTOMATION Shocked
    let shockedMap = {};
    for (let turn of combat.turns) {
        const turnActor = await fromUuid(turn.actor.uuid);

        if (turnActor.statuses.has('shocked')) {
            flags.buttons.push(`loseCondition shocked 1 ${turnActor.uuid}|<b>${turnActor.name}</b>: Lose Shocked x1`);

            for (let compare of combat.turns) {
                if (compare.uuid == turn.uuid)
                    continue;

                const ray = new Ray(turn.token.getCenterPoint(), compare.token.getCenterPoint());
                // 2. Measure the distance using the scene's grid rules
                const distance = canvas.grid.measurePath([ray.A, ray.B]);

                if (distance.distance <= 2) {
                    if (!shockedMap[compare.actor.uuid])
                        shockedMap[compare.actor.uuid] = 0;

                    shockedMap[compare.actor.uuid] += 1;
                }
            }
        }
    }

    for (let [key, value] of Object.entries(shockedMap)) {
        let shockedActor = await fromUuid(key);
        flags.buttons.push(`damage ${value} ${shockedActor.uuid}|<b>${shockedActor.name}</b>: Apply ${value} Shocked Damage`);
    }

    return content;
}