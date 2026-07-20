export function initializeGlobals() {
    game.vrylGlobalFunctions = {
        markdownToHtml: function(markdownText) {
            let html = markdownText;
            html = html.replaceAll(/\*\*\*(.*?)\*\*\*/g, `<b><i>$1</i></b>`);
            html = html.replaceAll(/\*\*(.*?)\*\*/g, `<b>$1</b>`);
            html = html.replaceAll(/\*(.*?)\*/g, `<i>$1</i>`);
            return html;
        },
        adjustNumberStepValue: function (element, amount, childrenDeep = 1) {
            let parent = element;
            for (let i = 0; i < childrenDeep; i++)
                parent = parent.parentElement;

            const input = parent.querySelector('input');
            input.value = parseInt(input.value) + parseInt(amount);
            input.dispatchEvent(new Event('change'));
        },
        runTokenSelector: async function ({ dialogButtonText = "Target", defaultSelectedActors = [], callback, userToken = null, range = null, singleTarget = false, tokenFilter = null, doRender = {} }) {
            let allTokens = canvas.tokens.placeables.filter(token => token.visible);
            if (tokenFilter)
                allTokens = allTokens.filter(tokenFilter);

            let availableTokens = allTokens;
            if (!userToken)
                userToken = canvas.tokens.controlled[0];

            if (userToken) {
                if (userToken.actor.statuses.has('blinded'))
                    range = Math.min(range ?? 2, 2);

                if (range != null) {
                    availableTokens = availableTokens.filter(token => {
                        const ray = new Ray(userToken.getCenterPoint(), token.getCenterPoint());
                        // 2. Measure the distance using the scene's grid rules
                        const distance = canvas.grid.measurePath([ray.A, ray.B]);
                        return distance.distance <= range;
                    });
                }
            }

            let context = {
                visibleTokens: {
                    allies: [...availableTokens.filter(token => token.document.disposition == 1)],
                    //neutral: [...visibleTokens.filter(token => token.document.disposition == 0 || token.document.disposition == -2)],
                    //enemies: [...visibleTokens.filter(token => token.document.disposition == -1)],
                    nonallies: [...availableTokens.filter(token => token.document.disposition != 1)],
                },
                selectedActors: [...defaultSelectedActors],
                doRender: doRender,
            }

            const path = `systems/vryl/templates/menus/tokenSelector.hbs`;
            const template = await foundry.applications.handlebars.renderTemplate(path, context);

            let d = new Dialog({
                title: dialogButtonText,
                content: template,
                buttons: {
                    one: {
                        label: dialogButtonText,
                        callback: () => {
                            callback(canvas.tokens.placeables.filter(e => context.selectedActors.includes(e.id)));
                        },
                    }
                },
                render: async (html) => {
                    //AUTOMATION Vulnerability opt-out
                    //AUTOMATION Blinded opt-out
                    const useButtons = html.find(`[data-action='selectToken']`);
                    for (let i = 0; i < useButtons.length; i++) {
                        const button = useButtons[i];
                        button.addEventListener('hover', async () => {

                        });

                        button.addEventListener('click', async () => {
                            if (singleTarget)
                                context.selectedActors = [button.id];
                            else {
                                const index = context.selectedActors.findIndex((a) => a == button.id);

                                if (index > -1) {
                                    context.selectedActors.splice(index, 1); // 2nd parameter means remove one item only
                                }
                                else {
                                    context.selectedActors.push(button.id);
                                }
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
        },
    }

    CONFIG.ui.vrylEnrichText = function (text, system = undefined, isChat = false) {
        if (!text)
            return text;

        //Enrich status effects
        for (const condition of CONFIG.statusEffects) {
            //TODO: make this replace cleaner, make sure that the text isnt within html tags
            text = text.replaceAll(`[${condition.name}]`, `<span class="clickable" title="${condition.description.replaceAll('"', '\"')}">${condition.name}</span>`);
        }

        if (system?.combat?.damage)
            text = text.replaceAll(/\[(\d+)?D\]/g, function (match, p1) {
                if (!p1 || p1 == "")
                    p1 = "1";
                return `${p1}d${system.combat.damage}`;
            });

        if (system?.combat?.fray)
            text = text.replaceAll(/\[(\d+)?fray\]/g, function (match, p1) {
                if (!p1 || p1 == "")
                    p1 = "1";
                return `${system.combat.fray * parseInt(p1)}`;
            });

        // Inline rolls
        text = text.replaceAll(/\[(.*?.*\d+) (.*?damage)\]/g, isChat ? `[[/r $1]]{$1 $2}` : `$1 $2`)


        return text;
    }
    
}