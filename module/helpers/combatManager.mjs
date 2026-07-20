
let combatManagerData = {
}

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

    startNewRound();
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
    let selectedActors = [];

    let buttons = message.flags?.vryl?.buttons ?? [];

    if (message.rolls?.length > 0) {
        selectedActors = message.flags.vryl?.rollCombatActionTargetUuids ?? message.flags.vryl?.selectedActorUuids ?? [];

        if (message.flavor.toLowerCase().includes("damage")) {
            buttons.push(`damage ${Math.ceil(parseInt(message.content))}|alias "Deal Damage"`);
            buttons.push(`damage ${Math.ceil(parseInt(message.content) * 2)}|alias "Deal Double Damage"`);
            buttons.push(`damage ${Math.ceil(parseInt(message.content) * 0.5)}|alias "Deal Half Damage"`);
        }
        if (message.flavor.toLowerCase().includes("recover")) {
            buttons.push(`recover ${Math.ceil(parseInt(message.content))}|alias "Recover Hit Points"`);
        }
        if (message.flavor.toLowerCase().includes("guard")) {
            buttons.push(`addguard ${Math.ceil(parseInt(message.content))}|alias "Gain Guard"`);
            buttons.push(`addguard ${Math.ceil(parseInt(message.content) * 2)}|alias "Gain Double Guard"`);
        }
    }

    if (message.flags?.vryl?.combatAction?.crits ?? 0 > 0) {
        let crits = message.flags.vryl.combatAction.crits;
        for (let i = 0; i < buttons.length; i++) {
            buttons[i] = buttons[i].replaceAll("[crits]", crits);
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

    async function formatButtonAlias(target, buttonAlias, text) {
        if (buttonAlias)
            return buttonAlias;

        buttonAlias = "";
        if (target.length == 1)
            buttonAlias += `<b>${(await fromUuid(target[0])).name}</b>: `;
        else if (target.length > 1)
            buttonAlias += `<b>Multiple Targets</b>: `;

        buttonAlias += text;

        return buttonAlias;
    }

    async function createChatMessageFromButton(context = {})
    {
        if(!context.flags)
            context.flags = {};
        if(!context.flags.vryl)
            context.flags.vryl = {};

        context.flags.vryl.hideInLog = true;

        let buttonResultMsg = await ChatMessage.create(context);
        
        let buttonResultMessages = message.getFlag("vryl", "buttonResultMessages") ?? [];
        buttonResultMessages.push(buttonResultMsg.uuid);
        message.setFlag("vryl", "buttonResultMessages", buttonResultMessages);
    }

    for (let b of buttons) {
        const elements = b.split("|");
        let tokens = elements[0].match(/"[^"]+"|[^\s]+/g);
        tokens = tokens.map(token => token.replace(/^"|"$/g, ''));
        const command = tokens[0].toLowerCase();

        let options = {}
        let buttonAlias = null;
        for (let i = 1; i < elements.length; i++) {
            let element = elements[i];
            let elementTokens = element.match(/"[^"]+"|[^\s]+/g);
            elementTokens = elementTokens.map(token => token.replace(/^"|"$/g, ''));

            if (elementTokens[0] == "alias") {
                buttonAlias = elementTokens[1];
            } else if (elementTokens[0] == "damageType") {
                options.damageType = elementTokens[1];
            }
        }

        // [50%]
        function getModifiedValue(modifierSet, unmodifiedValue) {
            let token = modifierSet;

            let percentRegex = /\[(\d+\.?\d+)%\]/;
            if (percentRegex.test(token)) {
                let percent = parseFloat(token.replace(percentRegex, `$1`));
                return Math.ceil(unmodifiedValue * (percent / 100.0));
            }

            return parseInt(modifierSet);
        }

        //#region Damage
        if (command == "damage") {
            let damage = parseInt(tokens[1]);
            let target = selectedActors;
            if (tokens.length > 2)
                target = [tokens[2]];

            damage = Math.max(damage, 0);
            let damageTypeString = "";
            if (options.damageType) {
                damageTypeString = " " + options.damageType;
                damageTypeString = damageTypeString.replace(/(^\w|\s\w)/g, m => m.toUpperCase());
            }
            buttonAlias = await formatButtonAlias(target, buttonAlias, `Deal ${damage}${damageTypeString} Damage`);
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

                    content += (content != "" ? "<br>" : "") + `${actor.name} took <b>${actorDamage}${damageTypeString} damage</b>!`;
                    dealDamage(actor, actorDamage, target ?? message.flags.vryl.selectedActorUuids);
                });
                createChatMessageFromButton({
                    content: content,
                });
            }, target);
        }
        //#endregion
        //#region Recover
        else if (command == "recover") {
            let hp = parseInt(tokens[1]);
            hp = Math.max(hp, 0);

            let target = selectedActors;
            if (tokens.length > 2)
                target = [tokens[2]];

            buttonAlias = await formatButtonAlias(target, buttonAlias, `Recover ${hp} Hit Point${hp != 1 ? "s" : ""}`);
            createTargetedButton(buttonAlias, (actors) => {
                let hp = parseInt(tokens[1]);
                let content = "";
                actors.forEach(actor => {
                    content += (content != "" ? "<br>" : "") + `${actor.name} recovered <b>${hp} Hit Point${hp != 1 ? "s" : ""}</b>!`;
                    recoverHp(actor, hp);
                });
                createChatMessageFromButton({
                    content: content,
                });
            }, target);
        }
        //#endregion
        //#region Guard
        else if (command == "addguard") {
            let guard = parseInt(tokens[1]);

            let target = selectedActors;
            if (tokens.length > 2)
                target = [tokens[2]];

            buttonAlias = await formatButtonAlias(target, buttonAlias, `Gain ${guard} Guard`);
            createTargetedButton(buttonAlias, (actors) => {
                let content = "";
                actors.forEach(actor => {
                    content += (content != "" ? "<br>" : "") + `${actor.name} gained <b>${guard} Guard</b>! <i>(${actor.system.combat.guard.value + guard})</i>`;
                    gainGuard(actor, guard);
                });
                createChatMessageFromButton({
                    content: content,
                });
            }, target);
        }
        else if (command == "setguard") {
            let setGuardString = parseInt(tokens[1]);

            let target = selectedActors;
            if (tokens.length > 2)
                target = [tokens[2]];

            buttonAlias = await formatButtonAlias(target, buttonAlias, `Set Guard to ${setGuardString}`);
            createTargetedButton(buttonAlias, (actors) => {
                let content = "";
                actors.forEach(actor => {
                    let currentGuard = actor.system.combat.guard.value;
                    let guardSet = getModifiedValue(setGuardString, currentGuard);
                    content += (content != "" ? "<br>" : "") + `${actor.name}'s <b>Guard</b> has been set to <b>${guard}</b>.`;
                    actor.update({ [`system.combat.guard.value`]: guard });
                });
                createChatMessageFromButton({
                    content: content,
                });
            }, target);
        }
        //#endregion
        //#region Conditions
        else if (command == "weakened") {
            //AUTOMATION Weakened
            let weakened = parseInt(tokens[1]);
            if (!buttonAlias)
                buttonAlias = `Apply Weakened x${weakened} to this roll`;
            createButton(buttonAlias, () => {
                let roll = parseInt(message.content);
                message.update({ content: Math.max(Math.ceil(roll / 2), roll - weakened) });
                message.update({ flavor: message.flavor + "<br>" + "Weakened x" + weakened })
            });
        }
        else if (command == "addcondition") {
            let effectId = tokens[1];
            let effectData = CONFIG.statusEffects.filter(e => e.id == effectId)[0];
            let stacksGained = parseInt(tokens[2]);
            let target = selectedActors;
            if (tokens.length > 3)
                target = [tokens[3]];

            buttonAlias = await formatButtonAlias(target, buttonAlias, `Apply ${effectData.name} x${stacksGained}`);


            createTargetedButton(buttonAlias, async (actors) => {
                let content = "";
                for (let actor of actors) {
                    let actorEffect = actor.effects.find(e => e.statuses.has(effectId));
                    let stacks = actorEffect?.flags?.statuscounter?.value ?? 0;

                    if (!actorEffect) {
                        await actor.toggleStatusEffect(effectId);
                        actorEffect = actor.effects.find(e => e.statuses.has(effectId));
                    }

                    stacks += stacksGained;
                    actorEffect.statusCounter.setValue(stacks);

                    content += (content != "" ? "<br>" : "") + `${actor.name} has gained <b>${stacksGained}</b> stack${stacksGained != 1 ? "s" : ""} of <b>${effectData.name}</b>. <i>(x${stacks})</i>`;
                }
                createChatMessageFromButton({
                    content: content,
                });
            }, target);
        }
        else if (command == "losecondition") {
            let effectId = tokens[1];
            let effectData = CONFIG.statusEffects.filter(e => e.id == effectId)[0];
            let stacksLostString = tokens[2];

            let target = selectedActors;
            if (tokens.length > 3)
                target = [tokens[3]];
            buttonAlias = await formatButtonAlias(target, buttonAlias, `Lose ${effectData.name} x${stacksLostString}`);

            createTargetedButton(buttonAlias, (actors) => {
                let content = "";
                actors.forEach(actor => {
                    let actorEffect = actor.effects.find(e => e.statuses.has(effectId));
                    if (actorEffect) {
                        let stacks = actorEffect.flags.statuscounter?.value ?? 1;
                        let stacksLost = getModifiedValue(stacksLostString, stacks);
                        stacksLost = Math.min(stacks, stacksLost);
                        stacks -= stacksLost;
                        if (stacks <= 0)
                            actorEffect.delete();
                        else
                            actorEffect.statusCounter.setValue(stacks);
                        content += (content != "" ? "<br>" : "") + `${actor.name} has lost <b>${stacksLost}</b> stack${stacksLost != 1 ? "s" : ""} of <b>${effectData.name}</b>. <i>(${stacks} Remaining)</i>`;
                    }
                });
                createChatMessageFromButton({
                    content: content,
                });
            }, target);
        }
        else if (command == "transfercondition") {
            let effectId = tokens[1];
            let effectData = CONFIG.statusEffects.filter(e => e.id == effectId)[0];
            let stacksLostString = tokens[2];

            let source = tokens[3];

            let target = selectedActors;
            if (tokens.length > 4)
                target = [tokens[4]];

            buttonAlias = await formatButtonAlias([source], buttonAlias, `Transfer ${effectData.name} x${stacksLostString}`);

            createTargetedButton(buttonAlias, async (actors) => {
                let content = "";

                let sourceActor = await fromUuid(source);
                let actorEffect = sourceActor.effects.find(e => e.statuses.has(effectId));
                if (actorEffect) {
                    let stacks = actorEffect.flags.statuscounter?.value ?? 1;
                    let stacksLost = getModifiedValue(stacksLostString, stacks);
                    stacksLost = Math.min(stacks, stacksLost);
                    stacks -= stacksLost;
                    if (stacks <= 0)
                        actorEffect.delete();
                    else
                        actorEffect.statusCounter.setValue(stacks);
                    content += (content != "" ? "<br>" : "") + `${sourceActor.name} has lost <b>${stacksLost}</b> stack${stacksLost != 1 ? "s" : ""} of <b>${effectData.name}</b>. <i>(${stacks} Remaining)</i>`;

                    for (let actor of actors) {
                        let actorEffect = actor.effects.find(e => e.statuses.has(effectId));
                        let stacks = actorEffect?.flags?.statuscounter?.value ?? 0;

                        if (!actorEffect) {
                            await actor.toggleStatusEffect(effectId);
                            actorEffect = actor.effects.find(e => e.statuses.has(effectId));
                        }

                        stacks += stacksLost;
                        actorEffect.statusCounter.setValue(stacks);

                        content += (content != "" ? "<br>" : "") + `${actor.name} has gained <b>${stacksLost}</b> stack${stacksLost != 1 ? "s" : ""} of <b>${effectData.name}</b>. <i>(x${stacks})</i>`;
                    }
                }

                createChatMessageFromButton({
                    content: content,
                });
            }, target);
        }
        else if (command == "conditionsave") {

            let target = selectedActors;
            if (tokens.length >= 1)
                target = [tokens[1]];

            buttonAlias = await formatButtonAlias(target, buttonAlias, `Condition Save`);

            createTargetedButton(buttonAlias, async (actors) => {
                for (let actor of actors) {
                    CONFIG.ui.rollBuilder.populateConditionSave(actor)
                }
            }, target);
        }
        else if (command == "threaten") {
            let sourceActorUuid = tokens[1];
            let sourceActor = await fromUuid(sourceActorUuid);
            let targetUuid = selectedActors;
            if (tokens.length > 2)
                targetUuid = [tokens[2]];

            buttonAlias = await formatButtonAlias(target, buttonAlias, `Threatened by <b>${sourceActor.name}</b>`);
            createTargetedButton(buttonAlias, async (actors) => {
                let content = "";
                for (let actor of actors) {
                    //AUTOMATION Threatened
                    {
                        let effect = actor.effects.find(e => e.statuses.has('threatened'));
                        if (!effect) {
                            await actor.toggleStatusEffect("threatened");
                            effect = actor.effects.find(e => e.statuses.has('threatened'));
                        }

                        let threatenedBy = effect.flags.vryl?.threatenedBy ?? [];
                        if (threatenedBy.filter(e => e == sourceActorUuid).length == 0) {
                            threatenedBy.push(sourceActorUuid);
                        }
                        effect.setFlag("vryl", "threatenedBy", threatenedBy);
                    }

                    content += (content != "" ? "<br>" : "") + `<b>${actor.name}</b> is now Threatened by <b>${sourceActor.name}</b>!`;
                }
                createChatMessageFromButton({
                    content: content,
                });
            }, targetUuid);
        }
        else if (command == "unthreaten") {
            let sourceActorUuid = tokens[1];
            let sourceActor = await fromUuid(sourceActorUuid);
            let targetUuid = selectedActors;
            if (tokens.length > 2)
                targetUuid = [tokens[2]];

            buttonAlias = await (targetUuid, buttonAlias, `Lose Threatened by <b>${sourceActor.name}</b>`);

            createTargetedButton(buttonAlias, (actors) => {
                let content = "";
                actors.forEach(actor => {
                    //AUTOMATION Threatened
                    {
                        let effect = actor.effects.find(e => e.statuses.has('threatened'));
                        if (effect) {
                            let threatenedBy = effect.flags.vryl?.threatenedBy ?? [];
                            threatenedBy = threatenedBy.filter(e => e != sourceActorUuid);
                            if (threatenedBy.length > 0)
                                effect.setFlag("vryl", "threatenedBy", threatenedBy);
                            else
                                effect.delete();
                        }
                    }

                    content += (content != "" ? "<br>" : "") + `<b>${actor.name}</b> is no longer Threatened by <b>${sourceActor.name}</b>!`;
                });
                createChatMessageFromButton({
                    content: content,
                });
            }, targetUuid);
        }
        else if (command == "finishturn") {
            if (!buttonAlias)
                buttonAlias = `Choose the next combatant to act`;
            createButton(buttonAlias, () => {
                game.vrylGlobalFunctions.runTokenSelector({
                    callback: async (tokens) => {
                        if (tokens.length == 0) {
                            //Nobody was selected
                            startNewRound();
                            return;
                        }

                        let currentCombatant = game.combat.combatant;
                        let nextActor = tokens[0].actor;
                        for (const turn of game.combat.turns) {
                            let turnActor = await fromUuid(turn.actor.uuid);
                            if (turnActor.uuid != nextActor.uuid)
                                continue;

                            await game.combat.update({ turn: game.combat.turns.findIndex(c => c.actor.uuid === turnActor.uuid) });
                            await turnActor.update({ [`system.combat.timesActivatedThisRound`]: turnActor.system.combat.timesActivatedThisRound + 1 });
                            onStartTurn();
                        }

                    },
                    singleTarget: true,
                    tokenFilter: (token) => game.combat.turns.filter(t => t.token.id == token.id).length > 0 && (token.actor.system.combat.timesActivatedThisRound < token.actor.system.combat.maxActivations),
                    doRender: {
                        activations: true,
                    },
                    dialogButtonText: "Next Combatant",
                });
            });
        }
        else if (command == "writesummary") {

            if (!buttonAlias)
                buttonAlias = `Write Summary`;

            createButton(buttonAlias, async () => {

                const path = `systems/vryl/templates/menus/write-summary.hbs`;
                const context = {
                    currentSummary: message.flags.vryl?.messageSummary ?? "",
                }
                const template = await foundry.applications.handlebars.renderTemplate(path, context);

                let d = new Dialog({
                    title: "Write Summary",
                    content: template,
                    buttons: {
                        one: {
                            label: "Save",
                            callback: (dHtml) => {
                                let proseMirror = dHtml.find(`#summary`)[0];
                                let summary = proseMirror.value;
                                summary = game.vrylGlobalFunctions.markdownToHtml(summary);
                                message.setFlag("vryl", "messageSummary", summary);
                                //message.update();
                            },
                        }
                    },
                    render: async (html) => {
                    },
                    close: (html) => {
                    }
                }, {
                    left: window.innerWidth - 300 - 450,
                    height: 350,
                });

                d.render(true);

            });

            if (message.flags.vryl?.messageSummary) {
                let summaryHtml = document.createElement('span');
                summaryHtml.innerHTML = `<br>${message.flags.vryl.messageSummary}`
                html.appendChild(summaryHtml);
            }
        }
    }
});

