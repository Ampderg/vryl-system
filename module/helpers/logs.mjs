export class VrylLogsHelpers {
    static hookChatExport() {

        this.backgroundColor = `color-mix(in srgb, currentColor 5%, transparent)`;
        this.styles = {
            alignCenter: "text-align: center; align-items: center; justify-content: center;",
            borderBox: `margin: 10px; border: 1px solid currentColor; background-color: ${this.backgroundColor};`,
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

                    let startTimestamp = new Date(new Date(data.startDate).getTime()).getTime();
                    let endTimestamp = new Date(new Date(data.endDate).getTime()).getTime();

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
        let worldDateString = ""
        let worldTimeString = ""
        for (let i = 0; i < messagesToSave.length; i++) {
            let message = messagesToSave[i];

            if (message.flags.vryl?.isAudioPlayEvent) {
                const sound = await fromUuid(message.flags.vryl.audioSrcUuid);
                if (!sound)
                    continue;

                log += "<b>Now Playing...</b><br>";
                let foundLink = false;
                const descTokens = sound.description.replaceAll("<br>", "\n").replaceAll("<br />", "\n").split('\n');
                for (let token of descTokens) {
                    if (token.toLowerCase().includes("bandcamp track id: ")) {
                        token = token.replace(/bandcamp track id: /i, "");
                        try {
                            const trackId = token.replace(/<[^>]*>/g, "");
                            console.log(trackId);

                            const embed = `<iframe style="border: 0; width: 100%; height: 42px;" src="https://bandcamp.com/EmbeddedPlayer/size=small/bgcol=000000/linkcol=0687f5/track=${trackId}/transparent=true/" seamless></iframe><br>`;
                            log += embed;

                            foundLink = true;
                        } catch (error) {
                            console.error('Request failed', error);
                        }
                    }
                }
                if (!foundLink) {
                    log += sound.name;
                }

                continue;
            }

            let header = "";

            header += "-- ";
            if (message.speaker && message.speaker.alias) {
                header += `<b>${message.speaker.alias}</b> (${message.author.name})`;
            }
            else
                header += `<b>(${message.author.name})</b>`;
            header += " --";
            log += this.styleCenter(header);

            let calendarProvider = undefined;
            if (message.flags["foundryvtt-simple-calendar"] != undefined)
                calendarProvider = "foundryvtt-simple-calendar";
            else if (message.flags["foundryvtt-simple-calendar-reborn"] != undefined)
                calendarProvider = "foundryvtt-simple-calendar-reborn";

            if (message.flags[calendarProvider] != undefined) {
                log += "<br>";
                let timestamp = message.flags[calendarProvider]["sc-timestamps"].timestamp;
                let date = SimpleCalendar.api.timestampToDate(timestamp).display;
                let newDateString = `<i>In-World Date: ${date.day}${date.daySuffix} of the ${date.monthName}, Year ${date.year}</i>`;

                let time = date.time;
                if (time.includes(".")) time = time.substring(0, date.time.indexOf("."));
                let newTimeString = `<i>In-World Time: ${time}</i>`;

                if (newDateString != worldDateString) {
                    worldDateString = newDateString;
                    log += this.styleCenter(newDateString);

                    if (newTimeString != worldTimeString) {
                        log += "<br>";
                        worldTimeString = newTimeString;
                        log += this.styleCenter(newTimeString);
                    }
                    log += "<br>";
                }
                else if (newTimeString != worldTimeString) {
                    worldTimeString = newTimeString;
                    log += this.styleCenter(newTimeString);
                    log += "<br>";
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
                log += this.styleCenter(message.flavor) + "\n";

            let content = message.content;
            content = content.replaceAll(`<em>`, "<i>").replaceAll(`</em>`, "</i>").replaceAll(`<hr>`, "<br>").replaceAll(`<hr />`, "<br>");
            content = content.replaceAll("<br>", "\n");
            // content = content.replaceAll(`<i class="fa-solid fa-arrow-right"></i>`, "(At-Will)");
            // content = content.replaceAll(`<i class="fa-solid fa-rotate"></i>`, "(Encounter)");
            // content = content.replaceAll(`<i class="fa-solid fa-diamond"></i><i class="fa-solid fa-diamond"></i><i class="fa-solid fa-diamond"></i>`, "(Three Actions)");
            // content = content.replaceAll(`<i class="fa-solid fa-diamond"></i><i class="fa-solid fa-diamond"></i>`, "(Two Actions)");
            // content = content.replaceAll(`<i class="fa-solid fa-diamond"></i>`, "(One Action)");
            // content = content.replaceAll(`<i class="fa-solid fa-diamond-turn-right"></i>`, "(Reaction)");
            // content = content.replaceAll(`<i class="fa-regular fa-diamond"></i>`, "(Free Action)");

            if (message.flags.vryl?.startOfCombatTurn)
                // &&
                // (log.lastIndexOf(`<!-- startOfCombatTurn -->`) == -1 ||
                //     log.lastIndexOf(`<!-- startOfCombatTurn -->`) >= log.lastIndexOf(`<!-- endOfCombatTurn -->`)))
                    {
                content = `<!-- startOfCombatTurn --><br><details> 
                ${content}`;
            }
            if (message.flags.vryl?.endOfCombatTurn) 
                // &&
                // log.lastIndexOf(`<!-- startOfCombatTurn -->`) != -1 &&
                // (log.lastIndexOf(`<!-- endOfCombatTurn -->`) == -1 ||
                //     log.lastIndexOf(`<!-- endOfCombatTurn -->`) <= log.lastIndexOf(`<!-- startOfCombatTurn -->`))) 
            {
                content = `${content}
                <summary><i>
                ${message.flags.vryl.messageSummary ?? ""}
                </i></summary>
                </details><!-- endOfCombatTurn -->`
            }
            if(message.flags.vryl?.newCombatRound)
            {
                log += `<h3>Round ${message.flags.vryl.newCombatRound}</h3><br>`;
            }

            if (message.flags.vryl?.isAttributeRoll) {
                function processFlavor(flavor) {
                    flavor = flavor.replaceAll("<h5", `<b style="${VrylLogsHelpers.styles.alignCenter}"`).replaceAll("</h5", "</b");
                    flavor = flavor.replaceAll("<h6", `<b style="${VrylLogsHelpers.styles.alignCenter}"`).replaceAll("</h6", "</b");
                    flavor = flavor.replaceAll("<i></i>", "");
                    flavor = flavor.replaceAll("<b></b>", "");
                    flavor = flavor.replaceAll(/^[ \t]+|[ \t]+$/gm, ""); // Trim whitespace from start and end of each line

                    flavor = flavor.replaceAll(/(\r<br>|\r|<br>){3,}/g, '<br><br>');
                    flavor = flavor.replaceAll(/<!--[\s\S]*?-->/g, ""); //Remove HTML comments
                    flavor = flavor.replaceAll(/^\s*[\r\n]/gm, ""); //Remove empty lines

                    flavor = VrylLogsHelpers.boxCenter(flavor);

                    return flavor;
                }

                if (message.flags.vryl?.isPrintedRoll) {
                    log += processFlavor(message.content);
                }
                else {
                    for (const roll of message.rolls) {

                        log += processFlavor(roll.options.flavor) + '<br>';
                    }
                    log += this.renderRollTerms(message) + "<br>" + this.styleCenter("Successes: " + content);
                    if (message.flags.vryl?.narrativeResult) {
                        const successes = parseInt(content);
                        let narrativeResult = "";
                        if (successes <= 0)
                            narrativeResult = `<b>Failure</b>, with a <b>Twist</b> to be the worst possible result.`;
                        else if (successes <= 1)
                            narrativeResult = `<b>Failure</b>, but your efforts result in something else happening.`;
                        else if (successes <= 2)
                            narrativeResult = `<b>Success</b>, with a <b>Twist</b>. You achieve your goal, but in an unexpected way.`;
                        else if (successes <= 3)
                            narrativeResult = `<b>Success</b>. You achieve your goal without complication.`;
                        else
                            narrativeResult = `<b>Success</b>, with a <b>Boon</b> to be the best possible result.`;
                        log += "\n" + narrativeResult + "<br//>";
                    }
                    log += "<br//>";
                }
            }
            else {
                //default roll rendering, if there are any rolls at all
                if (message.rolls.length > 0) {
                    log += this.renderRollTerms(message) + "<br>" + this.styleCenter("Total: " + content);
                }
                else {
                    log += content;
                }
            }

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
        function faRegex(icon, type = "") {
            return new RegExp(`(<i[^<>]*?class=['"][^<>]*?fa[^<>]*?${type}[^<>]*? fa-${icon}['"][^<>]*?><\/i>)`, "g");
        }
        log = log.replaceAll(faRegex("dice-d20"), `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width=${iconSize} height=${iconSize} viewBox="0 0 512 512"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M224.4-8.2c19.6-11.1 43.6-11.1 63.1 0l192 108.8c20 11.4 32.4 32.6 32.4 55.7l0 215.6c0 23-12.4 44.3-32.4 55.7l-192 108.8c-19.6 11.1-43.6 11.1-63.1 0L32.4 427.5C12.4 416.1 0 394.8 0 371.8L0 156.2c0-23 12.4-44.3 32.4-55.7L224.4-8.2zm52 73.2C267 49.8 245 49.8 235.6 65l-76.6 123.7-85.4-46.3-3.8-1.6c-8.9-2.7-18.8 1.1-23.4 9.6s-2.4 18.9 4.7 24.8l3.3 2.3 83.4 45.2-74.6 120.6C55.3 356.2 61 373 75 378.4l161 61.9 0 39.7c0 11 9 20 20 20s20-9 20-20l0-39.7 161-61.9c14-5.4 19.7-22.2 11.8-35l-74.7-120.6 83.4-45.2c9.7-5.3 13.3-17.4 8.1-27.1s-17.4-13.3-27.1-8.1L353 188.7 276.4 65zm-47 329.9l-122-46.9 54.5-88.1 67.5 135zM404.6 348l-122 46.9 67.5-135 54.5 88.1zM319.3 232L256 358.6 192.7 232 319.3 232zM308 192l-104.1 0 52-84 52 84z"/></svg>`);
        log = log.replaceAll(faRegex("plus-square"), `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width=${iconSize} height=${iconSize} viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M160 96C124.7 96 96 124.7 96 160L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 160C544 124.7 515.3 96 480 96L160 96zM296 408L296 344L232 344C218.7 344 208 333.3 208 320C208 306.7 218.7 296 232 296L296 296L296 232C296 218.7 306.7 208 320 208C333.3 208 344 218.7 344 232L344 296L408 296C421.3 296 432 306.7 432 320C432 333.3 421.3 344 408 344L344 344L344 408C344 421.3 333.3 432 320 432C306.7 432 296 421.3 296 408z"/></svg>`);
        log = log.replaceAll(faRegex("arrow-right"), `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width=${iconSize} height=${iconSize} viewBox="0 0 640 640"><!--!Font Awesome Free v7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M566.6 342.6C579.1 330.1 579.1 309.8 566.6 297.3L406.6 137.3C394.1 124.8 373.8 124.8 361.3 137.3C348.8 149.8 348.8 170.1 361.3 182.6L466.7 288L96 288C78.3 288 64 302.3 64 320C64 337.7 78.3 352 96 352L466.7 352L361.3 457.4C348.8 469.9 348.8 490.2 361.3 502.7C373.8 515.2 394.1 515.2 406.6 502.7L566.6 342.7z"/></svg>`);
        log = log.replaceAll(faRegex("arrows-rotate"), `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width=${iconSize} height=${iconSize} viewBox="0 0 640 640"><!--!Font Awesome Free v7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M129.9 292.5C143.2 199.5 223.3 128 320 128C373 128 421 149.5 455.8 184.2C456 184.4 456.2 184.6 456.4 184.8L464 192L416.1 192C398.4 192 384.1 206.3 384.1 224C384.1 241.7 398.4 256 416.1 256L544.1 256C561.8 256 576.1 241.7 576.1 224L576.1 96C576.1 78.3 561.8 64 544.1 64C526.4 64 512.1 78.3 512.1 96L512.1 149.4L500.8 138.7C454.5 92.6 390.5 64 320 64C191 64 84.3 159.4 66.6 283.5C64.1 301 76.2 317.2 93.7 319.7C111.2 322.2 127.4 310 129.9 292.6zM573.4 356.5C575.9 339 563.7 322.8 546.3 320.3C528.9 317.8 512.6 330 510.1 347.4C496.8 440.4 416.7 511.9 320 511.9C267 511.9 219 490.4 184.2 455.7C184 455.5 183.8 455.3 183.6 455.1L176 447.9L223.9 447.9C241.6 447.9 255.9 433.6 255.9 415.9C255.9 398.2 241.6 383.9 223.9 383.9L96 384C87.5 384 79.3 387.4 73.3 393.5C67.3 399.6 63.9 407.7 64 416.3L65 543.3C65.1 561 79.6 575.2 97.3 575C115 574.8 129.2 560.4 129 542.7L128.6 491.2L139.3 501.3C185.6 547.4 249.5 576 320 576C449 576 555.7 480.6 573.4 356.5z"/></svg>`);
        log = log.replaceAll(faRegex("diamond", "s"), `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width=${iconSize} height=${iconSize} viewBox="0 0 640 640"><!--!Font Awesome Free v7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M81 279L279 81C289.9 70.1 304.6 64 320 64C335.4 64 350.1 70.1 361 81L559 279C569.9 289.9 576 304.6 576 320C576 335.4 569.9 350.1 559 361L361 559C350.1 569.9 335.4 576 320 576C304.6 576 289.9 569.9 279 559L81 361C70.1 350.1 64 335.4 64 320C64 304.6 70.1 289.9 81 279z"/></svg>`);
        log = log.replaceAll(faRegex("diamond", "l"), `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width=${iconSize} height=${iconSize} viewBox="0 0 448 512" class="svg-inline--fa fa-diamond fa-w-14 fa-7x"><path fill="currentColor" d="M253 13.4c-15.3-17.9-42.8-17.9-58.1 0L9.3 230.9c-12.4 14.5-12.4 35.6 0 50.2L195 498.6c15.3 17.9 42.8 17.9 58.1 0l185.6-217.5c12.4-14.5 12.4-35.6 0-50.2L253 13.4zm161.4 246.9L228.7 477.8c-2.5 2.9-6.9 2.9-9.4 0L33.6 260.3c-2.1-2.5-2.1-6.2 0-8.6L219.3 34.2c2.5-2.9 6.9-2.9 9.4 0l185.7 217.5c2.1 2.5 2.1 6.1 0 8.6z" class=""></path></svg>`);
        log = log.replaceAll(faRegex("diamond-turn-right"), `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width=${iconSize} height=${iconSize} viewBox="0 0 640 640"><!--!Font Awesome Free v7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M279 81L81 279C70.1 289.9 64 304.6 64 320C64 335.4 70.1 350.1 81 361L279 559C289.9 569.9 304.6 576 320 576C335.4 576 350.1 569.9 361 559L559 361C569.9 350.1 576 335.4 576 320C576 304.6 569.9 289.9 559 279L361 81C350.1 70.1 335.4 64 320 64C304.6 64 289.9 70.1 279 81zM449 321L377 393C367.6 402.4 352.4 402.4 343.1 393C333.8 383.6 333.7 368.4 343.1 359.1L374.1 328.1L296 328.1C282.7 328.1 272 338.8 272 352.1L272 392.1C272 405.4 261.3 416.1 248 416.1C234.7 416.1 224 405.4 224 392.1L224 352.1C224 312.3 256.2 280.1 296 280.1L374.1 280.1L343.1 249.1C333.7 239.7 333.7 224.5 343.1 215.2C352.5 205.9 367.7 205.8 377 215.2L449 287.2C458.4 296.6 458.4 311.8 449 321.1z"/></svg>`);
        log = log.replaceAll(faRegex("circle", `s`), `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width=${iconSize} height=${iconSize} viewBox="0 0 640 640"><!--!Font Awesome Free v7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C178.6 576 64 461.4 64 320z"/></svg>`);
        log = log.replaceAll(faRegex("circle", `l`), `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width=${iconSize} height=${iconSize} viewBox="0 0 640 640"><!--!Font Awesome Free v7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M528 320C528 205.1 434.9 112 320 112C205.1 112 112 205.1 112 320C112 434.9 205.1 528 320 528C434.9 528 528 434.9 528 320zM64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C178.6 576 64 461.4 64 320z"/></svg>`);
        log = log.replaceAll(faRegex("user-group"), `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width=${iconSize} height=${iconSize} viewBox="0 0 640 640"><!--!Font Awesome Free v7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M96 192C96 130.1 146.1 80 208 80C269.9 80 320 130.1 320 192C320 253.9 269.9 304 208 304C146.1 304 96 253.9 96 192zM32 528C32 430.8 110.8 352 208 352C305.2 352 384 430.8 384 528L384 534C384 557.2 365.2 576 342 576L74 576C50.8 576 32 557.2 32 534L32 528zM464 128C517 128 560 171 560 224C560 277 517 320 464 320C411 320 368 277 368 224C368 171 411 128 464 128zM464 368C543.5 368 608 432.5 608 512L608 534.4C608 557.4 589.4 576 566.4 576L421.6 576C428.2 563.5 432 549.2 432 534L432 528C432 476.5 414.6 429.1 385.5 391.3C408.1 376.6 435.1 368 464 368z"/></svg>`);
        log = log.replaceAll(faRegex("bullseye-arrow"), `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width=${iconSize} height=${iconSize} viewBox="0 0 496 512" class="svg-inline--fa fa-bullseye-arrow fa-w-16 fa-7x"><path fill="currentColor" d="M305.05 98.74l16.57 49.7-90.59 90.59c-9.38 9.38-9.38 24.56 0 33.94 9.37 9.37 24.56 9.38 33.94 0l90.59-90.59 49.7 16.57c7.39 2.46 15.53.54 21.04-4.96l63.67-63.67c10.8-10.8 6.46-29.2-8.04-34.04l-55.66-18.55-18.55-55.65c-4.83-14.5-23.23-18.84-34.04-8.04L310.02 77.7a20.582 20.582 0 0 0-4.97 21.04zm-75.17 96.19l55.14-55.14-2.12-6.38c-11.17-3.17-22.72-5.41-34.9-5.41-70.69 0-128 57.31-128 128s57.31 128 128 128 128-57.31 128-128c0-12.18-2.24-23.73-5.42-34.89l-6.37-2.12-55.14 55.14C301.19 300.55 276.95 320 248 320c-35.29 0-64-28.71-64-64 0-28.95 19.45-53.19 45.88-61.07zm254.55-13.83l-35.5 35.5c-5.5 5.5-12.07 9.48-19.17 12.07 1.33 8.94 2.25 18.02 2.25 27.33 0 101.69-82.29 184-184 184-101.69 0-184-82.29-184-184 0-101.69 82.29-184 184-184 9.42 0 18.6.93 27.63 2.29 2.58-7.02 6.23-13.69 11.76-19.22l35.5-35.5A247.848 247.848 0 0 0 248 8C111.03 8 0 119.03 0 256s111.03 248 248 248 248-111.03 248-248c0-26.11-4.09-51.26-11.57-74.9z" class=""></path></svg>`);

        log = this.addStyleIfClass(log, "flex-group-center", this.styles.alignCenter);
        log = this.addStyleIfClass(log, "roll-builder-actor-inner", this.styles.alignCenter + this.styles.borderBox);
        log = this.addStyleIfClass(log, "roll-builder-attribute", this.styles.alignCenter + this.styles.borderBox);
        log = this.addStyleIfClass(log, "roll-builder-prompt", this.styles.alignCenter + this.styles.borderBox);
        log = this.addStyleIfClass(log, "flexcol", "display: flex; flex-direction: column;");
        log = this.addStyleIfClass(log, "flexrow", "display: flex; flex-direction: row;");
        log = this.addStyleIfType(log, "summary", `list-style-position: outside;`);
        log = this.addStyleIfType(log, "details", this.styles.borderBox, `(?:(?!Whisper to:).)*?</details>`);

        log = log.replaceAll(/(<details(?:(?!Whisper to:).)*?<\/details>)/g, this.boxCenter(`$1`));

        log = log.replaceAll(`<div class="copy-roll flexcol" style="display: flex; flex-direction: column;">
<button class="copy-roll-replace">Copy Roll <i class="fa-solid fa-copy"></i></button>
<div style="min-width:100%"><div style="margin: auto; max-width: 50%;"><details class="full-width" style="margin: 10px; border: 1px solid currentColor; background-color: color-mix(in srgb, currentColor 5%, transparent);">
<summary class="align-center" style="list-style-position: outside;">Expand</summary>
<button class="copy-roll-append full-width">Append Actors to Roll <i class="fa-regular fa-plus-square"></i></button>
</details></div></div></div>`, "");

        log = log.replaceAll(`<button class="clickable" id="combatEffectsButton">Open Effects</button>`, ``);

        log = log.replaceAll(`<a class="inline`, `<b class="inline`).replaceAll(`</a>`, `</b>`);
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
                    if (term._faces == 20)
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
                    if (term.number == 0) continue;
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

    static addStyleIfType(html, htmlType, htmlStyle, suffix = "") {
        let styleRegex = new RegExp(`<(${htmlType})([^>]*)>(${suffix})`, "g");
        return this.mergeStyles(html.replaceAll(styleRegex, `<$1$2 style="${htmlStyle}">$3`));
    }

    static mergeStyles(html) {
        return html.replaceAll(/(<[a-zA-Z0-9]+\b[^>]*)\bstyle="([^"]*)"([^>]*)\bstyle="([^"]*)"([^>]*>)/g,
            `$1$3 style="$2; $4"$5`
        );
    }

    static boxCenter(html, width = "50%", relativeToLogWidth = true) {
        return `<div style="min-width:100%"><div style="margin: auto; max-width: ${width};">${html}</div></div>`;
    }
}
