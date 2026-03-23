const { api, sheets } = foundry.applications;

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { AbstractSidebarTab } = foundry.applications.sidebar;
const { deepClone } = foundry.utils;

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
    }

    //#region Update Roll Data

    static async updateRollData() {
        const containers = document.querySelectorAll(".roll-builder-attribute-container");
        containers.forEach(async (container) => {
            container.innerHTML = await CONFIG.ui.rollBuilder.renderRollAttributes();
            let attributeElements = container.querySelectorAll(`.roll-builder-attribute`);
            for (let element of attributeElements) {
                element.classList.add("attribute-deletable");
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

    _getRollLevel() {
        let totalLevels = 0;
        let guaranteedSuccesses = 0;

        const rollActors = CONFIG.ROLL_DATA.rollActors;
        const rollActorsValues = rollActors.values();

        function addAttribute(attribute) {
            if (attribute.level && !isNaN(attribute.level))
                totalLevels += attribute.level;
            if (attribute.heroicLevel && !isNaN(attribute.heroicLevel))
                totalLevels += attribute.heroicLevel;
            if (attribute.bonusDice &&!isNaN(attribute.bonusDice))
                totalLevels += attribute.bonusDice;
            if (attribute.guaranteedSuccesses && !isNaN(attribute.guaranteedSuccesses))
                guaranteedSuccesses += attribute.guaranteedSuccesses;
        }

        for (const actor of rollActorsValues) {
            for (const attribute of actor.attributes) {
                addAttribute(attribute);
            }

            if (actor.willpower)
                addAttribute(actor.willpower);
        }



        if (totalLevels <= 0) {
            guaranteedSuccesses -= 1 - totalLevels;
            totalLevels = 2 - totalLevels;
        }

        return {
            totalLevels: totalLevels,
            guaranteedSuccesses: guaranteedSuccesses,
        }
    }

    //#region Roll

    static async #roll(event, target) {
        console.log("Rolling with data: ", CONFIG.ROLL_DATA);

        const dc = CONFIG.ROLL_DATA.dc;

        let levelData = this._getRollLevel();

        let roll = new CONFIG.Dice.AttributeRoll(`${levelData.totalLevels}d20cs>=${dc}sa + ${levelData.guaranteedSuccesses}`);
        roll.options.flavor = await CONFIG.ui.rollBuilder.renderRoll();
        await roll.toMessage();

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
                    await ChatMessage.create({content: `${actor.actor.name} lost <b>${actor.willpower.guaranteedSuccesses} Willpower</b>!`})
                    actor.actor.update({ [`system.willpower.level`]: actor.actor.system.willpower.level - actor.willpower.guaranteedSuccesses })
                }
            }
        }


        RollSidebar.#clearRoll();
        RollSidebar.goToChat(target);
    }

    //#region Print

    static async #print(event, target) {
        console.log("Printing to chat with data: ", CONFIG.ROLL_DATA);
        const rollData = CONFIG.ROLL_DATA;
        let rollActors = {};

        for (const [key, value] of rollData.rollActors) {
            rollActors[key] = value;
        }

        let html = await RollSidebar.renderRoll();
        html += `<div class="copy-roll flexrow">
        <button class="copy-roll-replace">Copy Roll <i class="fa-solid fa-copy"></i></button>
        <button class="copy-roll-append">Append Roll <i class="fa-regular fa-plus-square"></i></button>
        </div>`;

        const flags = {
            vryl: {
                rollData: rollData,
                rollActors: rollActors,
            }
        }

        const msg = await ChatMessage.create({
            content: html,
            flags: flags,
        });

        RollSidebar.#clearRoll();
        RollSidebar.goToChat(target);
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
                    actorData.actor = game.actors.get(value.actor._id);
                    CONFIG.ROLL_DATA.rollActors.set(key, actorData);
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

                    currentData.willpower = actorData.willpower ?? oldData.willpower;

                    currentData.actor = game.actors.get(actorData.actor._id);

                    CONFIG.ROLL_DATA.rollActors.set(key, currentData);
                }

                RollSidebar.updateRollData();
                CONFIG.ui.rollBuilder.goToRollBuilder();
            });
        }
    }

    //#region Utils

    static getAttributeCategory(attribute) {
        if(attribute.dataName == 'willpower') return attribute;

        const attributeCategories = game.settings.get(CONFIG.SystemId, 'attribute_categories');
        return attributeCategories[attribute.category];
    }
    static getAttributeType(attribute) {
        if(attribute.dataName == 'willpower') return attribute;

        const attributeCategory = this.getAttributeCategory(attribute);
        const attributeTypes = game.settings.get(CONFIG.SystemId, 'attribute_types');
        return attributeTypes[attributeCategory.type];
    }
    static getDefaultAttributeFromDataName(dataName) {
        const attributes = game.settings.get(CONFIG.SystemId, 'attributes');
        return attributes.filter((a) => a.dataName == dataName);
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
        if(attribute.dataName == 'willpower')
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
        if(attribute.dataName == 'willpower')
        {
            if(actorData.willpower && !isNaN(actorData.willpower.guaranteedSuccesses))
                attribute.guaranteedSuccesses = actorData.willpower.guaranteedSuccesses;
            actorData.willpower = attribute;
        }
        else
        {
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

        if (!rollActors.has(actorId)) return;

        const actorData = rollActors.get(actorId);

        if (dataName == "willpower")
            actorData.willpower = undefined;
        else
            actorData.attributes = actorData.attributes.filter((a) => a.dataName != dataName);

        if (render)
            this.updateRollData();
    }

    //#region Attribute Rendering

    static async renderRoll() {
        return (await this.renderRollAttributes()) + (await this.renderRollOptions());
    }

    static async renderRollAttributes() {
        let content = "";
        const rollActors = CONFIG.ROLL_DATA.rollActors;
        const attributeCategories = game.settings.get(CONFIG.SystemId, 'attribute_categories');
        const attributeTypes = game.settings.get(CONFIG.SystemId, 'attribute_types');
        for (const [key, actor] of rollActors) {
            if (actor.attributes.length > 0 || actor.willpower) {
                content += `<div class="roll-builder-actor actor-${key}"><div class="roll-builder-actor-inner">`
                content += `<h5 class="flex-group-center">${actor.actor.name}</h5>`;

                const sortedAttributes = actor.attributes.toSorted((a, b) => {
                    return this.getAttributeType(a).sorting - this.getAttributeType(b).sorting;
                });

                async function renderAttribute(attribute) {
                    const bonusDiceContent = ` ${attribute.bonusDice > 0 ? "+" : "-"} ${Math.abs(attribute.bonusDice)}`;
                    attribute.combinedLevel = attribute.level;
                    if(attribute.heroicLevel && !isNaN(attribute.heroicLevel))
                        attribute.combinedLevel += attribute.heroicLevel;

                    attribute.actorId = key;
                    attribute.dataName = attribute.dataName;

                    if (!isNaN(attribute.combinedLevel)) {
                        attribute.hasLevel = true;
                        attribute.bonusDiceString = attribute.bonusDice && attribute.bonusDice != 0 ? bonusDiceContent : "";
                    }
                    if (attribute.guaranteedSuccesses > 0)
                        attribute.hasFlat = true;

                    const template = await foundry.applications.handlebars.renderTemplate(`systems/vryl/templates/parts/roll/roll-attribute.html`, attribute);
                    content += template;
                }

                for (const attribute of sortedAttributes) {
                    await renderAttribute(attribute);
                }

                if (actor.willpower) {
                    actor.willpower.dataName = "willpower";
                    actor.willpower.name = "Willpower";
                    ;
                    await renderAttribute(actor.willpower);
                }

                content += `</div></div>`;
            }
        }
        return content;
    }

    static async renderRollOptions() {
        let rollData = {};
        rollData.dc = CONFIG.ROLL_DATA.dc;

        return await foundry.applications.handlebars.renderTemplate(`systems/vryl/templates/parts/roll/roll-options.html`, rollData);
    }

    static async #clearRoll() {
        console.log("Clearing roll data...");
        CONFIG.ROLL_DATA.rollActors.clear();

        let allSelected = document.querySelectorAll(`.selected.attribute-name`);
        for (let a of allSelected) {
            a.classList.remove(`selected`);
        }

        RollSidebar.updateRollData();
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

    //#region DC

    static _getDiceProbability(n, successThreshold, dc, sides = 20) {
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
        const levelData = this._getRollLevel();

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

    // #endregion Actions
}