//#region combatTurnChange

async function startNewRound() {
    let combat = game.combat;
    for (const turn of combat.turns) {
        let turnActor = await fromUuid(turn.actor.uuid);
        await turnActor.update({ [`system.combat.timesActivatedThisRound`]: 0 });
    }

    let combatRound = combat.flags.vryl?.combatRound ?? 0;
    combatRound++;

    await combat.setFlag("vryl", "combatRound", combatRound);

    //await combat.update({ round: combat.round + 1, turn: combat, tokenId: null });

    await ChatMessage.create({
        content: `No combatant was selected, a new round has started!`,
        flags: {
            vryl: {
                buttons: ["finishTurn"],
                newCombatRound: combatRound,
            }
        }
    });
}

async function onStartTurn() {
    const combat = game.combat;
    const activeCombatant = combat.combatant;
    const actor = activeCombatant?.actor;

    if (actor) {
        let content = `It is now ${actor.name}'s turn!`;

        let flags = {
            vryl: {
                selectedActorUuids: [actor.uuid],
                buttons: [],
                startOfCombatTurn: true,
            }
        };

        let conditions = await startOfTurnConditions(actor, flags.vryl, combat, activeCombatant);
        if (conditions && conditions != "")
            content += "<br>" + conditions;

        //First turn
        if (actor.system.combat.timesActivatedThisRound <= 1) {
            if (actor.system.combat.guard.value > 0) {
                flags.vryl.buttons.push(`setguard 0 ${actor.uuid}`);
            }
        }

        await ChatMessage.create({
            content: content,
            flags: flags,
        });
    }
}

