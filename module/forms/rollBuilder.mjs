const { api, sheets } = foundry.applications;

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { AbstractSidebarTab } = foundry.applications.sidebar;
const { deepClone } = foundry.utils;
import { ROLL_ACTIONS } from '../helpers/roll-actions.mjs';
import { VrylActorSheet } from "../data/views.mjs";

export class RollSidebar extends HandlebarsApplicationMixin(AbstractSidebarTab) {
    // #region Options
    static tabName = `rollBuilder`;



    static DEFAULT_OPTIONS = {
        classes: [
            `roll-sidebar`,
        ],
        window: {},
        actions: {
            openApp: this.#openApp,
            roll: this.#roll,
            print: this.#print,
            clearRoll: this.clearRoll,
            groupRoll: this.toggleGroupRoll,
            "open-template-actor": this.openTemplateActor,
            "open-global-actions": this.openGlobalActions,
        },
    };

    static PARTS = {
        rollBuilder: {
            template: `systems/vryl/templates/menus/rollBuilder.hbs`,
        },
    };
    // #endregion Options

    // #region Data Prep


    _prepareContext() {
        return {
            meta: {
                idp: this.id,
            },
            can: {
                //upload: game.user.can(`FILES_UPLOAD`),
            },
        };
    };

    async _preparePartContext(partID, ctx) {
        ctx = deepClone(ctx);
        ctx.data = CONFIG.ROLL_DATA;
        return ctx;
    };
    // #endregion Data Prep

    async _renderHTML(context, options) {
        let html = await super._renderHTML(context, options);

        let dcElement = html.rollBuilder.querySelector("input#dc-input");
        dcElement.addEventListener('change', (event) => { this.updateDC(true) });
        Hooks.on(`vryl-rollDataUpdated`, () => { this.updateDC() });

        Hooks.on('renderChatMessageHTML', (message, html, context) => {
            this.bindChatListeners(message, html, context);
        });


        let opts = document.querySelectorAll(`.ui-control.plain.icon.fa-solid.fa-dice-d20`);
        for (let element of opts) {
            let item = element.parentElement;
            if (element) {
                let chatOpts = document.querySelectorAll(`.ui-control.plain.icon.fa-solid.fa-comments`);
                if (chatOpts.length == 1)
                    chatOpts[0].parentElement.after(item);
            }
        }
        return html;
    }

    _onRender(context, options) {
        this.updateDC();
        CONFIG.ui.rollBuilder.clearRoll();
    }

    //#region Update Roll Data

    static async updateRollData() {
        const containers = document.querySelectorAll(".roll-builder-attribute-container");
        containers.forEach(async (container) => {
            container.innerHTML = await CONFIG.ui.rollBuilder.renderRollAttributes(null, true);
            let attributeElements = container.querySelectorAll(`.roll-builder-attribute`);
            for (let element of attributeElements) {
                element.classList.add("attribute-deletable");
                if (element.classList.contains(`roll-action`))
                    element.addEventListener('click', (event) => {
                        let actorId;
                        let attributeDataName;
                        element.classList.forEach((c) => {
                            if (c.startsWith(`actor-`)) actorId = c.replace(`actor-`, ``);
                            else if (c.startsWith(`action-name-`)) attributeDataName = c.replace(`action-name-`, ``);
                        })
                        this.removeAction(attributeDataName, game.actors.get(actorId));
                    });
                else
                    element.addEventListener('click', (event) => {
                        let actorId;
                        let attributeDataName;
                        element.classList.forEach((c) => {
                            if (c.startsWith(`actor-`)) actorId = c.replace(`actor-`, ``);
                            else if (c.startsWith(`attribute-name-`)) attributeDataName = c.replace(`attribute-name-`, ``);
                        })
                        this.deselectAttribute(actorId, attributeDataName);
                    });
            }
        });

        Hooks.callAll(`vryl-rollDataUpdated`);
    }

    async updateIndividualPanelRollData() {
        this.element.querySelector(`input#dc-input`).value = CONFIG.ROLL_DATA.dc;
    }

    static async #openApp(event, target) {
        const { app: appKey, ...options } = target.dataset;
        delete options.action;

