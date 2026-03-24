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
            container.innerHTML = await CONFIG.ui.rollBuilder.renderRollAttributes();
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


    // #region Actions
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
            if (actor.attributes) {
                for (const attribute of actor.attributes) {
                    addAttribute(attribute);
                }
            }

            if (actor.willpower)
                addAttribute(actor.willpower);
        }



        if (totalLevels <= 0 && CONFIG.ui.rollBuilder.hasPreRollFlag(`roll-level-zero`)) {
            guaranteedSuccesses -= 1 - totalLevels;
            totalLevels = 2 - totalLevels;
        }

        return {
            totalLevels: totalLevels,
            guaranteedSuccesses: guaranteedSuccesses,
        }
    }

    //#region Roll

    static _getRollData() {
        let dc = CONFIG.ROLL_DATA.dc;

        for (const [key, actor] of CONFIG.ROLL_DATA.rollActors) {
            if (actor.actor.system.dcMod)
                dc = parseInt(dc) + (parseInt(actor.actor.system.dcMod) ?? 0);
        }

        let levelData = CONFIG.ui.rollBuilder._getRollLevel();
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

    static async #roll(event, target) {
        console.log("Rolling with data: ", CONFIG.ROLL_DATA);

        const rollData = CONFIG.ui.rollBuilder._getRollData();

        let formula = `${rollData.level}d${rollData.faces}`;
        if (CONFIG.ui.rollBuilder.hasPreRollFlag(`explode-crits`))
            formula += `x>=${rollData.critThreshold}`;
        formula += `cs>=${rollData.dc}`;
        formula += `sa`;
        formula += ` + ${rollData.guaranteedSuccesses}`;
        let roll = new CONFIG.Dice.AttributeRoll(formula);
        roll.options.flavor = await CONFIG.ui.rollBuilder.renderRoll(rollData);
        let msg = await roll.toMessage({
            flags: {
                vryl: {
                    narrativeResult: CONFIG.ui.rollBuilder.hasPreRollFlag(`narrative-result`),
                }
            },
        });

        await CONFIG.ui.rollBuilder.processPostRollActions(msg);

        const coinflipWillpower = game.settings.get(CONFIG.SystemId, 'spend_willpower_coinflip');

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
            }
        }

        const msg = await ChatMessage.create({
            content: html,
            flags: flags,
        });

        RollSidebar.clearRoll();
        RollSidebar.goToChat(target);
    }

    async bindChatListeners(message, html, context) {

        function getActor(actorData) {
            if (actorData.id != 'VRYL-TEMPLATE-ACTOR')
                return game.actors.get(actorData.id);

            const controlledActor = game.user.character ?? canvas.tokens.controlled[0]?.actor;

            if (controlledActor) {
                return controlledActor;
            }

            return actorData.actor;
        }

        function updateActorSelection(actor) {
            const rollActor = CONFIG.ROLL_DATA.rollActors.get(actor._id);
            const attributesArray = Object.entries(actor.system.attributes);
            for (const a of rollActor.attributes) {
                const filtered = attributesArray.filter((b) => b[0] == a.dataName);
                if(filtered && filtered.length > 0)
                {
                    const attributeData = Object.entries(filtered[0][1]);
                    for(const d of attributeData)
                    {
                        a[d[0]] = d[1];
                    }
                    CONFIG.ui.rollBuilder.selectAttribute(actor, a);
                }
            }
        }

        let copyButton = html.querySelector(`.copy-roll-replace`);
        if (copyButton) {
            copyButton.addEventListener('click', function () {
                const flags = message.flags.vryl;
                CONFIG.ROLL_DATA = structuredClone(flags.rollData);
                const rollActors = Object.entries(flags.rollActors);
                CONFIG.ROLL_DATA.rollActors = new Map();
                for (const [key, value] of rollActors) {
                    let actorData = structuredClone(value);

                    actorData.actor = getActor(actorData);

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

                    currentData.actor = getActor(actorData);

                    CONFIG.ROLL_DATA.rollActors.set(actorData.actor.id, currentData);
                    if (actorData.actor.id != key) updateActorSelection(actorData.actor);
                }

                RollSidebar.updateRollData();
                CONFIG.ui.rollBuilder.goToRollBuilder();
            });
        }
    }

    //#region Utils

    static getAttributeCategory(attribute) {
        if (attribute.dataName == 'willpower') return attribute;

        const attributeCategories = game.settings.get(CONFIG.SystemId, 'attribute_categories');
        return attributeCategories[attribute.category];
    }
    static getAttributeType(attribute) {
        if (attribute.dataName == 'willpower') return attribute;

        const attributeCategory = this.getAttributeCategory(attribute);
        const attributeTypes = game.settings.get(CONFIG.SystemId, 'attribute_types');
        return attributeTypes[attributeCategory.type];
    }
    static getDefaultAttributeFromDataName(dataName) {
        const attributes = game.settings.get(CONFIG.SystemId, 'attributes');
        return attributes.filter((a) => a.dataName == dataName);
    }
    static populateDefaultAttributeFromDataName(attribute, dataName) {
        const defaults = Object.entries(this.getDefaultAttributeFromDataName(dataName));
        for(const d of defaults)
        {
            if(!attribute[d[0]])
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

    static async renderRoll(rollData) {
        return (await this.renderRollAttributes(rollData)) + (await this.renderRollOptions(rollData));
    }

    static async renderRollAttributes(rollData) {
        let content = "";
        const rollActors = CONFIG.ROLL_DATA.rollActors;
        const attributeCategories = game.settings.get(CONFIG.SystemId, 'attribute_categories');
        const attributeTypes = game.settings.get(CONFIG.SystemId, 'attribute_types');

        async function renderAttribute(actorId, attribute) {
            if (actorId == 'global') {
                if (attribute.level == 0)
                    attribute.level = undefined;
                if (attribute.guaranteedSuccesses == 0)
                    attribute.guaranteedSuccesses = undefined;
            }

            let content = "";
            const bonusDiceContent = ` ${attribute.bonusDice > 0 ? "+" : "-"} ${Math.abs(attribute.bonusDice)}`;
            attribute.combinedLevel = attribute.level ?? 0;
            if (attribute.heroicLevel && !isNaN(attribute.heroicLevel))
                attribute.combinedLevel += attribute.heroicLevel;

            attribute.actorId = actorId;
            attribute.dataName = attribute.dataName;

            if (!isNaN(attribute.level) || !isNaN(attribute.bonusDice)) {
                attribute.hasLevel = true;
                attribute.bonusDiceString = attribute.bonusDice && attribute.bonusDice != 0 ? bonusDiceContent : "";
            }
            if (!isNaN(attribute.guaranteedSuccesses) && attribute.guaranteedSuccesses != 0)
                attribute.hasFlat = true;

            const template = await foundry.applications.handlebars.renderTemplate(`systems/vryl/templates/parts/roll/roll-attribute.html`, attribute);
            content += template;
            return content;
        }

        async function renderAction(action) {
            const template = await foundry.applications.handlebars.renderTemplate(`systems/vryl/templates/parts/roll/roll-action.html`, action);
            return template;
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
                actorData.willpower.dataName = "willpower";
                actorData.willpower.name = "Willpower";

                actorContent += await renderAttribute(key, actorData.willpower);
            }

            //Render actor actions
            if ((actorData.actions && actorData.actions.length > 0)) {
                // if (actorContent != "")
                //     actorContent += "<br>";
                for (const action of actorData.actions) {
                    action.actorId = key;
                    actorContent += await renderAction(action);
                }
            }

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
            for (const action of CONFIG.ROLL_DATA.globalActions) {
                action.actorId = 'global';
                globalContent += await renderAction(action);
            }
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

    static async renderRollOptions(rollData) {
        return await foundry.applications.handlebars.renderTemplate(`systems/vryl/templates/parts/roll/roll-options.html`, rollData);
    }

    static async clearRoll(replaceWithDefault = true) {
        console.log("Clearing roll data...");
        CONFIG.ROLL_DATA = {};
        CONFIG.ROLL_DATA.rollActors = new Map();
        CONFIG.ROLL_DATA.globalActions = [];

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

    static adjustRollData(field, change, render = true) {
        if (!CONFIG.ROLL_DATA[field]) CONFIG.ROLL_DATA[field] = 0;
        CONFIG.ROLL_DATA[field] += change;

        if (render)
            this.updateRollData();
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

    static addAction(actionName, actor = 'global', render = true) {
        const actionsArray = this.getActionArray(actor);

        actionsArray.push({
            action: actionName,
            actor: actor
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

    static hasPreRollFlag(flag) {
        const flags = this.getPreRollActionFlags();
        return flags.filter((a) => a == flag).length > 0;
    }

    static getPreRollActionFlags() {
        let flags = [];

        const rollData = CONFIG.ROLL_DATA;

        if (rollData.globalActions && rollData.globalActions.length > 0) {
            for (const action of rollData.globalActions) {
                if (ROLL_ACTIONS.filter((a) => a.action == action.action && a.actionType == 'preRoll').length > 0)
                    flags.push(action.action);
            }
        }

        return flags;
    }

    static async processPostRollActions(msg) {
        const rollData = CONFIG.ROLL_DATA;

        for (const [key, actorData] of rollData.rollActors) {
            if (actorData.actions && actorData.actions.length > 0) {
                const actor = game.actors.get(key);
                for (const action of actorData.actions) {
                    const actionData = ROLL_ACTIONS.filter((a) => a.action == action.action && a.actionType == 'postRoll')[0];
                    if (actionData && actionData.functionName)
                        this[actionData.functionName](actor, msg);
                }
            }
        }
    }

    static async successesRegenerateWillpower(actor, msg) {
        actor.update({ [`system.willpower.level`]: Math.min(actor._source.system.willpower.level + msg.rolls[0]._total, actor.system.willpower.max) });
    }

    static async failuresLoseWillpower(actor, msg) {
        let newWillpower = Math.max(actor._source.system.willpower.level - (msg.rolls[0].terms[0]._number - msg.rolls[0]._total), 0);
        if (newWillpower > actor._source.system.willpower.level)
            return;
        actor.update({ [`system.willpower.level`]: newWillpower });
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

        let content = await foundry.applications.handlebars.renderTemplate(`systems/vryl/templates/parts/attributes-list.html`, data);

        const sidebarElement = document.querySelector(`aside#sidebar`);
        const rect = sidebarElement.getBoundingClientRect();
        content = content.replaceAll(`data-tab='attribute-list'`, '');

        const dialog = new foundry.applications.api.DialogV2({
            window: {
                resizable: true,
                title: 'Template Character Sheet' // Just the localization key
            },
            content: content,
            buttons: [{
                action: "apply",
                label: "Apply",
                default: true,
                // callback: (event, button, dialog) => button.form.elements.choice.value
            }],
        });

        let menu = await dialog.render({ force: true });
        menu.setPosition({ left: rect.left - menu.element.getBoundingClientRect().width, top: rect.bottom - menu.element.getBoundingClientRect().height });

        let element = menu.element;
        element.querySelectorAll(`.form-footer`)[0].remove();

        VrylActorSheet.renderSelectedAttributes(element, data.id);

        Hooks.on(`vryl-rollDataUpdated`, () => {
            console.log("Roll data updated for actor: " + data.id);
            VrylActorSheet.renderSelectedAttributes(element, data.id);
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
            content += await foundry.applications.handlebars.renderTemplate(`systems/vryl/templates/parts/roll/roll-action.html`, action);
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

        Hooks.on(`vryl-rollDataUpdated`, () => {
            onActionsUpdate();
        })

        onActionsUpdate();
    }

}
