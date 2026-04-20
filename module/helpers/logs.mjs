export class VrylLogsHelpers {
    static hookChatExport() {

        this.styles = {
            alignCenter: "text-align: center; align-items: center; justify-content: center;",
            borderBox: "margin: 10px; border: 1px solid currentColor; background-color: color-mix(in srgb, currentColor 5%, transparent);",
            logWidth: "75%",
        };

        Hooks.on("renderChatInput", (app, elements, context) => {
            const el = (elements["#chat-controls"]).querySelector(".control-buttons");
            if (!el) return;
            if (el.querySelector("#vryl-archive-chat")) return;

            const parent = document.createElement("div");
            parent.innerHTML = `<button type="button" id="vryl-archive-chat" class="ui-control icon fa-solid fa-save" data-tooltip="Export Chat Log" aria-label="Open Vauxs Archives"></button>`;

            const element = parent.firstChild;
            if (!element) return;

            element.addEventListener(
                "click",
                async () => {

                    let maxDate = new Date(game.messages.contents[game.messages.contents.length - 1].timestamp);
                    let minDate = new Date(maxDate.getTime());

                    const sessionDifferentiationDistanceMinutes = 60 * 8; //8 hours

                    for (let i = game.messages.contents.length - 1; i >= 0; i--) {
                        const msg = game.messages.contents[i];
                        let msgDate = new Date(msg.timestamp);

                        if (msgDate < minDate && ((minDate - msgDate) / (1000 * 60)) < sessionDifferentiationDistanceMinutes)
                            minDate = msgDate;
                    }

                    const offset = new Date(Date.now()).getTimezoneOffset() * 60000;

                    const buffer = (15 * 60 * 1000);

                    const data = await foundry.applications.api.DialogV2.input({
                        window: { title: "Export Chat Log" },
                        content: `Start Date: <input type="datetime-local" name="startDate" placeholder="" value="${new Date(minDate - offset - buffer).toISOString().slice(0, 16)}" required>
                        End Date: <input type="datetime-local" name="endDate" placeholder="" value="${new Date(maxDate - offset + buffer).toISOString().slice(0, 16)}" required>`,
                        ok: {
                            label: "Save",
                            icon: "fa-solid fa-floppy-disk",
                        }
                    });
                    if (!data) return;

                    let startTimestamp = new Date(new Date(data.startDate) + offset).getTime();
                    let endTimestamp = new Date(new Date(data.endDate) + offset).getTime();

                    let log = "";
                    let worldDateString = "";
                    let worldTimeString = "";

                    const filteredMessages = game.messages.contents.filter((msg) => (msg.timestamp >= startTimestamp && msg.timestamp <= endTimestamp));

                    this.saveMessagesToFile(filteredMessages, new Date(startTimestamp).toISOString().split('T')[0]);
                },
            );


            const archiveButton = (elements["#chat-controls"]).querySelector("[data-action=\"export\"]");
            if (archiveButton) {
                archiveButton.after(element);
                archiveButton.remove();
            }
            else {
                el.appendChild(element);
            }
        });
    }

    static async saveMessagesToFile(messagesToSave, startDate = "") {
        let log = "";
        let dateString = ""
        for (let i = 0; i < messagesToSave.length; i++) {
            let header = "";
            let message = messagesToSave[i];
            header += "-- ";
            if (message.speaker && message.speaker.alias) {
                header += `<b>${message.speaker.alias}</b> (${message.author.name})`;
            }
            else
                header += `<b>(${message.author.name})</b>`;
            header += " --";
            log += this.styleCenter(header);

            if (message.flags["foundryvtt-simple-calendar"] != undefined) {
                log += "<br>";
                let timestamp = message.flags["foundryvtt-simple-calendar"]["sc-timestamps"].timestamp;
                let date = SimpleCalendar.api.timestampToDate(timestamp).display;
                let newDateString = `<i>In-World Date: ${date.day}${date.daySuffix} of the ${date.monthName}, Year ${date.year}</i>`;

                let time = date.time;
                if (time.includes(".")) time = time.substring(0, date.time.indexOf("."));
                let newTimeString = `<i>In-World Time</i>: ${time}*`;

                if (newDateString != worldDateString) {
                    worldDateString = newDateString;
                    log += this.styleCenter(newDateString);

                    if (newTimeString != worldTimeString)
                        log += "<br>";
                }
                if (newTimeString != worldTimeString) {
                    worldTimeString = newDateString;
                    log += this.styleCenter(newDateString);
                }
            }

            log += "<br>";

            if (message.whisper.length > 0) {
                log += "<details><summary>Whisper to: ";
                let i = 0;
                for (let w of message.whisper) {
                    log += game.users.get(w).name;
                    if (i < message.whisper.length - 1)
                        log += ", ";
                    i++;
                }
                log += "</summary><div>";
            }

            if (message.flavor != "")
                log += message.flavor + "\n";

            let content = message.content;
            content = content.replaceAll(`<em>`, "<i>").replaceAll(`</em>`, "</i>").replaceAll(`<hr>`, "<br>").replaceAll(`<hr />`, "<br>");
            content = content.replaceAll("<br>", "\n");
            content = content.replaceAll(`<i class="fa-solid fa-arrow-right"></i>`, "(At-Will)");
            content = content.replaceAll(`<i class="fa-solid fa-rotate"></i>`, "(Encounter)");
            content = content.replaceAll(`<i class="fa-solid fa-diamond"></i><i class="fa-solid fa-diamond"></i><i class="fa-solid fa-diamond"></i>`, "(Three Actions)");
            content = content.replaceAll(`<i class="fa-solid fa-diamond"></i><i class="fa-solid fa-diamond"></i>`, "(Two Actions)");
            content = content.replaceAll(`<i class="fa-solid fa-diamond"></i>`, "(One Action)");
            content = content.replaceAll(`<i class="fa-solid fa-diamond-turn-right"></i>`, "(Reaction)");
            content = content.replaceAll(`<i class="fa-regular fa-diamond"></i>`, "(Free Action)");

            if (message.flags.vryl?.isAttributeRoll) {
                for (const roll of message.rolls) {
                    let newLine = roll.options.flavor;

                    newLine = newLine.replaceAll("<h5", `<b style="${this.styles.alignCenter}"`).replaceAll("</h5", "</b");
                    newLine = newLine.replaceAll("<h6", `<b style="${this.styles.alignCenter}"`).replaceAll("</h6", "</b");
                    newLine = newLine.replaceAll("<i></i>", "");
                    newLine = newLine.replaceAll("<b></b>", "");
                    newLine = newLine.replaceAll(/^[ \t]+|[ \t]+$/gm, ""); // Trim whitespace from start and end of each line

                    newLine = newLine.replaceAll(/(\r<br>|\r|<br>){3,}/g, '<br><br>');
                    newLine = newLine.replaceAll(/<!--[\s\S]*?-->/g, ""); //Remove HTML comments
                    newLine = newLine.replaceAll(/^\s*[\r\n]/gm, ""); //Remove empty lines

                    newLine = this.boxCenter(newLine);

                    log += newLine + '<br>';
                }
                log += this.renderRollTerms(message) + "<br>" + "Successes: ";
            }
            else {
                //default roll rendering, if there are any rolls at all
                if (message.rolls.length > 0)
                    log += this.renderRollTerms(message) + "<br>" + "Total: ";
            }
            log += content;

            if (message.whisper.length > 0) {
                log += "</div></details>";
            }

            log += "<br><br>";
        }
        log = log.replaceAll("<br />", "<br>").replaceAll("<hr />", "<br>").replaceAll("<br>", "<br>").replaceAll("<hr>", "<br>");

        log = log.replaceAll(`<em>`, "<i>").replaceAll(`</em>`, "</i>");
        log = log.replaceAll(/(\r<br>|\r|<br>){3,}/g, '<br><br>');
        log = log.replaceAll(/<!--[\s\S]*?-->/g, "");
        log = log.replaceAll("<br>", "\n");
        log = log.replaceAll("<br//>", "<br>")

        log = log.replaceAll(/ +?[\r\n]+>/g, ">"); //Remove newlines before ">"
        log = log.replaceAll(/<div(.*?)[\r\n]+>/g, "<div$1>"); //remove newlines after "<div"

        const iconSize = "14px";
        log = log.replaceAll(`<i class="fa-solid fa-dice-d20"></i>`, `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width=${iconSize} height=${iconSize} viewBox="0 0 512 512"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M224.4-8.2c19.6-11.1 43.6-11.1 63.1 0l192 108.8c20 11.4 32.4 32.6 32.4 55.7l0 215.6c0 23-12.4 44.3-32.4 55.7l-192 108.8c-19.6 11.1-43.6 11.1-63.1 0L32.4 427.5C12.4 416.1 0 394.8 0 371.8L0 156.2c0-23 12.4-44.3 32.4-55.7L224.4-8.2zm52 73.2C267 49.8 245 49.8 235.6 65l-76.6 123.7-85.4-46.3-3.8-1.6c-8.9-2.7-18.8 1.1-23.4 9.6s-2.4 18.9 4.7 24.8l3.3 2.3 83.4 45.2-74.6 120.6C55.3 356.2 61 373 75 378.4l161 61.9 0 39.7c0 11 9 20 20 20s20-9 20-20l0-39.7 161-61.9c14-5.4 19.7-22.2 11.8-35l-74.7-120.6 83.4-45.2c9.7-5.3 13.3-17.4 8.1-27.1s-17.4-13.3-27.1-8.1L353 188.7 276.4 65zm-47 329.9l-122-46.9 54.5-88.1 67.5 135zM404.6 348l-122 46.9 67.5-135 54.5 88.1zM319.3 232L256 358.6 192.7 232 319.3 232zM308 192l-104.1 0 52-84 52 84z"/></svg>`);
        log = log.replaceAll(`<i class="fa-solid fa-plus-square"></i>`, `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width=${iconSize} height=${iconSize} viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M160 96C124.7 96 96 124.7 96 160L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 160C544 124.7 515.3 96 480 96L160 96zM296 408L296 344L232 344C218.7 344 208 333.3 208 320C208 306.7 218.7 296 232 296L296 296L296 232C296 218.7 306.7 208 320 208C333.3 208 344 218.7 344 232L344 296L408 296C421.3 296 432 306.7 432 320C432 333.3 421.3 344 408 344L344 344L344 408C344 421.3 333.3 432 320 432C306.7 432 296 421.3 296 408z"/></svg>`);

        log = this.addStyleIfClass(log, "flex-group-center", this.styles.alignCenter);
        log = this.addStyleIfClass(log, "roll-builder-actor-inner", this.styles.alignCenter + this.styles.borderBox);
        log = this.addStyleIfClass(log, "roll-builder-attribute", this.styles.alignCenter + this.styles.borderBox);
        log = this.addStyleIfClass(log, "roll-builder-prompt", this.styles.alignCenter + this.styles.borderBox);
        log = this.addStyleIfClass(log, "flexcol", "display: flex; flex-direction: column;");
        log = this.addStyleIfClass(log, "flexrow", "display: flex; flex-direction: row;");
        log = this.addStyleIfType(log, "summary", `list-style-position: outside;`);
        log = this.addStyleIfType(log, "details", this.styles.borderBox);

        log = log.replaceAll(/(<details[\s\S]*?<\/details>)/g, this.boxCenter(`$1`));

        log = this.boxCenter(log, this.styles.logWidth, false);

        //trim html
        //log = log.replace("<b>", "**").replace("</b>", "**").replace("<i>", "*").replace("</i>", "*");
        // const log = originalMessages.map((m) => m.export()).join("<br><br>");
        //let date = (/* @__PURE__ */ new Date()).toDateString().replace(/\s/g, "-");
        const storedSession = await game.settings.get(CONFIG.SystemId, 'log-session') ?? 1;
        const filename = `Session ${storedSession}${startDate != "" ? ` - ${startDate}` : ""}.html`;
        foundry.utils.saveDataToFile(log, "text/html", filename);
        game.settings.set(CONFIG.SystemId, 'log-session', storedSession + 1);
    }

    static renderRollTerms(message) {
        let content = "";

        for (const roll of message.rolls) {
            let rollFormula = "";
            let rollResults = "";

            function addResults(results, dieString) {
                for (const die of results) {
                    rollResults += `<span title="${dieString.replaceAll(` <i class="fa-solid fa-dice-d20"></i>`, "d20")}">${die.success ? "<b>" : ""}[${die.result}]${die.success ? "</b>" : ""}</span>`;
                    rollResults += " ";
                }
            }

            for (const term of roll.terms) {
                if (term instanceof foundry.dice.terms.Die) {
                    let dieString = `${term._number}`;
                    if(term._faces == 20)
                        dieString += ` <i class="fa-solid fa-dice-d20"></i>`;
                    else
                        dieString += `d${term._faces}`;
                    for (const modifier of term.modifiers) {
                        if (modifier.startsWith("cs>="))
                            dieString += modifier.replace("cs>=", " DC");
                    }
                    rollFormula += dieString;
                    addResults(term.results, dieString);
                }
                else if (term instanceof foundry.dice.terms.OperatorTerm) {
                    rollFormula += term.operator;
                }
                else if (term instanceof foundry.dice.terms.NumericTerm) {
                    if(term.number == 0) continue;
                    rollFormula += term.number + ` <i class="fa-solid fa-plus-square"></i>`;
                }
                else if (term instanceof foundry.dice.terms.Coin) {
                    let dieString = term.number + ` Flipped Coin${term.number != 1 ? "s" : ""}`;
                    rollFormula += dieString;
                    addResults(term.results, dieString);
                }
                rollFormula += " ";
            }
            content += `<details><summary>${this.styleCenter(rollFormula)}</summary>${this.styleCenter(rollResults)}</details>`;
        }
        content = content.replaceAll(" + </", "</");
        content = content.replaceAll(" - </", "</");
        return content;
    }

    static styleCenter(rawHtml) {
        return `<div style="${this.styles.alignCenter}">${rawHtml}</div>`;
    }

    static addStyleIfClass(html, htmlClass, htmlStyle) {
        let styleRegex = new RegExp(`<([a-z0-9]+)([^>]*class="[^"]*\\b${htmlClass}\\b[^"]*"[^>]*)>`, "g");
        return this.mergeStyles(html.replaceAll(styleRegex, `<$1$2 style="${htmlStyle}">`));
    }

    static addStyleIfType(html, htmlType, htmlStyle) {
        let styleRegex = new RegExp(`<(${htmlType})([^>]*)>`, "g");
        return this.mergeStyles(html.replaceAll(styleRegex, `<$1$2 style="${htmlStyle}">`));
    }

    static mergeStyles(html) {
        return html.replaceAll(/(<[a-zA-Z0-9]+\b[^>]*)\bstyle="([^"]*)"([^>]*)\bstyle="([^"]*)"([^>]*>)/g,
            `$1$3 style="$2; $4"$5`
        );
    }

    static boxCenter(html, width = "66%", relativeToLogWidth = true) {
        return `<div style="min-width:100%"><div style="margin: auto; max-width: ${width};">${html}</div></div>`;
    }
}
