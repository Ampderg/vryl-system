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
        let opts = document.querySelectorAll(`.ui-control.plain.icon.fa-solid.fa-dice-d20`);
        for (let element of opts) {
            let item = element.parentElement;
            if (element) {
                let chatOpts = document.querySelectorAll(`.ui-control.plain.icon.fa-solid.fa-comments`);
                if (chatOpts.length == 1)
                    chatOpts[0].parentElement.after(item);
            }
        }
        return super._renderHTML(context, options);
    }

    //#region Html Updates

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

    static async #roll(event, target) {
        console.log("Rolling with data: ", CONFIG.ROLL_DATA);

        const rollActors = CONFIG.ROLL_DATA.rollActors;
        const rollActorsValues = rollActors.values();
        let totalLevels = 0;
        let dc = 11;
        let guaranteedSuccesses = 0;
        for (const actor of rollActorsValues) {
            for (const attribute of actor.attributes) {
                totalLevels += attribute.level + attribute.heroicLevel + attribute.bonusDice;
            }
        }

        if (totalLevels <= 0) {
            guaranteedSuccesses -= 1 - totalLevels;
            totalLevels = 2 - totalLevels;
        }

        let roll = new CONFIG.Dice.AttributeRoll(`${totalLevels}d20cs>=${dc}sa + ${guaranteedSuccesses}`);
        roll.options.flavor = await CONFIG.ui.rollBuilder.renderRollAttributes();
        roll.toMessage();

        RollSidebar.#clearRoll();
        RollSidebar.#goToChat(target);
    }

    static async #print(event, target) {
        console.log("Printing to chat with data: ", CONFIG.ROLL_DATA);

        ChatMessage.create({
            content: await RollSidebar.renderRollAttributes()
        });

        //RollSidebar.#clearRoll();
        //RollSidebar.#goToChat(target);
    }

    static async getAttributeCategory(attribute) {
        const attributeCategories = game.settings.get(CONFIG.SystemId, 'attribute_categories');
        return attributeCategories[attribute.category];
    }
    static async getAttributeType(attribute) {
        const attributeCategory = this.getAttributeCategory(attribute);
        const attributeTypes = game.settings.get(CONFIG.SystemId, 'attribute_types');
        return attributeTypes[attributeCategory.type];
    }

    static async deselectAttribute(actorId, dataName, render = true) {
        const rollActors = CONFIG.ROLL_DATA.rollActors;
        rollActors.forEach((value, key) => {
            if (key == actorId) {
                value.attributes = value.attributes.filter((a) => a.dataName != dataName);

                let allSelected = document.querySelectorAll(`.attribute-name.selected.actor-${actorId}.attribute-name-${dataName}`);
                for (let a of allSelected) {
                    a.classList.remove(`selected`);
                }

                if (value.attributes.length == 0) {
                    let allSelected = document.querySelectorAll(`.roll-builder-actor.actor-${actorId}`);
                    for (let a of allSelected) {
                        a.remove();
                    }
                }
            }
        })
        if (render)
            this.updateRollData();
    }

    static async renderRollAttributes() {
        let content = "";
        const rollActors = CONFIG.ROLL_DATA.rollActors;
        const attributeCategories = game.settings.get(CONFIG.SystemId, 'attribute_categories');
        const attributeTypes = game.settings.get(CONFIG.SystemId, 'attribute_types');
        for (const [key, actor] of rollActors) {
            if(actor.attributes.length > 0)
            {
            content += `<div class="roll-builder-actor actor-${key}"><div class="roll-builder-actor-inner">`
            content += `<h5 class="flex-group-center">${actor.name}</h5>`;
            for (const attribute of actor.attributes.toSorted((a, b) => {
                return this.getAttributeType(a).sorting - this.getAttributeType(b).sorting;
            })) {
                const bonusDiceContent = `<i>${attribute.bonusDice > 0 ? "+" : "-"} ${attribute.bonusDice} </i>`;
                attribute.bonusDiceString = attribute.bonusDice && attribute.bonusDice != 0 ? bonusDiceContent : "";
                attribute.combinedLevel = attribute.level + attribute.heroicLevel;
                attribute.actorId = key;
                attribute.dataName = attribute.dataName;

                const template = await foundry.applications.handlebars.renderTemplate(`systems/vryl/templates/parts/roll-attribute.html`, attribute);
                content += template;
            }
            content += `</div></div>`;
        }
        }
        return content;
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

    static #goToChat(target) {
        if (target.offsetParent.offsetParent.id.includes("popout")) return;
        window.ui.sidebar.expand()
        window.ui.sidebar.changeTab("chat", "primary");
    }
    // #endregion Actions
};
