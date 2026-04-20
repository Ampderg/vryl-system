export class AttributeRoll extends foundry.dice.Roll {
    static CHAT_TEMPLATE = `systems/vryl/templates/parts/roll/roll.hbs`;
    static TOOLTIP_TEMPLATE = `systems/vryl/templates/parts/roll/tooltip.hbs`;

    async _prepareChatRenderContext({ flavor, isPrivate = false, ...options } = {}) {
        const context = await super._prepareChatRenderContext({ flavor, isPrivate, ...options });

        let crits = 0;
        for (let roll of options.message.rolls) {
            for (let term of roll.terms) {
                if (term.results) {
                    for (let result of term.results) {
                        if (result.result >= term._faces)
                            crits++;
                    }
                }
            }
        }
        context.crits = crits;

        context.flags = options.message.flags;
        context.flags.vryl.isAttributeRoll = true;
        return context;
    }
}