export async function onCombatTurnChange() {

    const combat = game.combat;
    // if (!(current.round > prior.round || current.turn > prior.turn))
    //     return;

    // Ensure this is the *first* active GM client to prevent duplicates
    // TODO: allow this to run even if there are no GMs
    // const primaryGM = game.users.find(u => u.isGM && u.active);
    // if (primaryGM.id !== game.user.id) return;

    const endingCombatant = combat.combatant;

    if (endingCombatant) {
        let flags = {
            vryl: {
                selectedActorUuids: [endingCombatant.actor.uuid],
                buttons: [],
                endOfCombatTurn: true,
            }
        }

        let content = `${endingCombatant.name} is ending their turn!`;
        const endingActor = await fromUuid(endingCombatant.actor.uuid);

        let conditions = await endOfTurnConditions(endingActor, flags.vryl, combat, endingCombatant.token);
        if (conditions && conditions != "")
            content = "<br>" + conditions;

        let conditionCount = 0;
        for (let c of endingActor.statuses) {
            let conditionData = CONFIG.statusEffects.filter(e => e.id == c)[0];
            if (conditionData) {
                if (conditionData.isCondition) {
                    conditionCount++;
                }
            }
        }
        if (conditionCount > 0)
            flags.vryl.buttons.push(`conditionSave ${endingActor.uuid}`);

        flags.vryl.buttons.push(`finishTurn`);
        flags.vryl.buttons.push(`writeSummary|alias "<b>${endingActor.name}</b>: Write Turn Summary"`);

        await ChatMessage.create({
            content: content,
            flags: flags,
        });
    }
}