        if (appKey in api.Apps) {
            const app = new api.Apps[appKey](options);
            await app.render({ force: true });
        } else {
            console.error(`Failed to find app with key: ${appKey}`);
        };
    };

    //#region Roll

    //AUTOMATION Doom
    static applyDoom(willpowerAttribute, actorData) {
        if(!actorData?.actor?.effects)
            return;

        let effect = actorData.actor.effects.find(e => e.statuses.has('doom'));
        if (effect) {
            let stacks = effect.flags.statuscounter.value ?? 1;
            willpowerAttribute.bonusDice -= stacks;
        }
    }

    //AUTOMATION Disoriented
    static applyDisoriented(bonusDice, actorData) {
        if(!actorData?.actor?.effects)
            return;

        let effect = actorData.actor.effects.find(e => e.statuses.has('disoriented'));
        if (effect) {
            let stacks = effect.flags.statuscounter.value ?? 1;
            bonusDice -= stacks;
        }
        return bonusDice;
    }

    //AUTOMATION Frightened
    static applyFrightened(guaranteedSuccesses, actorData) {
        if(!actorData?.actor?.effects)
            return;

        let effect = actorData.actor.effects.find(e => e.statuses.has('frightened'));
        if (effect) {
            let stacks = effect.flags.statuscounter.value ?? 1;
            guaranteedSuccesses -= 1;
        }
        return guaranteedSuccesses;
    }

    static _getRollLevel() {
        let totalLevels = CONFIG.ROLL_DATA.bonusDice ?? 0;
        let guaranteedSuccesses = CONFIG.ROLL_DATA.guaranteedSuccesses ?? 0;

        const rollActors = CONFIG.ROLL_DATA.rollActors;
        const rollActorsValues = rollActors.values();

        function addAttribute(attribute) {
            if (attribute.level && !isNaN(attribute.level))
                totalLevels += attribute.level;
            if (attribute.heroicLevel && !isNaN(attribute.heroicLevel))
                totalLevels += attribute.heroicLevel;
            if (attribute.bonusDice && !isNaN(attribute.bonusDice))
                totalLevels += attribute.bonusDice;
            if (attribute.guaranteedSuccesses && !isNaN(attribute.guaranteedSuccesses))
                guaranteedSuccesses += attribute.guaranteedSuccesses;
        }

        for (const actor of rollActorsValues) {
            if (actor.actor?.system?.bonusDice)
                totalLevels += RollSidebar.applyDisoriented(actor.actor.system.bonusDice, actor);

            guaranteedSuccesses = RollSidebar.applyFrightened(guaranteedSuccesses, actor);

            if (actor.attributes) {
                for (const attribute of actor.attributes) {
                    addAttribute(attribute);
                }
            }

            if (actor.willpower) {
                let willpower = structuredClone(actor.willpower);
                RollSidebar.applyDoom(willpower, actor);
                addAttribute(willpower);
            }
        }

        const groupChallenge = CONFIG.ui.rollBuilder.getRollFlagValue(`group-roll`, `global`, `targetGroupSize`);
        if (groupChallenge)
            totalLevels = Math.ceil(totalLevels / parseFloat(groupChallenge));

        if (totalLevels <= 0 && CONFIG.ui.rollBuilder.hasRollFlag(`roll-level-zero`, 'global', 'preRoll')) {
            guaranteedSuccesses -= 1 - totalLevels;
            totalLevels = 2 - totalLevels;
        }

        return {
            totalLevels: totalLevels,
            guaranteedSuccesses: guaranteedSuccesses,
        }
    }

    static _getRollData() {
        let levelData = CONFIG.ui.rollBuilder._getRollLevel();
        let dc = CONFIG.ROLL_DATA.dc;

        for (const [key, actor] of CONFIG.ROLL_DATA.rollActors) {
            if (actor.actor.system.dcMod)
                dc = parseInt(dc) + (parseInt(actor.actor.system.dcMod) ?? 0);
        }

        let faces = 20;
        let critThreshold = faces;

        return {
            dc: dc,
            level: levelData.totalLevels,
            guaranteedSuccesses: levelData.guaranteedSuccesses,
            faces: faces,
            critThreshold: critThreshold,
        }
    }

    // static _applyExposure(roll, critThreshold = 20) {
    //     let exposure = CONFIG.ui.rollBuilder.getRollFlagValue(`exposure`, `global`, `amount`);
    //     if (exposure == 0)
    //         return;

    //     for (let term of roll.terms) {
    //         if (!(term instanceof foundry.dice.terms.Die))
    //             continue;

    //         for (let die of term.results) {
    //             if (die.success && die.result < critThreshold) {
    //                 die.result = 20;


    //                 exposure--;
    //                 if (exposure <= 0)
    //                     return;
    //             }
    //         }
    //     }
    // }

    static async setupMessageCombatAction(flags, action, options = { targetUuids: null, spendCharge: false }) {
        if (!flags.vryl) flags.vryl = {};

        if (!options.targetUuids)
            options.targetUuids = CONFIG.ROLL_DATA.rollCombatActionTargetUuids;

        if (!options.targetUuids)
            options.targetUuids = [];

        if (action.system.combatAction.usesCharges && options.spendCharge) {
            if (action.system.combatAction.charges <= 0) {
                ui.notifications.warn(`${action.name} has no charges remaining!`);
                return;
            }
            action.update({ [`system.combatAction.charges`]: Math.max(0, action.system.combatAction.charges - 1) });
        }
        flags.vryl.combatAction = {
            uuid: action.uuid,
            usedEffects: [],
            targetUuids: [...options.targetUuids],
            targetNames: new Array(options.targetUuids.length),
        }

        flags.vryl.combatAction.currentTargetUuids = flags.vryl.combatAction.targetUuids;
        
        for (let i = 0; i < options.targetUuids.length; i++) {
            flags.vryl.combatAction.targetNames[i] = (await fromUuid(options.targetUuids[i])).name;
        }
    }

    static async #roll(event, target) {
        const flags = {
            vryl: {
                narrativeResult: CONFIG.ui.rollBuilder.hasRollFlag(`narrative-result`, 'global', 'preRoll'),
                isAttributeRoll: true,
                buttons: [],
            }
        }

        console.log("Rolling with data: ", CONFIG.ROLL_DATA);

        const rollData = CONFIG.ui.rollBuilder._getRollData();

        let formula = `${rollData.level}d${rollData.faces}`;

        if (CONFIG.ui.rollBuilder.hasRollFlag(`exposure`, 'global', 'preRoll')) {
            const exposure = CONFIG.ui.rollBuilder.getRollFlagValue(`exposure`, `global`, `amount`);
            formula += `exposure|${exposure}|${rollData.dc}|${rollData.critThreshold}`
        }

        if (CONFIG.ui.rollBuilder.hasRollFlag(`explode-crits`, 'global', 'preRoll'))
            formula += `x>=${rollData.critThreshold}`;

        formula += `cs>=${rollData.dc}`;
        formula += `sa`;
        formula += ` + ${rollData.guaranteedSuccesses}`;
        let roll = new CONFIG.Dice.AttributeRoll(formula);
        roll.options.flavor = await CONFIG.ui.rollBuilder.renderRoll(rollData);

        await roll.roll();

        if (CONFIG.ROLL_DATA.rollCombatActionSource) {
            await RollSidebar.setupMessageCombatAction(flags, CONFIG.ROLL_DATA.rollCombatActionSource, { targetUuids: CONFIG.ROLL_DATA.rollCombatActionTargetUuids, spendCharge: true });
            flags.vryl.combatAction.spentSuccesses = 0;
            flags.vryl.combatAction.totalSuccesses = roll._total;
            
            let crits = 0;
            for (let term of roll.terms) {
                if (term.results) {
                    for (let result of term.results) {
                        if (result.result >= term._faces)
                            crits++;
                    }
                }
            }
            

            flags.vryl.combatAction.crits = crits;
        }

        //AUTOMATION Disoriented
        for (const [key, actorData] of CONFIG.ROLL_DATA.rollActors) {
            const actor = game.actors.get(key);
            let disorientedEffect = actor.effects.find(e => e.statuses.has('disoriented'));
            if (disorientedEffect) {
                let stacks = disorientedEffect.flags.statuscounter.value ?? 1;
                stacks = Math.ceil(stacks / 2);
                flags.vryl.buttons.push(`loseCondition disoriented ${stacks} ${actor.uuid}|<b>${actor.name}</b>: Lose Disoriented x${stacks}`);
            }
        }

        let msg = await roll.toMessage({
            flags: flags,
        });

        let rolls = msg.rolls;

        // let flavor = rolls[0].options.flavor;
        // rolls[0].options.flavor = flavor.replaceAll(`id="combatEffectsButton"`, `id="combatEffectsButton" onclick="event.stopPropagation(); event.preventDefault(); CONFIG.ui.rollBuilder.openCombatActionEffectsMenu('${msg.uuid}')"`);

        // await msg.update({ rolls: rolls });

        await CONFIG.ui.rollBuilder.processPostRollActions(msg);

        const coinflipWillpower = game.settings.get(CONFIG.SystemId, 'spend-willpower-coinflip');

        for (const [key, actor] of CONFIG.ROLL_DATA.rollActors) {
            if (actor.willpower && !isNaN(actor.willpower.guaranteedSuccesses)) {
                if (coinflipWillpower) {
                    const coinCount = actor.willpower.guaranteedSuccesses;
                    let willpowerKeepRoll = new Roll(`${coinCount}dc`);
                    await willpowerKeepRoll.evaluate();
                    await willpowerKeepRoll.toMessage({ flavor: `${actor.actor.name} lost <b>${coinCount - willpowerKeepRoll.total} Willpower</b>!` });
                    actor.actor.update({ [`system.willpower.level`]: actor.actor.system.willpower.level - coinCount + willpowerKeepRoll.total })
                }
                else {
                    await ChatMessage.create({ content: `${actor.actor.name} lost <b>${actor.willpower.guaranteedSuccesses} Willpower</b>!` })
                    actor.actor.update({ [`system.willpower.level`]: actor.actor.system.willpower.level - actor.willpower.guaranteedSuccesses })
                }
            }
        }


        CONFIG.ui.rollBuilder.clearRoll();
        CONFIG.ui.rollBuilder.goToChat(target);
    }



    //#region Print

    static async #print(event, target) {
        console.log("Printing to chat with data: ", CONFIG.ROLL_DATA);
        const rollData = CONFIG.ROLL_DATA;
        let rollActors = {};

        for (const [key, value] of rollData.rollActors) {
            rollActors[key] = value;
            rollActors[key].id = key;
        }

        let html = await RollSidebar.renderRoll();
        html += `<div class="copy-roll flexcol">
        <button class="copy-roll-replace">Copy Roll <i class="fa-solid fa-copy"></i></button>
        `;

        html += `<details class="full-width">
        <summary class="align-center">Expand</summary>
        <button class="copy-roll-append full-width">Append Actors to Roll <i class="fa-regular fa-plus-square"></i></button>
        </details>`;

        html += `</div>`;

        const flags = {
            vryl: {
                rollData: structuredClone(rollData),
                rollActors: structuredClone(rollActors),
                isAttributeRoll: true,
                isPrintedRoll: true,
            }
        }

        const msg = await ChatMessage.create({
            content: html,
            flags: flags,
        });

        RollSidebar.clearRoll();
        RollSidebar.goToChat(target);
    }

    static getActor(actorData, fillTemplate = true) {
        if (actorData.id != 'VRYL-TEMPLATE-ACTOR')
            return game.actors.get(actorData.id);

        if (!fillTemplate)
            return actorData.id;

        const controlledActor = game.user.character ?? canvas.tokens.controlled[0]?.actor;

        if (controlledActor) {
            return controlledActor;
        }

        return actorData.actor;
    }

    static updateActorSelection(actor) {
        const rollActor = CONFIG.ROLL_DATA.rollActors.get(actor._id);
        const attributesArray = Object.entries(actor.system.attributes);
        for (const a of rollActor.attributes) {
            const filtered = attributesArray.filter((b) => b[0] == a.dataName);
            if (filtered && filtered.length > 0) {
                const attributeData = Object.entries(filtered[0][1]);
                for (const d of attributeData) {
                    a[d[0]] = d[1];
                }
                CONFIG.ui.rollBuilder.selectAttribute(actor, a);
            }
        }
    }

    async bindChatListeners(message, html, context) {

        let copyButton = html.querySelector(`.copy-roll-replace`);
        if (copyButton) {
            copyButton.addEventListener('click', function () {
                const flags = message.flags.vryl;
                CONFIG.ROLL_DATA = structuredClone(flags.rollData);
                const rollActors = Object.entries(flags.rollActors);
                CONFIG.ROLL_DATA.rollActors = new Map();
                for (const [key, value] of rollActors) {
                    let actorData = structuredClone(value);

                    actorData.actor = RollSidebar.getActor(actorData);

                    CONFIG.ROLL_DATA.rollActors.set(actorData.actor.id, actorData);
                    if (actorData.actor.id != key) updateActorSelection(actorData.actor);
                }

                RollSidebar.updateRollData();
                CONFIG.ui.rollBuilder.goToRollBuilder();
            });
        }
        let appendButton = html.querySelector(`.copy-roll-append`);
        if (appendButton) {
            appendButton.addEventListener('click', function () {
                const flags = message.flags.vryl;
                const rollActors = Object.entries(flags.rollActors);

                for (const [key, value] of rollActors) {
                    let actorData = structuredClone(value);
                    let currentData = CONFIG.ROLL_DATA.rollActors.get(key) ?? {};
                    const oldData = structuredClone(currentData);

                    currentData = actorData;

                    currentData.attributes = actorData.attributes.length > 0 ? actorData.attributes : oldData.attributes;

                    if (!currentData.attributes)
                        currentData.attributes = [];

                    currentData.willpower = actorData.willpower ?? oldData.willpower;

                    currentData.actor = RollSidebar.getActor(actorData);

                    CONFIG.ROLL_DATA.rollActors.set(actorData.actor.id, currentData);
                    if (actorData.actor.id != key) RollSidebar.updateActorSelection(actorData.actor);
                }

                RollSidebar.updateRollData();
                CONFIG.ui.rollBuilder.goToRollBuilder();
            });
        }
        let combatEffectsButton = html.querySelector(`#combatEffectsButton`);
        if (combatEffectsButton) {

        }
    }

    //#region Utils

    static getAttributeCategory(attribute) {
        if (attribute.dataName == 'willpower') return attribute;

        const attributeCategories = game.settings.get(CONFIG.SystemId, 'attribute-categories');
        return attributeCategories[attribute.category];
    }
    static getAttributeType(attribute) {
        if (attribute.dataName == 'willpower') return attribute;

        const attributeCategory = this.getAttributeCategory(attribute);
        const attributeTypes = game.settings.get(CONFIG.SystemId, 'attribute-types');
        return attributeTypes[attributeCategory.type];
    }
    static getDefaultAttributeFromDataName(dataName) {
        const attributes = game.settings.get(CONFIG.SystemId, 'attributes');
        return attributes.filter((a) => a.dataName == dataName);
    }
    static populateDefaultAttributeFromDataName(attribute, dataName) {
        const defaults = Object.entries(this.getDefaultAttributeFromDataName(dataName));
        for (const d of defaults) {
            if (!attribute[d[0]])
                attribute[d[0]] = d[1];
        }
    }

    //#region Attribute Selection

    static populateRollActor(actor) {
        if (!CONFIG.ROLL_DATA.rollActors.has(actor.id))
            CONFIG.ROLL_DATA.rollActors.set(actor.id, {
                actor: actor,
                attributes: []
            });
    }

    static async clearSelectedAttributes() {
        CONFIG.ROLL_DATA.rollActors.clear();
    }

    static async toggleWillpower(actor, render = true) {
        const actorData = rollActors.get(actor.id);
        if (!actorData || !actorData.willpower)
            await this.selectAttribute(actor, actor.system.willpower, render);
        else
            await this.deselectAttribute(actor.id, 'willpower', render);
    }

    static async toggleAttribute(actor, attribute, render = true) {
        this.populateRollActor(actor);

        const rollActors = CONFIG.ROLL_DATA.rollActors;
        const actorData = rollActors.get(actor.id);

        let doSelect = false;
        if (attribute.dataName == 'willpower')
            doSelect = !actorData.willpower || isNaN(actorData.willpower.level);
        else
            doSelect = actorData.attributes.filter((a) => a.dataName == attribute.dataName).length == 0

        if (doSelect)
            await this.selectAttribute(actor, attribute, render);
        else
            await this.deselectAttribute(actor.id, attribute.dataName, render);
    }

    static async selectAttribute(actor, attribute, render = true) {
        this.populateRollActor(actor);

        const rollActors = CONFIG.ROLL_DATA.rollActors;
        const actorData = rollActors.get(actor.id);

        //Deselect matching types
        if (attribute.dataName == 'willpower') {
            if (actorData.willpower && !isNaN(actorData.willpower.guaranteedSuccesses))
                attribute.guaranteedSuccesses = actorData.willpower.guaranteedSuccesses;
            actorData.willpower = attribute;
        }
        else {
            const type = this.getAttributeType(attribute);

            actorData.attributes = actorData.attributes.filter((a) => {
                const compareType = this.getAttributeType(a);
                return type.canSelectMultipleAttributesAtOnce || compareType.dataName != type.dataName;
            });
            actorData.attributes.push(attribute);
        }

        if (render)
            this.updateRollData();
    }

    static async deselectAttribute(actorId, dataName, render = true) {
        const rollActors = CONFIG.ROLL_DATA.rollActors;

        if (!rollActors.has(actorId)) {
            if (actorId != 'global')
                return;

            if (dataName == "") {
                CONFIG.ROLL_DATA.bonusDice = 0;
                CONFIG.ROLL_DATA.guaranteedSuccesses = 0;
            }
        }
        else {
            const actorData = rollActors.get(actorId);

            if (dataName == "willpower")
                actorData.willpower = undefined;
            else
                actorData.attributes = actorData.attributes.filter((a) => a.dataName != dataName);
        }
        if (render)
            this.updateRollData();
    }

    //#region Attribute Rendering

    static async renderRoll(rollData, inSidebar = false) {
        if (rollData == undefined)
            rollData = CONFIG.ROLL_DATA;
        return (await this.renderRollAttributes(rollData, inSidebar)) + (await this.renderRollOptions(rollData, inSidebar));
    }

    static async renderRollAttributes(rollData, inSidebar = false) {
        let content = "";
        const rollActors = CONFIG.ROLL_DATA.rollActors;
        const attributeCategories = game.settings.get(CONFIG.SystemId, 'attribute-categories');
        const attributeTypes = game.settings.get(CONFIG.SystemId, 'attribute-types');

        CONFIG.ui.rollBuilder._populateActorEffects();

        async function renderAttribute(actorId, attribute) {
            if (actorId == 'global') {
                if (attribute.level == 0)
                    attribute.level = undefined;
                if (attribute.guaranteedSuccesses == 0)
                    attribute.guaranteedSuccesses = undefined;
            }

            let content = "";
            const bonusDiceContent = ` ${attribute.bonusDice > 0 ? "+" : "-"} ${Math.abs(attribute.bonusDice)}`;
            attribute.combinedLevelWithoutBonus = attribute.level ?? 0;
            if (attribute.heroicLevel && !isNaN(attribute.heroicLevel))
                attribute.combinedLevelWithoutBonus += attribute.heroicLevel;

            attribute.combinedLevel = attribute.combinedLevelWithoutBonus;
            if (attribute.bonusDice && !isNaN(attribute.bonusDice))
                attribute.combinedLevel += attribute.bonusDice;

            attribute.actorId = actorId;
            attribute.dataName = attribute.dataName;

            if (!isNaN(attribute.level) || !isNaN(attribute.bonusDice)) {
                attribute.hasLevel = true;
                attribute.bonusDiceString = attribute.bonusDice && attribute.bonusDice != 0 ? bonusDiceContent : "";
            }
            else
                attribute.hasLevel = false;

            if (!isNaN(attribute.guaranteedSuccesses) && attribute.guaranteedSuccesses != 0)
                attribute.hasFlat = true;
            else
                attribute.hasFlat = false;

            const template = await foundry.applications.handlebars.renderTemplate(`systems/vryl/templates/parts/roll/roll-attribute.hbs`, attribute);
            content += template;
            return content;
        }

        async function renderAction(action) {
            action.inSidebar = inSidebar;
            const template = await foundry.applications.handlebars.renderTemplate(`systems/vryl/templates/parts/roll/roll-action.hbs`, action);
            return template;
        }

        async function renderItemEffects(actorId) {
            const actorItems = CONFIG.ROLL_DATA.rollItemEffects.filter((a) => a.actor.id == actorId);

            let content = "";

            for (const item of actorItems) {
                if (item.isApplied || inSidebar) {
                    item.inSidebar = inSidebar;
                    content += await foundry.applications.handlebars.renderTemplate(`systems/vryl/templates/parts/roll/roll-usePrompt.hbs`, item);
                }
            }

            return content;
        }

        for (const [key, actorData] of rollActors) {
            let actorContent = "";
            //Render attributes
            if ((actorData.attributes && actorData.attributes.length > 0)) {
                const sortedAttributes = actorData.attributes.toSorted((a, b) => {
                    return this.getAttributeType(a).sorting - this.getAttributeType(b).sorting;
                });

                for (const attribute of sortedAttributes) {
                    actorContent += await renderAttribute(key, attribute);
                }
            }

            //Add willpower if it is present
            if (actorData.willpower) {
                let willpower = structuredClone(actorData.willpower);
                willpower.dataName = "willpower";
                willpower.name = "Willpower";

                RollSidebar.applyDoom(willpower, actorData);

                actorContent += await renderAttribute(key, willpower);
            }

            //Add actor bonuses if present
            {
                let actorBonuses = {};

                let actorLevels = 0;
                actorLevels += RollSidebar.applyDisoriented(actorData.actor.system.bonusDice ?? 0, actorData);
                if (actorLevels)
                    actorBonuses.level = actorLevels

                let actorGuaranteedSuccesses = 0;
                actorGuaranteedSuccesses += RollSidebar.applyFrightened(actorGuaranteedSuccesses, actorData);
                if (actorGuaranteedSuccesses)
                    actorBonuses.guaranteedSuccesses = actorGuaranteedSuccesses;

                if (Object.keys(actorBonuses).length > 0) {
                    actorBonuses.dataName = "actor_" + key;
                    actorBonuses.name = "Character Bonuses";

                    actorContent += await renderAttribute(key, actorBonuses);
                }
            }

            //Render actor actions
            if ((actorData.actions && actorData.actions.length > 0)) {
                // if (actorContent != "")
                //     actorContent += "<br>";
                for (const action of actorData.actions.toSorted((a, b) => a.sorting - b.sorting)) {
                    action.actorId = key;
                    actorContent += await renderAction(action);
                }
            }

            actorContent += await renderItemEffects(key);

            //Combine all renderings
            if (actorContent != "") {
                content += `
                <div class="roll-builder-actor actor-${key}"><div class="roll-builder-actor-inner">
                <h5 class="flex-group-center">${actorData.actor.name}</h5>
                ${actorContent}
                </div></div>`;
            }
        }

        //Global content
        let globalContent = "";

        const globalAttribute = {
            level: CONFIG.ROLL_DATA.bonusDice,
            guaranteedSuccesses: CONFIG.ROLL_DATA.guaranteedSuccesses,
        }
        //Bonus Dice
        if ((globalAttribute.level && globalAttribute.level != 0)
            || (globalAttribute.guaranteedSuccesses && globalAttribute.guaranteedSuccesses != 0))
            globalContent += await renderAttribute('global', globalAttribute);

        //Actions
        if (CONFIG.ROLL_DATA.globalActions && CONFIG.ROLL_DATA.globalActions.length > 0) {
            // if (globalContent != "")
            //     globalContent += "<hr>";
            for (const action of CONFIG.ROLL_DATA.globalActions.toSorted((a, b) => a.sorting - b.sorting)) {
                action.actorId = 'global';
                globalContent += await renderAction(action);
            }
        }

        if (CONFIG.ROLL_DATA.rollCombatActionSource) {
            CONFIG.ROLL_DATA.rollCombatActionSource.inSidebar = inSidebar;
            let flags = {};
            await this.setupMessageCombatAction(flags, CONFIG.ROLL_DATA.rollCombatActionSource, { targetUuids: CONFIG.ROLL_DATA.rollCombatActionTargetUuids, spendCharge: false });
            CONFIG.ROLL_DATA.rollCombatActionSource.flags = flags;
            let actionContent = await renderTemplate(`systems/vryl/templates/parts/combat/action-chat-card.hbs`, CONFIG.ROLL_DATA.rollCombatActionSource);

            content += actionContent;
        }

        if (globalContent != "") {
            content += `
            <div class="roll-builder-actor global"><div class="roll-builder-actor-inner">
            <h6 class="flex-group-center">Roll Options</h6>
            ${globalContent}
            </div></div>`
        }

        return content;
    }

    static async renderRollOptions(rollData, inSidebar = false) {
        return await foundry.applications.handlebars.renderTemplate(`systems/vryl/templates/parts/roll/roll-options.hbs`, rollData);
    }

    //#region Clear Roll

    static async clearRoll(replaceWithDefault = true) {
        console.log("Clearing roll data...");

        CONFIG.ui.rollBuilder._clearInstantEffects();
        CONFIG.ROLL_DATA = {};
        CONFIG.ROLL_DATA.rollActors = new Map();
        CONFIG.ROLL_DATA.globalActions = [];
        CONFIG.ROLL_DATA.rollItemEffects = []

        let allSelected = document.querySelectorAll(`.selected.attribute-name`);
        for (let a of allSelected) {
            a.classList.remove(`selected`);
        }

        if (replaceWithDefault) {
            CONFIG.ui.rollBuilder.addAction('narrative-result', 'global', false);
            CONFIG.ui.rollBuilder.addAction(`roll-level-zero`, 'global', false);
        }
        CONFIG.ui.rollBuilder.updateRollData();
    }

    // #region Tab Nav

    static goToRollBuilder() {
        if (!window.ui.sidebar.expanded)
            window.ui.sidebar.expand();
        window.ui.sidebar.changeTab("rollBuilder", "primary");
    }

    static goToChat(target) {
        if (target.offsetParent.offsetParent.id.includes("popout")) return;
        if (!window.ui.sidebar.expanded)
            window.ui.sidebar.expand()
        window.ui.sidebar.changeTab("chat", "primary");
    }

    //#region Input Fields

    static adjustRollData(field, change, options =
        {
            render: true,
            min: undefined,
            max: undefined,
        }) {
        if (!CONFIG.ROLL_DATA[field]) CONFIG.ROLL_DATA[field] = 0;
        CONFIG.ROLL_DATA[field] += change;

        if (options.min != undefined)
            CONFIG.ROLL_DATA[field] = Math.min(CONFIG.ROLL_DATA[field], min);
        if (options.max != undefined)
            CONFIG.ROLL_DATA[field] = Math.max(CONFIG.ROLL_DATA[field], max);

        if (options.render)
            this.updateRollData();
    }

    //#region Combat

    static async openCombatActionEffectsMenu(messageUuid) {
        const msg = await fromUuid(messageUuid);
        console.log(msg);
        const action = await fromUuid(msg.flags.vryl.combatAction.uuid);

        action.inSidebar = true;
        action.executionMode = true;
        const actionContent = await renderTemplate(`systems/vryl/templates/parts/combat/action-chat-card.hbs`, action);

        const context = {
            flags: msg.flags.vryl,
            action: action,
            actionContent: actionContent,
        }

        const combatActionFlags = msg.flags.vryl.combatAction;

        const template = await foundry.applications.handlebars.renderTemplate(`systems/vryl/templates/parts/roll/combat-action-effect-execution.hbs`, context);

        let d = new Dialog({
            title: action.name,
            content: template,
            buttons: {
                one: {
                    label: "Close",
                    callback: () => console.log("Closed")
                }
            },
            render: async (html) => {
                const useButtons = html.find(`[data-action='useCombatActionEffect']`);
                for (let i = 0; i < useButtons.length; i++) {
                    const button = useButtons[i];
                    button.addEventListener('click', async (event) => {

                        event.stopPropagation();
                        event.preventDefault();
                        const effect = action.system.combatAction.effects.find(item => item.id == button.id);
                        let newTargetContent = "";

                        async function continueActionEffect() {
                            let newMessageFlags = {
                                vryl: {
                                    buttons: []
                                }
                            }

                            if(combatActionFlags)
                                newMessageFlags.vryl.combatAction = combatActionFlags;

                            for(let chatButton of effect.chatButtons)
                            {
                                let newButton = chatButton.buttonText;
                                let targetText = "";
                                if(combatActionFlags.currentTargetUuids.length == 1)
                                    targetText = ` ${combatActionFlags.currentTargetUuids[0]}`;
                                else if(combatActionFlags.currentTargetUuids.length > 1)
                                    targetText = ` [${combatActionFlags.currentTargetUuids.join(' ')}]`;
                                newButton = newButton.replaceAll(" [target]", targetText)

                                newButton = newButton.replaceAll(" [source]", ` ${action.actor.uuid}`)

                                newMessageFlags.vryl.buttons.push(newButton);
                            }

                            ChatMessage.create({
                                content: `
<div class="flexcol flex-group-center">
    <h6>${action.name}</h6>
    <div>
        <span class="centerhor"><b style="min-width:1em;text-align:right; margin-right:0.2em;">${effect.successCost}</b><i class='fal fa-check-circle'></i></span>
    </div>
    <div>
        ${CONFIG.ui.vrylEnrichText(effect.description, action.actor.system, true)}
    </div>
    ${newTargetContent}
</div>`,
                                flags: newMessageFlags,
                            });

                            combatActionFlags.spentSuccesses += effect.successCost;
                            combatActionFlags.usedEffects.push(effect.id);

                            await msg.setFlag("vryl", "combatAction", combatActionFlags);
                            d.data.content = (await foundry.applications.handlebars.renderTemplate(`systems/vryl/templates/parts/roll/combat-action-effect-execution.hbs`, context));
                            d.render(true);
                        }

                        if (effect.targeting.doesTarget) {
                            game.vrylGlobalFunctions.runTokenSelector({
                                callback: (tokens) => {
                                    combatActionFlags.currentTargetUuids = [...tokens.map(e => e.uuid)];
                                    newTargetContent = `
<div class="flexcol flex-group-center">
    <b>Targets</b>
        `;
                                    for (let token of tokens) {
                                        newTargetContent += `<span>${token.name}</span>`;
                                    }
                                    newTargetContent += "</div>";
                                    continueActionEffect();
                                },
                                userToken: msg.speakerActor?.getActiveTokens()?.filter(e => e.id == msg.speaker.token)[0] ?? null,
                            });
                        }
                        else {
                            continueActionEffect();
                        }
                    });
                }
            },
            close: (html) => {

            }
        }, {
            left: window.innerWidth - 300 - 450,
        });
        d.render(true);
    }

    //#endregion

    //#region Group Roll

    static adjustRollFlagNumber(change, action, actor, flag, event = undefined) {
        let amount;
        const val = CONFIG.ui.rollBuilder.getRollFlagValue(action, actor, flag);
        const flagSettings = CONFIG.ui.rollBuilder.getRollFlagSettings(action, flag);
        if (val == undefined)
            amount = flagSettings.initial;
        else
            amount = val;

        amount += change;

        this.setRollFlagNumber(amount, action, actor, flag, event);
    }

    static getRollFlagSettings(action, flag) {
        const actionData = ROLL_ACTIONS.filter((a) => a.action == action)[0];
        if (!actionData) {
            console.log("WARNING: setting roll action flag for action that has no data: " + action + ", " + flag);
            return;
        }
        const flagData = actionData.flags[flag];
        if (!flagData) {
            console.log("WARNING: setting roll action flag for action that is missing the flag: " + action + ", " + flag);
            return;
        }
        return flagData;
    }

    static getInitialRollFlagValue(action, flag) {
        return CONFIG.ui.rollBuilder.getRollFlagSettings(action, flag).initial;
    }

    static getRollFlagValue(action, actor, flag) {
        const actionData = CONFIG.ui.rollBuilder.getRollActionData(action, actor);
        if (actionData == undefined)
            return CONFIG.ui.rollBuilder.getInitialRollFlagValue(action, flag);

        const flagData = actionData.flags.filter((f) => f.flag == flag)[0];
        if (flagData == undefined || flagData.value == undefined)
            return CONFIG.ui.rollBuilder.getInitialRollFlagValue(action, flag);
        return flagData.value;
    }

    static setRollFlagNumber(amount, action, actor, flag, event = undefined) {
        if (event != undefined)
            event.stopPropagation();

        const flagSettings = CONFIG.ui.rollBuilder.getRollFlagSettings(action, flag);

        if (flagSettings.min != undefined && amount < flagSettings.min) amount = flagSettings.min;
        if (flagSettings.max != undefined && amount > flagSettings.max) amount = flagSettings.max;

        this.addAction(action, actor, `true`, { [`${flag}`]: { value: amount } });
    }

    static toggleGroupRoll(event, target, force = undefined) {
        let content;
        if ((!CONFIG.ui.rollBuilder.hasRollFlag(`group-roll`, `global`) && force !== false) || (force === true)) {
            content = `
            <div class="groupRollContainer flexrow" style="padding: 0 0.58em;">    
                <b class="fitwidth clickable" style="padding-right: 0.3em;" data-action="groupRoll"><i class="fa-solid fa-user-group"></i></b>
                <button class="small-button" type="button" onclick="CONFIG.ui.rollBuilder.adjustRollFlagNumber(-1, 'group-roll', 'global', 'targetGroupSize')">-</button>
                <button class="small-button" type="button" onclick="CONFIG.ui.rollBuilder.adjustRollFlagNumber(1, 'group-roll', 'global', 'targetGroupSize')">+</button>
            </div>`;

            CONFIG.ui.rollBuilder.setRollFlagNumber(1, `group-roll`, `global`, `targetGroupSize`);
        }
        else {
            content = `
            <button type="button" class="groupRollContainer" data-action="groupRoll" title="Group Roll Settings">
				<i class="fa-solid fa-user-group" inert=""></i>
			</button>`;

            CONFIG.ui.rollBuilder.removeAction(`group-roll`, `global`);
        }

        const elements = document.querySelectorAll(`.groupRollContainer`);
        for (const e of elements)
            e.outerHTML = content;
    }

    //#region DC

    static _getDiceProbability(n, successThreshold, dc, sides = 20) {
        dc -= 1;
        // Probability of success on a single die
        const p = (sides - dc) / sides;

        // Probability of exactly k successes: (nCk) * p^k * (1-p)^(n-k)
        const getBinomial = (n, k, p) => {
            const combinations = (n, k) => {
                if (k === 0 || k === n) return 1;
                if (k > n / 2) k = n - k;
                let res = 1;
                for (let i = 1; i <= k; i++) res = res * (n - i + 1) / i;
                return res;
            };
            return combinations(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
        };

        // Sum probabilities for 3, 4, ..., n successes
        let totalProbability = 0;
        for (let k = successThreshold; k <= n; k++) {
            totalProbability += getBinomial(n, k, p);
        }

        return totalProbability;
    }

    updateDC(isInputChange = false) {
        console.log("Update DC");
        const elements = this.element.querySelectorAll(`.success-confidence-estimate`);
        const levelData = CONFIG.ui.rollBuilder._getRollLevel();

        CONFIG.ROLL_DATA.dc = CONFIG.ROLL_DATA.dc ?? 11;

        if (isInputChange)
            CONFIG.ROLL_DATA.dc = this.element.querySelector(`input#dc-input`).value;
        else
            this.element.querySelector(`input#dc-input`).value = CONFIG.ROLL_DATA.dc;

        for (const element of elements) {
            const successThreshold = parseInt(element.id) - levelData.guaranteedSuccesses;
            const prob = 100.0 * RollSidebar._getDiceProbability(levelData.totalLevels, successThreshold, CONFIG.ROLL_DATA.dc);
            let confidenceString = "";
            if (prob <= 0.1)
                confidenceString = "Impossible";
            else if (prob < 15)
                confidenceString = "Improbable";
            else if (prob < 40)
                confidenceString = "Unlikely";
            else if (prob < 65)
                confidenceString = "Coinflip";
            else if (prob < 90)
                confidenceString = "Confident";
            else if (prob < 98)
                confidenceString = "Certain";
            else
                confidenceString = "Guaranteed";

            const formatter = new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
            });

            const formattedProb = formatter.format(prob);

            element.innerHTML = `<span class="dc-difficulty-estimate-${confidenceString.toLowerCase()}">${confidenceString}</span>`;
            element.title = `${formattedProb}%`;
        }
    }

    // #region Roll Actions

    static getActionArray(actor) {
        if (!CONFIG.ROLL_DATA.globalActions)
            CONFIG.ROLL_DATA.globalActions = [];

        if (actor && actor != 'global' && actor._id) {
            this.populateRollActor(actor);

            const actorData = CONFIG.ROLL_DATA.rollActors.get(actor._id);
            if (!actorData.actions)
                actorData.actions = [];

            return actorData.actions;
        }

        return CONFIG.ROLL_DATA.globalActions;
    }

    static addAction(actionName, actor = 'global', render = true, flagData = {}) {
        const actionsArray = this.getActionArray(actor);

        let sorting = Math.max(...actionsArray.map((a) => a.sorting), -1) + 1;

        if (actionsArray.filter((a) => a.action == actionName).length > 0) {
            const prevActionInstance = actionsArray.filter((a) => a.action == actionName)[0];
            sorting = prevActionInstance.sorting;
            this.removeAction(actionName, actor, render);
        }

        const data = {
            flags: [],
        }

        const actionSettings = ROLL_ACTIONS.filter((a) => a.action == actionName)[0];

        if (actionSettings.flags != undefined) {
            for (const [flag, flagSettings] of Object.entries(actionSettings.flags)) {
                let value;
                if (flagData[flag] != undefined)
                    value = flagData[flag].value;
                else
                    value = CONFIG.ui.rollBuilder.getRollFlagValue(actionName, actor, flag);

                data.flags.push({
                    flag: flag,
                    value: value,
                    settings: flagSettings,
                });
            }
        }

        actionsArray.push({
            action: actionName,
            actor: actor,
            sorting: sorting,
            data: data,
        })

        if (render)
            this.updateRollData();
    }

    static removeAction(actionName, actor = 'global', render = true) {
        let actionsArray = this.getActionArray(actor);

        const index = actionsArray.findIndex((a) => a.action == actionName);

        if (index > -1) {
            actionsArray.splice(index, 1); // 2nd parameter means remove one item only
        }

        if (render)
            this.updateRollData();
    }

    static hasRollFlag(flag, actor = 'global', actionType = 'both') {
        const flags = this.getRollActionFlags(actor, actionType);
        return flags.filter((a) => a.action == flag).length > 0;
    }

    static getRollActionData(flag, actor = 'global', actionType = 'both') {
        const flags = this.getRollActionFlags(actor, actionType);
        const flagData = flags.filter((a) => a.action == flag)[0];
        if (flagData)
            return flagData.data;
    }

    static getRollActionFlags(actor = 'global', actionType = 'both') {
        let flags = [];

        const rollData = CONFIG.ROLL_DATA;

        if (actor == 'global' && rollData.globalActions && rollData.globalActions.length > 0) {
            for (const action of rollData.globalActions) {
                if (ROLL_ACTIONS.filter((a) => a.action == action.action && (actionType == "both" || a.actionType == actionType)).length > 0)
                    flags.push(action);
            }
        }

        return flags;
    }

    static async processPostRollActions(msg) {


        const rollData = CONFIG.ROLL_DATA;

        for (const [key, actorData] of rollData.rollActors) {
            const actor = game.actors.get(key);

            if (actorData.actions && actorData.actions.length > 0) {


                function processAction(collection) {
                    for (const action of collection) {
                        const actionData = ROLL_ACTIONS.filter((a) => a.action == action.action && a.actionType == 'postRoll')[0];
                        if (actionData && actionData.functionName)
                            CONFIG.ui.rollBuilder[actionData.functionName](actor, msg);
                    }
                }

                processAction(actorData.actions);
                processAction(rollData.globalActions);

                this.processOnRollEffects(actor, msg);
            }
        }

        for (const itemEffect of rollData.rollItemEffects) {
            this.processOnRollItemEffects(itemEffect);
        }
    }

    static async successesRegenerateWillpower(actor, msg) {
        actor.update({ [`system.willpower.level`]: Math.min(actor._source.system.willpower.level + msg.rolls[0]._total, actor.system.willpower.max) });
    }

    static async failuresLoseWillpower(actor, msg) {
        let failures = (msg.rolls[0].terms[0]._number - msg.rolls[0]._total);

        let effect = actor.effects.find(e => e.statuses.has('doom'));
        if (effect) {
            let stacks = effect.flags.statuscounter.value ?? 1;
            failures += stacks;
        }

        let newWillpower = Math.max(actor._source.system.willpower.level - failures, 0);
        if (newWillpower > actor._source.system.willpower.level)
            return;
        actor.update({ [`system.willpower.level`]: newWillpower });
    }

    static async conditionSave(actor, msg) {
        const context = {
            successes: {
                starting: msg.rolls[0].total,
                spent: 0,
            },
            data: []
        };
        for (let s of actor.effects.contents) {
            console.log(s);
            s.statuses.forEach((condition) => {
                let conditionData = CONFIG.statusEffects.filter(e => e.id == condition)[0];
                if (conditionData && conditionData.isCondition) {
                    let newData = {
                        condition: s,
                        conditionData: conditionData,
                        startingStacks: s.flags.statuscounter?.value ?? 1,
                    };
                    newData.targetStacks = newData.startingStacks;
                    context.data.push(newData);
                }
            });
        }

        context.data.sort((a, b) => a.conditionData.conditionSaveSorting - b.conditionData.conditionSaveSorting);

        if (context.successes < 0) {
            context.successes = 0;
        }

        const path = `systems/vryl/templates/menus/condition-save.hbs`;
        const template = await foundry.applications.handlebars.renderTemplate(path, context);

        let d = new Dialog({
            title: "Condition Save",
            content: template,
            buttons: {
                one: {
                    label: "Apply",
                    callback: () => {
                        let content = "";
                        context.data.forEach(data => {
                            let stacks = data.targetStacks;
                            let stacksLost = data.startingStacks - data.targetStacks;
                            if (stacksLost > 0) {
                                if (stacks <= 0)
                                    data.condition.delete();
                                else
                                    data.condition.statusCounter.setValue(stacks);
                                content += (content != "" ? "<br>" : "") + `${actor.name}'s has lost <b>${stacksLost}</b> stack${stacksLost != 1 ? "s" : ""} of <b>${data.conditionData.name}</b>. <i>(${stacks} Remaining)</i>`;
                            }
                        });
                        ChatMessage.create({
                            content: content,
                        });
                    },
                }
            },
            render: async (html) => {
                //AUTOMATION Condition Save

                const useButtons = html.find(`[data-action='changeCondtionToValue']`);
                for (let i = 0; i < useButtons.length; i++) {
                    const button = useButtons[i];
                    button.addEventListener('click', async () => {
                        let conditionData = context.data.filter(e => e.condition.id == button.id)[0];
                        let targetStacks = parseInt(button.dataset.index) + 1;
                        if (targetStacks == conditionData.targetStacks)
                            targetStacks--;
                        conditionData.targetStacks = Math.max(0, targetStacks);

                        context.successes.spent = 0;
                        for (const data of context.data) {
                            context.successes.spent += data.startingStacks - data.targetStacks;
                        }

                        d.data.content = (await foundry.applications.handlebars.renderTemplate(path, context));
                        d.render(false);
                    });
                }
            },
            close: (html) => {

            }
        }, {
            left: window.innerWidth - 300 - 450,
        });
        d.render(true);
    }

    static async processOnRollEffects(actor, msg) {
        console.log(actor);
    }

    static async processOnRollItemEffects(itemEffect) {
        const item = itemEffect.effect.parent;

        //Process charge automation
        if (item.system.chargeAutomation == "instantEffectUse")
            this.decrementItemCharges(item);
    }

    static async processOnRestEffects(actor, msg) {

        //Process rest charge automation
        for (const item of actor.items) {
            if (item.system.chargeAutomation == "rest")
                this.decrementItemCharges(item);
        }
    }

    static async decrementItemCharges(item) {
        await item.update({ [`system.charges`]: Math.max(0, item.system.charges - 1) });
        if (item.system.charges <= 0)
            this.chargesSpentMessage(item);
    }

    static async chargesSpentMessage(item) {
        const speaker = ChatMessage.getSpeaker({ actor: item.parent });
        const content = `<b>${item.name}</b> has run out of charges!`;
        if (speaker)
            await ChatMessage.create({ speaker: speaker, content: content });
        else
            await ChatMessage.create({ content: content });
    }

    //#region Template Actor

    static async openTemplateActor(event, target) {

        let data = {
            id: "VRYL-TEMPLATE-ACTOR",
            name: "Template",
            system: {
                attributes: {},
                isTemplateActor: true,
            },
        }
        data._id = data.id;
        data.actor = {};
        data.actor.id = data.id;

        const defaultAttributes = game.settings.get(CONFIG.SystemId, 'attributes');

        for (const a of defaultAttributes) {
            data.system.attributes[a.dataName] = {};
        }

        VrylActorSheet.prepareAttributeData(data.system);

        let content = await foundry.applications.handlebars.renderTemplate(`systems/vryl/templates/parts/attributes-list.hbs`, data);

        const sidebarElement = document.querySelector(`aside#sidebar`);
        const rect = sidebarElement.getBoundingClientRect();
        content = content.replaceAll(`data-tab='attribute-list'`, '');

        const dialog = new foundry.applications.api.DialogV2({
            window: {
                resizable: true,
                title: 'Template Character Sheet' // Just the localization key
            },
            content: content,
            form: {
                submitOnClose: true,
            },
            buttons: [{
                action: "apply",
                label: "Apply",
                default: true,
            }]
        });

        const windowHooks = [];
        dialog.addEventListener('close', () => {
            for (const hook of windowHooks)
                Hooks.off(hook.name, hook.id);
        })

        let menu = await dialog.render({ force: true });
        menu.setPosition({ left: rect.left - menu.element.getBoundingClientRect().width, top: rect.bottom - menu.element.getBoundingClientRect().height });

        let element = menu.element;
        element.querySelectorAll(`.form-footer`)[0].remove();

        VrylActorSheet.renderSelectedAttributes(element, data.id);

        windowHooks.push({
            name: `vryl-rollDataUpdated`,
            id: Hooks.on(`vryl-rollDataUpdated`, () => {
                console.log("Roll data updated for actor: " + data.id);
                VrylActorSheet.renderSelectedAttributes(element, data.id);
            })
        });

        async function clickAttribute(target) {
            const attributesArray = Object.values(data.system.attributes);
            const attribute = attributesArray.filter((a) => a.dataName == target.id)[0];
            await CONFIG.ui.rollBuilder.toggleAttribute(data, attribute, false);

            CONFIG.ui.rollBuilder.goToRollBuilder();
            CONFIG.ui.rollBuilder.updateRollData();
            VrylActorSheet.renderSelectedAttributes(element, data.id);
        }

        const clickable = element.querySelectorAll('.attribute-name:not(.listeners_bound)');

        for (let c of clickable) {
            c.addEventListener('click', async (event) => {
                clickAttribute(c);
            });

            c.classList.add('listeners_bound');
        }


    }

    //#region Actions Menu

    static async openGlobalActions(event, target) {
        CONFIG.ui.rollBuilder.openActions('global');
    }

    static async openActions(actor) {
        const actionList = actor == 'global' ? ROLL_ACTIONS.filter((a) => a.actionOwner == 'global' || a.actionOwner == 'both')
            : ROLL_ACTIONS.filter((a) => a.actionOwner == 'actor' || a.actionOwner == 'both');

        let content = "";

        for (const action of actionList) {
            if (action.presentInMenu !== false)
                content += await foundry.applications.handlebars.renderTemplate(`systems/vryl/templates/parts/roll/roll-action.hbs`, action);
        }

        content = content.replaceAll(`flex-group-center`, `flex-group-left align-left full-width`);

        const sidebarElement = document.querySelector(`aside#sidebar`);
        const rect = sidebarElement.getBoundingClientRect();

        const dialog = new foundry.applications.api.DialogV2({
            window: {
                title: "Roll Actions",
            },
            content: content,
            buttons: [{
                action: "apply",
                label: "Apply",
                default: true,
                // callback: (event, button, dialog) => button.form.elements.choice.value
            }],
        });

        const windowHooks = [];
        dialog.addEventListener('close', () => {
            for (const hook of windowHooks)
                Hooks.off(hook.name, hook.id);
        })

        let menu = await dialog.render({ force: true });
        menu.setPosition({ left: rect.left - menu.element.getBoundingClientRect().width, top: rect.bottom - menu.element.getBoundingClientRect().height });

        let element = menu.element;
        element.querySelectorAll(`.form-footer`)[0].remove();

        const clickable = element.querySelectorAll('.roll-action:not(.listeners_bound)');

        function attributePresent(c) {
            let activeActions;
            if (actor == 'global') {
                if (!CONFIG.ROLL_DATA.globalActions)
                    CONFIG.ROLL_DATA.globalActions = [];
                activeActions = CONFIG.ROLL_DATA.globalActions
            }
            else {
                this.populateRollActor(actor);
                const actorData = CONFIG.ROLL_DATA.rollActors.get(actor._id);
                activeActions = actorData.action;
            }

            let clickedActionName;
            c.classList.forEach((c) => {
                if (c.startsWith(`action-name-`)) clickedActionName = c.replace(`action-name-`, ``);
            })
            return { name: clickedActionName, present: (activeActions.filter((a) => a.action == clickedActionName).length > 0) };
        }

        function onActionsUpdate() {
            for (let c of clickable) {
                if (attributePresent(c).present)
                    c.classList.add('selected');
                else
                    c.classList.remove('selected');
            }
        }

        for (let c of clickable) {
            c.classList.add('clickable');

            c.addEventListener('click', async (event) => {
                const a = attributePresent(c);
                if (a.present) {
                    this.removeAction(a.name, actor);
                }
                else {
                    this.addAction(a.name, actor);
                }
            });

            c.classList.add('listeners_bound');
        }

        windowHooks.push({
            name: `vryl-rollDataUpdated`,
            id: Hooks.on(`vryl-rollDataUpdated`, () => {
                onActionsUpdate();

            })
        });

        onActionsUpdate();
    }

    //#region Active Effects

    static _populateActorEffects() {
        CONFIG.ROLL_DATA.rollItemEffects = [];

        for (const [actorId, actorData] of CONFIG.ROLL_DATA.rollActors) {
            if (actorData.actor.id == 'VRYL-TEMPLATE-ACTOR')
                continue;

            for (const effect of actorData.actor.appliedEffects) {
                if (effect.getFlag(CONFIG.SystemId, `isInstant`)) {

                    let isApplied = effect.getFlag(CONFIG.SystemId, `isInstantApplied`);
                    let isPrompted = false;

                    if (!isApplied) {
                        const promptSetting = effect.getFlag(CONFIG.SystemId, `promptSetting`);
                        switch (promptSetting) {
                            case "always":
                                isPrompted = true;
                                break;
                            case "flagPresent":
                                isPrompted = CONFIG.ui.rollBuilder.hasRollFlag(effect.getFlag(CONFIG.SystemId, `promptSettingFlag`), 'global');
                                break;
                            case "attributesAffected":
                                for (const change of effect.changes) {
                                    if (change.key.startsWith(`system.attributes.`)) {
                                        const attributeChanged = change.key.replace(`system.attributes.`, ``).split(`.`)[0];
                                        for (const attribute of actorData.attributes) {
                                            if (attribute.dataName == attributeChanged)
                                                isPrompted = true;
                                        }
                                    }
                                }
                                break;
                        }

                    }

                    if (!isApplied && !isPrompted)
                        continue;

                    const effectData = {
                        name: effect.name,
                        isApplied: isApplied,
                        uuid: effect.uuid,
                        effect: effect,
                        actor: effect.target,
                        effectDescription: effect.description.replaceAll(/<p>/g, ``).replaceAll(/<\/p>/g, `<br>`),
                    }
                    CONFIG.ROLL_DATA.rollItemEffects.push(effectData);
                }
            }
        }
    }

    static _clearInstantEffects() {
        for (const [key, value] of CONFIG.ROLL_DATA.rollActors) {
            if (key == 'VRYL-TEMPLATE-ACTOR')
                continue;

            for (const effect of value.actor.appliedEffects) {
                if (effect.getFlag(CONFIG.SystemId, `isInstant`))
                    effect.setFlag(CONFIG.SystemId, `isInstantApplied`, false);
            }
        }
    }

    static serializeToJson() {
        const rollData = CONFIG.ROLL_DATA;
        let rollActors = {};

        for (const [key, value] of rollData.rollActors) {
            rollActors[key] = value;
            rollActors[key].id = key;
        }

        const flags = {
            vryl: {
                rollData: structuredClone(rollData),
                rollActors: structuredClone(rollActors),
            }
        }

        const json = JSON.stringify(flags);

        return json;
    }

    static deserializeFromJson(json, fillTemplate = true, fromActor = undefined) {
        const flags = JSON.parse(json).vryl;
        CONFIG.ROLL_DATA = structuredClone(flags.rollData);
        const rollActors = Object.entries(flags.rollActors);
        CONFIG.ROLL_DATA.rollActors = new Map();
        for (const [key, value] of rollActors) {
            let actorData = structuredClone(value);
            if (!fillTemplate && key == "VRYL-TEMPLATE-ACTOR") {
                CONFIG.ROLL_DATA.rollActors.set(actorData.actor.id, actorData);
                continue;
            }

            actorData.actor = fromActor ?? RollSidebar.getActor(actorData);

            CONFIG.ROLL_DATA.rollActors.set(actorData.actor.id, actorData);
            if (actorData.actor.id != key) RollSidebar.updateActorSelection(actorData.actor);
        }

        RollSidebar.updateRollData();
        CONFIG.ui.rollBuilder.goToRollBuilder();
    }

    static setActionSource(action, options = { targets: null }) {
        CONFIG.ROLL_DATA.rollCombatActionSource = action;
        CONFIG.ROLL_DATA.rollCombatActionTargetUuids = options?.targets ?? null;
    }

}

Hooks.on("renderChatMessage", (message, html, data) => {

    let effectsButtons = html[0].querySelectorAll("#combatEffectsButton");

    for (const b of effectsButtons) {
        b.addEventListener("click", (event) => {
            event.stopPropagation();
            event.preventDefault();
            CONFIG.ui.rollBuilder.openCombatActionEffectsMenu(message.uuid);
        });
    }

});