//#region End of turn

async function endOfTurnConditions(actor, flags, combat, token) {
    let content = "";
    //AUTOMATION Condition Save

    //AUTOMATION Threatened
    let threatenedEffect = actor.effects.find(e => e.statuses.has('threatened'));
    if (threatenedEffect) {
        for (let compare of combat.turns) {
            const compareActor = await fromUuid(compare.actor.uuid);

            if (compare.uuid == actor.uuid || !threatenedEffect.flags.vryl?.threatenedBy?.includes(compareActor.uuid))
                continue;

            const ray = new Ray(token.getCenterPoint(), compare.token.getCenterPoint());
            // 2. Measure the distance using the scene's grid rules
            const distance = canvas.grid.measurePath([ray.A, ray.B]);

            if (distance.distance <= 1) {
                content += (content != "" ? "<br>" : "") + `<b>${actor.name}</b> is Threatened by <b>${compareActor.name}</b>, granting them an <i>Opportunity!</i>`;
                flags.buttons.push(`unthreaten ${compareActor.uuid} ${actor.uuid}`);
            }
        }
    }

    return content;
}

//#region Start of turn

async function startOfTurnConditions(actor, flags, combat, token) {
    let content = "";
    //AUTOMATION Stunned
    let stunnedEffect = actor.effects.find(e => e.statuses.has('stunned'));
    if (stunnedEffect) {
        flags.buttons.push(`loseCondition stunned [100%] ${actor.uuid}|alias "<b>${actor.name}</b>: Lose all stacks of Stunned"`);
    }

    //AUTOMATION Dazed
    let dazedEffect = actor.effects.find(e => e.statuses.has('dazed'));
    if (dazedEffect) {
        let actionPointsLost = actor.system.combat.actionsPerTurn - 1;
        flags.buttons.push(`loseCondition dazed ${actionPointsLost} ${actor.uuid}"`);
    }

    //AUTOMATION Burning

    let burningEffect = actor.effects.find(e => e.statuses.has('burning'));
    if (burningEffect) {
        let burningStacks = burningEffect.flags.statuscounter.value ?? 1;
        flags.buttons.push(`damage ${burningStacks} ${actor.uuid}|alias "Apply ${burningStacks} Burning Damage"|damageType "Burning"`);
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
            flags.buttons.push(`damage ${bleedDamage.total} ${actor.uuid}|alias "Apply ${bleedDamage.total} Bleeding Damage"|damageType "Bleeding"`);
        }
    }
    //AUTOMATION Shocked
    let shockedMap = {};
    for (let turn of combat.turns) {
        const turnActor = await fromUuid(turn.actor.uuid);

        if (turnActor.statuses.has('shocked')) {
            flags.buttons.push(`loseCondition shocked 1 ${turnActor.uuid}|alias "<b>${turnActor.name}</b>: Lose Shocked x1"`);

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
        flags.buttons.push(`damage ${value} ${shockedActor.uuid}|alias "<b>${shockedActor.name}</b>: Apply ${value} Shocked Damage"|damageType "Shocked"`);
    }

    //AUTOMATION Threatened
    for (let compare of combat.turns) {
        if (compare.uuid == actor.uuid)
            continue;

        const compareActor = await fromUuid(compare.actor.uuid);
        let threatenedEffect = compareActor.effects.find(e => e.statuses.has('threatened'));

        if (!threatenedEffect || !threatenedEffect.flags.vryl?.threatenedBy?.includes(actor.uuid))
            continue;

        flags.buttons.push(`unthreaten ${actor.uuid} ${compareActor.uuid}|alias "<b>${compareActor.name}</b>: Lose Threatened by <b>${actor.name}</b>"`);

    }
    

    return content;
}